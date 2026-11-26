# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""私有成对评测 —— 逐版本"戳印"器(把固定题面跑成当版候选答案)。

为什么需要这一层(2026-11-26 立,RP-45 的"题库落盘"缺口):
    `pairwise_eval.py` / `private_eval_run.py` 只判**现成**的 candidate/reference;
    若题库里的 candidate 一直不变,逐版本胜率就是一条水平线 —— 看着在跑,其实什么都没测。
    原文 SmolTalkBench 的候选答案由被评测的那一版现场生成;本层补的就是这一步:
    读固定题面 → 用当版模型生成 candidate → reference 取上一版题库的 candidate(首版用基线模型)
    → 原子换件写回题库 → 再交给 `private_eval_run.py` 裁决。

三条硬纪律:
    ① 题库永不进 git(落点复用 `private_eval_store.template_path()` 的批准根,不另抄盘符表);
    ② 生成失败的题**整行剔除**并报数,绝不写空 candidate 让裁判把它判成"输"(§0.3);
    ③ reference 的语义是"上一版/基线",不是手写金标 —— 所以每跑一版,题库自身就是下一版的基线。

用法(在 apps/ai-service 下):
    ./.venv/Scripts/python.exe scripts/private_eval_stamp.py --version <sha> \
        --candidate-model agnes-3.0-flash --baseline-model agnes-2.5-flash
    ./.venv/Scripts/python.exe scripts/private_eval_stamp.py --self-test
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_APP_ROOT = Path(__file__).resolve().parents[1]
if str(_APP_ROOT) not in sys.path:
    sys.path.insert(0, str(_APP_ROOT))

from app.services.private_eval_store import template_path  # noqa: E402
from app.services.pairwise_eval import EvalItem  # noqa: E402

EXIT_OK = 0
EXIT_UNDETERMINED = 2

DEFAULT_SYSTEM_PROMPT = (
    "你是一位自然、贴心的对话伙伴,像知识渊博的朋友一样回答用户的问题。"
    "先直接解决用户要办的事,再补必要的背景;事实要准确,不知道就直说,不编造。"
    "语气自然克制,不用套话、不堆术语、不为了显得专业而绕弯子。"
)

PROMPTS_NAME = "prompts.jsonl"
DATASET_NAME = "pairwise-dataset.jsonl"


def approved_root(env: dict[str, str] | None = None) -> Path:
    """批准根 = 模板落点的父目录(单一真相源在 private_eval_store.template_path)。"""
    return template_path(env).parent


def load_prompts(path: Path | str) -> tuple[list[dict[str, str]], dict[str, int]]:
    """读题面库:只认 item_id + instruction;模板行/重复/坏行剔除并计数。"""
    scan = {"total": 0, "usable": 0, "template": 0, "duplicate": 0, "malformed": 0, "missing_field": 0}
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        scan["total"] += 1
        try:
            obj: Any = json.loads(line)
        except json.JSONDecodeError:
            scan["malformed"] += 1
            continue
        if not isinstance(obj, dict):
            scan["malformed"] += 1
            continue
        item_id = str(obj.get("item_id") or "").strip()
        instruction = str(obj.get("instruction") or "").strip()
        if not item_id or not instruction:
            scan["missing_field"] += 1
            continue
        if item_id.startswith("TEMPLATE-"):
            scan["template"] += 1
            continue
        if item_id in seen:
            scan["duplicate"] += 1
            continue
        seen.add(item_id)
        scan["usable"] += 1
        items.append({"item_id": item_id, "instruction": instruction})
    return items, scan


def previous_candidates(path: Path | str | None) -> dict[str, str]:
    """从上一版题库取 item_id → candidate(下一版的 reference 就是它)。"""
    out: dict[str, str] = {}
    if not path:
        return out
    p = Path(path)
    if not p.exists():
        return out
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(obj, dict):
            continue
        item_id = str(obj.get("item_id") or "")
        candidate = str(obj.get("candidate") or "").strip()
        if item_id and candidate and not item_id.startswith("TEMPLATE-"):
            out[item_id] = candidate
    return out


def write_dataset(path: Path | str, rows: list[dict[str, str]]) -> None:
    """原子换件:先写同目录临时件再 os.replace,半截文件永远不会被下一版当成基线。"""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".pairwise-dataset.", suffix=".tmp", dir=str(p.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, p)
    finally:
        if Path(tmp).exists():
            Path(tmp).unlink(missing_ok=True)


async def _generate_one(gateway: Any, model: str | None, system_prompt: str, instruction: str) -> str:
    r = await gateway.complete(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": instruction},
        ],
        model=model or None,
        max_tokens=800,
    )
    return str(r.get("content") or "").strip()


