from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[3]


class CiContractTest(unittest.TestCase):
    def test_lightweight_checks_cover_every_pr_and_use_locked_tools(self):
        for name in ["typecheck.yml", "jest-unit-tests.yml", "biome.yml"]:
            with self.subTest(workflow=name):
                content = (ROOT / ".github/workflows" / name).read_text()
                event = re.search(r"^  pull_request:(.*?)(?=^  [a-z_]+:|^jobs:)", content, re.M | re.S)
                self.assertIsNotNone(event)
                self.assertNotRegex(event.group(1), r"branches|paths|types")
                self.assertIn("node-version: " + (ROOT / ".nvmrc").read_text().strip(), content)
                self.assertIn("npm ci --no-audit --no-fund", content)
                self.assertNotIn("version: latest", content)


if __name__ == "__main__":
    unittest.main()
