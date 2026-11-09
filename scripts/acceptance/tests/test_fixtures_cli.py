from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest

CLI = Path(__file__).resolve().parents[1] / "acceptance.py"
FAKE_DOCKER = r'''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
p=Path(os.environ['FAKE_SERVER_STATE']); s=json.loads(p.read_text()); q=json.load(sys.stdin)
if q['operation']=='issue':
 s['token_active']=True; result={'token':'secret-sentinel','account_id':1}
elif q['operation']=='revoke':
 if s.get('fail_revoke'): sys.exit(1)
 s['token_active']=False; result={'revoked':True}
elif q['operation']=='owned_records': result={'ids':[int(k) for k in s['records']]}
elif q['operation']=='find_record': result={'id':next((r['id'] for r in s['records'].values() if r['client_request_id']==q['request_id']),None)}
elif q['operation']=='purge':
 for pet in q['pets']:
  current=s['pets'].get(str(pet['id']))
  if current:
   assert current['bio']==pet['marker'] or current['nickname']==pet['seed_name']
   assert not any(r['pet_id']==pet['id'] for r in s['records'].values())
   del s['pets'][str(pet['id'])]
 result={'purged':True}
else: sys.exit(1)
p.write_text(json.dumps(s)); print(json.dumps(result))
'''


class FixtureCliTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.state = self.root / "server.json"
        self.state.write_text(json.dumps({"pets": {"900": {"id": 900, "nickname": "existing", "species": "cat", "bio": None}}, "records": {}, "next": 1, "token_active": False}))
        path = self.state

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def dispatch(self):
                state = json.loads(path.read_text())
                if self.headers.get("Authorization") != "Bearer secret-sentinel":
                    self.send_error(401)
                    return
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length)
                if self.headers.get_content_type() == "multipart/form-data":
                    message = BytesParser(policy=default).parsebytes(("Content-Type: " + self.headers["Content-Type"] + "\r\n\r\n").encode() + raw)
                    body = {part.get_param("name", header="content-disposition"): part.get_payload(decode=True).decode() for part in message.iter_parts() if not part.get_filename()}
                else:
                    body = json.loads(raw) if raw else {}
                route = self.path.replace("/api/v1/metvage", "")
                status = 200
                if route == "/pets" and self.command == "GET":
                    result = {"pets": list(state["pets"].values()), "current_pet_id": 900}
                elif route == "/pets":
                    key = state["next"]; state["next"] += 1
                    state["pets"][str(key)] = {"id": key, "bio": None, **body}
                    result = {"pet": {**state["pets"][str(key)], "id": str(key)}}
                    status = 201
                elif route.startswith("/pets/"):
                    pet = state["pets"][route.rsplit("/", 1)[1]]
                    pet.update(body)
                    result = {"pet": pet}
                elif route == "/records":
                    if state.get("fail_upload"):
                        self.send_response(500); self.end_headers(); return
                    record = next((r for r in state["records"].values() if r['client_request_id']==body['client_request_id']), None)
                    if not record:
                        key = state["next"]; state["next"] += 1
                        record = {**body, "id": key, "pet_id": int(body["pet_id"]), "photos": [{"id": key}]}
                        state["records"][str(key)] = record
                        status = 201
                    result = {"record": {**record, "id": str(record["id"]), "pet_id": str(record["pet_id"])}}
                elif self.command == "DELETE":
                    state["records"].pop(route.rsplit("/", 1)[1], None)
                    result, status = None, 204
                else:
                    record = state["records"].get(route.rsplit("/", 1)[1])
                    result, status = ({"record": record}, 200) if record else (None, 404)
                path.write_text(json.dumps(state))
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                if result is not None:
                    self.wfile.write(json.dumps(result).encode())

            do_GET = do_POST = do_PATCH = do_DELETE = dispatch

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        docker = self.root / "docker"
        docker.write_text(FAKE_DOCKER); docker.chmod(0o700)
        image = self.root / "generated.png"
        image.write_bytes(b"\x89PNG\r\n\x1a\nfixture")
        self.config = self.root / "config.json"
        self.config.write_text(json.dumps({"runRoot": str(self.root / "runs"), "docker": str(docker), "serverContainer": "test-api", "testAccount": True,
                                          "profileUsername": "test-owner", "apiOrigin": f"http://127.0.0.1:{self.server.server_port}",
                                          "fixtures": [{"key": "cat", "nickname": "布丁", "species": "cat", "image": str(image), "generated": True}]}))
        self.env = {**os.environ, "FAKE_SERVER_STATE": str(self.state)}

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        self.temp.cleanup()

    def command(self, *args):
        return subprocess.run([sys.executable, str(CLI), "--config", str(self.config), *args], env=self.env, capture_output=True, text=True, timeout=15)

    def test_rerun_reuses_ids_and_cleanup_handles_204_without_deleting_existing_data(self):
        for _ in range(2):
            result = self.command("fixtures", "--run-id", "repeatable", "--keep")
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertNotIn("secret-sentinel", result.stdout)
            state = json.loads(self.state.read_text())
            self.assertEqual(len(state["pets"]), 2)
            self.assertEqual(len(state["records"]), 1)
            self.assertFalse(state["token_active"])
        for _ in range(2):
            result = self.command("cleanup", "--run-id", "repeatable")
            self.assertEqual(result.returncode, 0, result.stdout)
        state = json.loads(self.state.read_text())
        self.assertEqual(list(state["pets"]), ["900"])
        self.assertEqual(state["records"], {})
        self.assertFalse(state["token_active"])
        for file in (self.root / "runs").rglob("*.json"):
            self.assertNotIn("secret-sentinel", file.read_text())

    def test_upload_failure_cleans_created_pets_and_revokes_the_token(self):
        state = json.loads(self.state.read_text())
        state["fail_upload"] = True
        self.state.write_text(json.dumps(state))
        result = self.command("fixtures", "--run-id", "failed-upload", "--keep")
        self.assertEqual(result.returncode, 1)
        state = json.loads(self.state.read_text())
        self.assertEqual(list(state["pets"]), ["900"])
        self.assertEqual(state["records"], {})
        self.assertFalse(state["token_active"])

    def test_failed_token_revocation_is_journaled_and_retried(self):
        state = json.loads(self.state.read_text())
        state["fail_revoke"] = True
        self.state.write_text(json.dumps(state))
        result = self.command("fixtures", "--run-id", "token-retry", "--keep")
        self.assertEqual(result.returncode, 1)
        journal = self.root / "runs/token-retry/fixtures.json"
        self.assertTrue(json.loads(journal.read_text())["token_cleanup_pending"])
        state = json.loads(self.state.read_text()); state["fail_revoke"] = False
        self.state.write_text(json.dumps(state))
        result = self.command("cleanup", "--run-id", "token-retry")
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertFalse(json.loads(journal.read_text())["token_cleanup_pending"])
        self.assertFalse(json.loads(self.state.read_text())["token_active"])


if __name__ == "__main__":
    unittest.main()
