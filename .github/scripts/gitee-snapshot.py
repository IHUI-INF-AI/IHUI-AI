#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Gitee 国内只读源码快照(方案 c, 2026-11-04 立)

语义:一棵树 + 一个**无父提交**,force 推到 Gitee refs/heads/main。
  为什么不推历史:2026-09-28 实测 Gitee 配额 1024MB 硬顶,历史镜像因此于 2026-10-23
  整体下线(见 scripts/check-mirror-purge-intact.mjs);本脚本只搬当前 origin/main 的树,
  不携带任何父提交/历史/LFS。
  为什么必须 force:无父提交与 Gitee 侧旧快照在提交图上无祖先关系,普通 push 必被拒;
  force **仅作用于 Gitee 的 refs/heads/main**,不碰 GitHub、不碰任何 tag。

刷新节奏(方案 c):
  · .github/workflows/snapshot-to-cn.yml —— schedule 每周一次 + workflow_dispatch;
  · release-desktop.yml 末端 `snapshot-gitee` —— 每次 desktop-v* 发版后刷新。
  因此落后窗口 ≤ 7 天;最新代码仍以 GitHub main 为准。

可观测(每次运行打印三件,便于对账):
  snapshot SHA  /  source(origin/main) SHA  /  tree SHA

用法:
  python3 .github/scripts/gitee-snapshot.py              # 生成并推送(CI 用)
  python3 .github/scripts/gitee-snapshot.py --self-test  # 离线自证(不联网、不推送)
