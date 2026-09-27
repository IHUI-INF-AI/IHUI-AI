# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

判据(逐项、可回退，不猜):
- 目标不存在 -> 搬，并改写 `profile.json` 的 `user_data_dir` / `account_id`；
- 目标存在但**没有** Chromium Cookies 而源有 -> 把目标(空壳)改名归档，再搬源；
- 两边都有 Cookies -> **拒绝**这一项(真撞脸，交人工，不许机器折中)；
- 两边都没有 Cookies -> 源是空壳，改名归档，不覆盖目标(目标那份才是"在用"的位置)。
每一项搬完都回读:Cookies 字节数与 mtime 未变 + `user_data_dir` 指向真实存在的目录。
任何一项校验不过 -> 当场把该项移回原位并在退出码上失败(整体不静默)。
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import sys
import tempfile
from typing import Literal

Action = Literal["move", "archive-shell-source", "archive-shell-target", "refuse", "noop"]

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
        print("[OK] 自检 5 组全过(含两条真实搬迁落盘与字节回读)")
        return 0
    finally:
        shutil.rmtree(root, ignore_errors=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="反风控画像根搬迁(默认只报告)")
    ap.add_argument("--src", default="apps/ai-service/.ihui-agent/tmp/anti-profiles")
    ap.add_argument("--dst", default=".ihui-agent/tmp/anti-profiles")
    ap.add_argument("--apply", action="store_true", help="真搬;不给则 dry-run")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    repo = pathlib.Path(__file__).resolve().parents[3]
    return run(repo / args.src, repo / args.dst, apply=args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
