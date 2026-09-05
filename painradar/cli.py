"""Command line interface for Reddit Pain Radar.

Usage (offline, no network, no API key):
    python3 -m painradar --fixture fixtures/sample_posts.json --out-json reports/demo.json --out-html reports/demo.html

Usage (bounded live collection from public subreddit RSS feeds):
    python3 -m painradar --live smallbusiness,freelance --max-items 15 --timeout 8 --delay 2 \
        --out-json reports/live.json --out-html reports/live.html
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import List, Optional

from .ingest import IngestError, load_posts_from_fixture
from .live import collect_live_posts
from .models import Post
from .pipeline import run_pipeline

DEFAULT_USER_AGENT = "painradar-poc/0.1 (educational research bot; contact: set --user-agent)"


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python3 -m painradar",
        description="Reddit Pain Radar — détection explicable de points de douleur (offline fixture ou RSS bornée).",
    )
    parser.add_argument(
        "--fixture",
        default="fixtures/sample_posts.json",
        help="Chemin vers un fichier JSON de posts (défaut : fixtures/sample_posts.json). Ignoré si --live est utilisé.",
    )
    parser.add_argument(
        "--live",
        default=None,
        help="Liste de subreddits séparés par des virgules à collecter en direct via RSS (ex: smallbusiness,freelance).",
    )
    parser.add_argument("--max-items", type=int, default=15, help="Nombre max de posts par flux en mode --live (défaut 15).")
    parser.add_argument("--timeout", type=float, default=8.0, help="Timeout HTTP en secondes en mode --live (défaut 8).")
    parser.add_argument("--delay", type=float, default=2.0, help="Délai en secondes entre deux flux en mode --live (défaut 2).")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT, help="User-Agent HTTP envoyé en mode --live.")
    parser.add_argument("--out-json", default="reports/report.json", help="Chemin de sortie du rapport JSON.")
    parser.add_argument("--out-html", default="reports/report.html", help="Chemin de sortie du rapport HTML.")
    return parser


def _load_fixture_posts(path: str) -> List[Post]:
    return load_posts_from_fixture(path)


def _load_live_posts(args: argparse.Namespace) -> List[Post]:
    subreddits = [s.strip() for s in args.live.split(",") if s.strip()]
    result = collect_live_posts(
        subreddits,
        user_agent=args.user_agent,
        timeout=args.timeout,
        max_items_per_feed=args.max_items,
        delay_seconds=args.delay,
    )
    for subreddit, error in result.errors.items():
        print(f"[avertissement] r/{subreddit} : {error}", file=sys.stderr)
    return result.posts


def _write_outputs(report_dict: dict, html: str, out_json: str, out_html: str) -> None:
    for path in (out_json, out_html):
        directory = os.path.dirname(path)
        if directory:
            os.makedirs(directory, exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(report_dict, f, ensure_ascii=False, indent=2)
    with open(out_html, "w", encoding="utf-8") as f:
        f.write(html)


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    try:
        if args.live:
            posts = _load_live_posts(args)
            source_description = f"live RSS: {args.live}"
        else:
            posts = _load_fixture_posts(args.fixture)
            source_description = f"fixture: {args.fixture}"
    except IngestError as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        return 1

    report_dict, html = run_pipeline(posts, source_description=source_description)
    _write_outputs(report_dict, html, args.out_json, args.out_html)

    print(f"{len(posts)} posts analysés, {len(report_dict['opportunities'])} opportunité(s) détectée(s).")
    print(f"Rapport JSON : {args.out_json}")
    print(f"Rapport HTML : {args.out_html}")
    return 0
