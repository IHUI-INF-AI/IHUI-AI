# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""反风控身份键迁移器:把旧的「凭证值派生键」画像目录与 device_graph 绑定,改名到
`app/services/publish/anti_risk/account_identity.py` 现在的稳定键(`<平台>_db<行id>`)。

为什么必须和改键同票落地:改键后每个账号的目录名/绑定归属都变了,不迁移就等于
① 已扫码登录的浏览器画像被弃用(账号"没登录了"),② 旧脸仍留在 device_graph 里与
新脸共用同一出口 IP ⇒ 反而**制造**联动判定与冷却。迁移是"改名",不是"重建"。

安全边界(全部按当次实测取,不猜):
- 默认 dry-run,只打印映射与拒绝原因;`--apply` 才动盘。
- 只处理能**唯一归属**到某个账号的旧键;两处争抢或归属不明一律点名交人工,绝不下猜。
- 动盘前先把 device_graph.json / anti-cooldowns.json 原样复制为 `.pre-identity-migration-<ts>`。
- 目录改名用 os.replace;目标已存在即拒绝(不覆盖)。
- 冷却台账跟着账号改名,不删任何人的冷却。

用法:
    python scripts/migrate_publish_identity.py            # 只看报告
    python scripts/migrate_publish_identity.py --apply    # 落盘
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.publish import credentials_crypto  # noqa: E402
from app.services.publish.anti_risk.account_identity import (  # noqa: E402
    STABLE_IDENTITY_FIELDS,
    resolve_account_id,
)

TMP_ROOT = Path(__file__).resolve().parents[1] / ".ihui-agent" / "tmp"
PROFILE_ROOT = TMP_ROOT / "anti-profiles"
GRAPH = TMP_ROOT / "device_graph.json"
COOLDOWNS = TMP_ROOT / "anti-cooldowns.json"


def _legacy_candidates(platform: str, creds: dict[str, Any]) -> set[str]:
    """旧实现可能用过的键(三种历史形态都算进去,只为**归属**,不用于生成新键)。"""
    out: set[str] = set()
    vals = [v for v in creds.values() if isinstance(v, str) and v]
    for v in vals:
        out.add(f"{platform}_{hashlib.md5(v.encode()).hexdigest()[:8]}")  # noqa: S324 - 复现旧键,非安全用途
    first = next(iter(vals), "default")
    out.add(f"{platform}_{hashlib.md5(str(first).encode()).hexdigest()[:8]}")  # noqa: S324
    for field in STABLE_IDENTITY_FIELDS:
        raw = creds.get(field)
        if isinstance(raw, str) and raw:
            out.add(f"{platform}_{raw[:16]}")
            out.add(f"{platform}_{raw}")
    return out


