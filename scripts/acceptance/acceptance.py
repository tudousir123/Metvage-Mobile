#!/usr/bin/env python3
"""Versioned entry point; stdout is one compact JSON result per invocation."""
import argparse
import json
from pathlib import Path
import sys
import uuid

from device import Device
from doctor import diagnose
from fixtures import FixtureRun
from runtime import AcceptanceError, Report, exclusive_lock, execute, interruptible, read_json, run_directory


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=".acceptance/config.json")
    commands = parser.add_subparsers(dest="command", required=True)
    doctor = commands.add_parser("doctor")
    doctor.add_argument("--without-device", action="store_true")
    doctor.add_argument("--run-id", default="doctor-" + uuid.uuid4().hex[:12])
    status = commands.add_parser("pr-status")
    status.add_argument("--repo", required=True)
    status.add_argument("--number", required=True, type=int)
    summary = commands.add_parser("summary")
    summary.add_argument("--run-id", required=True)
    fixtures = commands.add_parser("fixtures")
    fixtures.add_argument("--run-id", required=True)
    fixtures.add_argument("--keep", action="store_true")
    run = commands.add_parser("run")
    run.add_argument("--plan", required=True)
    run.add_argument("--run-id", default="accept-" + uuid.uuid4().hex[:16])
    run.add_argument("--font-scale", type=float)
    run.add_argument("--fail-after-step", type=int)
    cleanup = commands.add_parser("cleanup")
    cleanup.add_argument("--run-id", required=True)
    args = parser.parse_args()
    report = Report(None, args.command)
    try:
        if args.command == "pr-status":
            value = json.loads(execute(["gh", "pr", "view", str(args.number), "--repo", args.repo,
                                      "--json", "url,state,headRefOid,baseRefName,autoMergeRequest,statusCheckRollup"]))
            report.finish("pass", pull_request=value)
            return 0
        config = read_json(args.config)
        config_root = Path(args.config).resolve().parent
        for key in ["mobileRoot", "serverRoot", "runRoot"]:
            if config.get(key):
                config[key] = str((config_root / Path(config[key]).expanduser()).resolve())
        for spec in config.get("fixtures", []):
            spec["image"] = str((config_root / Path(spec["image"]).expanduser()).resolve())
        directory = run_directory(config, args.run_id)
        if args.command == "summary":
            value = read_json(directory / "summary.json")
            report.finish("pass", run=value, event_count=len(read_json(directory / "events.json")))
            return 0
        report = Report(directory, args.command)
        device = Device(config, report) if args.command == "run" or (args.command == "doctor" and not args.without_device) else None
        with interruptible():
            if args.command == "doctor":
                result = diagnose(config, report, device)
                report.finish("pass", **result)
                return 0
            elif args.command == "run":
                if config.get("mobileRoot"):
                    diagnose(config, report, device)
                with device.session(directory, args.font_scale):
                    device.run_plan(read_json(args.plan), directory, args.run_id, args.fail_after_step)
            elif args.command == "fixtures":
                with exclusive_lock("account:" + config["apiOrigin"] + ":" + config["profileUsername"]):
                    fixture = FixtureRun(config, directory, args.run_id, report)
                    with fixture.authenticated():
                        try:
                            fixture.ensure()
                        except BaseException:
                            fixture.cleanup()
                            raise
                        if not args.keep:
                            fixture.cleanup()
            elif args.command == "cleanup":
                errors = []
                if (directory / "device.json").exists():
                    try:
                        device = Device(config, report)
                        with exclusive_lock("device:" + device.serial):
                            device.restore(directory / "device.json")
                    except AcceptanceError as error:
                        errors.append(str(error))
                if (directory / "fixtures.json").exists():
                    try:
                        with exclusive_lock("account:" + config["apiOrigin"] + ":" + config["profileUsername"]):
                            fixture = FixtureRun(config, directory, args.run_id, report)
                            with fixture.authenticated():
                                fixture.cleanup()
                    except AcceptanceError as error:
                        errors.append(str(error))
                if errors:
                    raise AcceptanceError("; ".join(errors))
        report.finish("pass", run_id=args.run_id)
        return 0
    except KeyboardInterrupt:
        report.finish("interrupted", error="Interrupted; inspect restoration journal before resuming")
        return 130
    except (AcceptanceError, KeyError, ValueError, OSError) as error:
        report.finish("fail", error=str(error))
        return 1


if __name__ == "__main__":
    sys.exit(main())
