# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""私有成对评测 —— CLI 运行入口(逐版本跑固定题库 → 落趋势账 → 骤降哨兵)。

退出码约定(对齐 AGENTS.md §22b 与 §0.3):
    0 = 跑完且判过,胜率未低于基线(ok)
    1 = 跑完且判过,但本版相对近期基线**骤降**(发现一个真问题,regression)
    2 = **未判定**(题库不在批准落点 / 题太少判不动 / 裁判整体没返回 / 脚本自身异常)
        —— 绝不把"没跑到"写成"跑过且没事",也不把"够不上基线样本"伪装成 ok。

典型用法:
    # 仓外放好 pairwise-dataset.jsonl 后(题库不进 git):
    python -m app.core 之外随便跑:  python apps/ai-service/scripts/private_eval_run.py --version <git尖或标签>
    python apps/ai-service/scripts/private_eval_run.py --self-test   # 纯函数自检,零外网零密钥
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path

# 让脚本在 apps/ai-service 下不依赖包安装也能 import app.*
_APP_ROOT = Path(__file__).resolve().parents[1]
if str(_APP_ROOT) not in sys.path:
    sys.path.insert(0, str(_APP_ROOT))

from app.services.pairwise_eval import (  # noqa: E402
    UNJUDGED,
    PairwiseResult,
    TrendPoint,
    WinRate,
    append_ledger,
    detect_regression,
    judge_pair,
    load_ledger,
    rollup_wins,
)
from app.services.private_eval_store import (  # noqa: E402
    load_dataset,
    resolve_dataset_path,
    trend_ledger_path,
)

EXIT_OK = 0
EXIT_REGRESSION = 1
EXIT_UNDETERMINED = 2


def _print_rate(label: str, rate: WinRate | None) -> None:
    if rate is None:
        print(f"  {label}: <无>")
        return
    pct = "n/a" if rate.win_rate is None else f"{rate.win_rate:.4f}"
    print(f"  {label}: 胜率={pct}  win={rate.win} loss={rate.loss} tie={rate.tie} unjudged={rate.unjudged} 可判basis={rate.basis}")


async def _run(args: argparse.Namespace) -> int:
    res = resolve_dataset_path()
    dataset_path = res.path
    if not res.found or dataset_path is None:
        print(f"[未判定] 题库不在批准落点(env 覆盖或候选根),不回落工作树、也不冒称通过(§0.3)。tried={res.tried} winner_index={res.winner_index}")
        if res.winner_index >= 0:
            print("         根已挂上但题库文件缺失 —— 先在该路径放 pairwise-dataset.jsonl 再跑。")
        return EXIT_UNDETERMINED

    items = load_dataset(dataset_path)
    if not items:
        print(f"[未判定] 题库 {res.path} 解析出 0 条可用题(空文件或全坏行),枚举到 0 候选不记绿(§0.3)。")
        return EXIT_UNDETERMINED
    if len(items) < args.min_judged:
        print(f"[未判定] 题数 {len(items)} < 判动阈值 {args.min_judged},样本太小噪声会打翻哨兵,本轮不裁决。")
        return EXIT_UNDETERMINED

    # 真跑才接网关;--dry 只做装载与计划,证明链路通而不调模型。
    if args.dry_run:
        print(f"[DRY] 题库={res.path} 解析 {len(items)} 条题,计划送裁判 model={args.judge_model or '<default>'};未发起任何网络/模型调用。")
        return EXIT_OK

    from app.core.llm_gateway import llm_gateway  # 仅真跑时再导,避免自检/装载路径拉起网关

    results: list[PairwiseResult | None] = []
    for item in items:
        try:
            results.append(await judge_pair(llm_gateway, item, judge_model=args.judge_model))
        except Exception as exc:  # noqa: BLE001 - 单题裁判异常降级为 unjudged,不拖垮整轮
            print(f"  ⚠ 题 {item.item_id} 裁判异常(按未判定处理): {type(exc).__name__}: {exc}")
            results.append(None)

    judged = [r for r in results if isinstance(r, PairwiseResult)]
    unjudged_extra = sum(1 for r in results if r is None)
    if not judged:
        print(f"[未判定] 全部 {len(items)} 题都没判下来(网关无可用 key/model?)⇒ 不冒称跑过,也不冒充零胜率(§0.3)。")
        return EXIT_UNDETERMINED

    # 把"裁判层未判定"计入统计口径
    for _ in range(unjudged_extra):
        judged.append(PairwiseResult(item_id="__gateway_error__", outcome=UNJUDGED, swapped=False, error="网关/裁判调用抛异常"))

    current = rollup_wins(judged)
    ledger = trend_ledger_path()
    history = load_ledger(ledger)
    # 基线只取"已落账的历史版本",不把本次自己算进基线
    baseline_rates = [p.rate for p in history]
    verdict = detect_regression(
        current,
        baseline_rates,
        min_judged=args.min_judged,
        min_delta=args.min_delta,
        window=args.window,
    )

    print("=" * 60)
    print(f"私有成对评测  version={args.version}  at={datetime.now(UTC).isoformat()}")
    _print_rate("本版   ", current)
    if history:
        print(f"  历史趋势点数: {len(history)}  (账本 {ledger})")
    else:
        print("  历史趋势点数: 0  (首版,暂无基线可比对)")
    print(f"  哨兵: {verdict.verdict}  baseline={verdict.baseline} dropped={verdict.dropped}  {verdict.reason}")
    print("=" * 60)

    if not args.no_append:
        append_ledger(ledger, TrendPoint(version=args.version, at=datetime.now(UTC).isoformat(), rate=current))

    if verdict.verdict == "regression":
        print("→ 退出 1:检测到相对近期基线的胜率骤降 —— 这正是原文靠曲线揪出坏合并的那一型,建议定位本版改动。")
        return EXIT_REGRESSION
    if verdict.verdict == "unjudged":
        print("→ 退出 2:本轮判不了(基线样本不足),不当成功也不当失败,补齐基线趋势再裁。")
        return EXIT_UNDETERMINED
    return EXIT_OK


