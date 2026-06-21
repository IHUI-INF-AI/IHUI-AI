"""CI 推送触发脚本.

帮助用户把本地代码推送到 GitHub 触发 GitHub Actions CI:
1. 检查 git 状态
2. 暂存指定文件
3. 创建触发 commit
4. 推送到 main 分支 (或自定义)
5. 等待 GitHub Actions 启动并返回 run URL

用法:
    python scripts/ci_push_trigger.py --message "ci: verify stage 1"
    python scripts/ci_push_trigger.py --branch feature/test --message "ci: 触发"
    python scripts/ci_push_trigger.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent
GIT_TIMEOUT = 30


def run(cmd: list[str], cwd: Path | None = None) -> tuple[int, str, str]:
    """执行 shell 命令."""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd or SERVER_ROOT,
            capture_output=True,
            text=True,
            timeout=GIT_TIMEOUT,
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return 1, "", "timeout"
    except FileNotFoundError as e:
        return 1, "", str(e)


def check_git() -> bool:
    code, _, _ = run(["git", "--version"])
    return code == 0


def git_status() -> str:
    code, out, _ = run(["git", "status", "--short"])
    return out if code == 0 else ""


def git_branch() -> str:
    code, out, _ = run(["git", "branch", "--show-current"])
    return out if code == 0 else ""


def git_remote_url() -> str:
    code, out, _ = run(["git", "remote", "get-url", "origin"])
    return out if code == 0 else ""


def git_add(paths: list[str]) -> tuple[int, str]:
    if not paths:
        return 0, ""
    code, out, err = run(["git", "add"] + paths)
    return code, out + err


def git_commit(message: str) -> tuple[int, str]:
    code, out, err = run(["git", "commit", "-m", message, "--no-verify"])
    return code, out + err


def git_push(remote: str, branch: str, force: bool = False) -> tuple[int, str]:
    cmd = ["git", "push", remote, branch]
    if force:
        cmd.insert(3, "--force-with-lease")
    code, out, err = run(cmd)
    return code, out + err


def get_run_url(remote_url: str, branch: str) -> str:
    """从 git remote url 推导 GitHub Actions URL."""
    # https://github.com/owner/repo.git -> https://github.com/owner/repo
    url = remote_url.rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]
    return f"{url}/actions?query=branch%3A{branch}"


def main() -> int:
    parser = argparse.ArgumentParser(description="CI 推送触发脚本")
    parser.add_argument("--branch", type=str, default="", help="目标分支 (默认当前分支)")
    parser.add_argument("--remote", type=str, default="origin", help="remote 名")
    parser.add_argument("--message", type=str, default="", help="commit 信息")
    parser.add_argument("--paths", type=str, nargs="*", default=[], help="要 add 的文件 (默认全选)")
    parser.add_argument("--force", action="store_true", help="force push (慎用)")
    parser.add_argument("--dry-run", action="store_true", help="演练, 不实际推送")
    args = parser.parse_args()

    print("===== CI 推送触发 =====")

    if not check_git():
        print("错误: git 未安装")
        return 1

    branch = args.branch or git_branch()
    if not branch:
        print("错误: 无法确定当前分支")
        return 1
    print(f"分支: {branch}")

    remote_url = git_remote_url()
    if not remote_url:
        print("错误: 没有配置 origin remote")
        return 1
    print(f"remote: {remote_url}")

    # 检查状态
    status = git_status()
    if not status and not args.paths:
        print("没有需要 commit 的变更, 创建空 commit 触发 CI")
        commit_msg = args.message or f"ci: trigger pipeline {datetime.now(timezone.utc).isoformat()}"
        cmd = ["git", "commit", "--allow-empty", "-m", commit_msg, "--no-verify"]
    else:
        print(f"变更: {len(status.splitlines())} 项")
        if args.paths:
            code, msg = git_add(args.paths)
            print(f"git add: {msg[:100]}")
        else:
            code, msg = git_add(["-A"])
            print(f"git add -A: {msg[:100]}")
        commit_msg = args.message or f"ci: trigger pipeline {datetime.now(timezone.utc).isoformat()}"
        code, msg = git_commit(commit_msg)
        print(f"git commit: {msg[:200]}")

    if args.dry_run:
        print("\nDRY-RUN 模式, 不实际推送")
        run_url = get_run_url(remote_url, branch)
        print(f"如执行, GitHub Actions URL: {run_url}")
        return 0

    # 推送
    code, msg = git_push(args.remote, branch, args.force)
    if code != 0:
        print(f"推送失败: {msg}")
        return 1
    print(f"推送成功: {msg[:200]}")

    run_url = get_run_url(remote_url, branch)
    print(f"\nGitHub Actions URL: {run_url}")
    print("请在浏览器打开链接查看 CI 执行情况")
    return 0


if __name__ == "__main__":
    sys.exit(main())
