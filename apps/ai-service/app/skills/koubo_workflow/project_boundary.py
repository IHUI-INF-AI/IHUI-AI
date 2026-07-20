#!/usr/bin/env python3
# project_boundary.py — 跨项目边界硬门禁（防止口播稿/公众号窜工作）
#
# 设计目标：让"在口播稿会话里跑公众号流水线 / 在公众号会话里跑口播稿工具 /
#           把错误产物类型写进对方目录"在技术上不可能发生，而不依赖 agent 记性。
#
# 三层防护（全部 fail-closed，默认拦截）：
#   1) 会话锁：init 声明 domain；锁超过 24h 视为过期，强制重新 init。
#   2) 工具拦截：跨项目流水线/审计工具在错误会话启动即 sys.exit(3)。
#   3) 写拦截：check_write() 在任何文件真正落盘前调用，拒绝
#        - 跨域产物类型（口播稿写 html/docx、公众号写 .txt）
#        - 把文件写进对方项目目录树
#        - 即使未声明会话，也防御性拒绝把禁产物流进对方树
#
# 用法（命令行）：
#   python project_boundary.py init <koubo|wechat>
#       声明本次会话所属项目。必须在任何写/发布操作之前执行。
#   python project_boundary.py check [--tool T] [--path P ...] [--cwd C]
#       在执行命令前校验；违反边界直接 sys.exit(3)。
#   python project_boundary.py check-write --path P [--path Q ...]
#       在写文件前校验每个目标路径；违反直接 sys.exit(3)。
#
# 作为模块被其他脚本 import：
#   import project_boundary
#   project_boundary.check_action(tool="publish_pipeline.py", paths=sys.argv[1:], cwd=os.getcwd())
#   project_boundary.check_write(out_path)   # 写交付物前调用
#
import sys, os, time

WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # skills/
KOUBO = os.path.join(WORKSPACE, "koubo_workflow")
WECHAT = os.path.join(WORKSPACE, "content_engine")
SESSION_FILE = os.path.join(WORKSPACE, ".session", "SESSION_DOMAIN")
STALE_SECONDS = 24 * 3600  # 锁超过 24h 视为过期，强制重新 init（fail-closed）

# 每个 domain 禁止的工具 / 路径片段 / 产物后缀
FORBID = {
    "koubo": {
        "tools": {"publish_pipeline.py", "full_audit.py",
                  "export_csdn_md.py", "build_gpt56_sol.py"}, # 公众号专属流水线/审计/构建
        "path_contains": ["content_engine", "wechat-article-system"], # 禁碰公众号目录
        "ext_forbid_write": {".html", ".docx"},               # 口播稿只产 .txt
        "note": "口播稿会话：只允许 .txt + koubo_validate/koubo_quality_gate/hot_topic_coverage/archive_daily/project_hygiene；"
                "禁止 publish_pipeline/full_audit/export_csdn_md/build_gpt56_sol、禁止进入或触碰公众号目录、禁止生成 html/docx。",
    },
    "wechat": {
        "tools": {"koubo_validate.py", "koubo_quality_gate.py",
                  "hot_topic_coverage_gate.py", "archive_daily.py",
                  "project_hygiene.py"},                       # 口播稿专属门禁/存档/卫生
        "path_contains": ["koubo_workflow", "koubo"],                 # 禁碰口播稿目录
        "ext_forbid_write": {".txt"},                         # 公众号禁 .txt / MMDD.txt
        "note": "公众号会话：只允许 md/html/docx + publish_pipeline/full_audit/export_csdn_md/build_gpt56_sol；"
                "禁止口播稿工具、禁止触碰口播稿目录、禁止生成 .txt。",
    },
}

RED = "\033[91m"
RESET = "\033[0m"
try:
    _HAVE_COLOR = sys.stderr.isatty()
except Exception:
    _HAVE_COLOR = False

def _c(s):
    return f"{RED}{s}{RESET}" if _HAVE_COLOR else s

def _under(path, root):
    """path 是否落在 root 目录树内（含 root 自身）。"""
    try:
        p = os.path.normpath(path)
        r = os.path.normpath(root)
        return p == r or p.startswith(r + os.sep)
    except Exception:
        return False

def read_session():
    """返回当前会话 domain；未声明/非法/过期 均返回 None（fail-closed）。"""
    try:
        with open(SESSION_FILE, encoding="utf-8") as f:
            raw = f.read().strip()
    except FileNotFoundError:
        return None
    if "|" in raw:
        domain, ts = raw.split("|", 1)
    else:
        domain, ts = raw, ""
    if domain not in FORBID:
        return None
    if ts:
        try:
            age = time.time() - time.mktime(time.strptime(ts, "%Y-%m-%dT%H:%M:%S"))
            if age > STALE_SECONDS:
                return None  # 过期，视为未声明
        except Exception:
            pass
    return domain

def init_session(domain):
    if domain not in FORBID:
        print(f"[边界] 未知 domain: {domain}", file=sys.stderr)
        sys.exit(2)
    os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
    ts = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(SESSION_FILE, "w", encoding="utf-8") as f:
        f.write(f"{domain}|{ts}")
    print(f"[边界] 已声明本次会话项目 = {domain}（有效期24h，过期需重新 init）。"
          f"后续写/发布操作将受该边界硬门禁保护。")

