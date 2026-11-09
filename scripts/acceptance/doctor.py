"""Read the actual checkout, dependency paths, Metro process and local Server."""
import json
from pathlib import Path
import re
import urllib.request

from runtime import AcceptanceError, execute
from fixtures import local_origin


def git_identity(root):
    root = Path(root).resolve()
    origin = execute(["git", "remote", "get-url", "origin"], cwd=root)
    match = re.search(r"github\.com[:/]([^/]+/[^/]+?)(?:\.git)?$", origin)
    return {"root": str(root), "repository": match.group(1) if match else "unrecognized",
            "branch": execute(["git", "branch", "--show-current"], cwd=root),
            "sha": execute(["git", "rev-parse", "HEAD"], cwd=root),
            "dirty": bool(execute(["git", "status", "--porcelain"], cwd=root))}


def diagnose(config, report, device=None):
    project = Path(config["mobileRoot"]).expanduser().resolve()
    identity = git_identity(project)
    if identity["repository"] != config.get("expectedRepo", "tudousir123/Metvage-Mobile"):
        raise AcceptanceError("Configured checkout is not the expected Mobile repository")
    if config.get("expectedBranch") and identity["branch"] != config["expectedBranch"]:
        raise AcceptanceError("Configured checkout is on a different branch")
    dependencies = (project / "node_modules").resolve()
    if not dependencies.is_relative_to(project) or not dependencies.is_dir():
        raise AcceptanceError("Install project-local dependencies with npm ci; external dependency symlinks are not a supported Metro launch root")
    entry = Path(execute(["node", "-p", "require.resolve('expo-router/entry')"], cwd=project)).resolve()
    if not entry.is_relative_to(project):
        raise AcceptanceError("Expo Router entry resolves outside the configured project")
    identity["node"] = execute(["node", "--version"])
    identity["entry"] = str(entry)
    result = {"mobile": identity}
    if config.get("metroPort"):
        port = int(config["metroPort"])
        listeners = execute(["ss", "-ltnpH"])
        pids = []
        for line in listeners.splitlines():
            parts = line.split()
            if len(parts) > 3 and parts[3].rsplit(":", 1)[-1] == str(port):
                pids.extend(re.findall(r"pid=(\d+)", line))
        roots = {str(Path(f"/proc/{pid}/cwd").resolve()) for pid in pids}
        if roots != {str(project)}:
            raise AcceptanceError("Metro port is not owned by the configured mobileRoot")
        result["metro"] = {"port": port, "root": str(project)}
    if config.get("serverContainer"):
        mounts = json.loads(execute([config.get("docker", "docker"), "inspect", "--format", "{{json .Mounts}}", config["serverContainer"]]))
        mount = next((m["Source"] for m in mounts if m["Destination"] == "/var/www/html"), None)
        if not mount or (config.get("serverRoot") and Path(mount).resolve() != Path(config["serverRoot"]).resolve()):
            raise AcceptanceError("Server container mount does not match serverRoot")
        result["server"] = {"container": config["serverContainer"], "root": mount}
    if config.get("apiOrigin"):
        with urllib.request.urlopen(local_origin(config["apiOrigin"]) + "/api/v1/metvage/records", timeout=5) as response:
            if response.status != 200:
                raise AcceptanceError("Local API health check did not return 200")
        result["api"] = {"origin": config["apiOrigin"], "status": 200}
    if device:
        result["device"] = device.preflight()
    report.event("doctor", **result)
    return result
