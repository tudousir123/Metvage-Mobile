"""The persisted-photo oracle must distinguish pending saves from retained photos."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts' / 'acceptance'))
from fixtures import FixtureRun
from photo_probe import app_fixture_session, observe_saved_record
from runtime import AcceptanceError, Report


class PhotoOracleTests(unittest.TestCase):
    def setUp(self):
        self.frames = []
        self.calls = 0
        self.username = 'contract'
        owner = self
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == '/api/v1/accounts/verify_credentials':
                    raw = json.dumps({'username': owner.username}).encode()
                    self.send_response(200)
                    self.send_header('Content-Length', str(len(raw)))
                    self.end_headers()
                    self.wfile.write(raw)
                    return
                if self.path != '/api/v1/metvage/records/1':
                    self.send_error(404)
                    return
                frame = owner.frames[min(owner.calls, len(owner.frames) - 1)]
                owner.calls += 1
                raw = json.dumps({'record': frame}).encode()
                self.send_response(200)
                self.send_header('Content-Length', str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
            def log_message(self, *args):
                pass
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.temporary = tempfile.TemporaryDirectory()
        self.fixture = FixtureRun({'testAccount': True, 'profileUsername': 'contract',
                                   'apiOrigin': f'http://127.0.0.1:{self.server.server_port}'},
                                  Path(self.temporary.name), 'contract', Report(None, 'contract'))
        self.fixture.token = 'synthetic-contract-value'
        self.expected = {'text': 'edited', 'title': 'edited title', 'pet_id': 2}

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temporary.cleanup()

    def observe(self):
        return observe_saved_record(lambda: self.fixture.request('GET', '/records/1')['record'],
                                    self.expected, timeout=.05, interval=.005)

    def test_pending_old_record_then_completed_save_is_green(self):
        self.frames = [{'id': 1, 'text': 'old', 'title': 'old', 'pet_id': 1, 'photos': [{'id': 9}]},
                       {'id': 1, **self.expected, 'photos': []}]
        self.assertEqual(self.observe()[0], 'removed')
        self.assertGreaterEqual(self.calls, 2)

    def test_completed_other_changes_with_retained_photo_is_red(self):
        self.frames = [{'id': 1, **self.expected, 'photos': [{'id': 9}]}]
        self.assertEqual(self.observe()[0], 'retained')
        self.assertGreater(self.calls, 1)

    def test_no_photos_without_confirmed_edits_is_inconclusive(self):
        self.frames = [{'id': 1, 'text': 'old', 'title': 'old', 'pet_id': 1, 'photos': []}]
        self.assertEqual(self.observe()[0], 'save-unconfirmed')

    def app_device(self):
        class SyntheticAppDevice:
            serial = 'emulator-9998'
            package = 'com.metvage.contract'
            def call(self, *args, **kwargs):
                return b'eyJzeW50aGV0aWM.e30.c2lnbmF0dXJl'
        return SyntheticAppDevice()

    def test_borrowed_app_token_cleared_when_cleanup_is_interrupted(self):
        with self.assertRaisesRegex(RuntimeError, 'interruption'):
            with app_fixture_session(self.fixture, self.app_device()):
                self.assertIsNotNone(self.fixture.token)
                raise RuntimeError('interruption')
        self.assertIsNone(self.fixture.token)

    def test_app_identity_mismatch_rejected_before_cleanup(self):
        self.username = 'different-account'
        with self.assertRaisesRegex(AcceptanceError, 'identity differs'):
            with app_fixture_session(self.fixture, self.app_device()):
                self.fail('An unrelated App account must not reach fixture cleanup')
        self.assertIsNone(self.fixture.token)


class ProbeGuardTests(unittest.TestCase):
    def reject_before_device_or_network(self, serial, iterations, message):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'config.json'
            path.write_text(json.dumps({'serial': serial, 'package': 'com.metvage.acceptance',
                                        'mobileRoot': str(ROOT), 'runRoot': folder,
                                        'testAccount': True, 'apiOrigin': 'http://127.0.0.1:1'}))
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/acceptance/acceptance.py'),
                                     '--config', str(path), 'probe-photo-edit', '--run-id', 'guard',
                                     '--iterations', str(iterations)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertIn(message, json.loads(result.stdout)['error'])

    def test_physical_device_rejected_before_adb_or_api(self):
        self.reject_before_device_or_network('physical-contract-device', 1, 'only permits an Android emulator')

    def test_invalid_iterations_rejected_before_adb_or_api(self):
        self.reject_before_device_or_network('emulator-9998', 0, 'iterations must be between')

    def test_app_recovery_rejects_physical_device_before_reading_storage(self):
        class PhysicalDevice:
            serial = 'physical-contract-device'
            def call(self, *args, **kwargs):
                raise AssertionError('Physical storage must not be read')
        with self.assertRaisesRegex(AcceptanceError, 'only permits an Android emulator'):
            with app_fixture_session(None, PhysicalDevice()):
                self.fail('Physical device must be rejected')


if __name__ == '__main__':
    unittest.main()
