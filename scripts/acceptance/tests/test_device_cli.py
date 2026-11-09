import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest


CLI = Path(__file__).resolve().parents[1] / "acceptance.py"
FAKE_ADB = r'''#!/usr/bin/env python3
import base64,json,os,sys,time
from pathlib import Path
p=Path(os.environ['FAKE_ADB_STATE']); s=json.loads(p.read_text()); a=sys.argv[1:]
if a[:1]==['-s']: a=a[2:]
def save(): p.write_text(json.dumps(s))
if a==['devices','-l']: print('List of devices attached\nphone device model:TestPhone'); sys.exit()
if not s.get('connected',True): print('device offline',file=sys.stderr); sys.exit(1)
if a[:2]==['shell','settings']:
 k=a[3]+'.'+a[4]
 if a[2]=='get': print(s['settings'][k])
 else: s['settings'][k]=a[5];save()
elif a==['reverse','--list']:
 for k,v in s['reverse'].items(): print('phone '+k+' '+v)
elif a[:1]==['reverse']:
 if a[1]=='--remove': s['reverse'].pop(a[2],None)
 else: s['reverse'][a[1]]=a[2]
 save()
elif a[:3]==['shell','wm','size']: print('Physical size: 1440x3200')
elif a[:3]==['shell','wm','density']: print('Physical density: 560')
elif a[:3]==['shell','pm','path']: print('package:/data/app/test.apk')
elif a[:2]==['shell','getprop']: print('TestPhone')
elif a[:3]==['shell','am','start']:
 s['focus']='com.metvage.acceptance.phone';save()
elif a==['shell','dumpsys','window']:
 print('mCurrentFocus=Window{a u0 '+s['focus']+'/MainActivity}')
 print('mDreamingLockscreen='+str(s.get('locked',False)).lower())
elif a[:3]==['shell','uiautomator','dump']:
 s.setdefault('xml_files',[]).append(a[3]);save()
 time.sleep(s.get('delay',0)); print('UI hierarchy dumped')
elif a[:2]==['shell','cat']:
 package=s['focus']; label='ready' if package=='com.metvage.acceptance.phone' else 'private'
 print('<hierarchy><node package="'+package+'" text="'+label+'" bounds="[0,0][1440,3200]" enabled="true" clickable="true"/></hierarchy>')
elif a==['exec-out','screencap','-p']:
 if s.get('lose_focus_on_capture'): s['focus']='other.app';save()
 sys.stdout.buffer.write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKb8AAAAASUVORK5CYII='))
elif a[:2]==['shell','rm']:
 s['xml_files']=[p for p in s.get('xml_files',[]) if p!=a[-1]];save()
elif a[:2]==['shell','input']:
 if s.get('disconnect_on_input'): s['connected']=False;save()
else: print('Unsupported fake adb operation: '+str(a),file=sys.stderr); sys.exit(2)
'''


class DeviceCliTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.state = self.root / "device.json"
        self.initial = {
            "settings": {"system.font_scale": "1.45", "global.stay_on_while_plugged_in": "2"},
            "reverse": {"tcp:8081": "tcp:9000", "tcp:7777": "tcp:7777"},
            "focus": "com.metvage.acceptance.phone",
        }
        self.state.write_text(json.dumps(self.initial))
        adb = self.root / "adb"
        adb.write_text(FAKE_ADB)
        adb.chmod(0o700)
        self.config = self.root / "config.json"
        self.config.write_text(json.dumps({
            "adb": str(adb), "serial": "phone", "package": "com.metvage.acceptance.phone",
            "runRoot": str(self.root / "runs"), "reversePorts": {"8081": 8081, "18080": 18080},
        }))
        self.plan = self.root / "plan.json"
        self.plan.write_text(json.dumps({"steps": [{"action": "assert", "label": "ready"}]}))
        self.env = {**os.environ, "FAKE_ADB_STATE": str(self.state)}

    def tearDown(self):
        self.temp.cleanup()

    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(CLI), "--config", str(self.config), *args],
                              env=self.env, capture_output=True, text=True, timeout=15)

    def test_failed_plan_restores_settings_and_prior_port_mappings(self):
        result = self.run_cli("run", "--plan", str(self.plan), "--run-id", "failure",
                              "--font-scale", "1.3", "--fail-after-step", "1")
        self.assertEqual(result.returncode, 1)
        summary = json.loads(result.stdout)
        self.assertEqual(summary["status"], "fail")
        current = json.loads(self.state.read_text())
        self.assertEqual(current["settings"], self.initial["settings"])
        self.assertEqual(current["reverse"], self.initial["reverse"])
        journal = json.loads((self.root / "runs/failure/device.json").read_text())
        self.assertFalse(journal["restoration_pending"])
        self.assertEqual(self.run_cli("cleanup", "--run-id", "failure").returncode, 0)
        history = json.loads(self.run_cli("summary", "--run-id", "failure").stdout)
        self.assertEqual(history["run"]["status"], "fail")
        self.assertEqual(history["cleanup"]["status"], "pass")

    def test_resumed_cleanup_removes_the_prior_process_xml(self):
        run = self.root / "runs/recovered"
        run.mkdir(parents=True)
        old_path = "/sdcard/metvage-acceptance-424242.xml"
        self.state.write_text(json.dumps({**self.initial, "xml_files": [old_path]}))
        (run / "device.json").write_text(json.dumps({"serial": "phone", "package": "com.metvage.acceptance.phone",
            "font": "1.45", "awake": "2", "reverse": {}, "changed_ports": [], "restoration_pending": True, "xml_path": old_path}))
        result = self.run_cli("cleanup", "--run-id", "recovered")
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertEqual(json.loads(self.state.read_text())["xml_files"], [])
        result = self.run_cli("summary", "--run-id", "recovered")
        self.assertEqual(result.returncode, 0, result.stdout)
        summary = json.loads(result.stdout)
        self.assertIsNone(summary["run"])
        self.assertEqual(summary["cleanup"]["status"], "pass")

    def test_focus_loss_during_capture_never_publishes_the_image(self):
        state = {**self.initial, "lose_focus_on_capture": True}
        self.state.write_text(json.dumps(state))
        self.plan.write_text(json.dumps({"steps": [{"action": "capture", "name": "proof"}]}))
        result = self.run_cli("run", "--plan", str(self.plan), "--run-id", "focus")
        self.assertEqual(result.returncode, 1)
        self.assertIn("Foreground changed", json.loads(result.stdout)["error"])
        self.assertFalse(list((self.root / "runs/focus").glob("*.png")))
        self.assertFalse(list((self.root / "runs/focus").glob("*.pending")))
        self.assertEqual(json.loads(self.state.read_text())["settings"], self.initial["settings"])

    def test_device_is_exclusively_owned_and_sigterm_restores_settings(self):
        self.state.write_text(json.dumps({**self.initial, "delay": 2}))
        child = subprocess.Popen([sys.executable, str(CLI), "--config", str(self.config),
                                  "run", "--plan", str(self.plan), "--run-id", "signal"],
                                 env=self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            deadline = time.monotonic() + 5
            while not (self.root / "runs/signal/device.json").exists():
                self.assertLess(time.monotonic(), deadline)
                time.sleep(0.01)
            other = self.run_cli("run", "--plan", str(self.plan), "--run-id", "second")
            self.assertEqual(other.returncode, 1)
            self.assertIn("Resource busy", json.loads(other.stdout)["error"])
            child.terminate()
            output, _ = child.communicate(timeout=10)
            self.assertEqual(child.returncode, 130)
            self.assertEqual(json.loads(output)["status"], "interrupted")
            self.assertEqual(json.loads(self.state.read_text())["settings"], self.initial["settings"])
        finally:
            if child.poll() is None:
                child.kill()
                child.communicate()

    def test_disconnect_keeps_a_recoverable_journal(self):
        self.state.write_text(json.dumps({**self.initial, "disconnect_on_input": True}))
        self.plan.write_text(json.dumps({"steps": [{"action": "back"}]}))
        result = self.run_cli("run", "--plan", str(self.plan), "--run-id", "offline", "--font-scale", "1.3")
        self.assertEqual(result.returncode, 1)
        journal = self.root / "runs/offline/device.json"
        self.assertTrue(json.loads(journal.read_text())["restoration_pending"])
        state = json.loads(self.state.read_text())
        state["connected"] = True
        self.state.write_text(json.dumps(state))
        result = self.run_cli("cleanup", "--run-id", "offline")
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertFalse(json.loads(journal.read_text())["restoration_pending"])
        self.assertEqual(json.loads(self.state.read_text())["settings"], self.initial["settings"])


if __name__ == "__main__":
    unittest.main()
