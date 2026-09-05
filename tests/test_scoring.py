import unittest

from painradar.models import Post
from painradar.clustering import Cluster
from painradar.scoring import score_cluster


def make_post(id_, author, score=10, num_comments=5, subreddit="sub1", created_utc=1):
    return Post(
        id=id_,
        title=f"title {id_}",
        selftext="I manually do this every week, so frustrating, expensive tools, I'd pay for a fix.",
        subreddit=subreddit,
        author=author,
        score=score,
        num_comments=num_comments,
        created_utc=created_utc,
        url=f"https://reddit.com/{id_}",
    )


class TestScoreCluster(unittest.TestCase):
    def test_more_independent_authors_scores_higher(self):
        low = Cluster(posts=[make_post("1", "a"), make_post("2", "a")])
        high = Cluster(posts=[make_post("3", "a"), make_post("4", "b")])
        low_result = score_cluster(low)
        high_result = score_cluster(high)
        self.assertGreater(high_result.total_score, low_result.total_score)

    def test_more_subreddits_scores_higher(self):
        one_sub = Cluster(posts=[make_post("1", "a", subreddit="s1"), make_post("2", "b", subreddit="s1")])
        two_subs = Cluster(posts=[make_post("3", "a", subreddit="s1"), make_post("4", "b", subreddit="s2")])
        self.assertGreater(score_cluster(two_subs).total_score, score_cluster(one_sub).total_score)

    def test_higher_engagement_scores_higher(self):
        low_engagement = Cluster(posts=[make_post("1", "a", score=1, num_comments=0)])
        high_engagement = Cluster(posts=[make_post("2", "a", score=500, num_comments=200)])
        self.assertGreater(
            score_cluster(high_engagement).total_score, score_cluster(low_engagement).total_score
        )

    def test_score_result_has_explainable_reasons(self):
        cluster = Cluster(posts=[make_post("1", "a"), make_post("2", "b")])
        result = score_cluster(cluster)
        self.assertIsInstance(result.reasons, list)
        self.assertTrue(len(result.reasons) > 0)
        self.assertTrue(all(isinstance(r, str) for r in result.reasons))

    def test_score_is_bounded(self):
        cluster = Cluster(posts=[make_post(str(i), f"author{i}", score=99999, num_comments=99999) for i in range(20)])
        result = score_cluster(cluster)
        self.assertLessEqual(result.total_score, 100.0)
        self.assertGreaterEqual(result.total_score, 0.0)

    def test_market_evidence_state_is_reported(self):
        cluster = Cluster(posts=[make_post("1", "a"), make_post("2", "b")])
        result = score_cluster(cluster)
        self.assertIn(result.market_evidence_state, {"faible", "modérée", "forte"})


if __name__ == "__main__":
    unittest.main()