# --------------------------------------------------------------------------- #
# 纯函数形状锁(零外网零密钥,钉死四态/位置随机/哨兵三态映射)
# --------------------------------------------------------------------------- #
def _self_test() -> int:
    from app.services.pairwise_eval import (
        LOSS,
        TIE,
        WIN,
        EvalItem,
        PairwiseResult,
        build_judge_prompt,
        is_swapped,
        pairwise_verdict,
    )

    fails: list[str] = []

    def check(cond: bool, msg: str) -> None:
        if not cond:
            fails.append(msg)

    # 未交换:候选在 A 位
    check(pairwise_verdict({"winner": "A", "reason": "a好"}, item_id="x", swapped=False).outcome == WIN, "未交换 winner=A 应计候选胜")
    check(pairwise_verdict({"winner": "B", "reason": "b好"}, item_id="x", swapped=False).outcome == LOSS, "未交换 winner=B 应计候选负")
    # 交换:候选在 B 位,同样 winner=B 现在是候选胜(位置随机化的映射正确性)
    check(pairwise_verdict({"winner": "B", "reason": "b好"}, item_id="x", swapped=True).outcome == WIN, "交换 winner=B 应映射成候选胜")
    check(pairwise_verdict({"winner": "A", "reason": "a好"}, item_id="x", swapped=True).outcome == LOSS, "交换 winner=A 应映射成候选负")
    # tie 与摆位无关
    check(pairwise_verdict({"winner": "tie", "reason": "同"}, item_id="x", swapped=True).outcome == TIE, "tie 不受摆位影响")
    # error / 缺字段 / 非法 winner ⇒ UNJUDGED,绝不默认成 tie
    check(pairwise_verdict({"error": True, "error_message": "网关挂了"}, item_id="x", swapped=False).outcome == UNJUDGED, "error 应落 unjudged")
    check(pairwise_verdict({"winner": "maybe", "reason": "?"}, item_id="x", swapped=False).outcome == UNJUDGED, "非法 winner 应落 unjudged")
    check(pairwise_verdict("not-a-dict", item_id="x", swapped=False).outcome == UNJUDGED, "非 dict 应落 unjudged")  # type: ignore[arg-type]

    # 胜率分母:tie/unjudged 不进 basis(w1 l1 t1 u1 ⇒ basis=2 rate=0.5)
    r = [
        PairwiseResult("1", WIN, False),
        PairwiseResult("2", LOSS, True),
        PairwiseResult("3", TIE, False),
        PairwiseResult("4", UNJUDGED, True, error="no"),
    ]
    w = rollup_wins(r)
    check(w.win == 1 and w.loss == 1 and w.tie == 1 and w.unjudged == 1, "计数分类错误")
    check(w.basis == 2 and w.win_rate == 0.5, f"胜率口径错误:分母应排除 tie/unjudged, got basis={w.basis} rate={w.win_rate}")

    # 全 tie ⇒ rate None ⇒ 哨兵 unjudged(判不动不得冒 ok)
    all_tie = rollup_wins([PairwiseResult(str(i), TIE, i % 2 == 0) for i in range(10)])
    check(all_tie.basis == 0 and all_tie.win_rate is None, "全 tie 应 basis=0 rate=None")

    # 哨兵三态:regression / ok / unjudged(基线不足)
    base_hi = WinRate(n=20, win=18, loss=2, tie=0, unjudged=0, win_rate=0.9)
    cur_low = WinRate(n=20, win=8, loss=12, tie=0, unjudged=0, win_rate=0.4)
    cur_ok = WinRate(n=20, win=17, loss=3, tie=0, unjudged=0, win_rate=0.85)
    hist5 = [base_hi] * 5
    check(detect_regression(cur_low, hist5).verdict == "regression", "应判骤降")
    check(detect_regression(cur_ok, hist5).verdict == "ok", "未跌破应判 ok")
    check(detect_regression(cur_ok, hist5[:2]).verdict == "unjudged", "历史不足 window 应判未判定不冒 ok")
    check(detect_regression(all_tie, hist5).verdict == "unjudged", "本版判不动应未判定")
    check(detect_regression(cur_low, [base_hi] * 5, min_delta=0.6).verdict == "ok", "阈值放宽后不该报骤降")

    # 位置随机化:同 id 可复现 + 抽样大致均衡 + **真实摆位与映射联动**(回归防线)
    item_ab = EvalItem(item_id="ab", instruction="问题?", candidate="[CAND]", reference="[REF]")
    for swp in (False, True):
        prompt = build_judge_prompt(item_ab, swapped=swp)
        user_text = prompt[1]["content"]
        a_is_candidate = "回答 A\n[CAND]" in user_text
        check(a_is_candidate != swp, f"swapped={swp} 时 A 位放错边(swap=False 应 A=candidate);摆位与映射若解耦会引入系统性偏差")
    check(is_swapped("stable-key") == is_swapped("stable-key"), "位置随机化必须跨调用可复现")
    flips = [is_swapped(f"s{i}") for i in range(30)]
    check(8 <= sum(flips) <= 22, f"位置随机化失衡(30 样本里 swap 数={sum(flips)}),会重新引入摆位偏差")

    if fails:
        print("[SELF-TEST FAIL]")
        for f in fails:
            print("  ✗", f)
        return EXIT_UNDETERMINED
    print("[SELF-TEST PASS] 四态/位置随机化/胜率口径/哨兵三态 全部形状锁通过(零外网零密钥)。")
    return EXIT_OK


