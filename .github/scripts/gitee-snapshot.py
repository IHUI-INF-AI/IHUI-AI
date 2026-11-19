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

# Gitee 侧网络预算(2026-11-20 立):GitHub 机房到 gitee.com 实测会整段逾时——
# 旧值单次 300s ⇒ 一次 job 白等 6 分钟仍判"快照失败"。现在单次 60s、最多重试 2 次,
# 并把"取不到远端"与"被远端拒绝"分开判(见 classify_failure / undetermined)。
NET_TIMEOUT = int(os.environ.get("GITEE_NET_TIMEOUT", "60"))
NET_RETRIES = int(os.environ.get("GITEE_NET_RETRIES", "2"))


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


# ── 失败三态(AGENTS §0.3:取不到输入 ⇒ 未判定,不记绿也不冒红) ──
# unreachable = 网络层拿不到远端(host 解析/连接/超时/TLS 握手中断/传输截断)。
#   这类只能判"未判定":远端可能完好,只是这一轮没读到 ⇒ 不得报成"快照失败"。
# denied      = 远端明确拒绝(鉴权/权限/403/401) ⇒ 真失败,必须红。
# failed      = 其它确定性失败(引用不一致、内容异常、未知 rc) ⇒ 真失败,必须红。
DENIED_MARKERS = (
    "authentication failed", "invalid username or password", "not authorized",
    "permission denied", "access denied", "could not read username",
    "denied to user", "permission to ", "protected branch",
    "401 unauthorized", "403 forbidden", "returned error: 403", "returned error: 401",
)
UNREACHABLE_MARKERS = (
    "could not resolve host", "failed to connect", "connection refused",
    "connection reset", "connection timed out", "operation timed out",
    "timed out", "timeout", "early eof", "rpc failed", "the remote end hung up",
    "network is unreachable", "gnutls_handshake", "tls connection",
    "ssl connect", "error: 502", "error: 503", "error: 504",
)


def classify_failure(text):
    """把 git 的失败文本归到三态之一(先鉴权后网络:403 由网关回也可能是鉴权)。"""
    low = str(text or "").lower()
    for marker in DENIED_MARKERS:
        if marker in low:
            return "denied"
    for marker in UNREACHABLE_MARKERS:
        if marker in low:
            return "unreachable"
    return "failed"


def _tag(msg):
    """GitHub Actions 注解:未判定走 warning,真失败走 error。"""
    print(f"::{msg}")


def undetermined(reason, what):
    """网络不可达 ⇒ 显式未判定并正常退出。

    为什么不是"失败":远端仓库可能完全正常,只是这一轮从本机读不到它;
    把"读不到"报成"快照坏了"会让这条门恒红(AGENTS §12e),也会掩盖下一次真失败。
    可观测性由 ::warning:: 注解 + step summary 的双重标注保证。
    """
    line = (f"[snapshot] 未判定({what}):Gitee 侧本轮不可达 —— 远端未被改写,"
            f"快照状态未判定(不等于通过)")
    _tag("warning::" + line)
    print(f"[snapshot] 失败归类=unreachable 原因={redact(reason)[:400]}")
    summary = os.environ.get("GITHUB_STEP_SUMMARY", "")
    if summary:
        try:
            with open(summary, "a", encoding="utf-8") as fh:
                fh.write("### Gitee 源码只读快照\n")
                fh.write(f"- 状态: **未判定**(Gitee 不可达,远端未改写)\n")
                fh.write(f"- 环节: {what}\n")
        except OSError:
            pass
    sys.exit(0)


def _git_net(args, timeout=None, retries=None):
    """带预算的网络操作:返回 (proc, verdict)。

    verdict 为 None ⇒ 成功;否则 (kind, detail),kind 是三态之一。
    只对 unreachable 重试 —— 鉴权失败重试 3 次没有意义,只会把 job 拖长。
    """
    timeout = timeout or NET_TIMEOUT
    retries = NET_RETRIES if retries is None else retries
    verdict = None
    for attempt in range(retries + 1):
        try:
            proc = _git(args, timeout)
        except subprocess.TimeoutExpired:
            verdict = ("unreachable", f"timeout after {timeout}s")
        else:
            if proc.returncode == 0:
                return proc, None
            verdict = (classify_failure((proc.stderr or "") + (proc.stdout or "")),
                       redact((proc.stderr or "") + (proc.stdout or ""))[-800:])
        if verdict[0] != "unreachable" or attempt == retries:
            return None, verdict
        time.sleep(2 * (attempt + 1))
    return None, verdict


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
    """推快照:成功返回 None;否则返回 (三态, 详情)。"""
    _, verdict = _git_net(push_argv(snapshot_sha))
    return verdict


