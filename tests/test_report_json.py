import json
import unittest

from painradar.models import Post
from painradar.clustering import Cluster
from painradar.opportunity import build_opportunities
from painradar.report_json import build_report_dict


def make_post(id_, author):
    return Post(
        id=id_,
        title=f"Manually doing invoice work {id_}",
        selftext="I manually copy invoice data every week, so frustrating, expensive, I'd pay for a fix.",
        subreddit="freelance",
        author=author,
        score=10,
        num_comments=5,
        created_utc=1,
        url=f"https://reddit.com/{id_}",
    )


class TestBuildReportDict(unittest.TestCase):
    def test_report_dict_is_json_serializable_and_has_expected_shape(self):
        cluster = Cluster(posts=[make_post("1", "a"), make_post("2", "b")])
        opportunities = build_opportunities([cluster])
        report = build_report_dict(opportunities, source_description="fixture: fixtures/sample_posts.json")

        serialized = json.dumps(report)
        parsed = json.loads(serialized)

        self.assertIn("generated_at", parsed)
        self.assertIn("source_description", parsed)
        self.assertIn("disclaimer", parsed)
        self.assertEqual(len(parsed["opportunities"]), 1)
        opp = parsed["opportunities"][0]
        self.assertIn("problem_statement", opp)
        self.assertIn("score", opp)
        self.assertIn("total", opp["score"])
        self.assertIn("reasons", opp["score"])
        self.assertIn("evidence", opp)
        self.assertIn("market_size_hypotheses", opp)


if __name__ == "__main__":
    unittest.main()
