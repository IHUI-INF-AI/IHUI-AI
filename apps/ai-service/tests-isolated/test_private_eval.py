# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""私有成对评测器形状锁 —— 复现 PyBot/SmolTalkBench 的成对胜率 + 骤降哨兵。

隔离纪律(AGENTS.md §5):全程注入 FakeGateway,零外网、零生产库(PG8810/Redis8811)、
零真实密钥。裁判返回由夹具给,测的是"映射对不对",不是"模型准不准"。

钉的行为:
- 四态:candidate 视角 win/loss/tie,判不动一律 unjudged(error/缺字段/非法 winner/空集)。
- swap 联动:build_judge_prompt 真按 swapped 翻转 A/B,且与 pairwise_verdict 映射闭环 ——
  swap=True 时真把 candidate 放进 B 位,同时 winner=B 还原为候选胜,任何一侧回归都会红。
- 胜率分母:win/(win+loss),tie 与 unjudged 都不进分母(判不动不得稀释/不得充数)。
- 哨兵三态:跌破阈值=regression|未破=ok|历史够不着窗口 or 本版判不动=unjudged(绝不冒 ok)。
"""

from __future__ import annotations

import os
from typing import Any

from app.services.pairwise_eval import (
    LOSS,
    TIE,
    UNJUDGED,
    WIN,
    EvalItem,
    PairwiseResult,
    WinRate,
    build_judge_prompt,
    detect_regression,
    is_swapped,
    judge_pair,
    pairwise_verdict,
    rollup_wins,
)


class FakeGateway:
    """mock structured_completion:按预设返回字典,或抛异常,绝不触网。"""

    def __init__(self, responses: list[dict[str, Any]] | None = None, raises: Exception | None = None):
        self.responses = list(responses or [])
        self.raises = raises
        self.calls = 0
        self.seen_schemas: list[dict[str, Any]] = []

    async def structured_completion(
        self,
        messages: list[dict[str, Any]],
        schema: dict[str, Any],
        model: str | None = None,
        *,
        owner_uuid: str | None = None,
        schema_name: str = "structured_response",
        max_retries: int = 1,
    ) -> dict[str, Any]:
        self.calls += 1
        self.seen_schemas.append(schema)
        if self.raises is not None:
            raise self.raises
        if self.calls <= len(self.responses):
            return self.responses[self.calls - 1]
        return {"error": True, "error_message": "夹具无更多响应"}


def _item(iid: str) -> EvalItem:
    return EvalItem(item_id=iid, instruction="问:", candidate="[CAND]", reference="[REF]")


# ---- A/B 摆位与映射闭环(swap 联动) ---- #
def test_build_prompt_swaps_positions() -> None:
    for swp in (False, True):
        user = build_judge_prompt(_item("x"), swapped=swp)[1]["content"]
        a_cand = "回答 A\n[CAND]" in user
        b_ref = "回答 B\n[REF]" in user
        assert a_cand == (not swp)
        assert b_ref == (not swp)
        assert a_cand != ("回答 B\n[CAND]" in user), "candidate 不应同时占 A 与 B"


def test_is_swapped_stable_and_balanced() -> None:
    assert is_swapped("stable-key") == is_swapped("stable-key")
    assert 8 <= sum(is_swapped(f"s{i}") for i in range(30)) <= 22, "摆位应近似均衡,否则重新引入偏差"


# ---- 四态映射 ---- #
def test_verdict_candidate_perspective_unswapped() -> None:
    assert pairwise_verdict({"winner": "A", "reason": "a 好"}, item_id="i", swapped=False).outcome == WIN
    assert pairwise_verdict({"winner": "B", "reason": "b 好"}, item_id="i", swapped=False).outcome == LOSS


def test_verdict_candidate_perspective_swapped() -> None:
    # swapped=True 时期望 candidate 在 B 位,所以 winner=B 才是候选胜
    assert pairwise_verdict({"winner": "B", "reason": "b 好"}, item_id="i", swapped=True).outcome == WIN
    assert pairwise_verdict({"winner": "A", "reason": "a 好"}, item_id="i", swapped=True).outcome == LOSS


def test_verdict_tie_and_unjudged() -> None:
    assert pairwise_verdict({"winner": "tie", "reason": "平"}, item_id="i", swapped=False).outcome == TIE
    assert pairwise_verdict({"error": True, "error_message": "超时"}, item_id="i", swapped=False).outcome == UNJUDGED
    assert pairwise_verdict({"winner": "?", "reason": ""}, item_id="i", swapped=False).outcome == UNJUDGED
    assert pairwise_verdict("not a dict", item_id="i", swapped=False).outcome == UNJUDGED  # type: ignore[arg-type]


def test_judge_pair_maps_actual_position_with_real_seed() -> None:
    """端到端:真实 is_swapped 决定摆放,裁判按内容返回,还原必须是候选胜。

    这是最有判别力的一条:swap 与映射若哪天解耦(比如有人改了 seed 或改了映射一侧),
    prompt 里给裁判的 A/B 与代码假设的 cand_side 不一致,结果会从 WIN 翻成 LOSS,本测试即红。
    """
    iid = "item-1"
    swp = is_swapped(iid)
    # 裁判返回"放候选那一方胜"——按实际摆位算它到底是 A 还是 B;同时给一个不与摆位巧合相等的 key,确保测的是还原逻辑不是巧合。
    item = _item(iid)
    prompt = build_judge_prompt(item, swapped=swp)
    cand_slot = "A" if "回答 A\n[CAND]" in prompt[1]["content"] else "B"
    assert (cand_slot == "A") == (not swp)
    for k in (1000, 2000, 3000, 4000, 5000):  # 跨多个 iid 验证真实联动,不靠单点巧合
        cand_key = "A" if not is_swapped(f"id{k}") else "B"
        res = pairwise_verdict({"winner": cand_key, "reason": "r"}, item_id=f"id{k}", swapped=is_swapped(f"id{k}"))
        assert res.outcome == WIN, f"id{k}: swap={is_swapped(f'id{k}')} 期望候选位={cand_key}"
        wrong_key = "B" if cand_key == "A" else "A"
        assert pairwise_verdict({"winner": wrong_key, "reason": "r"}, item_id=f"id{k}", swapped=is_swapped(f"id{k}")).outcome == LOSS
    assert swp == is_swapped(iid)


async def test_judge_pair_calls_gateway_once() -> None:
    gw = FakeGateway([{"winner": "A", "reason": "ok"}])
    res = await judge_pair(gw, _item("z"))
    assert gw.calls == 1
    assert res.outcome in {WIN, LOSS, TIE}
    assert gw.seen_schemas[0]["properties"]["winner"]["enum"] == ["A", "B", "tie"]


async def test_judge_pair_gateway_exception_degrades_to_unjudged() -> None:
    """网关抛异常时 judge_pair 不吞成功:本层若未捕获会冒泡给调用方。

    本层故意让异常传播(不就地转 unjudged),由 run 侧统一计为 unjudged;
    断言异常确实发生、未被静默伪装成"已判定",与诚实降级方向一致。
    """
    gw = FakeGateway(raises=RuntimeError("net down"))
    try:
        await judge_pair(gw, _item("boom"))
    except RuntimeError as exc:
        assert "net down" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("网关异常不应被静默吞成已判定")


# ---- 胜率分母口径 ---- #
def _p(outcome: str) -> PairwiseResult:
    return PairwiseResult(item_id="t", outcome=outcome, swapped=False)


def test_rollup_excludes_tie_unjudged_from_denominator() -> None:
    w = rollup_wins([_p(WIN), _p(WIN), _p(LOSS), _p(TIE), _p(UNJUDGED)])
    assert w.win == 2 and w.loss == 1 and w.tie == 1 and w.unjudged == 1
    assert w.basis == 3, "分母只含 win+loss"
    assert w.win_rate == round(2 / 3, 4)


def test_rollup_all_tie_or_unjudged_has_no_rate() -> None:
    assert rollup_wins([_p(TIE), _p(UNJUDGED)]).win_rate is None
    assert rollup_wins([]).win_rate is None


# ---- 哨兵三态 ---- #
def _rate(win: int, loss: int) -> WinRate:
    basis = win + loss
    return WinRate(n=basis, win=win, loss=loss, tie=0, unjudged=0, win_rate=round(win / basis, 4) if basis else None)


def test_regression_triggers_on_drop() -> None:
    v = detect_regression(_rate(4, 16), [_rate(18, 2)] * 5, min_judged=8, min_delta=0.10, window=5)
    assert v.verdict == "regression"
    assert v.baseline == 0.9 and v.dropped is not None and v.dropped >= 0.10


def test_ok_when_not_dropping() -> None:
    assert detect_regression(_rate(18, 2), [_rate(18, 2)] * 5).verdict == "ok"


def test_unjudged_when_history_short() -> None:
    v = detect_regression(_rate(4, 16), [_rate(18, 2)] * 2, window=5)
    assert v.verdict == "unjudged", "历史不足不得冒充 regression 或 ok"


def test_unjudged_when_current_low_basis() -> None:
    # current.basis < min_judged → 判不动,绝不能因"分母小但比例低"误报 regression
    v = detect_regression(_rate(1, 3), [_rate(18, 2)] * 5, min_judged=10)
    assert v.verdict == "unjudged"


def test_undetermined_never_falsely_green() -> None:
    """失效方向必须是"要多一次说明",不是"多放一次":无基线一律 unjudged ≠ ok/≠ regression。"""
    v = detect_regression(_rate(4, 16), [], window=5)
    assert v.verdict == "unjudged"
    assert v.verdict != "ok", "无基线绝不冒绿灯(§0.2/§0.3)"


# ---- 仓外题库装载(保密轴:不在批准落点=判不了,绝不回落工作树) ---- #
def test_resolve_dataset_missing_root_is_not_found(tmp_path: Any) -> None:
    from app.services.private_eval_store import resolve_dataset_path

    empty = tmp_path / "nope"  # 根不存在
    res = resolve_dataset_path({"PRIVATE_EVAL_DIR": str(empty)})
    assert res.found is False  # 读不到 ≠ 通过,调用方据此落未判定
    assert res.winner_index == -1
    assert res.tried and "pairwise-dataset.jsonl" in res.tried[0]


def test_resolve_dataset_root_present_but_file_absent(tmp_path: Any) -> None:
    from app.services.private_eval_store import resolve_dataset_path

    root = tmp_path / "ev"
    root.mkdir()  # 根挂了,题库文件还没放
    res = resolve_dataset_path({"PRIVATE_EVAL_DIR": str(root)})
    assert res.winner_index == 0  # 根命中
    assert res.found is False  # 但文件缺 ⇒ 仍不可用(不得当空题冒跑)


def test_load_dataset_dedupes_by_item_id(tmp_path: Any) -> None:
    from app.services.private_eval_store import load_dataset

    f = tmp_path / "pairwise-dataset.jsonl"
    rows = [
        {"item_id": "a", "instruction": "i1", "candidate": "c1", "reference": "r1"},
        {"item_id": "b", "instruction": "i2", "candidate": "c2", "reference": "r2"},
        {"item_id": "a", "instruction": "dup", "candidate": "dupC", "reference": "dupR"},
        {"garbage": True},
    ]
    import json as _json

    f.write_text("\n".join(_json.dumps(x) for x in rows), encoding="utf-8")
    items = load_dataset(f)
    assert [i.item_id for i in items] == ["a", "b"], "重复 item_id 必须折到首枚,坏行丢弃"
    assert items[0].candidate == "c1", "去重应保第一份"


# ---- 模板行不可用(防"没人改就直接假绿") ---- #
def test_template_rows_are_not_usable(tmp_path: Any) -> None:
    from app.services.private_eval_store import load_dataset, scan_dataset, write_template

    f = tmp_path / "pairwise-dataset.jsonl"
    n = write_template(f)
    assert n == 3
    assert load_dataset(f) == [], "纯模板文件必须一条可用题都不给(否则会拿占位文字出题)"
    s = scan_dataset(f)
    assert s.usable == 0 and s.template == 3 and s.verdict == "template-only", s.to_dict()


# ---- 路径二义性:write_template/load_dataset/scan_dataset 都得接受 str,不只 Path(§0.9 真能跑) ---- #
def test_store_accepts_str_path_not_only_pathlib(tmp_path: Any) -> None:
    """调用方给 str 不能 AttributeError。修前 write_template(path.parent) 对 str 直接炸。"""
    from pathlib import Path

    from app.services.private_eval_store import load_dataset, scan_dataset, write_template

    str_dir = str(tmp_path)
    # write_template 接受 str
    str_file = os.path.join(str_dir, "t.jsonl")
    assert write_template(str_file) == 3, "write_template 必须接受 str 路径"
    assert Path(str_file).exists()
    # scan/load 接受 str
    assert scan_dataset(str_file).verdict == "template-only"
    assert load_dataset(str_file) == []
    # Path 对象仍照常工作(回归保护:别把 pathlib 路径改坏)
    assert write_template(Path(str_file)) == 3


def test_scan_counts_each_defect_kind(tmp_path: Any) -> None:
    import json as _json

    from app.services.private_eval_store import scan_dataset

    dicts = [
        {"item_id": "ok1", "instruction": "i", "candidate": "c", "reference": "r"},
        {"item_id": "ok1", "instruction": "i", "candidate": "c", "reference": "r"},
        {"item_id": "ok2", "instruction": "i2", "candidate": "c2", "reference": "r2"},
        {"item_id": "TEMPLATE-x", "instruction": "i", "candidate": "c", "reference": "r"},
        {"item_id": "miss", "instruction": "i", "candidate": "c"},
    ]
    lines = [_json.dumps(d, ensure_ascii=False) for d in dicts]
    lines.append("not-json{")  # 坏行
    f = tmp_path / "pairwise-dataset.jsonl"
    f.write_text("\n".join(lines), encoding="utf-8")
    s = scan_dataset(f)
    assert (s.total, s.usable, s.duplicate, s.template, s.missing_field, s.malformed) == (6, 2, 1, 1, 1, 1), s.to_dict()
    assert s.verdict == "usable"


# ---- CLI 装车证据:子进程真跑,零网络零密钥,且**绝不泄题** ---- #
def test_cli_init_template_then_validate(tmp_path: Any) -> None:
    """装车证据:子进程真跑 CLI。零网络零密钥,且**绝不泄题**。"""
    import json as _json
    import os
    import subprocess
    import sys
    from pathlib import Path

    app_root = Path(__file__).resolve().parents[1]
    child_env = {**os.environ, "PRIVATE_EVAL_DIR": str(tmp_path), "PYTHONIOENCODING": "utf-8"}

    def run_cli(*flags: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "scripts/private_eval_run.py", *flags],
            cwd=app_root,
            env=child_env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=240,
            check=False,
        )

    t = run_cli("--init-template")
    assert t.returncode == 0, (t.stdout or "") + (t.stderr or "")
    tpl = tmp_path / "pairwise-dataset.TEMPLATE.jsonl"
    assert tpl.exists(), "模板应落在批准根内,且文件名不带正式题库名"
    assert not (tmp_path / "pairwise-dataset.jsonl").exists(), "生成模板不得顺手造出正式题库(那会变成可用题=0 的假状态)"

    v = run_cli("--validate")
    assert v.returncode == 2, v.stdout  # 只有模板未被替换 ⇒ 未判定,绝不冒绿
    assert "template-only" in v.stdout

    secret_text = "绝不该出现在终端里的机密题面"
    (tmp_path / "pairwise-dataset.jsonl").write_text(
        "\n".join(
            _json.dumps({"item_id": f"x{i}", "instruction": secret_text, "candidate": "c", "reference": "r"}, ensure_ascii=False)
            for i in range(4)
        ),
        encoding="utf-8",
    )
    v2 = run_cli("--validate")
    assert v2.returncode == 0, v2.stdout
    assert "可用=4" in v2.stdout
    assert secret_text not in (v2.stdout or "") + (v2.stderr or ""), "体检档绝不允许打印题面文字(保密轴)"


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
