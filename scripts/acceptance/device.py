"""Serial device operations with durable restoration and guarded screenshots."""
from contextlib import contextmanager
import hashlib
import os
from pathlib import Path
import re
import shlex
import time
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

from runtime import AcceptanceError, execute, exclusive_lock, read_json, write_json


class Device:
    def __init__(self, config, report):
        self.config = config
        self.report = report
        self.serial = config["serial"]
        self.package = config["package"]
        if not re.fullmatch(r"[a-zA-Z0-9_.:-]+", self.serial) or not re.fullmatch(r"[a-zA-Z0-9_.]+", self.package):
            raise AcceptanceError("Invalid device serial or package")
        self.adb = config.get("adb", "adb")
        self.adb_calls = 0
        self.adb_seconds = 0.0
        self.ui_reads = 0
        self.parents = {}
        self.xml_path = f"/sdcard/metvage-acceptance-{os.getpid()}.xml"

    def call(self, *args, **kwargs):
        started = time.monotonic()
        self.adb_calls += 1
        try:
            return execute([self.adb, "-s", self.serial, *args], **kwargs)
        finally:
            self.adb_seconds += time.monotonic() - started
            self.report.metrics.update(adb_calls=self.adb_calls, adb_seconds=round(self.adb_seconds,3), ui_reads=self.ui_reads)

    def preflight(self):
        devices = execute([self.adb, "devices", "-l"])
        matches = [line.split() for line in devices.splitlines() if line.startswith(self.serial + "\t") or line.startswith(self.serial + " ")]
        if len(matches) != 1 or matches[0][1] != "device":
            raise AcceptanceError("Device unavailable: check USB connection, debugging authorization and host USB permissions")
        if not self.call("shell", "pm", "path", self.package).startswith("package:"):
            raise AcceptanceError("Configured test app is not installed")
        window = self.call("shell", "dumpsys", "window")
        if re.search(r"(?:mDreamingLockscreen|mShowingLockscreen)=true", window):
            raise AcceptanceError("Device locked: unlock the existing test app session")
        return {"serial": self.serial, "model": self.call("shell", "getprop", "ro.product.model")}

    def foreground(self):
        deadline = time.monotonic() + 2
        while True:
            window = self.call('shell', 'dumpsys', 'window')
            if re.search(r'(?:mDreamingLockscreen|mShowingLockscreen)=true', window):
                raise AcceptanceError('Device became locked')
            focus = re.search(r'mCurrentFocus=.*?\bu\d+\s+([^\s/]+)/', window)
            if focus:
                if focus.group(1) != self.package:
                    raise AcceptanceError('Foreground changed: device operation stopped before reading/capturing another app')
                return window
            if time.monotonic() >= deadline:
                raise AcceptanceError('Test App focus unavailable; no UI was read')
            # Window transitions can briefly have no focused window. Only metadata
            # is polled here; a real different package always stops immediately.
            time.sleep(0.05)

    def tree(self):
        self.foreground()
        self.call("shell", "uiautomator", "dump", self.xml_path)
        try:
            raw = self.call("shell", "cat", self.xml_path)
        finally:
            self.call("shell", "rm", "-f", self.xml_path)
        self.foreground()
        root = ET.fromstring(raw)
        self.ui_reads += 1
        self.report.metrics["ui_reads"] = self.ui_reads
        self.parents = {child: parent for parent in root.iter() for child in parent}
        nodes = [node for node in root.iter("node") if node.get("package") == self.package]
        meaningful = [node for node in nodes if (node.get("text") or node.get("content-desc")) not in [None, "", "Notifications (F8)"]]
        if not meaningful:
            raise AcceptanceError("Test app has no stable visible content")
        state = [(n.get("class"), n.get("text"), n.get("content-desc"), n.get("bounds"), n.get("enabled"), n.get("clickable")) for n in meaningful]
        return nodes, hashlib.sha256(repr(state).encode()).hexdigest()

    def stable(self, timeout=15):
        deadline = time.monotonic() + timeout
        nodes, fingerprint = self.tree()
        while time.monotonic() < deadline:
            current, observed = self.tree()
            if observed == fingerprint:
                return current, observed
            nodes, fingerprint = current, observed
        raise AcceptanceError("Test app layout did not settle before timeout")

    def wait_label(self, label, timeout=15):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            nodes, _ = self.tree()
            found = [n for n in nodes if label in [n.get("text"), n.get("content-desc"), n.get("resource-id")]]
            if found:
                return found
            time.sleep(0.05)
        raise AcceptanceError(f"Expected test control not visible: {label}")

    def targets(self, nodes, label):
        matches = []
        for attribute in ['content-desc', 'resource-id', 'text']:
            matches.extend(node for node in nodes if node.get(attribute) == label and node not in matches)
        unique = []
        for node in matches:
            target = node
            while target.get('clickable') != 'true' and target in self.parents:
                parent = self.parents[target]
                if parent.get('package') != self.package:
                    break
                target = parent
            if target.get('clickable') != 'true':
                target = node
            if target not in unique:
                unique.append(target)
        return unique

    def target_summary(self, nodes, label):
        return [{'class': n.get('class'), 'bounds': n.get('bounds'),
                 'clickable': n.get('clickable') == 'true', 'enabled': n.get('enabled') != 'false'}
                for n in self.targets(nodes, label)]

    def tap(self, label, index=None, timeout=15):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            nodes, state = self.tree()
            if not self.targets(nodes, label):
                continue
            current, observed = self.tree()
            if observed != state:
                continue
            matches = self.targets(current, label)
            if len(matches) > 1 and index is None:
                raise AcceptanceError(f'Target has {len(matches)} clickable candidates; specify index')
            chosen = index if index is not None else 0
            if chosen >= len(matches):
                raise AcceptanceError(f'Target index out of range ({len(matches)} candidates)')
            node = matches[chosen]
            bounds = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
            if len(bounds) != 4 or bounds[2] <= bounds[0] or bounds[3] <= bounds[1] or node.get('enabled') == 'false':
                raise AcceptanceError('Tap target is disabled or outside the visible layout')
            self.call('shell', 'input', 'tap', str((bounds[0] + bounds[2]) // 2), str((bounds[1] + bounds[3]) // 2))
            return
        raise AcceptanceError('Tap target not visible before timeout')

    def wait_condition(self, condition, timeout=15):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            nodes, _ = self.tree()
            if condition.get('label') and not any(condition['label'] in [n.get('text'), n.get('content-desc'), n.get('resource-id')] for n in nodes):
                continue
            if condition.get('keyboard'):
                visible = bool(re.search(r'type=ime .*?visible=true', self.foreground()))
                if visible != (condition['keyboard'] == 'visible'):
                    continue
            return
        raise AcceptanceError('Navigation postcondition not reached; subsequent actions stopped')

    def installed_scheme(self):
        output = self.call('shell', 'dumpsys', 'package', self.package)
        schemes = sorted(set(re.findall(r'Scheme: "([a-zA-Z][a-zA-Z0-9+.-]*)"', output)))
        schemes = [scheme for scheme in schemes if scheme not in {'http', 'https', self.package}]
        if len(schemes) != 1:
            raise AcceptanceError('Installed test app must expose one custom URL scheme')
        return schemes[0]

    def open_path(self, path):
        if not path.startswith('/') or any(ch in path for ch in ["'", '"', '\n', '\r', ' ']):
            raise AcceptanceError('Open path must be an encoded app-relative route')
        self.foreground()
        url = self.installed_scheme() + '://' + path
        self.call('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', shlex.quote(url), '-p', self.package)

    def change_api_connection(self, directory, state):
        port = str(urlsplit(self.config['apiOrigin']).port)
        if not port.isdigit():
            raise AcceptanceError('Local API must have an explicit port')
        source = 'tcp:' + port
        path = directory / 'device.json'
        journal = read_json(path)
        if source not in journal['changed_ports']:
            journal['changed_ports'].append(source)
            write_json(path, journal)
        if state == 'off':
            self.call('reverse', '--remove', source)
        else:
            self.call('reverse', source, 'tcp:' + str(self.config['reversePorts'].get(port, int(port))))

    def capture(self, destination):
        _, state = self.stable()
        destination = Path(destination)
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        temporary = destination.with_suffix(".pending")
        try:
            image = self.call("exec-out", "screencap", "-p", binary=True)
            if not image.startswith(b"\x89PNG\r\n\x1a\n"):
                raise AcceptanceError("Device did not return a PNG screenshot")
            _, observed = self.stable()
            if observed != state:
                raise AcceptanceError("Layout changed during capture; screenshot discarded")
            with temporary.open("wb") as file:
                os.chmod(temporary, 0o600)
                file.write(image)
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)
        self.report.event("screenshot", path=str(destination))

    def snapshot(self):
        ports = {}
        for line in self.call("reverse", "--list").splitlines():
            parts = line.split()
            if len(parts) == 3:
                ports[parts[1]] = parts[2]
        return {"serial": self.serial, "package": self.package,
                "font": self.call("shell", "settings", "get", "system", "font_scale"),
                "awake": self.call("shell", "settings", "get", "global", "stay_on_while_plugged_in"),
                "reverse": ports, "changed_ports": [], "restoration_pending": True, "xml_path": self.xml_path}

    def restore(self, path):
        state = read_json(path)
        if not state["restoration_pending"]:
            return
        if state["serial"] != self.serial or state["package"] != self.package:
            raise AcceptanceError("Restoration journal belongs to a different device/app")
        errors = []
        for namespace, key, value in [("system", "font_scale", state["font"]),
                                      ("global", "stay_on_while_plugged_in", state["awake"])]:
            try:
                self.call("shell", "settings", "put", namespace, key, value)
                if self.call("shell", "settings", "get", namespace, key) != value:
                    raise AcceptanceError("Device setting restoration did not persist")
            except AcceptanceError as error:
                errors.append(str(error))
        for port in state["changed_ports"]:
            try:
                if port in state["reverse"]:
                    self.call("reverse", port, state["reverse"][port])
                else:
                    self.call("reverse", "--remove", port)
            except AcceptanceError as error:
                errors.append(str(error))
        try:
            xml_path = state.get("xml_path", self.xml_path)
            if not re.fullmatch(r"/sdcard/metvage-acceptance-[1-9][0-9]*\.xml", xml_path):
                raise AcceptanceError("Restoration journal contains an invalid owned XML path")
            self.call("shell", "rm", "-f", xml_path)
        except AcceptanceError as error:
            errors.append(str(error))
        state["restoration_pending"] = bool(errors)
        state["restoration_errors"] = errors
        write_json(path, state)
        if errors:
            raise AcceptanceError("Device disconnected or restoration failed; reconnect and run cleanup with this run-id")

    @contextmanager
    def session(self, directory, font=None):
        with exclusive_lock("device:" + self.serial):
            self.preflight()
            path = directory / "device.json"
            for journal in directory.parent.glob("*/device.json"):
                previous = read_json(journal)
                if journal != path and previous.get("serial") == self.serial and previous.get("restoration_pending"):
                    raise AcceptanceError(f"Restore pending device run first: cleanup --run-id {journal.parent.name}")
            if path.exists():
                self.restore(path)
            state = self.snapshot()
            write_json(path, state)
            try:
                if font is not None:
                    if not 0.5 <= font <= 2.0:
                        raise AcceptanceError("font-scale must be between 0.5 and 2.0")
                    self.call("shell", "settings", "put", "system", "font_scale", str(font))
                self.call("shell", "settings", "put", "global", "stay_on_while_plugged_in", "3")
                for source, target in self.config.get("reversePorts", {}).items():
                    source, target = f"tcp:{int(source)}", f"tcp:{int(target)}"
                    if state["reverse"].get(source) != target:
                        state["changed_ports"].append(source)
                        write_json(path, state)
                        self.call("reverse", source, target)
                yield
            finally:
                self.restore(path)

    @contextmanager
    def measured_step(self, number, action):
        started = time.monotonic()
        calls, reads, adb_time = self.adb_calls, self.ui_reads, self.adb_seconds
        status = 'fail'
        try:
            yield
            status = 'pass'
        finally:
            self.report.event('step', number=number, operation=action, status=status,
                              seconds=round(time.monotonic()-started,3), adb_calls=self.adb_calls-calls,
                              adb_seconds=round(self.adb_seconds-adb_time,3), ui_reads=self.ui_reads-reads)

    def run_plan(self, plan, directory, run_id, fail_after=None):
        self.call("shell", "am", "start", "-n", self.package + "/.MainActivity")
        deadline = time.monotonic() + 10
        while True:
            try:
                self.foreground()
                break
            except AcceptanceError:
                if time.monotonic() >= deadline:
                    raise AcceptanceError("Test app did not reach the foreground after launch")
                time.sleep(0.1)
        for index, step in enumerate(plan["steps"], 1):
            action = step["action"]
            def expand(value):
                for key, replacement in {**self.config.get("variables", {}), "run_id": run_id}.items():
                    value = value.replace("{" + key + "}", str(replacement))
                return value
            label = expand(step.get("label", ""))
            with self.measured_step(index, action):
                if action == "assert":
                    self.wait_label(label, timeout=step.get("timeout",15))
                elif action == "tap":
                    self.tap(label, step.get("index"))
                elif action == "type":
                    self.foreground()
                    value = expand(step["text"])
                    if not value.isascii():
                        raise AcceptanceError("adb text input supports ASCII here; use the API for Unicode fixture names")
                    self.call("shell", "input", "text", shlex.quote(value.replace(" ", "%s")))
                elif action == "back":
                    self.foreground()
                    self.call("shell", "input", "keyevent", "KEYCODE_BACK")
                elif action == 'open':
                    self.open_path(expand(step['path']))
                elif action == 'api_connection':
                    self.change_api_connection(directory, step['state'])
                elif action == 'touch':
                    nodes, _ = self.stable()
                    matches = self.targets(nodes, label)
                    if len(matches) != 1:
                        raise AcceptanceError('Touch measurement requires one target')
                    bounds = list(map(int, re.findall(r'\d+', matches[0].get('bounds', ''))))
                    density = int(re.findall(r'\d+', self.call('shell', 'wm', 'density'))[-1]) / 160
                    width, height = (bounds[2] - bounds[0]) / density, (bounds[3] - bounds[1]) / density
                    if min(width, height) < 48:
                        raise AcceptanceError('Touch target smaller than 48 logical points')
                    self.report.event('touch_target', width=width, height=height)
                elif action == "keyboard":
                    nodes, _ = self.stable()
                    window = self.foreground()
                    ime = re.search(r"type=ime frame=\[\d+,(\d+)\]\[\d+,\d+\].*?visible=true", window)
                    matches = [n for n in nodes if label in [n.get("text"), n.get("content-desc")]]
                    if not ime or len(matches) != 1:
                        raise AcceptanceError("Visible keyboard and a unique action control are required")
                    bounds = list(map(int, re.findall(r"\d+", matches[0].get("bounds", ""))))
                    if len(bounds) != 4 or not 0 < bounds[1] < bounds[3] <= int(ime.group(1)):
                        raise AcceptanceError("Comment action is covered by the keyboard")
                    self.report.event("keyboard_clearance", button_bottom=bounds[3], keyboard_top=int(ime.group(1)))
                elif action == "swipe":
                    self.foreground()
                    width, height = map(int, re.findall(r"(\d+)x(\d+)", self.call("shell", "wm", "size"))[-1])
                    points = step["fractions"]
                    if len(points) != 4 or not all(0 <= x <= 1 for x in points):
                        raise AcceptanceError("Swipe coordinates must be four fractions between 0 and 1")
                    x1, y1, x2, y2 = points
                    self.call("shell", "input", "swipe", str(int(x1 * width)), str(int(y1 * height)),
                              str(int(x2 * width)), str(int(y2 * height)), "450")
                elif action == "capture":
                    name = step.get("name", f"step-{index}")
                    if not re.fullmatch(r"[a-zA-Z0-9_-]+", name):
                        raise AcceptanceError("Screenshot name must be a plain file name")
                    self.capture(directory / (name + ".png"))
                else:
                    raise AcceptanceError("Unsupported acceptance plan action")
                if step.get('expect'):
                    self.wait_condition({key: expand(value) for key, value in step['expect'].items()}, timeout=step.get("timeout",15))
                if index == fail_after:
                    raise AcceptanceError("Injected failure after requested step")
