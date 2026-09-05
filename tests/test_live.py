import io
import unittest
import urllib.error
from unittest.mock import patch

from painradar.live import fetch_subreddit_feed, collect_live_posts, FeedResult

ATOM_SAMPLE = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>reddit: r/testsub</title>
  <entry>
    <id>t3_abc123</id>
    <title>Manually copying data is exhausting, no solution exists</title>
    <content type="html">I manually copy data every day and it's frustrating, I'd pay for a fix.</content>
    <author><name>/u/atomuser</name></author>
    <link href="https://www.reddit.com/r/testsub/comments/abc123/post/"/>
    <updated>2024-01-01T00:00:00+00:00</updated>
  </entry>
</feed>
"""

RSS_SAMPLE = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>reddit: r/testsub2</title>
    <item>
      <title>Expensive tools are killing my small business, willing to pay for alternative</title>
      <description>All the CRMs are way too expensive, so frustrating for a small team.</description>
      <author>rssuser</author>
      <link>https://www.reddit.com/r/testsub2/comments/def456/post/</link>
      <guid>t3_def456</guid>
      <pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>
"""

MALFORMED_SAMPLE = b"<feed><entry><title>broken"


class FakeResponse:
    def __init__(self, data: bytes):
        self._buf = io.BytesIO(data)

    def read(self):
        return self._buf.read()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class TestFetchSubredditFeed(unittest.TestCase):
    @patch("painradar.live.urlopen")
    def test_parses_atom_feed(self, mock_urlopen):
        mock_urlopen.return_value = FakeResponse(ATOM_SAMPLE)
        result = fetch_subreddit_feed("testsub", user_agent="test-agent/1.0", timeout=5, max_items=10)
        self.assertTrue(result.ok)
        self.assertEqual(len(result.posts), 1)
        self.assertEqual(result.posts[0].author, "atomuser")
        self.assertIn("manually copy data", result.posts[0].selftext.lower())

    @patch("painradar.live.urlopen")
    def test_parses_rss_feed(self, mock_urlopen):
        mock_urlopen.return_value = FakeResponse(RSS_SAMPLE)
        result = fetch_subreddit_feed("testsub2", user_agent="test-agent/1.0", timeout=5, max_items=10)
        self.assertTrue(result.ok)
        self.assertEqual(len(result.posts), 1)
        self.assertEqual(result.posts[0].author, "rssuser")

    @patch("painradar.live.urlopen")
    def test_respects_max_items(self, mock_urlopen):
        mock_urlopen.return_value = FakeResponse(ATOM_SAMPLE)
        result = fetch_subreddit_feed("testsub", user_agent="ua", timeout=5, max_items=0)
        self.assertTrue(result.ok)
        self.assertEqual(len(result.posts), 0)

    @patch("painradar.live.urlopen")
    def test_handles_malformed_xml_gracefully(self, mock_urlopen):
        mock_urlopen.return_value = FakeResponse(MALFORMED_SAMPLE)
        result = fetch_subreddit_feed("broken", user_agent="ua", timeout=5, max_items=10)
        self.assertFalse(result.ok)
        self.assertIn("invalide", result.error.lower())

    @patch("painradar.live.urlopen")
    def test_handles_http_429(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.HTTPError(
            "url", 429, "Too Many Requests", hdrs=None, fp=None
        )
        result = fetch_subreddit_feed("ratelimited", user_agent="ua", timeout=5, max_items=10)
        self.assertFalse(result.ok)
        self.assertIn("429", result.error)

    @patch("painradar.live.urlopen")
    def test_handles_http_403(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.HTTPError(
            "url", 403, "Forbidden", hdrs=None, fp=None
        )
        result = fetch_subreddit_feed("blocked", user_agent="ua", timeout=5, max_items=10)
        self.assertFalse(result.ok)
        self.assertIn("403", result.error)

    @patch("painradar.live.urlopen")
    def test_handles_network_error(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.URLError("connection refused")
        result = fetch_subreddit_feed("unreachable", user_agent="ua", timeout=5, max_items=10)
        self.assertFalse(result.ok)
        self.assertIn("réseau", result.error.lower())

    @patch("painradar.live.urlopen")
    def test_sends_expected_user_agent(self, mock_urlopen):
        mock_urlopen.return_value = FakeResponse(ATOM_SAMPLE)
        fetch_subreddit_feed("testsub", user_agent="my-agent/2.0", timeout=5, max_items=10)
        request_arg = mock_urlopen.call_args[0][0]
        self.assertEqual(request_arg.get_header("User-agent"), "my-agent/2.0")
        self.assertEqual(mock_urlopen.call_args.kwargs.get("timeout"), 5)


class TestCollectLivePosts(unittest.TestCase):
    @patch("painradar.live.time.sleep")
    @patch("painradar.live.urlopen")
    def test_collects_across_multiple_subreddits_with_delay(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = [FakeResponse(ATOM_SAMPLE), FakeResponse(RSS_SAMPLE)]
        result = collect_live_posts(
            ["testsub", "testsub2"],
            user_agent="ua",
            timeout=5,
            max_items_per_feed=10,
            delay_seconds=0.01,
        )
        self.assertEqual(len(result.posts), 2)
        self.assertEqual(result.errors, {})
        mock_sleep.assert_called_with(0.01)

    @patch("painradar.live.time.sleep")
    @patch("painradar.live.urlopen")
    def test_collects_partial_results_when_one_feed_fails(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = [
            FakeResponse(ATOM_SAMPLE),
            urllib.error.HTTPError("url", 403, "Forbidden", hdrs=None, fp=None),
        ]
        result = collect_live_posts(
            ["testsub", "blocked"],
            user_agent="ua",
            timeout=5,
            max_items_per_feed=10,
            delay_seconds=0,
        )
        self.assertEqual(len(result.posts), 1)
        self.assertIn("blocked", result.errors)


if __name__ == "__main__":
    unittest.main()