async def _fill(
    instructions: list[str],
    *,
    model: str | None,
    system_prompt: str,
    concurrency: int,
    retries: int = 2,
    retry_backoff: float = 8.0,
    min_interval: float = 1.0,
) -> list[str | None]:
    gateway = None
    sem = asyncio.Semaphore(max(1, concurrency))
    pace_lock = asyncio.Lock()
    last_call = [0.0]

    async def _pace() -> None:
        if min_interval <= 0:
            return
        async with pace_lock:
            now = asyncio.get_running_loop().time()
            wait = last_call[0] + min_interval - now
            if wait > 0:
                await asyncio.sleep(wait)
            last_call[0] = asyncio.get_running_loop().time()

    async def one(text: str) -> str | None:
        nonlocal gateway
        async with sem:
            if gateway is None:
                from app.core.llm_gateway import llm_gateway

                gateway = llm_gateway
            for attempt in range(retries + 1):
                await _pace()
                try:
                    answer = await _generate_one(gateway, model, system_prompt, text)
                    return answer or None
                except Exception as exc:  # noqa: BLE001 - 单题失败降级为剔除/重试,不拖垮整轮
                    if attempt < retries:
                        await asyncio.sleep(retry_backoff * (attempt + 1))
                        continue
                    print(f"  ⚠ 生成失败({type(exc).__name__}: {exc}) ⇒ 本题剔除,不写空答案")
                    return None
            return None

    return list(await asyncio.gather(*(one(t) for t in instructions)))


async def _run(args: argparse.Namespace) -> int:
    root = approved_root()
    prompts_path = Path(args.prompts) if args.prompts else root / PROMPTS_NAME
    out_path = Path(args.out) if args.out else root / DATASET_NAME
    ref_path = Path(args.reference_from) if args.reference_from else out_path

    if not prompts_path.exists():
        print(f"[未判定] 题面库不存在:{prompts_path}")
        print("  出路:先建固定题面库(item_id + instruction),它不是题库、不含答案,可以人工维护。")
        return EXIT_UNDETERMINED

    prompts, scan = load_prompts(prompts_path)
    print(
        f"[题面库] {prompts_path} 行数={scan['total']} 可用={scan['usable']} "
        f"模板={scan['template']} 重复={scan['duplicate']} 坏行={scan['malformed']} 缺字段={scan['missing_field']}"
    )
    if not prompts:
        print("[未判定] 题面库解析出 0 条 ⇒ 不冒称可跑(§0.3)")
        return EXIT_UNDETERMINED

    if args.limit:
        prompts = prompts[: args.limit]

    prev = previous_candidates(ref_path)
    print(f"[基线] 上一版可复用 candidate 的题数={len(prev)}(来源 {ref_path if ref_path.exists() else '无(首版)'})")

    system_prompt = DEFAULT_SYSTEM_PROMPT
    if args.system_prompt_file:
        sp = Path(args.system_prompt_file)
        if not sp.exists():
            print(f"[未判定] system prompt 文件不存在:{sp}")
            return EXIT_UNDETERMINED
        system_prompt = sp.read_text(encoding="utf-8").strip() or DEFAULT_SYSTEM_PROMPT

    # 1) 当版 candidate:每题都重新生成 —— 复用上一版候选等于自评自。
    cands = await _fill(
        [p["instruction"] for p in prompts],
        model=args.candidate_model,
        system_prompt=system_prompt,
        concurrency=args.concurrency,
        retries=args.retries,
        retry_backoff=args.retry_backoff,
        min_interval=args.min_interval,
    )

    # 2) reference:优先上一版同 item_id 的 candidate;缺失的用基线模型补。
    need_baseline = [p["instruction"] for p, c in zip(prompts, cands, strict=False) if c and p["item_id"] not in prev]
    base_map: dict[str, str] = {}
    if need_baseline and args.baseline_model:
        base_answers = await _fill(
            need_baseline,
            model=args.baseline_model,
            system_prompt=system_prompt,
            concurrency=args.concurrency,
            retries=args.retries,
            retry_backoff=args.retry_backoff,
            min_interval=args.min_interval,
        )
        # 按顺序回填到缺基线的 item_id
        it = iter(base_answers)
        for p, cand in zip(prompts, cands, strict=False):
            if cand and p["item_id"] not in prev:
                a = next(it, None)
                if a:
                    base_map[p["item_id"]] = a
    elif need_baseline and not args.baseline_model:
        print(f"  提示:{len(need_baseline)} 题缺基线且未给 --baseline-model ⇒ 这些题本轮剔除")

    rows: list[dict[str, str]] = []
    skipped = 0
    for p, cand in zip(prompts, cands, strict=False):
        if not cand:
            skipped += 1
            continue
        ref = prev.get(p["item_id"]) or base_map.get(p["item_id"])
        if not ref:
            skipped += 1
            continue
        rows.append(
            {
                "item_id": p["item_id"],
                "instruction": p["instruction"],
                "candidate": cand,
                "reference": ref,
            }
        )

    print(f"[戳印] 候选可用={len(rows)} 剔除={skipped} 版={args.version} 候选模型={args.candidate_model}")
    if not rows:
        print("[未判定] 没有任何一题同时拿到候选与参照 ⇒ 不写题库、不冒称跑过(§0.3)")
        return EXIT_UNDETERMINED

    # 扩题后防缩表(2026-11-26):40 题题库遇到 429/个别题失败时，rows 会少于上一版；
    # 直接写回等于静默把题库缩回 12 题。宁可本轮 undetermined 保留旧题库，也不缩表冒充新一期。
    prev_count = len(prev)
    if prev_count and len(rows) < prev_count:
        print(f"[未判定] 本轮 {len(rows)} 行 < 上一版 {prev_count} 行 ⇒ 拒绝缩表写回，旧题库原样保留")
        return EXIT_UNDETERMINED

    if args.dry_run:
        print(f"[DRY] 不写盘;正式落点应为 {out_path}")
        return EXIT_OK

    write_dataset(out_path, rows)
    print(f"[已落盘] {out_path} 共 {len(rows)} 行(reference=上一版/基线,下一版会把它当基线)")
    return EXIT_OK