def main() -> int:
    parser = argparse.ArgumentParser(description="私有成对胜率评测(复现 SmolTalkBench)+ 骤降趋势哨兵")
    parser.add_argument("--version", default="unknown", help="本版标识(git 尖/标签/evolve轮次),写进趋势账")
    parser.add_argument("--judge-model", default=None, help="裁判模型,空则用网关默认")
    parser.add_argument("--min-judged", type=int, default=8, help="判动所需最小可判题数(小于此不裁决,§0.3)")
    parser.add_argument("--min-delta", type=float, default=0.10, help="相对基线下降多少算骤降")
    parser.add_argument("--window", type=int, default=5, help="基线取近 N 个历史点均值")
    parser.add_argument("--dry-run", action="store_true", help="只装载与计划,不调模型、不落账")
    parser.add_argument("--no-append", action="store_true", help="跑完不写趋势账(调试用)")
    parser.add_argument("--self-test", action="store_true", help="纯函数形状锁,零网络")
    args = parser.parse_args()

    if args.self_test:
        return _self_test()
    try:
        return asyncio.run(_run(args))
    except Exception as exc:  # noqa: BLE001 - 脚本自身异常必须 exit 2,绝不冒 0
        print(f"[脚本异常 ⇒ 未判定] {type(exc).__name__}: {exc}")
        return EXIT_UNDETERMINED


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
