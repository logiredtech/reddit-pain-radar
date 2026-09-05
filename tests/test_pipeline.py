import unittest

from painradar.ingest import load_posts_from_fixture
from painradar.models import Post
from painradar.pipeline import run_pipeline


class TestRunPipeline(unittest.TestCase):
    def test_fixture_to_report_end_to_end(self):
        posts = load_posts_from_fixture("fixtures/sample_posts.json")
        report_dict, html = run_pipeline(posts, source_description="fixture: fixtures/sample_posts.json")

        self.assertGreaterEqual(len(report_dict["opportunities"]), 2)
        # opportunities are sorted by descending score
        scores = [o["score"]["total"] for o in report_dict["opportunities"]]
        self.assertEqual(scores, sorted(scores, reverse=True))

        self.assertIn("<html", html.lower())
        self.assertIn("Opportunités", html)

        # the off-topic keyboard post should not surface as a strong opportunity
        problem_statements = " ".join(o["problem_statement"].lower() for o in report_dict["opportunities"])
        self.assertNotIn("mechanical keyboard", problem_statements)

    def test_posts_without_pain_signals_are_excluded(self):
        post = Post(
            id="neutral-1",
            title="Promote Your Business thread",
            selftext="Share your company and introduce yourself to the community.",
            subreddit="smallbusiness",
            author="moderator",
            score=100,
            num_comments=50,
            created_utc=1,
            url="https://www.reddit.com/r/smallbusiness/comments/neutral-1",
        )

        report_dict, _ = run_pipeline([post], source_description="test")

        self.assertEqual(report_dict["opportunities"], [])

    def test_empty_post_list_produces_empty_but_valid_report(self):
        report_dict, html = run_pipeline([], source_description="empty")
        self.assertEqual(report_dict["opportunities"], [])
        self.assertIn("<html", html.lower())


if __name__ == "__main__":
    unittest.main()
