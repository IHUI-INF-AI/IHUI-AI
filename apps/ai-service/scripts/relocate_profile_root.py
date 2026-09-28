# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""反风控画像根搬迁:把「随启动目录漂移」时期落在端目录里的画像，搬到锚定仓库根的权威根。

为什么必须有这一步(不搬就等于主动换一次脸):
`app/services/publish/anti_risk/account_profile.py` 的画像根此前是
`Path(".ihui-agent/tmp/anti-profiles").resolve()` —— 相对路径按**进程 cwd** 解析，
而 `pnpm --filter @ihui/ai-service dev` 的 dev 脚本是 `uv run uvicorn app.main:app`，
cwd 就是 `apps/ai-service`。所以真实画像一直落在
`apps/ai-service/.ihui-agent/tmp/anti-profiles/`(2026-09-27 实测 9 个键目录、
9 份都带 Chromium `Cookies`)。根改成锚定仓库根之后若不搬迁，调度器会在仓库根
**重新长出空壳** —— 画像、指纹种子、设备图谱归属全部另起一张脸，正是我们要修的故障。

画像内部还存着**绝对** `user_data_dir`，所以搬完必须同批改写它，否则 `load_profile`
按旧路径判"目录已丢失"→ 当场重生成新画像(同 AGENTS 记过的"改名式迁移"那一型)。

用法:
    python apps/ai-service/scripts/relocate_profile_root.py                # 只报告,不动盘
    python apps/ai-service/scripts/relocate_profile_root.py --apply         # 真搬
    python apps/ai-service/scripts/relocate_profile_root.py --self-test     # 构造面自检
    python apps/ai-service/scripts/relocate_profile_root.py --legacy-root apps/ai-service/.trae-cn
        # 再认一个历史启动目录(--legacy-root 可重复给;默认只认实测的 apps/ai-service)

判据(逐项、可回退，不猜):
- 目标不存在 -> 搬，并改写 `profile.json` 的 `user_data_dir` / `account_id`；
- 目标存在但**没有** Chromium Cookies 而源有 -> 把目标(空壳)改名归档，再搬源；
- 两边都有 Cookies -> **拒绝**这一项(真撞脸，交人工，不许机器折中)；
- 两边都没有 Cookies -> 源是空壳，改名归档，不覆盖目标(目标那份才是"在用"的位置)。
每一项搬完都回读:Cookies 字节数与 mtime 未变 + `user_data_dir` 指向真实存在的目录。
任何一项校验不过 -> 当场把该项移回原位并在退出码上失败(整体不静默)。

2026-09-27 扩第二能力(同一族缺陷第三维):搬 anti_risk 的**单文件状态**。
`device_graph_guard` / `audit_logger` / `cooldown_manager` / `risk_scoring` /
`cookie_health` 五个状态文件此前同样按进程 cwd 解析,真实数据长在
`apps/ai-service/.ihui-agent/tmp/`(实测 device_graph.json 2975 B,仓库根那份不存在)。
路径锚点已收口到 `app/services/publish/anti_risk/state_paths.py`,本脚本负责把存量数据
搬到仓库根那一份。**待搬文件清单不在本脚本里硬写** —— 由 `discover_state_items()` 从
`anti_risk/*.py` 的模块级 `*_FILE` 赋值现读(旧形状 `Path(os.environ.get(ENV, REL))` 与
新形状 `resolve_state_path(os.environ.get(ENV), REL)` 都认),清单因此跟着源码走、不会腐烂。
单文件判据(与目录判据并列、互不覆写):目标不存在或为 0 字节占位 -> `os.replace` 搬过去
并回读字节全等;两边都非空 -> **拒绝**交人工(不许机器折中选一份);源本身是空壳 -> 不动盘
(在用的那份是目标);一个文件在多个启动目录下各有一份 -> 也拒绝(归属要人来判)。
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import pathlib
import shutil
import tempfile
from typing import Literal

Action = Literal["move", "archive-shell-source", "archive-shell-target", "refuse", "noop"]

#: 单文件状态项的裁决。与目录档的 Action 刻意分开:判据不同(这里没有 Cookies 概念,
#: 只看"两边是否都有内容"),混成一套会让两边互相顶掉。
FileAction = Literal["absent", "move", "refuse", "source-empty-shell", "undetermined"]

