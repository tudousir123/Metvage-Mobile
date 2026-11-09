"""Generated private fixtures; every created ID is journaled before the next write."""
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request
import uuid

from runtime import AcceptanceError, execute, read_json, write_json


def local_origin(origin):
    parsed = urllib.parse.urlsplit(origin)
    if (parsed.scheme not in ["http", "https"] or parsed.hostname not in ["localhost", "127.0.0.1", "::1"]
            or parsed.username or parsed.password or parsed.path not in ["", "/"] or parsed.query or parsed.fragment):
        raise AcceptanceError("Acceptance API writes require a loopback origin without credentials or URL paths")
    return origin.rstrip("/")


def positive_id(value):
    if isinstance(value, bool) or not re.fullmatch(r"[1-9][0-9]*", str(value)):
        raise AcceptanceError("API returned an invalid resource ID")
    return int(value)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise AcceptanceError("API redirect rejected; authentication stays on the configured local origin")


class FixtureRun:
    def __init__(self, config, directory, run_id, report):
        if config.get("testAccount") is not True:
            raise AcceptanceError("Enable testAccount only for the isolated local acceptance account")
        self.config, self.directory, self.run_id, self.report = config, directory, run_id, report
        self.origin = local_origin(config["apiOrigin"])
        self.path = directory / "fixtures.json"
        self.state = read_json(self.path) if self.path.exists() else {
            "run_id": run_id, "profile_username": config["profileUsername"], "api_origin": self.origin,
            "pets": [], "records": [], "cleaned": False, "token_cleanup_pending": False,
        }
        if self.state["run_id"] != run_id or self.state["profile_username"] != config["profileUsername"] or self.state["api_origin"] != self.origin:
            raise AcceptanceError("Fixture journal is bound to a different run/account/origin")
        self.token = None
        self.http = urllib.request.build_opener(NoRedirect)

    def save(self):
        write_json(self.path, self.state)

    def admin(self, operation, **fields):
        source = Path(__file__).with_name("server-session.php").read_text().removeprefix("<?php")
        payload = {"operation": operation, "run_id": self.run_id,
                   "profile_username": self.config["profileUsername"], **fields}
        response = execute([self.config.get("docker", "docker"), "exec", "-i", self.config["serverContainer"],
                            "php", "-r", source], data=json.dumps(payload).encode())
        return json.loads(response)

    @contextmanager
    def authenticated(self):
        self.state["token_cleanup_pending"] = True
        self.save()
        try:
            credentials = self.admin("issue")
            self.token = credentials["token"]
            self.report.secrets.append(self.token)
            self.state["account_id"] = positive_id(credentials["account_id"])
            self.save()
            yield
        finally:
            self.admin("revoke")
            self.token = None
            self.state["token_cleanup_pending"] = False
            self.save()

    def request(self, method, path, body=None, image=None, expected=(200,)):
        headers = {"Accept": "application/json", "Authorization": "Bearer " + self.token}
        data = None
        if image:
            boundary = "metvage" + uuid.uuid4().hex
            chunks = []
            for key, value in body.items():
                chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
            chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="photos[0]"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n'.encode())
            data = b"".join(chunks) + image + f"\r\n--{boundary}--\r\n".encode()
            headers["Content-Type"] = "multipart/form-data; boundary=" + boundary
        elif body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(self.origin + "/api/v1/metvage" + path, data=data, headers=headers, method=method)
        try:
            with self.http.open(request, timeout=15) as response:
                status, raw = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, raw = error.code, b""
        if status not in expected:
            raise AcceptanceError(f"Local API {method} {path}: HTTP {status}; expected {expected}")
        return json.loads(raw) if raw else None

    def pets(self):
        return self.request("GET", "/pets")

    def reconcile_pets(self):
        available = self.pets()["pets"]
        for entry in self.state["pets"]:
            if entry.get("id"):
                found = [p for p in available if positive_id(p["id"]) == entry["id"]]
                if found and found[0].get("bio") != entry["marker"] and found[0]["nickname"] != entry["seed_name"]:
                    raise AcceptanceError("Fixture ID now has a different ownership marker")
            else:
                found = [p for p in available if p.get("bio") == entry["marker"] or p["nickname"] == entry["seed_name"]]
                if len(found) > 1:
                    raise AcceptanceError("Ambiguous fixture recovery; no data was selected for deletion")
                if found:
                    entry["id"] = positive_id(found[0]["id"])
                    self.save()

    def ensure(self):
        if self.state["cleaned"]:
            raise AcceptanceError("This run was cleaned; use a new run-id")
        owned = self.pets()
        if "original_current_pet_id" not in self.state:
            self.state["original_current_pet_id"] = owned["current_pet_id"]
            self.save()
        self.reconcile_pets()
        for spec in self.config["fixtures"]:
            key = spec["key"]
            if not re.fullmatch(r"[a-z0-9_-]{1,12}", key) or spec.get("generated") is not True:
                raise AcceptanceError("Fixtures require a short key and explicitly generated image")
            image = Path(spec["image"]).read_bytes()
            if not image.startswith(b"\x89PNG\r\n\x1a\n") or len(image) > 10 * 1024 * 1024:
                raise AcceptanceError("Generated fixture must be a PNG smaller than 10 MB")
            digest = hashlib.sha256(image).hexdigest()
            entry = next((p for p in self.state["pets"] if p["key"] == key), None)
            if entry is None:
                seed = "验收-" + hashlib.sha256((self.run_id + key).encode()).hexdigest()[:20]
                entry = {"key": key, "seed_name": seed, "marker": "acceptance:" + self.run_id + ":" + key,
                         "image_sha256": digest, "id": None}
                self.state["pets"].append(entry)
                self.save()
            if entry["image_sha256"] != digest:
                raise AcceptanceError("Generated asset changed; use a new run-id")
            if entry["id"] is None:
                pet = self.request("POST", "/pets", {"nickname": entry["seed_name"], "species": spec["species"]}, expected=(201,))["pet"]
                entry["id"] = positive_id(pet["id"])
                self.save()
            self.request("PATCH", f'/pets/{entry["id"]}', {"nickname": spec["nickname"], "bio": entry["marker"]})
            record = next((r for r in self.state["records"] if r["key"] == key), None)
            if record is None:
                record = {"key": key, "pet_id": entry["id"], "id": None, "request_id": self.run_id + "-" + key}
                self.state["records"].append(record)
                self.save()
            # Always replay the same request ID, including after an uncertain HTTP response.
            saved = self.request("POST", "/records", {"pet_id": entry["id"], "visibility": "private",
                                  "title": spec["nickname"] + "的测试照片", "text": entry["marker"],
                                  "client_request_id": record["request_id"]}, image=image, expected=(200, 201))["record"]
            record["id"] = positive_id(saved["id"])
            if positive_id(saved["pet_id"]) != entry["id"] or saved["visibility"] != "private":
                raise AcceptanceError("API fixture response has unexpected ownership/visibility")
            self.save()
        self.report.event("fixtures_ready", pets=[p["id"] for p in self.state["pets"]], records=[r["id"] for r in self.state["records"]])

    def cleanup(self):
        self.reconcile_pets()
        errors = []
        # Recover a record created before its response or local journal write was lost.
        for entry in self.state["records"]:
            try:
                if entry.get("id") is None:
                    value = self.admin("find_record", request_id=entry["request_id"])
                    if value["id"] is None:
                        continue
                    entry["id"] = positive_id(value["id"])
                    self.save()
                allowed = self.admin("owned_records", ids=[entry["id"]])["ids"]
                value = self.request("GET", f'/records/{entry["id"]}', expected=(200, 404))
                if value is not None:
                    if entry["id"] not in [positive_id(i) for i in allowed]:
                        raise AcceptanceError("Record does not belong to this run")
                    self.request("DELETE", f'/records/{entry["id"]}', expected=(204, 404))
            except (AcceptanceError, OSError, ValueError) as error:
                errors.append(str(error))
        try:
            self.admin("purge", pets=[p for p in self.state["pets"] if p.get("id")],
                       original_current_pet_id=self.state.get("original_current_pet_id"))
        except AcceptanceError as error:
            errors.append(str(error))
        self.state["cleaned"] = not errors
        self.state["cleanup_errors"] = errors
        self.save()
        if errors:
            raise AcceptanceError("Fixture cleanup incomplete; retry cleanup with this run-id")
        self.report.event("fixtures_cleaned", run_id=self.run_id)
