import unittest

from painradar.models import Post
from painradar.clustering import Cluster
from painradar.opportunity import build_opportunities
from painradar.report_html import render_html_report


def make_post(id_, author, selftext):
    return Post(
        id=id_,
        title=f"Manually doing invoice work {id_}",
        selftext=selftext,
        subreddit="freelance",
        author=author,
        score=10,
        num_comments=5,
        created_utc=1,
        url=f"https://reddit.com/{id_}",
    )


class TestRenderHtmlReport(unittest.TestCase):
    def test_escapes_malicious_post_content(self):
        malicious = "<script>alert('xss')</script> I manually do this, so frustrating, I'd pay."
        cluster = Cluster(posts=[make_post("1", "a", malicious), make_post("2", "b", malicious)])
        opportunities = build_opportunities([cluster])
        html = render_html_report(opportunities, source_description="fixture")
        self.assertNotIn("<script>alert('xss')</script>", html)
        self.assertIn("&lt;script&gt;", html)

    def test_escapes_malicious_author_and_subreddit(self):
        posts = [
            Post(
                id="1",
                title="Manually copying data",
                selftext="I manually copy this every week, so frustrating, I'd pay for a fix.",
                subreddit='"><img src=x onerror=alert(1)>',
                author="<b>hacker</b>",
                score=5,
                num_comments=1,
                created_utc=1,
                url="https://reddit.com/1",
            ),
            make_post("2", "normal_user", "I manually copy this every week, so frustrating, I'd pay for a fix."),
        ]
        cluster = Cluster(posts=posts)
        opportunities = build_opportunities([cluster])
        html = render_html_report(opportunities, source_description="fixture")
        self.assertNotIn("<img src=x onerror=alert(1)>", html)
        self.assertNotIn("<b>hacker</b>", html)

    def test_report_is_in_french_and_contains_disclaimer(self):
        cluster = Cluster(posts=[make_post("1", "a", "I manually do this, so frustrating, I'd pay.")])
        opportunities = build_opportunities([cluster])
        html = render_html_report(opportunities, source_description="fixture")
        self.assertIn("Opportunités", html)
        self.assertIn("hypothèse", html.lower())
        self.assertIn("<html", html.lower())

    def test_report_includes_evidence_links(self):
        cluster = Cluster(posts=[make_post("1", "a", "I manually do this, so frustrating, I'd pay.")])
        opportunities = build_opportunities([cluster])
        html = render_html_report(opportunities, source_description="fixture")
        self.assertIn("https://reddit.com/1", html)


if __name__ == "__main__":
    unittest.main()
