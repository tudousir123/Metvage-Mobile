import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

CLI = Path(__file__).resolve().parents[1] / "acceptance.py"


class DoctorCliTest(unittest.TestCase):
    def test_external_dependency_symlink_is_rejected_before_starting_metro(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            project = root / "mobile"
            project.mkdir()
            subprocess.run(["git", "init", "--initial-branch=codex/test", str(project)], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(project), "remote", "add", "origin", "https://github.com/tudousir123/Metvage-Mobile.git"], check=True)
            subprocess.run(["git", "-C", str(project), "-c", "user.name=Test", "-c", "user.email=test@example.test", "commit", "--allow-empty", "-m", "fixture"], check=True, capture_output=True)
            external = root / "external-dependencies"
            external.mkdir()
            (project / "node_modules").symlink_to(external, target_is_directory=True)
            config = root / "config.json"
            config.write_text(json.dumps({"mobileRoot": str(project), "runRoot": str(root / "runs"), "expectedBranch": "codex/test"}))
            result = subprocess.run([sys.executable, str(CLI), "--config", str(config), "doctor", "--without-device"], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertIn("dependencies", json.loads(result.stdout)["error"])


if __name__ == "__main__":
    unittest.main()