#: Chromium 新版把 cookie 放在 Default/Network/ 下,旧版在 Default/ 直下 —— 两形态都认,
#: 只认一种会把"有真实登录态"的画像读成空壳(2026-09-27 实测踩过:判据写 Default/Cookies
#: 时 9 份带登录态的画像全被读成"无 Cookies",差一步就把它们当垃圾删掉)。
COOKIE_CANDIDATES = (
    ("browser-data", "Default", "Network", "Cookies"),
    ("browser-data", "Default", "Cookies"),
)


def cookies_path(profile_dir: pathlib.Path) -> pathlib.Path | None:
    for parts in COOKIE_CANDIDATES:
        p = profile_dir.joinpath(*parts)
        if p.exists():
            return p
    return None


def has_login_state(profile_dir: pathlib.Path) -> bool:
    """画像里有没有真实浏览器数据 —— 只看 Cookies 在不在,不看目录在不在。"""
    return cookies_path(profile_dir) is not None


def decide(src: pathlib.Path, dst: pathlib.Path, *, archive_target: bool = False) -> Action:
    """单项目标/源组合的裁决。纯函数,自检直接喂构造目录。"""
    if not dst.exists():
        return "move"
    src_live, dst_live = has_login_state(src), has_login_state(dst)
    if src_live and dst_live:
        # 两边都有真实登录态 ⇒ 默认拒绝交人工。只有操作者**点名**归档目标时才放行,
        # 用于"目标那份正是本次要修的漂移缺陷在今天长出来的副本"这一种场景。
        return "archive-shell-target" if archive_target else "refuse"
    if src_live:
        return "archive-shell-target"
    if dst_live:
        return "archive-shell-source"
    return "archive-shell-source"


def rewrite_profile(profile_dir: pathlib.Path, key: str) -> None:
    """改写画像内部的绝对自引用 —— 不改写就等于搬完仍然指向旧位置,下次加载直接重生成新脸。"""
    prof = profile_dir / "profile.json"
    if not prof.exists():
        return
    data = json.loads(prof.read_text(encoding="utf-8"))
    data["user_data_dir"] = str((profile_dir / "browser-data").resolve())
    data["account_id"] = key
    prof.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _sig(p: pathlib.Path | None) -> tuple[int, int] | None:
    if p is None or not p.exists():
        return None
    st = p.stat()
    return (st.st_size, int(st.st_mtime))


def relocate_key(src: pathlib.Path, dst: pathlib.Path, *, apply: bool, stamp: str) -> tuple[Action, bool]:
    """搬一个键。返回 (裁决, 是否成功落地/可安全跳过)。失败一律回退本项。"""
    act = decide(src, dst)
    if act == "refuse":
        return act, False
    if not apply:
        return act, True
    if act == "archive-shell-target":
        dst.rename(dst.with_name(f"{dst.name}.shell-{stamp}"))
    if act == "archive-shell-source":
        src.rename(src.with_name(f"{src.name}.shell-{stamp}"))
        return act, True
    before = _sig(cookies_path(src))
    shutil.move(str(src), str(dst))
    rewrite_profile(dst, dst.name)
    after = _sig(cookies_path(dst))
    try:
        udd = json.loads((dst / "profile.json").read_text(encoding="utf-8")).get("user_data_dir", "")
    except Exception:  # noqa: BLE001
        udd = ""
    if before != after or not udd or not pathlib.Path(udd).exists():
        # 回退:把搬过去的挪回源位置,绝不留半搬状态
        shutil.move(str(dst), str(src))
        return act, False
    return act, True


def run(src_root: pathlib.Path, dst_root: pathlib.Path, *, apply: bool) -> int:
    if not src_root.exists():
        print(f"源根不存在({src_root})，无需搬迁")
        return 0
    if apply:
        dst_root.mkdir(parents=True, exist_ok=True)
    stamp = str(int(pathlib.Path(__file__).stat().st_mtime))
    counts = {"move": 0, "archive-shell-target": 0, "archive-shell-source": 0, "refuse": 0}
    failed = 0
    for d in sorted(p for p in src_root.iterdir() if p.is_dir() and ".shell-" not in p.name):
        act, ok = relocate_key(d, dst_root / d.name, apply=apply, stamp=stamp)
        counts[act] = counts.get(act, 0) + 1
        tag = "[DRY]" if not apply else ("OK  " if ok else "FAIL")
        print(f"{tag} {d.name:<34} {act}" + ("" if ok else "  ← 两边都有真实 Cookies，或回读校验失败，交人工"))
        if not ok:
            failed += 1
    print(
        f"\n合计 move={counts['move']} 归档源空壳={counts['archive-shell-source']} "
        f"归档目标空壳={counts['archive-shell-target']} 拒绝={counts['refuse']} "
        f"失败={failed};模式={'apply' if apply else 'dry-run'}"
    )
    return 1 if (failed or counts["refuse"]) else 0


