"""CI Drill 失败钉钉通知 (建议 1 落地工具).

CI 演练失败时, 把失败汇总推到钉钉群, 让运维及时看到.
支持加签 (DINGTALK_SECRET) 和无加签 (留空) 两种模式.

用法:
  python scripts/ci/dingtalk_drill_notify.py \
    --webhook https://oapi.dingtalk.com/robot/send?access_token=XXX \
    --secret SECxxx \
    --date 20260616 \
    --run-id 12345 \
    --report drill_report.md \
    --repo org/repo
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import sys
import time
import urllib.parse
from pathlib import Path

import requests


def sign_webhook(url: str, secret: str) -> str:
    """钉钉加签: 在 URL 后追加 timestamp + sign."""
    timestamp = str(round(time.time() * 1000))
    string_to_sign = f"{timestamp}\n{secret}"
    hmac_code = hmac.new(
        secret.encode("utf-8"),
        string_to_sign.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    sign = urllib.parse.quote_plus(base64.b64encode(hmac_code))
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}timestamp={timestamp}&sign={sign}"


def read_report(path: str) -> str:
    p = Path(path)
    if not p.exists():
        return "(报告文件不存在)"
    return p.read_text(encoding="utf-8", errors="replace")


def build_message(date: str, run_id: str, repo: str, report: str) -> dict:
    """构造 markdown 消息."""
    title = f"Phase 8 Weekly Drill 失败 ({date})"
    run_url = f"https://github.com/{repo}/actions/runs/{run_id}"
    return {
        "msgtype": "markdown",
        "markdown": {
            "title": title,
            "text": (
                f"## {title}\n"
                f"**仓库**: {repo}\n"
                f"**Run ID**: [{run_id}]({run_url})\n"
                f"**日期**: {date}\n\n"
                f"### 演练汇总\n"
                f"```\n{report}\n```\n\n"
                f"@所有人 请尽快排查失败 job, 详细日志见 GitHub Actions artifacts."
            ),
        },
        "at": {"isAtAll": True},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="CI Drill 失败钉钉通知")
    parser.add_argument("--webhook", required=True, help="钉钉机器人 webhook URL")
    parser.add_argument("--secret", default="", help="钉钉加签密钥 (SEC开头, 留空=无加签)")
    parser.add_argument("--date", required=True, help="演练日期 YYYYMMDD")
    parser.add_argument("--run-id", required=True, help="GitHub Actions run id")
    parser.add_argument("--report", required=True, help="drill_report.md 路径")
    parser.add_argument("--repo", required=True, help="仓库名 org/repo")
    args = parser.parse_args()

    url = sign_webhook(args.webhook, args.secret) if args.secret else args.webhook
    report = read_report(args.report)
    msg = build_message(args.date, args.run_id, args.repo, report)

    print(f"[notify] POST -> {args.webhook[:80]}...")
    r = requests.post(url, json=msg, timeout=10)
    print(f"[notify] status={r.status_code} body={r.text[:120]}")
    if r.status_code != 200:
        return 1
    try:
        data = r.json()
        if data.get("errcode", 0) != 0:
            print(f"[notify] errcode={data.get('errcode')} errmsg={data.get('errmsg')}")
            return 1
    except Exception:
        pass
    print("[notify] OK 已推送")
    return 0


if __name__ == "__main__":
    sys.exit(main())
