#!/usr/bin/env python3
"""Versioned entry point; stdout is one compact JSON result per invocation."""
import argparse
import json
import re
from pathlib import Path
import sys
import uuid

from device import Device
from plans import bind_plan, load_plan
from launch import launch, verify_runtime
from replay import replay, verify_api
from doctor import diagnose
from fixtures import FixtureRun
from runtime import AcceptanceError, Report, exclusive_lock, execute, interruptible, read_json, run_directory
from photo_probe import app_fixture_session, cleanup_app_fixtures, probe_photos, validate_probe_config


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=".acceptance/config.json")
    commands = parser.add_subparsers(dest="command", required=True)
    doctor = commands.add_parser("doctor")
    doctor.add_argument("--without-device", action="store_true")
    doctor.add_argument("--run-id", default="doctor-" + uuid.uuid4().hex[:12])
    discovery = commands.add_parser('discover')
    discovery.add_argument('--match', default='AGENTS|DEVELOPMENT|local-acceptance|typechecking|acceptance/plans')
    discovery.add_argument('--device', action='store_true')
    discovery.add_argument('--run-id', default='discover-' + uuid.uuid4().hex[:12])
    inspect = commands.add_parser('inspect')
    inspect.add_argument('--label', required=True)
    inspect.add_argument('--run-id', default='inspect-' + uuid.uuid4().hex[:12])
    launcher = commands.add_parser("launch")
    launcher.add_argument("--run-id", default="launch-" + uuid.uuid4().hex[:12])
    launcher.add_argument("--restart-metro", action="store_true")
    status = commands.add_parser("pr-status")
    status.add_argument("--repo", required=True)
    status.add_argument("--number", required=True, type=int)
    summary = commands.add_parser("summary")
    summary.add_argument("--run-id", required=True)
    fixtures = commands.add_parser("fixtures")
    fixtures.add_argument("--run-id", required=True)
    fixtures.add_argument("--keep", action="store_true")
    replay_parser = commands.add_parser('replay')
    replay_parser.add_argument('--plan', required=True)
    replay_parser.add_argument('--run-id', required=True)
    replay_parser.add_argument('--fail-after-step', type=int)
    api = commands.add_parser('verify-api')
    api.add_argument('--run-id', default='api-' + uuid.uuid4().hex[:12])
    run = commands.add_parser("run")
    run.add_argument("--plan", required=True)
    run.add_argument("--run-id", default="accept-" + uuid.uuid4().hex[:16])
    run.add_argument("--font-scale", type=float)
    run.add_argument("--fail-after-step", type=int)
    probe = commands.add_parser('probe-photo-edit')
    probe.add_argument('--run-id', required=True)
    probe.add_argument('--iterations', type=int, default=1)
    probe.add_argument('--font-scale', type=float, default=1.45)
    probe.add_argument('--negative-control', action='store_true')
    cleanup = commands.add_parser("cleanup")
    cleanup.add_argument("--run-id", required=True)
    args = parser.parse_args()
    report = Report(None, args.command)
    try:
        if args.command == "pr-status":
            value = json.loads(execute(["gh", "pr", "view", str(args.number), "--repo", args.repo,
                                      "--json", "url,state,headRefOid,baseRefName,autoMergeRequest,statusCheckRollup"]))
            report.finish("pass", pull_request={
                'url':value['url'], 'state':value['state'], 'head':value['headRefOid'], 'base':value['baseRefName'],
                'auto_merge':bool(value['autoMergeRequest']),
                'checks':[{'name':check.get('name',check.get('context')), 'state':check.get('conclusion') or check.get('status') or check.get('state'), 'url':check.get('detailsUrl') or check.get('targetUrl')} for check in value.get('statusCheckRollup',[])]})
            return 0
        config = read_json(args.config)
        config_root = Path(args.config).resolve().parent
        for key in ["mobileRoot", "serverRoot", "runRoot"]:
            if config.get(key):
                config[key] = str((config_root / Path(config[key]).expanduser()).resolve())
        config["runtimeJournal"] = str(config_root / "runtime.json")
        for spec in config.get("fixtures", []):
            spec["image"] = str((config_root / Path(spec["image"]).expanduser()).resolve())
        directory = run_directory(config, args.run_id)
        if args.command == "summary":
            primary = directory / "summary.json"
            value = read_json(primary) if primary.exists() else None
            cleanup = directory / "cleanup-summary.json"
            event_files = list(directory.glob("invocations/*/events.json"))
            legacy = directory / "events.json"
            if legacy.exists():
                event_files.append(legacy)
            report.finish("pass", run=value,
                          cleanup=read_json(cleanup) if cleanup.exists() else None,
                          event_count=sum(len(read_json(path)) for path in event_files),
                          invocation_count=len(list(directory.glob("invocations/*/summary.json"))))
            return 0
        plan = load_plan(args.plan) if args.command in {"run", "replay"} else None
        report = Report(directory, args.command)
        if args.command in {'run','replay'} and not config.get('mobileRoot'):
            raise AcceptanceError('mobileRoot is required for App acceptance; synthetic drivers use the tests harness')
        if args.command == 'run':
            plan = bind_plan(plan, config.get('variables', {}), args.run_id)
        device = Device(config, report) if args.command in {"run", "launch", "inspect", "replay", "probe-photo-edit"} or (args.command == "doctor" and not args.without_device) else None
        with interruptible():
            if args.command == 'discover':
                from doctor import git_identity
                identity = git_identity(config['mobileRoot'])
                paths = execute(['git','ls-files'],cwd=config['mobileRoot']).splitlines()
                pattern = re.compile(args.match)
                files = [path for path in paths if pattern.search(path)]
                result = {'mobile':identity, 'files':files[:50], 'remaining_files':max(0,len(files)-50)}
                if args.device:
                    discovered = Device(config, report)
                    discovered.preflight()
                    result['installed_scheme'] = discovered.installed_scheme()
                report.finish('pass', **result)
                return 0
            elif args.command == 'inspect':
                with exclusive_lock("device:" + device.serial):
                    device.preflight()
                    nodes, _ = device.stable()
                    targets = device.target_summary(nodes, args.label)
                    report.finish('pass', count=len(targets), candidates=targets, adb_calls=device.adb_calls, ui_reads=device.ui_reads)
                return 0
            elif args.command == "launch":
                diagnose({**config, "metroPort": None}, report, device)
                result = launch(config, device, directory, report, args.restart_metro)
                report.finish("pass", runtime=result)
                return 0
            elif args.command == "doctor":
                result = diagnose(config, report, device)
                report.finish("pass", **result)
                return 0
            elif args.command == "run":
                report.event("plan", sources=plan["_sources"])
                if config.get("mobileRoot"):
                    diagnose(config, report, device)
                    report.event("runtime", **verify_runtime(config, device))
                with device.session(directory, args.font_scale):
                    device.run_plan(plan, directory, args.run_id, args.fail_after_step)
                if config.get("mobileRoot"):
                    verify_runtime(config, device)
            elif args.command == 'probe-photo-edit':
                validate_probe_config(config, args.iterations)
                diagnose(config, report, device)
                probe_photos(config, device, directory, args.run_id, report,
                             args.iterations, args.font_scale, args.negative_control)
            elif args.command == 'replay':
                if config.get('mobileRoot'):
                    diagnose(config, report, device)
                    report.event('runtime', **verify_runtime(config, device))
                replay(config, device, directory, args.run_id, plan, report, args.fail_after_step)
                if config.get("mobileRoot"):
                    verify_runtime(config, device)
            elif args.command == 'verify-api':
                verify_api(config, directory, args.run_id, report)
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
                            if fixture.state.get('authentication') == 'app-oauth':
                                device = Device(config, report)
                                with exclusive_lock('device:' + device.serial), app_fixture_session(fixture, device):
                                    cleanup_app_fixtures(fixture)
                            else:
                                with fixture.authenticated():
                                    fixture.cleanup()
                    except AcceptanceError as error:
                        errors.append(str(error))
                peer_path = directory / 'peer' / 'fixtures.json'
                if peer_path.exists():
                    try:
                        peer_state = read_json(peer_path)
                        if peer_state['profile_username'] != config.get('peerProfileUsername'):
                            raise AcceptanceError('Peer token journal does not match configured test account')
                        peer_config = {**config, 'profileUsername':config['peerProfileUsername']}
                        peer = FixtureRun(peer_config, directory / 'peer', peer_state['run_id'], report)
                        peer.admin('revoke')
                        peer.state['token_cleanup_pending'] = False
                        peer.save()
                    except AcceptanceError as error:
                        errors.append(str(error))
                if errors:
                    raise AcceptanceError("; ".join(errors))
        report.finish("pass", run_id=args.run_id, **({"runtime_mode":"verified"} if args.command in {"run","replay","probe-photo-edit"} else {}))
        return 0
    except KeyboardInterrupt:
        report.finish("interrupted", error="Interrupted; inspect restoration journal before resuming")
        return 130
    except (AcceptanceError, KeyError, ValueError, OSError) as error:
        report.finish("fail", error=str(error))
        return 1


if __name__ == "__main__":
    sys.exit(main())