def _load_bindings(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    bindings: list[dict[str, Any]] = data.get("bindings", []) if isinstance(data, dict) else []
    return bindings


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="真正改名(默认只出报告)")
    args = ap.parse_args()

    dsn = os.environ.get("DATABASE_URL", "").strip()
    if not dsn:
        # 走应用自己的配置层(Settings 的 env_file 是相对 cwd 的 .env ⇒ 必须在本端目录下跑)
        from app.core.config import settings

        dsn = str(settings.database_url or "").strip()
    if not dsn:
        print("❌ DATABASE_URL 取不到:请在 apps/ai-service 目录下运行,或显式设环境变量。")
        return 2
    import asyncio

    import asyncpg

    async def _rows() -> list[Any]:
        conn = await asyncpg.connect(dsn)
        try:
            fetched: list[Any] = await conn.fetch(
                "select id, platform, credentials_enc from publish_accounts order by id"
            )
            return fetched
        finally:
            await conn.close()

    rows = asyncio.run(_rows())

    dirs = {p.name for p in PROFILE_ROOT.iterdir() if p.is_dir()} if PROFILE_ROOT.exists() else set()
    bindings = _load_bindings(GRAPH)
    graph_ids = {b.get("account_id") for b in bindings if isinstance(b, dict)}

    mapping: dict[str, str] = {}  # 旧键 → 新键
    new_keys: set[str] = set()  # 现役账号的稳定键(第二遍跑时它们已在位,不得被报成"未归属")
    ambiguous: list[str] = []
    claimed: set[str] = set()
    for r in rows:
        plat = str(r["platform"])
        creds = credentials_crypto.decrypt(str(r["credentials_enc"]))
        new_key = resolve_account_id(plat, creds, int(r["id"]))
        new_keys.add(new_key)
        hits = {k for k in _legacy_candidates(plat, creds) if k in dirs or k in graph_ids}
        hits = {h for h in hits if h != new_key}
        for h in hits:
            if h in claimed:
                ambiguous.append(f"{h} 同时被 id={r['id']} 与更早的账号命中 ⇒ 不迁移,交人工")
                continue
            claimed.add(h)
            mapping[h] = new_key
        print(f"id={r['id']:>3} {plat:<12} 新键={new_key} 命中旧键={sorted(hits) or '无'}")

    orphan_dirs = sorted(dirs - claimed - new_keys)
    orphan_graph = sorted(str(g) for g in graph_ids - claimed - new_keys)
    print("\n=== 映射(旧 → 新)===")
    for old, new in sorted(mapping.items()):
        print(f"  {old}  ->  {new}")
    if not mapping:
        print("  (无可唯一归属的旧键)")
    print("\n=== 未归属(不动,只点名)===")
    print(f"  画像目录:{orphan_dirs or '无'}")
    print(f"  图谱绑定:{orphan_graph or '无'}")
    for a in ambiguous:
        print(f"  ⚠️ {a}")

    if not args.apply:
        print("\n[dry-run] 未动盘。加 --apply 才执行改名。")
        return 0
    if ambiguous:
        print("❌ 存在归属歧义,拒绝落盘(先人工判归属)。")
        return 1

    stamp = time.strftime("%Y%m%d-%H%M%S")
    for f in (GRAPH, COOLDOWNS):
        if f.exists():
            shutil.copy2(f, f.with_name(f"{f.name}.pre-identity-migration-{stamp}"))
            print(f"已备份 {f.name} → {f.name}.pre-identity-migration-{stamp}")

    renamed, moved = 0, 0
    archived_shells = 0
    swept = TMP_ROOT / f"anti-profiles-shells-{stamp}"
    for old, new in mapping.items():
        src, dst = PROFILE_ROOT / old, PROFILE_ROOT / new
        if src.is_dir():
            if dst.exists():
                # 目标已存在:只允许"src 是上一轮改名后由旧 profile.json 里的过期路径重新长出来的空壳"
                # 这一种情形(它没有 profile.json,登录态真身在 dst 里)。其余一律交人工,不猜。
                if (src / "profile.json").exists():
                    print(f"❌ 两侧都有 profile.json,归属真冲突,拒绝处理:{old} 与 {new}")
                    return 1
                swept.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(swept / old))
                archived_shells += 1
                print(f"空壳归档(无 profile.json,登录态在 {new}):{old} → {swept.name}/{old}")
            else:
                os.replace(src, dst)
                renamed += 1
                print(f"画像目录改名:{old} → {new}")
        # profile.json 里记的是**绝对** user_data_dir —— 只改目录名而不改它,下次启动仍会
        # 顺着旧路径重新长出一个空壳画像(实测本机第一轮迁移就栽在这:verify 照样通过,
        # 因为适配器每次显式 add_cookies,真实浏览器数据其实没被用上)。
        pf = dst / "profile.json"
        if pf.is_file():
            data = json.loads(pf.read_text(encoding="utf-8"))
            changed = False
            if data.get("account_id") != new:
                data["account_id"] = new
                changed = True
            want_dir = str(dst / "browser-data")
            if str(data.get("user_data_dir", "")) != want_dir:
                data["user_data_dir"] = want_dir
                changed = True
            if changed:
                pf.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                print(f"profile.json 已回写:{new}(account_id + user_data_dir 指向本目录)")
    for b in bindings:
        if isinstance(b, dict) and b.get("account_id") in mapping:
            b["account_id"] = mapping[str(b["account_id"])]
            moved += 1
    if bindings:
        seen: dict[str, dict[str, Any]] = {}
        for b in bindings:
            key = str(b.get("account_id"))
            prev = seen.get(key)
            if prev is None or float(b.get("updated_at", 0)) >= float(prev.get("updated_at", 0)):
                seen[key] = b  # 同账号多张旧脸归一,保留最近更新的那条
        GRAPH.write_text(
            json.dumps({"bindings": list(seen.values()), "updated_at": time.time()}, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"图谱绑定改名 {moved} 条,归一后共 {len(seen)} 条")

    if COOLDOWNS.exists():
        cool = json.loads(COOLDOWNS.read_text(encoding="utf-8"))
        items = cool.get("cooldowns", []) if isinstance(cool, dict) else []
        for c in items:
            if isinstance(c, dict) and c.get("account_id") in mapping:
                c["account_id"] = mapping[str(c["account_id"])]
        COOLDOWNS.write_text(json.dumps(cool, indent=2) + "\n", encoding="utf-8")
        print(f"冷却台账跟随改名 {len(items)} 条(未删除任何冷却)")
    print(
        f"\n✅ 完成:目录改名 {renamed} 个,空壳归档 {archived_shells} 个,绑定改写 {moved} 条,"
        "未归属项保持原样。"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
