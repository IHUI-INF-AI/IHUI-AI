# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""审计:哪些 FastAPI 端点"取到已验证身份却一次都没用它"(认证不等于授权)。

**这是一把只读尺子,不是守门** —— 它既没接 guardian-runner 也没接 CI(所以本文件刻意
不写"已接 pre-commit / 第 N 项"那种话,守门 89 会判"声称已接线而零命中")。升 blocking
的前置条件写在下面"定级"一段,不满足之前它就是手动问责档。

为什么用 ast 而不是正则(实测换来的):第一版普查按行拼签名/切函数体,报出 **106** 条,
里面把 helper 的一跳委托(`_update_owned` / `_owner_filter(request)` 那类)全算成漏洞,
真假混杂、不能当判据。换成 `ast` 遍历后真值 **53** 条,再逐条读体定性才有 A/B/C/D 分组
(账在 PROJECT_PLAN 的 G-258)。**"扫到很多"必须先怀疑尺子,再相信世界。**

判据只有一条结构事实,刻意保守到"宁可漏报":
  函数签名里有参数的默认值调用了身份依赖(`get_current_user_id` 等),
  而**整个函数体内没有任何一处 Name/Attribute 引用该参数名** ⇒ 判"未消费"。
委托给 helper 的写法一定会引用它(把值当实参传进去),所以本判据的失效方向是**漏报**,
不是误报 —— 这是它将来能升 blocking 的唯一资格。

定级(升档前置,别跳步):
  ① 先逐条清偿或按"确属公共面"显式登记豁免(带理由,不得按目录整片放行);
  ② 存量清零前挂 blocking = 与任何提交无关的恒红门,唯一结局是各会话 `--no-verify`
     连带全部守门作废(AGENTS §12e 同型);
  ③ 接进提交链时必须同时给"身份在别处被消费"的第二判据(request.state.user_id 通道),
     否则会把 hooks.py 那 7 条假阳性判成红。

用法:
    python apps/ai-service/scripts/audit_principal_consumed.py [--json] [--root <dir>]
退出码恒 0(审计档);`--fail-on-findings` 才在有发现时退 1(留给未来的 CI 决策档)。
"""

from __future__ import annotations

import argparse
import ast
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

# 身份依赖的函数名。**加名字之前先问**:多一个名字就多一类被判的端点;
# 少一个名字则是漏报(与 AGENTS §5"身份只能从承载层显式入参进来"同一条禁令)。
AUTH_DEPS = ("get_current_user_id", "require_request_user_id", "get_current_user")


def auth_params(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> list[str]:
    """签名里默认值调用了身份依赖的参数名(含 `Security(...)` 同族形态)。"""
    args = fn.args
    positioned = [*args.args, *args.kwonlyargs]
    defaults = [*args.defaults, *args.kw_defaults]
    if not defaults or not positioned:
        return []
    # 位置默认值对齐**尾部**参数;kwonly 的默认值按自身顺序对齐(两者长度不等的情况由
    # min() 收口 —— 宁可少判,绝不把不相干的名字当成身份参数)
    pairs: list[tuple[str, ast.expr | None]] = []
    tail = positioned[len(positioned) - min(len(defaults), len(positioned)) :]
    offset = len(positioned) - len(tail)
    for i, arg in enumerate(tail):
        d = defaults[i] if i < len(defaults) else None
        pairs.append((arg.arg, d))
    for i, arg in enumerate(args.kwonlyargs):
        d = args.kw_defaults[i] if i < len(args.kw_defaults) else None
        pairs.append((arg.arg, d))
    names: list[str] = []
    for name, default in pairs:
        if default is None:
            continue
        for node in ast.walk(default):
            if isinstance(node, ast.Name) and node.id in AUTH_DEPS:
                names.append(name)
                break
    return names


def references(fn: ast.AST, name: str) -> bool:
    """函数体内是否出现对该名字的引用(Name 或 `x.name` 属性两种形态)。"""
    for node in ast.walk(fn):
        if isinstance(node, ast.Name) and node.id == name:
            return True
        if isinstance(node, ast.Attribute) and node.attr == name:
            return True
    return False


def functions_in(source: str) -> list[ast.FunctionDef | ast.AsyncFunctionDef]:
    tree = ast.parse(source)
    return [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]


def audit_text(rel: str, source: str) -> list[dict[str, Any]]:
    """一个文件 → 未消费身份的行(纯函数,便于用构造面取证)。"""
    rows: list[dict[str, Any]] = []
    for fn in functions_in(source):
        params = auth_params(fn)
        if not params:
            continue
        unused = [p for p in params if not references(fn, p)]
        if unused and len(unused) == len(params):
            rows.append(
                {
                    "file": rel,
                    "line": fn.lineno,
                    "func": fn.name,
                    "params": sorted(set(unused)),
                }
            )
    return rows


def tracked_py(root: Path) -> list[Path]:
    out = subprocess.run(
        ["git", "-c", "safe.directory=*", "ls-files", "*.py"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if out.returncode != 0:
        return []
    return [root / p for p in out.stdout.splitlines() if p.strip()]


def harden_stdout_for_console_codepage() -> None:
    """把 stdout 的编码错误策略换成 replace,让**输出面**不可能把结论面打死。

    实测踩到的形态:本机控制台代码页是 GBK,而"枚举到 0 个"那一行里有个 `⇒`,
    于是这条"拒绝出具合格证"的分支自己先抛 `UnicodeEncodeError` —— 退出码从 2 变成 1
    (崩溃),拿它当判据的下一步就会把"尺子打不开口"读成"仓里有别的毛病"。
    编码本身不变(GBK 控制台下中文照样出得去),只把不可编码的符号降级成 `?`。
    """
    try:
        sys.stdout.reconfigure(errors="replace")  # type: ignore[union-attr]
    except (AttributeError, OSError, ValueError):
        pass


def main(argv: list[str] | None = None) -> int:
    harden_stdout_for_console_codepage()
    ap = argparse.ArgumentParser(description="审计:身份依赖未被消费的端点(只读)")
    ap.add_argument("--root", default=None, help="被审仓根(缺省 = 本脚本所在仓根)")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--fail-on-findings", action="store_true")
    ns = ap.parse_args(argv)
    # 缺省只审**本 FastAPI 应用**(`apps/ai-service`)—— 判据的射程由"身份依赖的函数名表"
    # 决定,把它扩到别的语言/别的进程要另立一条判据,不是把 root 放宽就完事。
    root = Path(ns.root).resolve() if ns.root else Path(__file__).resolve().parents[1]
    files = tracked_py(root)
    if not files:
        # 枚举为空 = 尺子没跑到东西,不当"没有问题"报(本仓"空枚举判死"同一条口径)。
        print(json.dumps({"error": "枚举到 0 个 .py ⇒ 判据失明,不记为通过"}, ensure_ascii=False))
        return 2
    rows: list[dict[str, Any]] = []
    scanned = 0
    for path in files:
        try:
            source = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        scanned += 1
        rows.extend(audit_text(path.relative_to(root).as_posix(), source))
    if ns.json:
        print(json.dumps({"scanned": scanned, "findings": rows}, ensure_ascii=False, indent=2))
    else:
        print(f"扫描 {scanned} 个 .py,身份依赖未被消费的端点 {len(rows)} 处:")
        for r in rows:
            print(f"  {r['file']}:{r['line']} {r['func']} :: {','.join(r['params'])}")
        print("  (审计档,不改退出码;逐条定性与分组账见 PROJECT_PLAN 的 G-258)")
    if ns.fail_on_findings and rows:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
