# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# /// script
# requires-python = ">=3.12"
# ///
"""连接器**无主记录的人工认领回填器**(2026-09-29,G-371 落属主的第二步)。

为什么需要它(现读事实,动手前不必再发现一遍):
  * `connector_store` 的读侧自 G-371 起按 `(owner_user_id, key)` 收窄,**无主记录不列给任何人**
    (fail-closed)。这是有意选择,但它的代价必须有人出口:收口之前经
    `POST /api/connectors` 装进来的记录身上没有属主键,部署机上一旦存在这类记录,
    收紧之后**原主永远看不见自己的连接器**,而账面什么都没红。
  * 本机的 `data/connector_store.json` 现读是空文件 ⇒ 本机零存量;这个事实**不构成**
    "不需要回填器" —— 部署机在另一台 checkout 上,它那份文件的内容本会话无从现读,
    没有出口就等于把"看不见"变成"找不回"。

判据四条,每一条都是"推不出就不落":
  1. **owner 只能由人点名**(claims 文件 / `--claim key=owner`)。这一族数据里没有任何
     可当权威的证据源 —— 记录既没有创建者列,也没有与会话/episodic 的关联键
     (对照 `backfill_working_owner.py`:那边的 session_id 在 `agent_memory_episodic` 里
     有 notNull 的 user_id 列可查,这边什么都没有)。从别表"猜"一个属主 = 拿一份不相关的
     表当授权凭据,那比无主更糟。
  2. **已有属主的记录一律不动**,除非该 key 同时被 `--reassign` 点名。幂等的根就在这条:
     第二次跑同一份 claims ⇒ 落盘项必为 0(`changed == False`)。
  3. **claims 点名了而文件里没有的 key ⇒ 只报数不落**,不凭空造记录(造出来的
     "别人的配置"是新增数据,不是回填)。
  4. 未被点名的无主记录**保持无主并逐条报名**(不是只给一个计数)—— 拿到计数的人
     不知道是哪几条,就没法去问原主。

只打印 key 与 owner,**绝不打印记录正文**(`app_secret` 就在这条记录里)。

退出码:0 = 成功(含"无可落项");1 = 语义拒绝(claims 与命令行都没给 / `--reassign`
未点名对应 key / 写盘失败);2 = 环境错(store 不可读、JSON 损坏或不是列表)。
`--apply` 缺省时是 dry-run,不写盘。
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # 允许 `python apps/ai-service/scripts/xxx.py` 直跑
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.connector_store import OWNER_FIELD  # noqa: E402

DEFAULT_STORE = Path(__file__).resolve().parents[1] / "data" / "connector_store.json"


@dataclass
class Plan:
    """一次回填的**结论**,与是否写盘无关(所以 dry-run 与 apply 共用同一判据)。"""

    stamps: dict[str, str] = field(default_factory=dict)  # key -> 新属主(本次会写)
    already_owned: list[str] = field(default_factory=list)  # 点名的 key 已有主 ⇒ 不动
    unknown_keys: list[str] = field(default_factory=list)  # 点名的 key 不在文件里
    untouched_ownerless: list[str] = field(default_factory=list)  # 无主且没被点名
    reassigned: list[str] = field(default_factory=list)  # 经 --reassign 改写了属主的 key

    @property
    def changed(self) -> bool:
        return bool(self.stamps)


def load_store(path: Path) -> list[dict[str, Any]]:
    """读连接器文件。缺文件按空列表(没有存量可回填);损坏/非列表抛错 ⇒ 交 CLI 判"无法判定"。

    刻意**不**复用 `connector_store._load()`:那个函数按设计把读失败降级成空列表,
    而回填器把"读不到"降级成"没什么可回填"就会在损坏文件上写出一个空 store,
    等于把全部配置抹掉。这里要求宁可 exit 2 也不猜。
    """
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path} 顶层不是列表,拒绝按记录处理")
    return [rec for rec in data if isinstance(rec, dict)]


def plan_backfill(
    records: list[dict[str, Any]],
    claims: dict[str, str],
    *,
    reassign: set[str] | None = None,
) -> Plan:
    """纯函数:按 claims 算出**该落哪些**,不碰入参。"""
    reassign = reassign or set()
    plan = Plan()
    by_key: dict[str, dict[str, Any]] = {}
    for rec in records:
        key = rec.get("key")
        if isinstance(key, str):
            by_key[key] = rec
    for key, owner in claims.items():
        target = by_key.get(key)
        if target is None:
            plan.unknown_keys.append(key)
            continue
        current = target.get(OWNER_FIELD)
        if current and key not in reassign:
            plan.already_owned.append(key)
            continue
        if not owner:
            plan.unknown_keys.append(key)  # 空 owner 等于"继续无主",写了也是噪音
            continue
        plan.stamps[key] = owner
        if current:
            plan.reassigned.append(key)
    plan.untouched_ownerless = [
        k for k, rec in by_key.items() if not rec.get(OWNER_FIELD) and k not in claims
    ]
    return plan


def apply_plan(records: list[dict[str, Any]], plan: Plan) -> list[dict[str, Any]]:
    """返回**新列表**(不改入参),便于测试同时比对改前改后。"""
    out: list[dict[str, Any]] = []
    for rec in records:
        key = rec.get("key")
        if isinstance(key, str) and key in plan.stamps:
            new_rec = dict(rec)
            new_rec[OWNER_FIELD] = plan.stamps[key]
            new_rec["updated_at"] = datetime.now(UTC).isoformat()
            out.append(new_rec)
        else:
            out.append(rec)
    return out


def parse_claims(args: argparse.Namespace) -> dict[str, str]:
    claims: dict[str, str] = {}
    if args.claims:
        raw = json.loads(Path(args.claims).read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise ValueError("--claims 文件顶层必须是 {key: owner_user_id} 映射")
        claims.update({str(k): str(v) for k, v in raw.items()})
    for item in args.claim or []:
        key, sep, owner = item.partition("=")
        if not sep or not key.strip():
            raise ValueError(f"--claim 要写成 key=owner_user_id,收到:{item!r}")
        claims[key.strip()] = owner.strip()
    return claims


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--store", default=str(DEFAULT_STORE), help="连接器 JSON 路径")
    parser.add_argument("--claims", help="JSON 文件:{连接器 key: 认领它的 user_id}")
    parser.add_argument("--claim", action="append", help="单条 key=owner_user_id,可重复")
    parser.add_argument(
        "--reassign",
        action="append",
        default=[],
        help="允许改写**已有属主**的 key(逐条点名;不点名的一律不动)",
    )
    parser.add_argument("--apply", action="store_true", help="写盘(缺省 dry-run)")
    parser.add_argument("--json", action="store_true", help="机器可读输出")
    args = parser.parse_args(argv)

    path = Path(args.store)
    try:
        records = load_store(path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"❌ 无法判定:{path} 读不到或形态不认识 —— {exc}")
        return 2

    try:
        claims = parse_claims(args)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"❌ 拒绝:claims 不可用 —— {exc}")
        return 1
    if not claims:
        print("❌ 拒绝:没有点名任何 key —— 空 claims 等于什么都不做,别让它看起来像「已回填」")
        return 1
    reassign = {str(k) for k in args.reassign}
    unknown_reassign = reassign - set(claims)
    if unknown_reassign:
        print(f"❌ 拒绝:--reassign 点名了 claims 里没有的 key:{sorted(unknown_reassign)}")
        return 1

    plan = plan_backfill(records, claims, reassign=reassign)

    if not args.json:
        print(f"📇 连接器属主回填 store={path} 记录 {len(records)} 条")
        print(
            f"   会落 owner:{len(plan.stamps)} 条(其中改写已有属主 {len(plan.reassigned)} 条)"
        )
        for key, owner in sorted(plan.stamps.items()):
            print(f"     · {key} -> {owner}")
        if plan.already_owned:
            print(f"   已属主、未动:{len(plan.already_owned)} 条 {sorted(plan.already_owned)}")
        if plan.unknown_keys:
            print(f"   点了名而文件里没有(不落):{len(plan.unknown_keys)} 条 {sorted(plan.unknown_keys)}")
        if plan.untouched_ownerless:
            print(f"   ⚠️ 仍无主且未被点名:{len(plan.untouched_ownerless)} 条 {sorted(plan.untouched_ownerless)}")

    if not args.apply:
        print("   [dry-run] 未写盘。确认无误后加 --apply")
        if args.json:
            print(json.dumps({"apply": False, "stamps": plan.stamps}, ensure_ascii=False))
        return 0

    if not plan.changed:
        print("   无可落项(幂等:第二次跑同一份 claims 就是这里为 0)")
        if args.json:
            print(json.dumps({"apply": True, "stamps": {}}, ensure_ascii=False))
        return 0

    new_records = apply_plan(records, plan)
    backup = path.with_name(f"{path.name}.pre-backfill-{datetime.now(UTC):%Y%m%dT%H%M%SZ}")
    try:
        if path.exists():
            backup.write_bytes(path.read_bytes())
            print(f"   🗂 原文件已备份到 {backup.name}")
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(new_records, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(path)
    except OSError as exc:
        print(f"❌ 写盘失败(原文件未改):{exc}")
        return 1
    print(f"✅ 已回填 {len(plan.stamps)} 条 owner")
    if args.json:
        print(json.dumps({"apply": True, "stamps": plan.stamps}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