# ---------------------------------------------------------------------------
# 第二能力:搬 anti_risk 的**单文件状态**(设备图谱 / 审计日志 / 冷却 / 风险事件 / Cookie 健康度)
# 与上面的目录搬迁并列,不共享判据、不互相覆写。
# ---------------------------------------------------------------------------

#: 模块级状态文件赋值的变量名后缀 —— 发现判据的一半(另一半是"模块顶层赋值")。
_STATE_SUFFIX = "_FILE"


def _string_literals(node: ast.AST) -> list[str]:
    """收集一个赋值右值里出现的字符串字面量(环境变量名与相对默认值都从这里现读)。"""
    return [n.value for n in ast.walk(node) if isinstance(n, ast.Constant) and isinstance(n.value, str)]


def discover_state_items(anti_risk_dir: pathlib.Path) -> list[tuple[str, str | None, str | None]]:
    """从源码现读待搬状态项:`(模块名, 环境变量名或 None, 相对默认值或 None)`。

    清单**不硬写在本脚本里**(清单会腐烂:改名 / 新增状态文件时脚本会静默漏搬)。
    判据只认"模块顶层赋值给以 `_FILE` 结尾的名字",因此两种形状都认:

    - 旧:`_X_FILE = Path(os.environ.get("ENV", ".ihui-agent/tmp/x.json")).resolve()`
    - 新:`_X_FILE = resolve_state_path(os.environ.get("ENV"), ".ihui-agent/tmp/x.json")`

    右值里的字符串按形状分流:全大写下划线串当环境变量名,含路径分隔符/点号的当相对默认值。
    默认值取到绝对路径一律判 `None`(= 未判定,由调用方点名),因为那意味着锚点又被藏回调用方。
    """
    items: list[tuple[str, str | None, str | None]] = []
    for py in sorted(anti_risk_dir.glob("*.py")):
        try:
            tree = ast.parse(py.read_text(encoding="utf-8-sig"))
        except (OSError, SyntaxError):
            continue
        for stmt in tree.body:
            if not isinstance(stmt, ast.Assign):
                continue
            for target in stmt.targets:
                if not (isinstance(target, ast.Name) and target.id.endswith(_STATE_SUFFIX)):
                    continue
                env: str | None = None
                rel: str | None = None
                for lit in _string_literals(stmt.value):
                    if lit and all(c.isupper() or c.isdigit() or c == "_" for c in lit) and lit[0].isalpha():
                        env = env or lit
                    elif ("/" in lit or "\\" in lit or lit.startswith(".")) and not pathlib.Path(lit).is_absolute():
                        rel = rel or lit
                items.append((py.stem, env, rel))
    return items


def _non_empty(p: pathlib.Path) -> bool:
    return p.is_file() and p.stat().st_size > 0


def decide_file(src: pathlib.Path, dst: pathlib.Path) -> FileAction:
    """单文件一项的裁决。纯函数(只看存在性与字节数),自检直接喂构造文件。"""
    if not src.is_file():
        return "absent"
    if not dst.exists():
        return "move"
    if not _non_empty(src):
        # 源是 0 字节空壳而目标已存在 -> 在用的是目标,不动盘(覆盖了等于拿空盖实)
        return "source-empty-shell"
    if _non_empty(dst):
        # 两边都有内容 -> 拒绝。哪份才是"这个账号的历史"要人判,机器折中就是编造连续性
        return "refuse"
    return "move"  # 目标是 0 字节占位 -> 用真实源覆盖它