def _banner(domain, reason):
    bar = "=" * 64
    sys.stderr.write(bar + "\n")
    sys.stderr.write(_c(f"[边界硬门禁·已拦截] 当前会话项目 = {domain}\n"))
    sys.stderr.write(f"  原因: {reason}\n")
    if domain in FORBID:
        sys.stderr.write(f"  规则: {FORBID[domain]['note']}\n")
    sys.stderr.write(bar + "\n")

def check_write(path, tool=None, silent=False):
    """在真正写文件前调用。拒绝跨域产物类型 / 跨域目录写入。"""
    p = os.path.normpath(path)
    ext = os.path.splitext(p)[1].lower()
    domain = read_session()

    # —— 防御纵深：即使未声明会话，也禁止把禁产物流进对方树 ——
    if _under(p, WECHAT) and ext == ".txt":
        _banner("公众号目录", f"禁止在公众号树下生成 .txt 文件: {path}")
        sys.exit(3)
    if _under(p, KOUBO) and ext in (".html", ".docx"):
        _banner("口播稿目录", f"禁止在口播稿树下生成 html/docx 文件: {path}")
        sys.exit(3)

    if domain is None:
        # 未声明：禁止任何跨域产物写入（仅拦截 known 跨域类型）
        if ext == ".txt" and not _under(p, KOUBO):
            _banner("未声明", f"写入 .txt 前必须先声明会话(koubo): {path}")
            sys.exit(3)
        if ext in (".html", ".docx") and not _under(p, WECHAT):
            _banner("未声明", f"写入 html/docx 前必须先声明会话(wechat): {path}")
            sys.exit(3)
        if not silent:
            print(f"[边界] 写校验通过（未声明·仅做跨树防御）: {path}")
        return True

    rules = FORBID[domain]
    # 1) 产物类型拦截
    if ext in rules["ext_forbid_write"]:
        _banner(domain, f"产物类型 {ext} 不属于【{domain}】项目，禁止生成: {path}")
        sys.exit(3)
    # 2) 目录拦截
    for frag in rules["path_contains"]:
        if frag in p.replace("/", os.sep):
            _banner(domain, f"路径 {path} 落在另一项目目录内，禁止在【{domain}】会话写入")
            sys.exit(3)
    if not silent:
        print(f"[边界] 写校验通过（会话={domain}）: {path}")
    return True

def check_action(tool=None, paths=None, cwd=None, silent=False):
    domain = read_session()
    if domain is None:
        # 未声明：跨项目流水线一律拦截，强制先 init（fail-closed）
        if tool and os.path.basename(tool) in (
            "publish_pipeline.py", "full_audit.py",
            "koubo_validate.py", "koubo_quality_gate.py",
            "hot_topic_coverage_gate.py", "export_csdn_md.py",
            "build_gpt56_sol.py", "archive_daily.py", "project_hygiene.py",
        ):
            _banner("未声明",
                    f"执行 {tool} 前必须先声明会话项目"
                    f"（python project_boundary.py init <koubo|wechat>）")
            sys.exit(3)
        # 未声明也顺带校验路径写意图
        for p in (paths or []):
            check_write(p, tool=tool, silent=True)
        return True
    rules = FORBID[domain]
    # 1) 工具拦截
    if tool and os.path.basename(tool) in rules["tools"]:
        _banner(domain, f"工具 {tool} 属于另一项目，禁止在【{domain}】会话执行")
        sys.exit(3)
    # 2) 路径拦截（含产物后缀，复用 check_write）
    for p in (paths or []):
        check_write(p, tool=tool, silent=True)
    # 3) 工作目录拦截：禁止在另一项目目录下执行命令
    if cwd:
        cwdn = os.path.normpath(cwd)
        for frag in rules["path_contains"]:
            if frag in cwdn.replace("/", os.sep):
                _banner(domain, f"当前工作目录 {cwd} 落在另一项目内，禁止在【{domain}】会话进入")
                sys.exit(3)
    if not silent:
        print(f"[边界] 校验通过（会话={domain}）：tool={tool} paths={paths}")
    return True

def main():
    if len(sys.argv) < 2:
        print("usage: project_boundary.py init|check|check-write ...")
        sys.exit(2)
    cmd = sys.argv[1]
    if cmd == "init":
        if len(sys.argv) < 3:
            print("init 需要 domain"); sys.exit(2)
        init_session(sys.argv[2])
    elif cmd == "check":
        tool = None
        paths = []
        cwd = None
        i = 2
        while i < len(sys.argv):
            a = sys.argv[i]
            if a == "--tool" and i + 1 < len(sys.argv):
                tool = sys.argv[i + 1]; i += 2
            elif a == "--path" and i + 1 < len(sys.argv):
                paths.append(sys.argv[i + 1]); i += 2
            elif a == "--cwd" and i + 1 < len(sys.argv):
                cwd = sys.argv[i + 1]; i += 2
            else:
                i += 1
        check_action(tool=tool, paths=paths, cwd=cwd)
    elif cmd == "check-write":
        paths = []
        i = 2
        while i < len(sys.argv):
            a = sys.argv[i]
            if a == "--path" and i + 1 < len(sys.argv):
                paths.append(sys.argv[i + 1]); i += 2
            else:
                i += 1
        if not paths:
            print("check-write 需要至少一个 --path"); sys.exit(2)
        for p in paths:
            check_write(p)
    else:
        print("unknown cmd"); sys.exit(2)

if __name__ == "__main__":
    main()
