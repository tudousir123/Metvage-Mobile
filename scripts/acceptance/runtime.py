"""Small process/file boundaries shared by the acceptance CLI."""
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import tempfile
import time
import uuid


class AcceptanceError(Exception):
    pass


def execute(args, *, cwd=None, data=None, binary=False, timeout=30):
    process = subprocess.Popen(args, cwd=cwd, stdin=subprocess.PIPE if data is not None else None,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        output, error = process.communicate(data, timeout=timeout)
    except subprocess.TimeoutExpired as error:
        process.kill()
        process.communicate()
        raise AcceptanceError(f"{Path(args[0]).name} timed out after {timeout} seconds") from error
    except BaseException:
        process.kill()
        process.communicate()
        raise
    if process.returncode:
        # Arguments, stdout, stderr may contain credentials: never echo them.
        raise AcceptanceError(f"{Path(args[0]).name} exited {process.returncode}")
    return output if binary else output.decode().strip()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as file:
        temporary = Path(file.name)
        try:
            os.chmod(temporary, 0o600)
            json.dump(value, file, ensure_ascii=False, indent=2)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise
    os.replace(temporary, path)


def read_json(path):
    return json.loads(Path(path).read_text())


def run_directory(config, run_id):
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,48}", run_id):
        raise AcceptanceError("run-id must contain 1–48 letters, digits, underscores or hyphens")
    return Path(config["runRoot"]).expanduser().resolve() / run_id


@contextmanager
def exclusive_lock(identity):
    name = hashlib.sha256(identity.encode()).hexdigest()[:24]
    path = Path(tempfile.gettempdir()) / f"metvage-acceptance-{name}.lock"
    fd = os.open(path, os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise AcceptanceError("Resource busy: another acceptance command owns this device/account") from error
        yield
    finally:
        os.close(fd)


class Report:
    def __init__(self, directory, command):
        self.directory = directory
        self.command = command
        self.started = time.monotonic()
        self.events = []
        self.metrics = {}
        self.secrets = []
        self.invocation = uuid.uuid4().hex
        self.history = directory / "invocations" / self.invocation if directory else None

    def redact(self, value):
        text = json.dumps(value, ensure_ascii=False)
        for secret in self.secrets:
            if secret:
                text = text.replace(secret, "<REDACTED>")
        text = re.sub(r"Bearer\s+[^\s\"\\]+", "Bearer <REDACTED>", text)
        return json.loads(text)

    def event(self, action, **fields):
        self.events.append(self.redact({"action": action, **fields}))
        if self.directory:
            write_json(self.history / "events.json", self.events)

    def finish(self, status, **fields):
        result = self.redact({"status": status, "command": self.command,
                              "seconds": round(time.monotonic() - self.started, 2),
                              "invocation": self.invocation,
                              **({"metrics":self.metrics} if self.metrics else {}), **fields})
        if self.directory:
            result["artifacts"] = str(self.directory)
            write_json(self.history / "summary.json", result)
            latest = "cleanup-summary.json" if self.command == "cleanup" else "summary.json"
            write_json(self.directory / latest, result)
        print(json.dumps(result, ensure_ascii=False))


@contextmanager
def interruptible():
    def stop(signum, frame):
        raise KeyboardInterrupt(f"signal {signum}")
    previous = {sig: signal.signal(sig, stop) for sig in [signal.SIGINT, signal.SIGTERM]}
    try:
        yield
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)
