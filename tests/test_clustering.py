import unittest

from painradar.models import Post
from painradar.clustering import jaccard_similarity, cluster_posts


def make_post(id_, title, selftext, subreddit="test", author="a", score=1, num_comments=1, created_utc=1):
    return Post(
        id=id_,
        title=title,
        selftext=selftext,
        subreddit=subreddit,
        author=author,
        score=score,
        num_comments=num_comments,
        created_utc=created_utc,
        url=f"https://reddit.com/{id_}",
    )


class TestJaccardSimilarity(unittest.TestCase):
    def test_identical_sets_have_similarity_one(self):
        self.assertEqual(jaccard_similarity({"a", "b"}, {"a", "b"}), 1.0)

    def test_disjoint_sets_have_similarity_zero(self):
        self.assertEqual(jaccard_similarity({"a"}, {"b"}), 0.0)

    def test_partial_overlap(self):
        self.assertAlmostEqual(jaccard_similarity({"a", "b"}, {"b", "c"}), 1 / 3)

    def test_both_empty_is_zero(self):
        self.assertEqual(jaccard_similarity(set(), set()), 0.0)


class TestClusterPosts(unittest.TestCase):
    def test_similar_posts_land_in_same_cluster(self):
        posts = [
            make_post("1", "Manually copying invoice data every week", "so tedious, manual invoice copying"),
            make_post("2", "Manually copying invoice line items weekly", "manual invoice copying is tedious"),
            make_post("3", "Best mechanical keyboard switches", "tactile vs linear switches discussion"),
        ]
        clusters = cluster_posts(posts)
        self.assertEqual(len(clusters), 2)
        sizes = sorted(len(c.posts) for c in clusters)
        self.assertEqual(sizes, [1, 2])

    def test_clustering_is_deterministic(self):
        posts = [
            make_post("1", "Manually copying invoice data every week", "manual invoice copying tedious"),
            make_post("2", "Manually copying invoice line items weekly", "manual invoice copying tedious"),
            make_post("3", "Expensive CRM tools for solo founders", "crm tools way too expensive solo"),
            make_post("4", "Expensive CRM software for indie founders", "crm software too expensive indie"),
        ]
        clusters_a = cluster_posts(posts)
        clusters_b = cluster_posts(posts)
        ids_a = [[p.id for p in c.posts] for c in clusters_a]
        ids_b = [[p.id for p in c.posts] for c in clusters_b]
        self.assertEqual(ids_a, ids_b)

    def test_cluster_has_a_label(self):
        posts = [
            make_post("1", "Manually copying invoice data every week", "manual invoice copying tedious"),
            make_post("2", "Manually copying invoice line items weekly", "manual invoice copying tedious"),
        ]
        clusters = cluster_posts(posts)
        self.assertTrue(clusters[0].label)


if __name__ == "__main__":
    unittest.main()
