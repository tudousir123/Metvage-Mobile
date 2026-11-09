"""Process adapter for synthetic-device contracts; never an App acceptance entry."""
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from device import Device
from plans import bind_plan, load_plan
from replay import replay
from runtime import AcceptanceError, Report, execute, interruptible, read_json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('command', choices=['run','replay','inspect','summary','cleanup'])
    parser.add_argument('--plan')
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--label')
    parser.add_argument('--font-scale', type=float)
    parser.add_argument('--fail-after-step', type=int)
    args = parser.parse_args()
    config = read_json(args.config)
    directory = Path(config['runRoot']) / args.run_id
    report = Report(None if args.command == 'summary' else directory, args.command)
    device = Device(config, report)
    try:
        with interruptible():
            if execute([config["adb"], "--acceptance-synthetic-adapter"]) != "synthetic-adapter-v1":
                raise AcceptanceError("Synthetic adapter handshake required")
            if args.command == 'summary':
                run = directory/'summary.json'
                cleanup = directory/'cleanup-summary.json'
                report.finish('pass', run=read_json(run) if run.exists() else None,
                              cleanup=read_json(cleanup) if cleanup.exists() else None)
                return 0
            if args.command == 'cleanup':
                device.restore(directory/'device.json')
            elif args.command == 'inspect':
                nodes, _ = device.stable()
                candidates = device.target_summary(nodes, args.label)
                report.finish('pass', count=len(candidates), candidates=candidates)
                return 0
            else:
                plan = load_plan(args.plan)
                if args.command == 'replay':
                    replay(config, device, directory, args.run_id, plan, report, args.fail_after_step)
                else:
                    plan = bind_plan(plan, config.get('variables', {}), args.run_id)
                    with device.session(directory, args.font_scale):
                        device.run_plan(plan, directory, args.run_id, args.fail_after_step)
        report.finish('pass', runtime_mode='synthetic-driver-test')
        return 0
    except KeyboardInterrupt:
        report.finish('interrupted'); return 130
    except (AcceptanceError, OSError, ValueError, KeyError) as error:
        report.finish('fail', error=str(error)); return 1


if __name__ == '__main__':
    sys.exit(main())
