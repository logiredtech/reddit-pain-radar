import unittest

from painradar.textnorm import normalize_text
from painradar.signals import detect_pain_signals, PAIN_CATEGORIES


class TestNormalizeText(unittest.TestCase):
    def test_lowercases_and_collapses_whitespace(self):
        self.assertEqual(normalize_text("  Hello   WORLD\n\n"), "hello world")

    def test_strips_urls(self):
        self.assertEqual(
            normalize_text("check this https://example.com/foo out"),
            "check this out",
        )


class TestDetectPainSignals(unittest.TestCase):
    def test_detects_manual_work_and_expensive_tools(self):
        text = "I manually copy data every week, the existing tools are way too expensive for us."
        result = detect_pain_signals(text)
        self.assertIn("manual_work", result.matched_categories)
        self.assertIn("expensive_tools", result.matched_categories)

    def test_detects_frustration_and_willingness_to_pay(self):
        text = "So frustrating that this doesn't exist, I would pay for a tool that fixes this."
        result = detect_pain_signals(text)
        self.assertIn("frustration", result.matched_categories)
        self.assertIn("willingness_to_pay", result.matched_categories)

    def test_no_signals_for_unrelated_text(self):
        text = "I bought a new mechanical keyboard today and it feels great."
        result = detect_pain_signals(text)
        self.assertEqual(result.matched_categories, set())
        self.assertEqual(result.diversity_score, 0)

    def test_diversity_score_counts_distinct_categories(self):
        text = (
            "I manually enter this data every day, there's no solution for it, "
            "it's so frustrating, and I'd pay for something that works."
        )
        result = detect_pain_signals(text)
        self.assertEqual(result.diversity_score, len(result.matched_categories))
        self.assertGreaterEqual(result.diversity_score, 3)

    def test_all_categories_are_registered(self):
        expected = {
            "manual_work",
            "expensive_tools",
            "missing_solution",
            "frustration",
            "willingness_to_pay",
        }
        self.assertEqual(set(PAIN_CATEGORIES.keys()), expected)


if __name__ == "__main__":
    unittest.main()
