import unittest

from painradar.problem import extract_problem_statement


class TestExtractProblemStatement(unittest.TestCase):
    def test_prefers_sentence_with_pain_signal_over_title(self):
        title = "Just a random title"
        selftext = (
            "Here is some context. I manually copy data every week and it's exhausting. "
            "Anyway, thanks for reading."
        )
        statement = extract_problem_statement(title, selftext)
        self.assertIn("manually copy data every week", statement.lower())

    def test_falls_back_to_title_when_no_pain_sentence(self):
        title = "Looking for recommendations on keyboards"
        selftext = "Just curious what people use these days."
        statement = extract_problem_statement(title, selftext)
        self.assertEqual(statement, title)

    def test_truncates_long_statement(self):
        title = "x"
        long_sentence = "I manually " + ("do this thing over and over " * 20) + "and it is expensive."
        statement = extract_problem_statement(title, long_sentence)
        self.assertLessEqual(len(statement), 220)

    def test_strips_whitespace(self):
        title = "  Some Title  "
        selftext = ""
        statement = extract_problem_statement(title, selftext)
        self.assertEqual(statement, "Some Title")


if __name__ == "__main__":
    unittest.main()
