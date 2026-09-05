import unittest

from painradar.models import Post
from painradar.clustering import Cluster
from painradar.opportunity import build_opportunities


def make_post(id_, author, subreddit="freelance", score=10, num_comments=5, created_utc=1):
    return Post(
        id=id_,
        title=f"Manually doing invoice work {id_}",
        selftext="I manually copy invoice data every week, so frustrating, tools are expensive, I'd pay for a fix.",
        subreddit=subreddit,
        author=author,
        score=score,
        num_comments=num_comments,
        created_utc=created_utc,
        url=f"https://reddit.com/{id_}",
    )


class TestBuildOpportunities(unittest.TestCase):
    def test_builds_one_opportunity_per_cluster_sorted_by_score_desc(self):
        cluster_a = Cluster(posts=[make_post("1", "a"), make_post("2", "b")])
        cluster_b = Cluster(posts=[make_post("3", "c")])
        opportunities = build_opportunities([cluster_a, cluster_b])
        self.assertEqual(len(opportunities), 2)
        self.assertGreaterEqual(opportunities[0].score.total_score, opportunities[1].score.total_score)

    def test_opportunity_has_required_fields(self):
        cluster = Cluster(posts=[make_post("1", "a"), make_post("2", "b")])
        opp = build_opportunities([cluster])[0]
        self.assertTrue(opp.problem_statement)
        self.assertTrue(opp.suggested_icp)
        self.assertTrue(opp.mvp_idea)
        self.assertTrue(opp.validation_steps)
        self.assertTrue(opp.evidence)
        self.assertIn("confidence", vars(opp))

    def test_evidence_items_reference_original_posts(self):
        cluster = Cluster(posts=[make_post("1", "a"), make_post("2", "b")])
        opp = build_opportunities([cluster])[0]
        urls = {e.url for e in opp.evidence}
        self.assertEqual(urls, {"https://reddit.com/1", "https://reddit.com/2"})

    def test_confidence_bounds(self):
        cluster = Cluster(posts=[make_post("1", "a")])
        opp = build_opportunities([cluster])[0]
        self.assertIn(opp.confidence, {"faible", "moyenne", "élevée"})


if __name__ == "__main__":
    unittest.main()
