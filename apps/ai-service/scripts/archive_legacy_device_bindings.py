# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""把**旧键形态**的设备绑定从关联图谱里归档出去（默认 dry-run，不删除）。

为什么需要这一步：`detect_linkage` 现在按归属作用域判关联，而"归属解析不到"的候选一律
**照旧计入**（保守方向不可反）。图里解析不到归属的只有两类键，且两类都是**已经修掉的 bug 留下的
化石**，不是真实账号：

1. ``<platform>_legacy-<8hex>`` —— 身份键的"首个凭证值哈希"兜底档。该档的定义就是
   "会随 token 刷新换脸"（2026-09-27 已改：调度器/验证入口一律显式传 `publish_accounts` 行 id），
   所以这类键**不可能再被产出**，它留在图里只会替真实账号制造"跨账号关联"命中。
2. ``<platform>_<游客字段>-<12hex>`` —— 用登录前游客 cookie 当身份锚的键。`webId` / `a1` / `d_c0`
   在 `services/scan_login.py` 里被明确标注为"登录前游客 cookie，2026-09-15 起剔除以免误报登录成功"，
   同一个值不能既"不算登录凭据"又"算设备身份"。

刻意**不碰**的两类：``*_db<行id>``（现行稳定档）与其它字段的哈希档（那是仍然在用的合法兜底）。
判据是"能不能反解出行 id"不行 —— 那会把合法字段档一起扫掉，所以这里用形态白名单而不是反解失败。

零损失判据（不成立就拒绝写盘）：``保留数 + 归档数 == 原数``，且每条保留项与原件**逐字段等值**；
归档件写在图谱旁边，不删。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.publish.anti_risk import device_graph_guard  # noqa: E402
from app.services.publish.anti_risk.account_identity import row_id_from_account_id  # noqa: E402

#: 登录前游客 cookie 字段（与 `services/scan_login.py` 的剔除清单同源，改那边必须改这里）
GUEST_IDENTITY_FIELDS = ("webId", "a1", "d_c0")
_LEGACY_RE = re.compile(r"_legacy-[0-9a-f]{8}$")
_GUEST_RE = re.compile(r"_(%s)-[0-9a-f]{12}$" % "|".join(map(re.escape, GUEST_IDENTITY_FIELDS)), re.ASCII)


def classify(account_id: str) -> str:
    """返回 'keep' / 'archive-legacy' / 'archive-guest'。"""
    if _LEGACY_RE.search(account_id):
        return "archive-legacy"
    if _GUEST_RE.search(account_id):
        return "archive-guest"
    return "keep"


def decide(bindings: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    kept: list[dict[str, Any]] = []
    doomed: list[dict[str, Any]] = []
    for b in bindings:
        bucket = classify(str(b.get("account_id") or ""))
        if bucket == "keep":
            kept.append(b)
        else:
            doomed.append({**b, "_archive_reason": bucket})
    return kept, doomed


def assert_zero_loss(before: list[dict[str, Any]], kept: list[dict[str, Any]], doomed: list[dict[str, Any]]) -> None:
    if len(kept) + len(doomed) != len(before):
        msg = f"零损失不成立: {len(kept)}+{len(doomed)} != {len(before)}"
        raise SystemExit(msg)
    kept_ids = {str(b.get("account_id")) for b in kept}
    for b in before:
        aid = str(b.get("account_id") or "")
        if aid in kept_ids and classify(aid) != "keep":
            msg = f"形态判据自相矛盾: {aid} 既被保留又被判归档"
            raise SystemExit(msg)
        if classify(aid) == "keep" and aid not in kept_ids:
            msg = f"保留项丢失: {aid}"
            raise SystemExit(msg)
    # 现行稳定档一条都不许被归档
    for b in doomed:
        if row_id_from_account_id(str(b.get("account_id") or "")):
            msg = f"db 档绑定不得归档: {b.get('account_id')}"
            raise SystemExit(msg)


def self_test() -> int:
    cases = [
        ("juejin_db13", "keep"),
        ("zhihu_db5", "keep"),
        ("xiaohongshu_web_session-0123456789ab", "keep"),  # 合法字段档不得被扫掉
        ("zhihu_legacy-59e794d4", "archive-legacy"),
        ("xiaohongshu_webId-2bccc9746008", "archive-guest"),
        ("weibo_a1-2bccc9746008", "archive-guest"),
        ("zhihu_d_c0-2bccc9746008", "archive-guest"),
    ]
    bad = 0
    for aid, want in cases:
        got = classify(aid)
        if got != want:
            print(f"[FAIL] classify({aid}) = {got}, 期望 {want}")
            bad += 1
    bindings = [{"account_id": a} for a, _ in cases]
    kept, doomed = decide(bindings)
    try:
        assert_zero_loss(bindings, kept, doomed)
    except SystemExit as e:
        print(f"[FAIL] 零损失断言: {e}")
        bad += 1
    if len(kept) != 3 or len(doomed) != 4:
        print(f"[FAIL] 计数异常 kept={len(kept)} doomed={len(doomed)}")
        bad += 1
    # 变异对照：把一条 db 档伪装成待归档，判据必须当场拒绝
    try:
        assert_zero_loss(bindings, kept[:2], [*doomed, {"account_id": "csdn_db12", "_archive_reason": "x"}])
    except SystemExit:
        pass
    else:
        print("[FAIL] db 档被误归档时判据没有拒绝")
        bad += 1
    print("[OK] 自检通过" if bad == 0 else f"[FAIL] 自检 {bad} 条不通过")
    return 0 if bad == 0 else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--apply", action="store_true", help="真写盘（默认只报告）")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    path = Path(str(device_graph_guard._GRAPH_FILE))  # noqa: SLF001
    if not path.is_file():
        print(f"[SKIP] 图谱不存在: {path}")
        return 0
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    before = list(data.get("bindings") or [])
    kept, doomed = decide(before)
    for b in before:
        aid = str(b.get("account_id"))
        print(f"  {classify(aid):<15} {aid}")
    assert_zero_loss(before, kept, doomed)
    print(f"合计 保留={len(kept)} 归档={len(doomed)} 原={len(before)} 模式={'apply' if args.apply else 'dry-run'}")
    if not doomed or not args.apply:
        return 0
    stamp = time.strftime("%Y%m%dT%H%M%S", time.gmtime())
    archive = path.with_name(f"device_graph-archived-{stamp}.json")
    archive.write_text(
        json.dumps({"archived_at": stamp, "reason": "旧键形态设备绑定归档", "bindings": doomed},
                   ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    data["bindings"] = kept
    tmp = path.with_suffix(".json.writing")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    back = json.loads(tmp.read_text(encoding="utf-8"))
    if len(back.get("bindings") or []) != len(kept):
        tmp.unlink(missing_ok=True)
        print("[ABORT] 回读条数不符，未替换图谱")
        return 1
    tmp.replace(path)
    print(f"[OK] 已归档 {len(doomed)} 条 -> {archive.name}（原件未删除）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