def parse_ls_remote(text):
    for line in (text or "").splitlines():
        fields = line.split()
        if len(fields) >= 2 and fields[1] == "refs/heads/main":
            return fields[0]
    return ""


def remote_main_sha():
    """返回 (sha, verdict);拿不到远端时 sha 为 ""、verdict 给出三态。"""
    proc, verdict = _git_net(["git", "ls-remote", gitee_url(), "refs/heads/main"])
    if verdict:
        return "", verdict
    return parse_ls_remote((proc.stdout or "").strip()), None


def remote_subject():
    """浅取 Gitee main 一个提交,读提交说明(幂等判据用)。返回 (subject, verdict)。"""
    proc, verdict = _git_net(["git", "fetch", "--no-tags", "--depth=1",
                              gitee_url(), "refs/heads/main"])
    if verdict:
        return "", verdict
    log, log_v = _git_net(["git", "log", "-1", "--format=%s", "FETCH_HEAD"])
    if log_v:
        return "", log_v
    return (log.stdout or "").strip(), None


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

    # 幂等预检。这里分三种:已同步 ⇒ 跳过;拿不到 ⇒ 继续走推送再说;
    # 被远端明确拒绝 ⇒ 不白推一次,直接按真失败报。
    current, pre = remote_main_sha()
    if current:
        subject, sub_v = remote_subject()
        if sub_v and sub_v[0] != "unreachable":
            _tag("error::[snapshot] 预检读不到 Gitee 提交说明(" + sub_v[0] + ")")
            sys.exit(f"[snapshot] 预检失败({sub_v[0]}):{sub_v[1]}")
        if subject and f"snapshot: {source} @" in subject:
            print(f"[snapshot] Gitee main 已记录同一来源 {source},跳过推送(幂等)")
            report(source, current, tree)
            return
    elif pre and pre[0] != "unreachable":
        _tag("error::[snapshot] 预检被 Gitee 拒绝(" + pre[0] + ")")
        sys.exit(f"[snapshot] 预检被远端拒绝({pre[0]}):{pre[1]}")
    elif pre:
        print(f"[snapshot] 预检未判定(继续尝试推送): {redact(pre[1])[:200]}")

    verdict = push_snapshot(snapshot)
    if verdict and verdict[0] == "unreachable":
        undetermined(verdict[1], "force push 快照")
    if verdict:
        _tag("error::[snapshot] 推送被 Gitee 拒绝(" + verdict[0] + ")")
        sys.exit(f"[snapshot] 推送失败({verdict[0]}):{verdict[1]}")

    remote, rv = remote_main_sha()
    if rv and rv[0] == "unreachable":
        undetermined(rv[1], "推送后复核 ls-remote")
    if rv:
        sys.exit(f"[snapshot] 推送后复核失败({rv[0]}):{rv[1]}")
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

    def t5():
        # 反向:网络层文本必须归 unreachable —— 否则这条门会再变恒红
        for text in (
            "fatal: unable to access 'https://gitee.com/x/y.git/': Failed to "
            "connect to gitee.com port 443 after 60001 ms: Could not connect to server",
            "error: RPC failed; curl 56 GnuTLS recv error (-110): "
            "The TLS connection was non-properly terminated.",
            "fatal: unable to access 'https://gitee.com/x/y.git/': "
            "The requested URL returned error: 502",
            "fatal: the remote end hung up unexpectedly",
            "fatal: unable to access 'https://gitee.com/x/y.git/': Operation timed out",
        ):
            assert classify_failure(text) == "unreachable", text
        # 正向:鉴权/权限/被拒必须归 denied —— 不得被吞成"未判定"
        for text in (
            "remote: Permission to x/y.git denied to user.",
            "fatal: Authentication failed for 'https://gitee.com/x/y.git/'",
            "fatal: unable to access 'https://gitee.com/x/y.git/': "
            "The requested URL returned error: 403",
        ):
            assert classify_failure(text) == "denied", text
        # 其它确定性失败仍是 failed
        assert classify_failure("remote: [hook] rejected by policy") == "failed"
        assert classify_failure("") == "failed"
        print("[self-test]   网络类 5 例→unreachable;鉴权类 3 例→denied;其它→failed")

    case("R5 失败三态:网络→unreachable / 鉴权→denied / 其它→failed", t5)

    def t6():
        code = None
        try:
            undetermined("simulated timeout", "self-test")
        except SystemExit as e:
            code = e.code
        assert code == 0, f"未判定必须 exit 0(否则这条门仍恒红),实测 {code}"
        print("[self-test]   未判定出口 exit 0(catchable,不冒红)")

    case("R6 未判定出口 exit 0:网络不可达不判红", t6)

    print(f"[self-test] 全部通过: {len(done)} 项(离线,未联网、未推送)")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
