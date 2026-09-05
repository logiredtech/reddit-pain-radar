import json
import os
import subprocess
import sys
import tempfile
import unittest


class TestCliEndToEnd(unittest.TestCase):
    def test_cli_fixture_mode_writes_json_and_html(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_json = os.path.join(tmp, "out.json")
            out_html = os.path.join(tmp, "out.html")
            proc = subprocess.run(
                [
                    sys.executable, "-m", "painradar",
                    "--fixture", "fixtures/sample_posts.json",
                    "--out-json", out_json,
                    "--out-html", out_html,
                ],
                capture_output=True,
                text=True,
                cwd=os.getcwd(),
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertTrue(os.path.exists(out_json))
            self.assertTrue(os.path.exists(out_html))
            with open(out_json, encoding="utf-8") as f:
                data = json.load(f)
            self.assertGreaterEqual(len(data["opportunities"]), 2)
            with open(out_html, encoding="utf-8") as f:
                html = f.read()
            self.assertIn("Opportunités", html)

    def test_cli_reports_missing_fixture_without_crashing(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_json = os.path.join(tmp, "out.json")
            out_html = os.path.join(tmp, "out.html")
            proc = subprocess.run(
                [
                    sys.executable, "-m", "painradar",
                    "--fixture", "fixtures/does_not_exist.json",
                    "--out-json", out_json,
                    "--out-html", out_html,
                ],
                capture_output=True,
                text=True,
                cwd=os.getcwd(),
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertNotIn("Traceback", proc.stderr)
            self.assertFalse(os.path.exists(out_json))


if __name__ == "__main__":
    unittest.main()
