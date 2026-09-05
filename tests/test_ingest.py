import unittest
from painradar.models import Post
from painradar.ingest import load_posts_from_fixture, IngestError


class TestModels(unittest.TestCase):
    def test_post_from_dict_builds_typed_post(self):
        raw = {
            "id": "abc123",
            "title": "Title",
            "selftext": "Body text",
            "subreddit": "smallbusiness",
            "author": "u1",
            "score": 12,
            "num_comments": 3,
            "created_utc": 1700000000,
            "url": "https://reddit.com/r/smallbusiness/abc123",
        }
        post = Post.from_dict(raw)
        self.assertEqual(post.id, "abc123")
        self.assertEqual(post.score, 12)
        self.assertEqual(post.subreddit, "smallbusiness")


class TestIngestFixture(unittest.TestCase):
    def test_load_posts_from_fixture_returns_posts(self):
        posts = load_posts_from_fixture("fixtures/sample_posts.json")
        self.assertGreaterEqual(len(posts), 12)
        self.assertTrue(all(isinstance(p, Post) for p in posts))

    def test_load_posts_from_fixture_missing_file_raises(self):
        with self.assertRaises(IngestError):
            load_posts_from_fixture("fixtures/does_not_exist.json")

    def test_load_posts_from_fixture_rejects_missing_required_field(self):
        import json
        import tempfile
        import os

        bad = [{"id": "x", "title": "t"}]  # missing required fields
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(bad, f)
            path = f.name
        try:
            with self.assertRaises(IngestError):
                load_posts_from_fixture(path)
        finally:
            os.unlink(path)

    def test_load_posts_from_fixture_rejects_malformed_json_syntax(self):
        import tempfile
        import os

        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            f.write("{not valid json,,,")
            path = f.name
        try:
            with self.assertRaises(IngestError):
                load_posts_from_fixture(path)
        finally:
            os.unlink(path)

    def test_load_posts_from_fixture_rejects_non_list_json(self):
        import json
        import tempfile
        import os

        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump({"not": "a list"}, f)
            path = f.name
        try:
            with self.assertRaises(IngestError):
                load_posts_from_fixture(path)
        finally:
            os.unlink(path)

    def test_load_posts_from_fixture_rejects_wrong_type_field(self):
        import json
        import tempfile
        import os

        bad = [
            {
                "id": "x",
                "title": "t",
                "selftext": "s",
                "subreddit": "sub",
                "author": "a",
                "score": "not-an-int",
                "num_comments": 1,
                "created_utc": 1,
                "url": "https://reddit.com/x",
            }
        ]
        bad[0]["score"] = {"nested": "dict, not coercible to int"}
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(bad, f)
            path = f.name
        try:
            with self.assertRaises(IngestError):
                load_posts_from_fixture(path)
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