def relocate_file(src: pathlib.Path, dst: pathlib.Path, *, apply: bool) -> tuple[FileAction, bool]:
    """搬一个状态文件。返回 (裁决, 是否成功落地/可安全跳过);失败不留半搬状态。"""
    act = decide_file(src, dst)
    if act in ("absent", "source-empty-shell"):
        return act, True
    if act == "refuse":
        return act, False
    if not apply:
        return act, True
    before = src.read_bytes()
    dst.parent.mkdir(parents=True, exist_ok=True)
    os.replace(src, dst)
    ok = dst.is_file() and dst.read_bytes() == before
    if not ok:
        # 回读字节不一致:尽力放回原位,且当场判失败(绝不静默"看起来搬完了")
        try:
            os.replace(dst, src)
        except OSError:
            pass
    return act, ok


def run_files(
    items: list[tuple[str, str | None, str | None]],
    repo: pathlib.Path,
    legacy_roots: list[pathlib.Path],
    *,
    apply: bool,
) -> int:
    """状态文件搬迁的一趟(默认 dry-run)。返回退出码贡献:拒绝/未判定/回读失败 => 1。"""
    print("\n--- 单文件状态(设备图谱 / 审计 / 冷却 / 风险事件 / Cookie 健康度)---")
    if not items:
        # 覆盖面自证:发现 0 项不是"无事可做",而是发现判据瞎了(模块改名/形状变了)。
        print("未发现任何 *_FILE 状态项 —— 判据失明，不得当作\u201c无需搬迁\u201d，请核对形状后修本脚本")
        return 1
    counts = {"move": 0, "refuse": 0, "absent": 0, "source-empty-shell": 0, "undetermined": 0}
    failed = 0
    for module, _env, rel in items:
        if not rel:
            counts["undetermined"] += 1
            failed += 1
            print(f"[?? ] {module:<28} undetermined  ← 该模块的 *_FILE 赋值里读不出相对默认值，交人工")
            continue
        target = repo / rel
        sources = [root / rel for root in legacy_roots if (root / rel).is_file()]
        tag = "[DRY]" if not apply else "OK  "
        if len(sources) > 1:
            failed += 1
            counts["refuse"] += 1
            print(f"[FAIL] {rel:<40} refuse  ← 多个启动目录各有一份({', '.join(str(s) for s in sources)})，交人工")
            continue
        if not sources:
            counts["absent"] += 1
            print(f"{tag} {rel:<40} absent   (历史位置 {legacy_roots[0] / rel} 无此文件，无需搬迁)")
            continue
        act, ok = relocate_file(sources[0], target, apply=apply)
        counts[act] = counts.get(act, 0) + 1
        if not ok:
            failed += 1
        shown = "[FAIL]" if not ok else tag
        # 措辞必须对上裁决本身:拒绝的原因是"两边都有内容"，回读失败的原因才是字节不一致
        # ——合成一句会让人在 dry-run 里去找根本不存在的"字节问题"。
        if not ok:
            reason = (
                "  ← 两边都有内容，交人工(不许机器折中选一份)"
                if act == "refuse"
                else "  ← 回读字节与搬前不全等，已尝试放回原位，交人工"
            )
            print(f"{shown} {rel:<40} {act}{reason}")
        elif act == "move":
            verb = "已搬到" if apply else "拟搬到"
            print(f"{shown} {rel:<40} {act}   {sources[0]}  ({verb}) {target}")
        else:
            print(f"{shown} {rel:<40} {act}   (源 {sources[0]} 保持原样，不动盘)")
    print(
        f"\n合计(状态文件) move={counts['move']} 拒绝={counts['refuse']} 源不存在={counts['absent']} "
        f"源空壳={counts['source-empty-shell']} 未判定={counts['undetermined']} 失败={failed}"
        f";模式={'apply' if apply else 'dry-run'}"
    )
    return 1 if failed else 0


