"""Phase 14 建议 3: S3 Lifecycle 漂移 PR Bot.

目的:
  Phase 13 建议 3 实现了 s3_lifecycle_drift.py 检测线上 S3 vs YAML 差异.
  Phase 14 加:
  1. GitHub Actions 集成: 检测到漂移时自动创建/更新 PR comment
  2. 阻断合并: 检测到漂移时 CI 失败 (exit 1)
  3. 评论幂等: 多次运行覆盖同一 comment (按 marker 识别)
  4. 环境变量配置: GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER 等
  5. 安全: 只读 token, 不修改 S3

用法 (CI 中):
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  steps:
    - run: |
        python scripts/ci/s3_lifecycle_drift_bot.py \\
          --config config/s3-lifecycle.yml \\
          --bucket $BUCKET \\
          --strict

设计:
  - Bot 调 s3_lifecycle_drift.compare() 获取 DriftItem 列表
  - format_pr_comment() 生成 Markdown
  - post_pr_comment() 用 GitHub API 创建/更新
  - exit code: --strict + 漂移>0 → 1; 否则 0
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

# 复用 s3_lifecycle_drift 模块
_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT / "scripts" / "ops"))

from s3_lifecycle_drift import (  # noqa: E402
    DriftItem,
    compare,
    fetch_live_rules,
    format_markdown,
)
from s3_lifecycle_tiering import load_rules, validate_rules  # noqa: E402

# ---------------------------------------------------------------------------
# 1. PR Comment 标记
# ---------------------------------------------------------------------------

PR_COMMENT_MARKER = "<!-- zhs-s3-lifecycle-drift-bot -->"


def format_pr_comment(
    drift_items: list[DriftItem],
    bucket: str,
    config_path: str = "config/s3-lifecycle.yml",
) -> str:
    """生成 PR comment 文本, 含 marker 便于幂等更新.

    GitHub issue comment API 支持 markdown, 用 marker 隐藏行 (HTML 注释) 标记本 bot 评论.
    多次运行时通过 marker 找到已有 comment 覆盖.
    """
    body = format_markdown(drift_items, bucket)
    if not body.startswith(PR_COMMENT_MARKER):
        body = f"{PR_COMMENT_MARKER}\n{body}"
    # 追加: 配置变更说明
    if drift_items:
        body += f"\n\n<details><summary>配置位置</summary>\n\n`{config_path}`\n</details>\n"
    return body


# ---------------------------------------------------------------------------
# 2. GitHub API 集成
# ---------------------------------------------------------------------------


def find_existing_comment(
    repo: str,
    pr_number: int,
    token: str,
    timeout_s: float = 10.0,
) -> int | None:
    """查找 PR 上由本 bot 创建的 comment, 返回 comment id, 没有则 None.

    GitHub API: GET /repos/{owner}/{repo}/issues/{pr_number}/comments
    """
    try:
        import urllib.error
        import urllib.request
    except ImportError:
        return None
    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[warn] 拉 PR comments 失败: {e}", file=sys.stderr)
        return None
    for c in data:
        body = c.get("body", "")
        if PR_COMMENT_MARKER in body:
            return c.get("id")
    return None


def post_pr_comment(
    repo: str,
    pr_number: int,
    body: str,
    token: str,
    comment_id: int | None = None,
    timeout_s: float = 10.0,
) -> int:
    """创建或更新 PR comment. 返回 comment id."""
    try:
        import urllib.error
        import urllib.request
    except ImportError:
        return 0
    if comment_id:
        url = f"https://api.github.com/repos/{repo}/issues/comments/{comment_id}"
        method = "PATCH"
    else:
        url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
        method = "POST"
    payload = json.dumps({"body": body}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return int(data.get("id", 0))
    except urllib.error.HTTPError as e:
        print(f"[error] GitHub API {method} 失败: {e.code} {e.reason}", file=sys.stderr)
        try:
            err_body = e.read().decode("utf-8")
            print(f"[error] body: {err_body[:500]}", file=sys.stderr)
        except Exception:
            pass
        return 0
    except Exception as e:
        print(f"[error] GitHub API 调用失败: {e}", file=sys.stderr)
        return 0


# ---------------------------------------------------------------------------
# 3. CLI
# ---------------------------------------------------------------------------


def _boto3_client(endpoint_url: str | None = None):
    import boto3

    kwargs: dict[str, Any] = {"region_name": os.environ.get("AWS_DEFAULT_REGION", "us-east-1")}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    return boto3.client("s3", **kwargs)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="S3 Lifecycle 漂移 PR Bot")
    p.add_argument("--config", type=Path, required=True, help="YAML 配置路径")
    p.add_argument("--bucket", required=True, help="S3 桶名")
    p.add_argument("--endpoint-url", default=os.environ.get("AWS_ENDPOINT_URL", ""), help="自定义 endpoint")
    p.add_argument("--strict", action="store_true", help="有漂移时 exit 1 (CI 阻断)")
    p.add_argument("--no-comment", action="store_true", help="不发 PR comment (只输出报告)")
    p.add_argument("--dry-run", action="store_true", help="不调用 GitHub API, 只输出 comment 预览")
    args = p.parse_args(argv)

    # 1. 加载 YAML
    try:
        yaml_rules = load_rules(args.config)
    except Exception as e:
        print(f"[error] 加载 YAML 失败: {e}", file=sys.stderr)
        return 2
    errors = validate_rules(yaml_rules)
    if errors:
        print(f"[error] YAML 校验失败: {errors}", file=sys.stderr)
        return 2

    # 2. 拉线上
    try:
        client = _boto3_client(args.endpoint_url or None)
        live_rules = fetch_live_rules(client, args.bucket)
    except Exception as e:
        print(f"[error] 拉线上规则失败: {e}", file=sys.stderr)
        return 3

    # 3. 比对
    drift_items = compare(yaml_rules, live_rules)

    # 4. 生成 PR comment
    config_path = str(args.config).replace("\\", "/")
    comment_body = format_pr_comment(drift_items, args.bucket, config_path=config_path)

    # 5. 发 PR comment
    if not args.no_comment and not args.dry_run:
        repo = os.environ.get("GITHUB_REPOSITORY", "")
        pr_number_str = os.environ.get("PR_NUMBER", os.environ.get("GITHUB_PR_NUMBER", ""))
        token = os.environ.get("GITHUB_TOKEN", "")
        if not (repo and pr_number_str and token):
            print("[warn] GITHUB_REPOSITORY / PR_NUMBER / GITHUB_TOKEN 未配置, 跳过 PR comment", file=sys.stderr)
        else:
            try:
                pr_number = int(pr_number_str)
            except ValueError:
                print(f"[error] PR_NUMBER 格式错误: {pr_number_str!r}", file=sys.stderr)
                return 2
            existing_id = find_existing_comment(repo, pr_number, token)
            new_id = post_pr_comment(repo, pr_number, comment_body, token, comment_id=existing_id)
            if new_id:
                action = "更新" if existing_id else "创建"
                print(f"[info] {action} PR #{pr_number} comment id={new_id}")
            else:
                print("[error] 发 PR comment 失败", file=sys.stderr)
                return 4

    # 6. 输出报告
    if drift_items:
        print(f"⚠ 发现 {len(drift_items)} 条漂移:", file=sys.stderr)
        for it in drift_items:
            print(f"  {it.action.upper():7s} {it.rule_id}", file=sys.stderr)
    else:
        print("✓ 无漂移", file=sys.stderr)

    if args.dry_run:
        print("\n--- PR comment 预览 ---")
        print(comment_body)

    if args.strict and drift_items:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
