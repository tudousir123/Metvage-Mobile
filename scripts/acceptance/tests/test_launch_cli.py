"""Launch contracts use real child processes/HTTP and a fake installed Android app."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest

from test_device_cli import FAKE_ADB

CLI = Path(__file__).resolve().parents[1] / 'acceptance.py'
METRO = '''import json,os
from pathlib import Path
from http.server import BaseHTTPRequestHandler,HTTPServer
state=Path(os.environ['FAKE_ADB_STATE']);s=json.loads(state.read_text())
s['runtime']=json.loads(os.environ['EXPO_PUBLIC_METVAGE_ACCEPTANCE_PROOF'])
if s.get('stale'):s['runtime']['source']='old-bundle'
state.write_text(json.dumps(s))
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  self.send_response(200);self.end_headers();self.wfile.write(b'packager-status:running')
 def log_message(self,*args):pass
HTTPServer(('127.0.0.1',int(os.environ['FAKE_METRO_PORT'])),Handler).serve_forever()
'''


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class LaunchCliTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for path in ['src', 'node_modules/expo-router', '.acceptance']:
            (self.root / path).mkdir(parents=True)
        (self.root / 'src/app.ts').write_text('export const version=1')
        (self.root / 'node_modules/expo-router/entry.js').write_text('')
        for args in [['init', '--initial-branch=codex/test'], ['remote', 'add', 'origin', 'https://github.com/tudousir123/Metvage-Mobile.git'], ['-c','user.name=Test','-c','user.email=test@example.test','commit','--allow-empty','-m','fixture']]:
            subprocess.run(['git', *args], cwd=self.root, capture_output=True, check=True)
        self.state = self.root / 'adb.json'
        self.initial = {'settings': {'system.font_scale': '1.45', 'global.stay_on_while_plugged_in': '2'}, 'reverse': {}, 'focus': 'com.metvage.acceptance.phone', 'pid': '4242'}
        self.state.write_text(json.dumps(self.initial))
        adb = self.root / 'adb'
        source = FAKE_ADB.replace("elif a[:3]==['shell','am','start']:", "elif a[:3]==['shell','am','force-stop']: pass\nelif a[:3]==['shell','am','start']:")
        source = source.replace("elif a[:2]==['shell','getprop']:", '''elif a[:3]==['shell','dumpsys','package']: print('Scheme: "nativefixture"\\nScheme: "com.metvage.acceptance.phone"')
elif a[:2]==['shell','pidof']: print(s['pid'])
elif a[:2]==['shell','getprop']:''')
        source = source.replace(" s['focus']='com.metvage.acceptance.phone';save()", ''' s['focus']='com.metvage.acceptance.phone';save()
 if '-d' in a:
  url=a[a.index('-d')+1];s['opened_url']=url;save()
  if not url.startswith('nativefixture:///'):sys.exit(2)
  import urllib.request
  proof=s['runtime'];payload={k:proof[k] for k in ['nonce','source']};payload['package']='com.metvage.acceptance.phone'
  try:urllib.request.urlopen(urllib.request.Request(proof['url'],data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'}),timeout=2).read()
  except Exception:pass''')
        adb.write_text(source); adb.chmod(0o700)
        metro = self.root / 'metro.py';metro.write_text(METRO)
        self.metro_port, self.proof_port = free_port(), free_port()
        self.config = self.root / '.acceptance/config.json'
        self.config.write_text(json.dumps({'adb':str(adb), 'serial':'phone', 'package':'com.metvage.acceptance.phone', 'mobileRoot':str(self.root), 'expectedBranch':'codex/test', 'runRoot':str(self.root/'runs'), 'metroPort':self.metro_port, 'proofPort':self.proof_port, 'launchTimeout':2, 'metroCommand':[sys.executable,str(metro)], 'readyLabel':'ready'}))
        self.env = {**os.environ, 'FAKE_ADB_STATE':str(self.state), 'FAKE_METRO_PORT':str(self.metro_port)}

    def tearDown(self):
        proof=self.root/'.acceptance/runtime.json'
        if proof.exists():
            value=json.loads(proof.read_text())
            try:os.kill(value['metro_pid'],15)
            except ProcessLookupError:pass
        self.temp.cleanup()

    def cli(self,*args):
        return subprocess.run([sys.executable,str(CLI),'--config',str(self.config),*args],env=self.env,capture_output=True,text=True,timeout=20)

    def test_installed_scheme_and_matching_app_acknowledgement_unlock_run(self):
        result=self.cli('launch','--run-id','launch')
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        proof=json.loads((self.root/'.acceptance/runtime.json').read_text())
        self.assertEqual(proof['scheme'],'nativefixture')
        self.assertTrue(json.loads(self.state.read_text())['opened_url'].startswith('nativefixture:///'))
        plan=self.root/'plan.json';plan.write_text('{"steps":[{"action":"assert","label":"ready"}]}')
        result=self.cli('run','--run-id','verified','--plan',str(plan))
        self.assertEqual(result.returncode,0,result.stdout)

    def test_old_bundle_acknowledgement_cannot_unlock_capture(self):
        self.state.write_text(json.dumps({**self.initial,'stale':True}))
        result=self.cli('launch','--run-id','stale')
        self.assertEqual(result.returncode,1,result.stdout+result.stderr)
        self.assertIn('acknowledgement',result.stdout)
        self.assertFalse((self.root/'.acceptance/runtime.json').exists())
        self.assertEqual(json.loads(self.state.read_text())['reverse'],{})

    def test_source_edits_invalidate_previous_proof(self):
        result=self.cli('launch','--run-id','launch')
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        (self.root/'src/app.ts').write_text('export const version=2')
        plan=self.root/'plan.json';plan.write_text('{"steps":[]}')
        result=self.cli('run','--run-id','changed','--plan',str(plan))
        self.assertEqual(result.returncode,1)
        self.assertIn('source changed',result.stdout)

    def test_app_restart_invalidates_previous_proof(self):
        result=self.cli('launch','--run-id','launch')
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        state=json.loads(self.state.read_text());state['pid']='4243';self.state.write_text(json.dumps(state))
        plan=self.root/'plan.json';plan.write_text('{"steps":[]}')
        result=self.cli('run','--run-id','restarted','--plan',str(plan))
        self.assertEqual(result.returncode,1)
        self.assertIn('App process changed',result.stdout)


if __name__=='__main__':unittest.main()