def _self_test() -> int:
    fails: list[str] = []

    def check(cond: bool, msg: str) -> None:
        if not cond:
            fails.append(msg)

    import tempfile as _tf

    with _tf.TemporaryDirectory(prefix="ihui-stamp-") as d:
        p = Path(d) / "prompts.jsonl"
        p.write_text(
            "\n".join(
                [
                    '{"item_id":"q1","instruction":"问题一"}',
                    '{"item_id":"q2","instruction":"问题二"}',
                    '{"item_id":"q2","instruction":"重复"}',
                    '{"item_id":"TEMPLATE-1","instruction":"模板"}',
                    '{"item_id":"q3"}',
                    'not-json',
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        items, scan = load_prompts(p)
        check(len(items) == 2, "题面库应只收 q1/q2")
        check(scan["duplicate"] == 1 and scan["template"] == 1 and scan["malformed"] == 1 and scan["missing_field"] == 1, "题面库计数错误")

        ds = Path(d) / "pairwise-dataset.jsonl"
        ds.write_text(
            '{"item_id":"q1","instruction":"问题一","candidate":"上一版答案","reference":"基线"}\n',
            encoding="utf-8",
        )
        prev = previous_candidates(ds)
        check(prev.get("q1") == "上一版答案", "上一版 candidate 应作为下一版 reference")
        check("q2" not in prev, "缺失的题不得伪造基线")

        out = Path(d) / "out.jsonl"
        write_dataset(out, [{"item_id": "q1", "instruction": "问题一", "candidate": "新", "reference": "旧"}])
        check(out.read_text(encoding="utf-8").strip().endswith('"reference": "旧"}'), "落盘行形状错误")
        check(not list(Path(d).glob(".pairwise-dataset.*.tmp")), "原子换件后不应留下临时件")

    if fails:
        print("[SELF-TEST FAIL]")
        for f in fails:
            print("  ✗", f)
        return EXIT_UNDETERMINED
    print("[SELF-TEST PASS] 题面库/上一版基线/原子换件 形状锁通过(零网络零密钥)。")
    return EXIT_OK


def main() -> int:
    parser = argparse.ArgumentParser(description="私有成对评测 · 逐版本候选答案戳印器")
    parser.add_argument("--version", default="unknown", help="本版标识(写进落盘日志;真正的版本账在 pairwise-trend.jsonl)")
    parser.add_argument("--prompts", default=None, help=f"题面库路径(默认批准根/{PROMPTS_NAME})")
    parser.add_argument("--out", default=None, help=f"题库输出路径(默认批准根/{DATASET_NAME})")
    parser.add_argument("--reference-from", default=None, help="上一版题库路径(默认=输出路径自身)")
    parser.add_argument("--candidate-model", default="auto", help="当版候选模型(默认 auto)")
    parser.add_argument("--baseline-model", default=None, help="首版/缺基线时生成参照的模型")
    parser.add_argument("--system-prompt-file", default=None, help="产品人设文件(默认内置自然对话人设)")
    parser.add_argument("--concurrency", type=int, default=1, help="并发生成数(免费档默认 1,过高会撞 429)")
    parser.add_argument("--retries", type=int, default=2, help="单题失败重试次数(429/上游抖动)")
    parser.add_argument("--retry-backoff", type=float, default=8.0, help="重试退避基数秒(逐次翻倍)")
    parser.add_argument("--min-interval", type=float, default=1.2, help="两次模型调用之间的最小间隔秒")
    parser.add_argument("--limit", type=int, default=0, help="只跑前 N 题(烟测用;0=全量)")
    parser.add_argument("--dry-run", action="store_true", help="只生成并报数,不写题库")
    parser.add_argument("--self-test", action="store_true", help="纯函数形状锁,零网络")
    args = parser.parse_args()

    if args.self_test:
        return _self_test()
    try:
        return asyncio.run(_run(args))
    except Exception as exc:  # noqa: BLE001 - 脚本异常必须 exit 2,绝不冒 0
        print(f"[脚本异常 ⇒ 未判定] {type(exc).__name__}: {exc}")
        return EXIT_UNDETERMINED


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