"""

import base64
import os
import subprocess
import sys
import time

GITEE_REPO = os.environ.get("GITEE_REPO", "IHUI-AI")
GITEE_OWNER = os.environ.get("GITEE_OWNER", "")
GITEE_TOKEN = os.environ.get("GITEE_TOKEN", "")
SOURCE_SHA_IN = os.environ.get("SOURCE_SHA", "").strip()


def gitee_url():
    """运行时读 env —— self-test 里临时改 owner 也能生效。"""
    owner = os.environ.get("GITEE_OWNER", "")
    repo = os.environ.get("GITEE_REPO", "IHUI-AI")
    return f"https://gitee.com/{owner}/{repo}.git"


def redact(text):
    if not text:
        return ""
    token = os.environ.get("GITEE_TOKEN", "")
    return str(text).replace(token, "***") if token else str(text)


def git_env():
    """鉴权只走环境配置,不进 argv —— token 不出现在进程命令行与日志。"""
    env = dict(os.environ)
    env["GIT_TERMINAL_PROMPT"] = "0"
    token = os.environ.get("GITEE_TOKEN", "")
    owner = os.environ.get("GITEE_OWNER", "")
    if token:
        raw = f"{owner}:{token}".encode()
        env["GIT_CONFIG_COUNT"] = "1"
        env["GIT_CONFIG_KEY_0"] = "http.extraHeader"
        env["GIT_CONFIG_VALUE_0"] = (
            "Authorization: Basic " + base64.b64encode(raw).decode())
    return env


def _git(args, timeout=300):
    return subprocess.run(args, capture_output=True, text=True,
                          timeout=timeout, env=git_env())


def _out(args, timeout=300):
    proc = _git(args, timeout)
    if proc.returncode != 0:
        raise RuntimeError(redact(proc.stderr or proc.stdout)[-800:])
    return (proc.stdout or "").strip()


def tree_of(rev):
    return _out(["git", "rev-parse", f"{rev}^{{tree}}"])


def fetch_origin_main():
    """以运行时刻的 origin/main 为准(不依赖 checkout 那次快照的 github.sha)。"""
    _out(["git", "fetch", "--no-tags", "--depth=1", "origin",
          "refs/heads/main"])
    return _out(["git", "rev-parse", "FETCH_HEAD"])


def make_snapshot(tree, source, now=None):
    """生成无父提交(commit-tree 不带 -p)。"""
    stamp = now or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    env = git_env()
    env["GIT_AUTHOR_NAME"] = env["GIT_COMMITTER_NAME"] = "ihui-snapshot-bot"
    env["GIT_AUTHOR_EMAIL"] = env["GIT_COMMITTER_EMAIL"] = "bot@aizhs.top"
    proc = subprocess.run(
        ["git", "commit-tree", tree, "-m",
         f"snapshot: {source} @ {stamp}"],
        capture_output=True, text=True, timeout=120, env=env)
    if proc.returncode != 0:
        raise RuntimeError(redact(proc.stderr)[-800:])
    return proc.stdout.strip()


def has_parent(sha):
    body = _out(["git", "cat-file", "-p", sha])
    return any(line.startswith("parent ") for line in body.splitlines())


def push_argv(snapshot_sha):
    """force 只对 Gitee refs/heads/main;单独成函数便于 self-test 断言。"""
    return ["git", "push", "--force", gitee_url(),
            f"{snapshot_sha}:refs/heads/main"]


def push_snapshot(snapshot_sha):
    proc = _git(push_argv(snapshot_sha))
    if proc.returncode != 0:
        raise RuntimeError(redact(
            (proc.stdout or "") + (proc.stderr or ""))[-800:])


def parse_ls_remote(text):
    for line in (text or "").splitlines():
        fields = line.split()
        if len(fields) >= 2 and fields[1] == "refs/heads/main":
            return fields[0]
    return ""


def remote_main_sha():
    return parse_ls_remote(_out(
        ["git", "ls-remote", gitee_url(), "refs/heads/main"]))


def remote_subject():
    """浅取 Gitee main 一个提交,读提交说明(幂等判据用)。"""
    _out(["git", "fetch", "--no-tags", "--depth=1", gitee_url(),
          "refs/heads/main"])
    return _out(["git", "log", "-1", "--format=%s", "FETCH_HEAD"])


def report(source, snapshot, tree):
    print(f"[snapshot] snapshot SHA = {snapshot}")
    print(f"[snapshot] source SHA   = {source}")
    print(f"[snapshot] tree SHA     = {tree}")
    summary = os.environ.get("GITHUB_STEP_SUMMARY", "")
    if summary:
        try:
            with open(summary, "a", encoding="utf-8") as fh:
                fh.write("### Gitee 源码只读快照\n")
                fh.write(f"- snapshot SHA: `{snapshot}`\n")
                fh.write(f"- source origin/main SHA: `{source}`\n")
                fh.write(f"- tree SHA: `{tree}`\n")
        except OSError:
            pass


def _require_env():
    missing = [k for k in ("GITEE_TOKEN", "GITEE_OWNER") if not os.environ.get(k)]
    if missing:
        sys.exit(f"缺少环境变量: {', '.join(missing)}(Gitee 侧需 projects 权限的私人令牌)")


def main():
    _require_env()
    source = SOURCE_SHA_IN or fetch_origin_main()
    tree = tree_of(source)
    snapshot = make_snapshot(tree, source)
    if has_parent(snapshot):
        sys.exit("[snapshot] 生成提交意外带 parent —— 拒绝推送")
    try:
        current = remote_main_sha()
        if current and f"snapshot: {source} @" in remote_subject():
            print(f"[snapshot] Gitee main 已记录同一来源 {source},跳过推送(幂等)")
            report(source, current, tree)
            return
    except Exception as e:
        print(f"[snapshot] 预检未判定(继续推送): {redact(e)}")
    push_snapshot(snapshot)
    remote = remote_main_sha()
    if remote != snapshot:
        sys.exit(f"[snapshot] 推送后 Gitee main={remote or '<空>'} 与快照 {snapshot} 不一致")
    report(source, snapshot, tree)


def self_test():
    """离线自证(不联网、不推送)。

    反向例 A:模拟 origin/main 前进一个提交 —— 对 A(新 tip)与其父 B 各生成无父快照,
    断言两份快照的树分别与对应源提交的树逐字相等(git diff --stat 为空),且 A/B 树不同。
    反向例 B:断言快照提交无 parent(cat-file -p 无 parent 行)。
    """
    done = []

    def case(name, fn):
        fn()
        done.append(name)
        print(f"[self-test] OK {name}")

    tip = _out(["git", "rev-parse", "origin/main"])
    prev = _out(["git", "rev-parse", "origin/main~1"])
    tree_new, tree_prev = tree_of(tip), tree_of(prev)

    def t1():
        snap = make_snapshot(tree_new, tip)
        body = _out(["git", "cat-file", "-p", snap])
        assert "parent " not in ("\n" + body), "快照提交不得带 parent"
        diff = _out(["git", "diff", "--stat", tip, snap])
        assert diff == "", f"树应逐字相等,实测 diff={diff!r}"
        print(f"[self-test]   A tip={tip[:10]} snapshot={snap[:10]} "
              f"tree={tree_of(snap)[:10]} diff=空")

    case("R1 origin/main 新 tip ⇒ 无父快照树逐字相等", t1)

    def t2():
        snap = make_snapshot(tree_prev, prev)
        body = _out(["git", "cat-file", "-p", snap])
        assert "parent " not in ("\n" + body), "快照提交不得带 parent"
        diff = _out(["git", "diff", "--stat", prev, snap])
        assert diff == "", f"前进前基线也应逐字相等,实测 diff={diff!r}"
        assert tree_prev != tree_new, "A/B 两提交树应不同(否则模拟不成立)"
        print(f"[self-test]   B prev={prev[:10]} snapshot={snap[:10]} "
              f"tree={tree_of(snap)[:10]} diff=空;A/B tree 不同")

    case("R2 前进前的基线同样逐字相等且 A/B 树不同", t2)

    def t3():
        os.environ["GITEE_TOKEN"] = "S3CRET-TOKEN"
        os.environ["GITEE_OWNER"] = "owner-x"
        try:
            argv = push_argv("deadbeef")
            joined = " ".join(argv)
            assert "--force" in argv, argv
            assert argv[-1] == "deadbeef:refs/heads/main", argv
            assert "gitee.com/owner-x/IHUI-AI.git" in joined, joined
            assert "S3CRET-TOKEN" not in joined, joined
            env = git_env()
            want = base64.b64encode(b"owner-x:S3CRET-TOKEN").decode()
            assert want in env["GIT_CONFIG_VALUE_0"], env["GIT_CONFIG_VALUE_0"]
            assert "S3CRET-TOKEN" not in env["GIT_CONFIG_KEY_0"]
        finally:
            os.environ.pop("GITEE_TOKEN", None)
            os.environ.pop("GITEE_OWNER", None)

    case("R3 force+/refs/heads/main 正确,token 只在 env", t3)

    def t4():
        assert parse_ls_remote("abc123\trefs/heads/main\n") == "abc123"
        assert parse_ls_remote("") == ""
        assert parse_ls_remote("def456\trefs/heads/other\n") == ""

    case("R4 ls-remote 解析只认 refs/heads/main", t4)

    print(f"[self-test] 全部通过: {len(done)} 项(离线,未联网、未推送)")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
