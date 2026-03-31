#!/usr/bin/env python3
"""
Analytics Interpreter — Query the database for user behavior data and generate
actionable UX recommendations as a markdown report.

Usage:
  python analyze_usage.py --output /mnt/documents/analytics-report.md
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print("Error: requests library required")
    sys.exit(1)


def run_query(sql):
    """Execute a SQL query via psql and return results."""
    try:
        result = subprocess.run(
            ["psql", "-t", "-A", "-F", "|", "-c", sql],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            return {"error": result.stderr.strip()}
        rows = []
        for line in result.stdout.strip().split("\n"):
            if line:
                rows.append(line.split("|"))
        return rows
    except Exception as e:
        return {"error": str(e)}


QUERIES = {
    "total_users": "SELECT COUNT(*) FROM profiles",
    "signups_last_7d": "SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '7 days'",
    "signups_last_30d": "SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '30 days'",
    "total_businesses": "SELECT COUNT(*) FROM businesses",
    "total_videos_generated": "SELECT COUNT(*) FROM video_generation_jobs",
    "videos_completed": "SELECT COUNT(*) FROM video_generation_jobs WHERE status = 'completed'",
    "videos_failed": "SELECT COUNT(*) FROM video_generation_jobs WHERE status = 'failed'",
    "videos_pending": "SELECT COUNT(*) FROM video_generation_jobs WHERE status IN ('queued', 'processing')",
    "total_content_posts": "SELECT COUNT(*) FROM content_posts",
    "posts_with_media": "SELECT COUNT(*) FROM content_posts WHERE media_url IS NOT NULL",
    "total_strategy_outputs": "SELECT COUNT(*) FROM strategy_outputs",
    "most_used_steps": "SELECT step_name, COUNT(*) as cnt FROM strategy_outputs GROUP BY step_name ORDER BY cnt DESC LIMIT 10",
    "forum_posts": "SELECT COUNT(*) FROM forum_posts",
    "forum_replies": "SELECT COUNT(*) FROM forum_replies",
    "active_referral_codes": "SELECT COUNT(*) FROM referral_codes WHERE is_active = true",
    "total_referral_conversions": "SELECT COUNT(*) FROM referral_conversions",
    "business_categories": "SELECT business_category, COUNT(*) FROM businesses WHERE business_category IS NOT NULL GROUP BY business_category ORDER BY count DESC LIMIT 10",
    "media_by_type": "SELECT file_type, COUNT(*) FROM business_media GROUP BY file_type ORDER BY count DESC",
    "video_providers": "SELECT provider, COUNT(*) FROM video_generation_jobs GROUP BY provider ORDER BY count DESC",
    "daily_signups_7d": "SELECT date_trunc('day', created_at)::date as day, COUNT(*) FROM profiles WHERE created_at > now() - interval '7 days' GROUP BY day ORDER BY day",
}


def get_ai_interpretation(data):
    """Use Lovable AI to interpret the data and generate recommendations."""
    api_key = os.environ.get("LOVABLE_API_KEY")
    if not api_key:
        return "⚠️ LOVABLE_API_KEY not available — skipping AI interpretation."

    try:
        resp = requests.post(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "google/gemini-2.5-flash",
                "messages": [
                    {"role": "system", "content": "You are a product analytics expert. Analyze the data and provide actionable UX recommendations. Be specific and data-driven."},
                    {"role": "user", "content": f"Here is the analytics data for our SaaS platform (RickyAI — an AI video + marketing strategy tool for businesses). Analyze it and provide:\n1. Key findings\n2. User behavior patterns\n3. Feature adoption rates\n4. Potential drop-off points\n5. Top 5 actionable recommendations\n\nData:\n{json.dumps(data, indent=2, default=str)}"}
                ],
            },
            timeout=60,
        )
        if resp.ok:
            return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        return f"⚠️ AI interpretation failed: {str(e)}"

    return "⚠️ Could not generate AI interpretation."


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Analytics Interpreter")
    parser.add_argument("--output", "-o", default="/mnt/documents/analytics-report.md", help="Output path")
    args = parser.parse_args()

    print("📊 Running analytics queries...")
    results = {}

    for name, sql in QUERIES.items():
        print(f"  Querying: {name}...", end=" ", flush=True)
        data = run_query(sql)
        results[name] = data
        if isinstance(data, dict) and "error" in data:
            print(f"❌ {data['error'][:80]}")
        else:
            print(f"✅ ({len(data)} rows)")

    # Build report
    timestamp = datetime.now(timezone.utc).isoformat()

    def val(key):
        d = results.get(key, [])
        if isinstance(d, list) and d and d[0]:
            return d[0][0]
        return "N/A"

    report_lines = [
        "# RickyAI Analytics Report",
        f"\n**Generated:** {timestamp}\n",
        "## 📈 Overview",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total Users | {val('total_users')} |",
        f"| Signups (7 days) | {val('signups_last_7d')} |",
        f"| Signups (30 days) | {val('signups_last_30d')} |",
        f"| Total Businesses | {val('total_businesses')} |",
        "",
        "## 🎬 Video Production",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total Jobs | {val('total_videos_generated')} |",
        f"| Completed | {val('videos_completed')} |",
        f"| Failed | {val('videos_failed')} |",
        f"| Pending | {val('videos_pending')} |",
        "",
        "## 📝 Content & Strategy",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Content Posts | {val('total_content_posts')} |",
        f"| Posts with Media | {val('posts_with_media')} |",
        f"| Strategy Outputs | {val('total_strategy_outputs')} |",
        "",
        "## 🏆 Most Used Strategy Steps",
        "",
        "| Step | Count |",
        "|------|-------|",
    ]

    steps = results.get("most_used_steps", [])
    if isinstance(steps, list):
        for row in steps:
            if len(row) >= 2:
                report_lines.append(f"| {row[0]} | {row[1]} |")

    report_lines.extend([
        "",
        "## 🏢 Business Categories",
        "",
        "| Category | Count |",
        "|----------|-------|",
    ])

    cats = results.get("business_categories", [])
    if isinstance(cats, list):
        for row in cats:
            if len(row) >= 2:
                report_lines.append(f"| {row[0]} | {row[1]} |")

    report_lines.extend([
        "",
        "## 💬 Community",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Forum Posts | {val('forum_posts')} |",
        f"| Forum Replies | {val('forum_replies')} |",
        f"| Active Referral Codes | {val('active_referral_codes')} |",
        f"| Referral Conversions | {val('total_referral_conversions')} |",
        "",
    ])

    # AI interpretation
    print("\n🤖 Generating AI interpretation...")
    interpretation = get_ai_interpretation(results)
    report_lines.extend([
        "## 🤖 AI Interpretation & Recommendations",
        "",
        interpretation,
        "",
    ])

    report = "\n".join(report_lines)

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w") as f:
        f.write(report)

    print(f"\n✅ Report written to {args.output}")


if __name__ == "__main__":
    main()
