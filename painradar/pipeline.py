"""Wire ingestion -> clustering -> scoring -> reports into one orchestration function."""
from __future__ import annotations

from typing import List, Tuple

from .clustering import cluster_posts
from .models import Post
from .opportunity import build_opportunities
from .report_html import render_html_report
from .report_json import build_report_dict
from .signals import detect_pain_signals


def run_pipeline(posts: List[Post], source_description: str) -> Tuple[dict, str]:
    pain_posts = [
        post
        for post in posts
        if detect_pain_signals(f"{post.title}\n{post.selftext}").matched_categories
    ]
    clusters = cluster_posts(pain_posts)
    opportunities = build_opportunities(clusters)
    report_dict = build_report_dict(opportunities, source_description=source_description)
    html = render_html_report(opportunities, source_description=source_description)
    return report_dict, html
