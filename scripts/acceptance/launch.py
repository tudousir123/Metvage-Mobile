"""A fresh Metro bundle must identify itself from the installed test App."""
from contextlib import contextmanager
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import threading
import time
import urllib.request
import uuid

from runtime import AcceptanceError, execute, read_json, write_json


def source_fingerprint(root):
    root = Path(root)
    files = []
    for directory in ['src', 'assets', 'constants']:
        if (root / directory).exists():
            files.extend(p for p in (root / directory).rglob('*') if p.is_file())
    files.extend(root / name for name in ['package.json', 'package-lock.json', 'babel.config.js', 'metro.config.js', 'app.config.js', 'app.json', 'tamagui.config.ts', 'tsconfig.json'] if (root / name).exists())
    digest = hashlib.sha256()
    for path in sorted(files):
        digest.update(str(path.relative_to(root)).encode() + b'\0' + path.read_bytes() + b'\0')
    return digest.hexdigest()


def process_identity(pid):
    try:
        root = str(Path(f'/proc/{pid}/cwd').resolve(strict=True))
        started = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[19]
        return {'pid': int(pid), 'root': root, 'started': started}
    except (OSError, IndexError):
        raise AcceptanceError('Recorded Metro process is no longer running; launch again')


def metro_process(root, port):
    identities = []
    for line in execute(['ss', '-ltnpH']).splitlines():
        fields = line.split()
        if len(fields) > 3 and fields[3].rsplit(':', 1)[-1] == str(port):
            identities.extend(process_identity(pid) for pid in re.findall(r'pid=(\d+)', line))
    if not identities:
        return None
    if any(item['root'] != str(Path(root).resolve()) for item in identities):
        raise AcceptanceError('Metro port belongs to another worktree; no process was stopped')
    if len({item['pid'] for item in identities}) != 1:
        raise AcceptanceError('Metro port ownership is ambiguous')
    return identities[0]


def runtime_path(config):
    return Path(config['runtimeJournal'])


def verify_runtime(config, device):
    path = runtime_path(config)
    if not path.exists():
        raise AcceptanceError('No App bundle acknowledgement; run acceptance launch first')
    proof = read_json(path)
    if proof.get('source') != source_fingerprint(config['mobileRoot']):
        raise AcceptanceError('App source changed; launch a fresh verified bundle')
    if proof.get('serial') != device.serial or proof.get('package') != device.package:
        raise AcceptanceError('Runtime proof belongs to another device/App')
    actual = metro_process(config['mobileRoot'], config['metroPort'])
    if actual != proof.get('metro'):
        raise AcceptanceError('Metro process changed; launch a fresh verified bundle')
    if device.call('shell', 'pidof', device.package) != proof.get('app_pid'):
        raise AcceptanceError('App process changed; launch a fresh verified bundle')
    return {key: proof[key] for key in ['source', 'scheme', 'app_pid', 'metro_pid']}


@contextmanager
def proof_server(port, expected, package):
    accepted = threading.Event()
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            try:
                self.connection.settimeout(2)
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 2048 or self.path != '/proof':
                    raise ValueError()
                value = json.loads(self.rfile.read(size))
                valid = value == {**expected, 'package': package}
            except (ValueError, OSError):
                valid = False
            self.send_response(204 if valid else 403)
            self.end_headers()
            if valid:
                accepted.set()
        def log_message(self, *args):
            pass
    server = HTTPServer(('127.0.0.1', port), Handler)
    server.timeout = 0.5
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield accepted
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def launch(config, device, directory, report, restart=False):
    with device.session(directory):
        return _launch_owned(config, device, directory, report, restart)


def _launch_owned(config, device, directory, report, restart):
    root, port = Path(config['mobileRoot']), int(config['metroPort'])
    identity = metro_process(root, port)
    if identity:
        if not restart:
            raise AcceptanceError('Metro already running in this worktree; use launch --restart-metro')
        os.kill(identity['pid'], signal.SIGTERM)
        deadline = time.monotonic() + 10
        while metro_process(root, port):
            if time.monotonic() > deadline:
                raise AcceptanceError('Previous Metro did not stop')
            time.sleep(0.1)
    source = source_fingerprint(root)
    expected = {'nonce': uuid.uuid4().hex, 'source': source}
    proof_port = int(config.get('proofPort', 18082))
    callback = {'url': f'http://localhost:{proof_port}/proof', **expected}
    environment = {**os.environ, 'METVAGE_LOCAL_TEST': '1', 'CI': '1',
                   'EXPO_PUBLIC_METVAGE_ACCEPTANCE_PROOF': json.dumps(callback)}
    command = config.get('metroCommand') or ['node', 'node_modules/expo/bin/cli', 'start', '--dev-client', '--localhost', '--port', str(port), '--max-workers', '2', '--clear']
    process = None
    runtime_path(config).unlink(missing_ok=True)
    try:
        with proof_server(proof_port, expected, device.package) as accepted:
            scheme = device.installed_scheme()
            with (directory / 'metro.log').open('w') as log:
                process = subprocess.Popen(command, cwd=root, env=environment, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            timeout = float(config.get('launchTimeout', 90))
            deadline = time.monotonic() + timeout
            while True:
                if process.poll() is not None:
                    raise AcceptanceError('Metro exited; inspect the local metro.log')
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/status', timeout=1) as response:
                        if response.read() == b'packager-status:running':
                            break
                except OSError:
                    pass
                if time.monotonic() > deadline:
                    raise AcceptanceError('Metro did not become ready')
                time.sleep(0.1)
            # The proof listener is only needed during cold launch; journal the mapping before changing it.
            journal = read_json(directory / 'device.json')
            proof_mapping = f'tcp:{proof_port}'
            if proof_mapping not in journal['changed_ports']:
                journal['changed_ports'].append(proof_mapping)
                write_json(directory / 'device.json', journal)
            device.call('reverse', proof_mapping, proof_mapping)
            device.call('shell', 'am', 'force-stop', device.package)
            device.call('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', scheme + ':///', '-p', device.package)
            if not accepted.wait(timeout):
                raise AcceptanceError('App bundle acknowledgement missing or mismatched; no acceptance was run')
            device.wait_condition({'label': config.get('readyLabel', '搜索宠物笔记')}, timeout=timeout)
            if source_fingerprint(root) != source:
                raise AcceptanceError('App source changed during launch')
            metro = metro_process(root, port)
            proof = {'source': source, 'scheme': scheme, 'package': device.package,
                     'serial': device.serial, 'app_pid': device.call('shell', 'pidof', device.package),
                     'metro': metro, 'metro_pid': metro['pid']}
            write_json(runtime_path(config), proof)
            report.event('runtime_verified', source=source, scheme=scheme, metro_pid=metro['pid'])
        return {key: proof[key] for key in ['source', 'scheme', 'app_pid', 'metro_pid']}
    except BaseException:
        if process and process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=10)
        raise