def self_test() -> int:
    """构造面自检:四条裁决 + 真搬 + 改写 + 回退,全部在临时目录里,不碰仓库。"""
    root = pathlib.Path(tempfile.mkdtemp(prefix="ihui-relocate-"))
    try:
        # 1) 目标不存在 -> move，且搬完 udd 指向新位置
        src = root / "src" / "juejin_db13"
        (src / "browser-data" / "Default" / "Network").mkdir(parents=True)
        (src / "browser-data" / "Default" / "Network" / "Cookies").write_bytes(b"SENTINEL-1")
        (src / "profile.json").write_text(
            json.dumps({"account_id": "juejin_db13", "user_data_dir": str(src / "browser-data")}),
            encoding="utf-8",
        )
        dst_root = root / "dst"
        dst_root.mkdir()
        assert decide(src, dst_root / "juejin_db13") == "move"
        assert relocate_key(src, dst_root / "juejin_db13", apply=True, stamp="t1")[1]
        ck = cookies_path(dst_root / "juejin_db13")
        assert ck is not None and ck.read_bytes() == b"SENTINEL-1", "Cookies 必须随目录整体移动且字节不变"
        data = json.loads((dst_root / "juejin_db13" / "profile.json").read_text(encoding="utf-8"))
        assert data["user_data_dir"] == str((dst_root / "juejin_db13" / "browser-data").resolve()), "udd 未改写"
        assert pathlib.Path(data["user_data_dir"]).exists()

        # 2) 两边都有真实 Cookies -> refuse（绝不机器折中）
        other = root / "src2" / "zhihu_db5"
        (other / "browser-data" / "Default").mkdir(parents=True)
        (other / "browser-data" / "Default" / "Cookies").write_bytes(b"A")
        tgt = dst_root / "zhihu_db5"
        (tgt / "browser-data" / "Default" / "Network").mkdir(parents=True)
        (tgt / "browser-data" / "Default" / "Network" / "Cookies").write_bytes(b"B")
        assert decide(other, tgt) == "refuse"

        # 3) 目标是空壳而源有数据 -> 归档目标再搬
        shell = dst_root / "csdn_db12"
        (shell / "browser-data").mkdir(parents=True)
        s2 = root / "src3" / "csdn_db12"
        (s2 / "browser-data" / "Default" / "Network").mkdir(parents=True)
        (s2 / "browser-data" / "Default" / "Network" / "Cookies").write_bytes(b"C")
        assert decide(s2, shell) == "archive-shell-target"

        # 4) 源是空壳 -> 归档源，不许覆盖在用的目标
        live = dst_root / "weibo_db11"
        (live / "browser-data" / "Default" / "Network").mkdir(parents=True)
        (live / "browser-data" / "Default" / "Network" / "Cookies").write_bytes(b"LIVE")
        dead = root / "src4" / "weibo_db11" / "browser-data"
        dead.mkdir(parents=True)
        assert decide(dead.parent, live) == "archive-shell-source"

        # 5) 反向对照:两形态 Cookies 路径都必须被认出(只认一种会把有登录态读成空壳)
        both = root / "src5" / "both"
        for parts in COOKIE_CANDIDATES:
            both.joinpath(*parts).parent.mkdir(parents=True, exist_ok=True)
            both.joinpath(*parts).write_bytes(b"x")
        assert has_login_state(both)

        # 6) 单文件状态搬迁:四条裁决 + 真搬 + 字节回读 + 空目标可覆盖
        fsrc_root = root / "legacy" / ".ihui-agent/tmp"
        fdst_root = root / "authoritative/.ihui-agent/tmp"
        fsrc_root.mkdir(parents=True)
        rel = ".ihui-agent/tmp/device_graph.json"

        f_a = fsrc_root / "device_graph.json"
        f_a.write_bytes(b"GRAPH-BYTES")
        assert decide_file(f_a, fdst_root / "device_graph.json") == "move"
        assert relocate_file(f_a, fdst_root / "device_graph.json", apply=True) == ("move", True)
        assert (fdst_root / "device_graph.json").read_bytes() == b"GRAPH-BYTES", "搬完字节必须全等"
        assert not f_a.exists(), "os.replace 后历史位置不得留下副本(留两份=两张脸回来了)"

        f_b = fsrc_root / "anti-cooldowns.json"
        f_b.write_bytes(b"NEW")
        (fdst_root / "anti-cooldowns.json").write_bytes(b"OLD")
        assert decide_file(f_b, fdst_root / "anti-cooldowns.json") == "refuse"
        assert relocate_file(f_b, fdst_root / "anti-cooldowns.json", apply=True)[1] is False
        assert (fdst_root / "anti-cooldowns.json").read_bytes() == b"OLD", "拒绝档一个字也不许动盘"
        assert f_b.read_bytes() == b"NEW"

        (fdst_root / "anti-risk-events.jsonl").write_bytes(b"")  # 0 字节占位
        f_c = fsrc_root / "anti-risk-events.jsonl"
        f_c.write_bytes(b"EVT")
        assert decide_file(f_c, fdst_root / "anti-risk-events.jsonl") == "move"
        assert relocate_file(f_c, fdst_root / "anti-risk-events.jsonl", apply=True) == ("move", True)
        assert (fdst_root / "anti-risk-events.jsonl").read_bytes() == b"EVT", "空占位应被真实源覆盖"

        f_d = fsrc_root / "anti-cookie-health.json"
        f_d.write_bytes(b"")
        (fdst_root / "anti-cookie-health.json").write_bytes(b"LIVE")
        assert decide_file(f_d, fdst_root / "anti-cookie-health.json") == "source-empty-shell"
        assert (fdst_root / "anti-cookie-health.json").read_bytes() == b"LIVE", "源空壳不得盖住在用目标"

        assert decide_file(fsrc_root / "no-such-file.json", fdst_root / "no-such-file.json") == "absent"
        assert run_files([("x", "ENV", rel)], root / "authoritative", [root / "legacy"], apply=False) == 0
        # 覆盖面自证:发现 0 项必须判失败，不得静默报"无需搬迁"
        assert run_files([], root / "authoritative", [root / "legacy"], apply=False) == 1
        # 未判定档(读不出相对默认值)必须点名并失败
        assert run_files([("broken", "ENV", None)], root / "authoritative", [root / "legacy"], apply=False) == 1

        # 7) 发现判据形状无关:新旧两种写法都必须读出 (env, 相对默认值)
        probe_dir = root / "anti_risk_probe"
        probe_dir.mkdir()
        (probe_dir / "legacy_shape.py").write_text(
            'import os\nfrom pathlib import Path\n'
            '_OLD_FILE = Path(os.environ.get(\n'
            '    "ANTI_RISK_OLD_FILE",\n'
            '    ".ihui-agent/tmp/old.json",\n'
            ')).resolve()\n',
            encoding="utf-8",
        )
        (probe_dir / "new_shape.py").write_text(
            'import os\nfrom .state_paths import resolve_state_path\n'
            '_NEW_FILE = resolve_state_path(\n'
            '    os.environ.get("ANTI_RISK_NEW_FILE"),\n'
            '    ".ihui-agent/tmp/sub/new.json",\n'
            ')\n',
            encoding="utf-8",
        )
        (probe_dir / "no_state.py").write_text("X = 1\n_NOT_A_STATE = 2\n", encoding="utf-8")
        found = {m: (e, r) for m, e, r in discover_state_items(probe_dir)}
        assert found.get("legacy_shape") == ("ANTI_RISK_OLD_FILE", ".ihui-agent/tmp/old.json"), found
        assert found.get("new_shape") == ("ANTI_RISK_NEW_FILE", ".ihui-agent/tmp/sub/new.json"), found
        assert "no_state" not in found, "非 *_FILE 后缀的赋值不该被当状态项(误报会让脚本搬错东西)"
        print("[OK] 自检 7 组全过(含两条真实搬迁落盘与字节回读 + 单文件态四判据 + 形状无关发现)")
        return 0
    finally:
        shutil.rmtree(root, ignore_errors=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="反风控画像根 + 状态文件搬迁(默认只报告)")
    ap.add_argument("--src", default="apps/ai-service/.ihui-agent/tmp/anti-profiles")
    ap.add_argument("--dst", default=".ihui-agent/tmp/anti-profiles")
    ap.add_argument(
        "--legacy-root",
        action="append",
        default=[],
        metavar="DIR",
        help="历史启动目录(相对仓库根)，状态文件可能落在这里面的同名相对路径下；可重复给",
    )
    ap.add_argument("--apply", action="store_true", help="真搬;不给则 dry-run")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    repo = pathlib.Path(__file__).resolve().parents[3]
    dir_rc = run(repo / args.src, repo / args.dst, apply=args.apply)
    anti_risk = repo / "apps/ai-service/app/services/publish/anti_risk"
    legacy = [repo / r for r in (args.legacy_root or ["apps/ai-service"])]
    files_rc = run_files(discover_state_items(anti_risk), repo, legacy, apply=args.apply)
    return 1 if (dir_rc or files_rc) else 0


if __name__ == "__main__":
    raise SystemExit(main())
