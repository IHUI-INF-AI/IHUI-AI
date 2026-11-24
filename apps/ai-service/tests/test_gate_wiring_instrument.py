# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R75 装车观测仪的回归锁。

三件事必须被钉住：① 仪器自证（1 阳 3 阴，坏尺不得出结论）；② 声明面不算消费者；
③ 取不到输入 ⇒ undetermined，不把空集读成"没人接线"。
"""

from __future__ import annotations

from typing import Any

from app.services import gate_wiring_instrument as gi
from app.services import reverse_engineered_gates as agg


def test_instrument_proves_itself_before_it_proves_anything() -> None:
    sc = gi.run_instrument_selfcheck()
    assert sc["ok"] is True, sc
    assert sc["detail"]["positive_hit"] is True
    assert sc["detail"]["negative_comment_only"] is False
    assert sc["detail"]["negative_import_only"] is False
    assert sc["detail"]["negative_string_literal"] is False


def test_broken_instrument_downgrades_readout_not_silences_it(monkeypatch: Any) -> None:
    """尺子坏了必须显式报 instrument-broken 并说明"读数不得用"，不得静默当合格读数。"""
    monkeypatch.setattr(gi, "_is_call_site", lambda text: False)
    rep = gi.scan_wiring({"app/services/producer.py": 'evaluate_gate_suite(req)\n'})
    assert rep["state"] == "instrument-broken"
    assert "先修尺再读盘" in rep["reason"]
    assert rep["counts"]["consumers"] == 0


def test_declaration_faces_are_never_counted_as_consumers() -> None:
    """聚合层与本模块自身都写着入口名 ⇒ 必须排除（R74 实测踩过：不排除会把 0 报成有）。"""
    sources = {
        "app/services/reverse_engineered_gates.py": "def evaluate_gate_suite(request=None, policy=None):\n    ...\n",
        "app/services/gate_wiring_instrument.py": 'ENTRY_TOKENS = ("evaluate_gate_suite",)\n',
        "app/services/reverse_engineered_gate_wiring.py": "out = evaluate_gate_suite(req)\n",  # 已作废件的历史形
    }
    rep = gi.scan_wiring(sources)
    assert rep["counts"]["consumers"] == 0
    assert rep["consumer_sites"] == {}
    assert sorted(rep["declaration_faces_excluded"]) == sorted(sources)


def test_real_consumer_is_detected_with_pair_key() -> None:
    sources = {
        "app/services/producer_x.py": (
            "from app.services.reverse_engineered_gates import evaluate_gate_suite\n"
            "res = evaluate_gate_suite(request, policy)\n"
        ),
        "app/services/producer_y.py": (
            "from app.services import reverse_engineered_gates as reg\n"
            "res = reg.evaluate_gate_suite(request)\n"
        ),
    }
    rep = gi.scan_wiring(sources)
    assert rep["state"] == "ok"
    assert rep["counts"]["consumers"] == 2
    assert set(rep["consumer_sites"]["evaluate_gate_suite"]) == {
        "app/services/producer_x.py",
        "app/services/producer_y.py",
    }


def test_entry_token_in_ordinary_prose_is_not_a_call_site() -> None:
    """判别力正面锁（本轮反向变异暴露的缺口）：把判据放宽成"原文里有名字就算"仍然全绿的，
    就是这三条 —— 所以这里必须**逐条直接问判据本体**，而不是只看聚合后的计数。"""
    assert gi._is_call_site(gi._POSITIVE) is True
    assert gi._is_call_site(gi._NEG_COMMENT_ONLY) is False
    assert gi._is_call_site(gi._NEG_IMPORT_ONLY) is False
    assert gi._is_call_site(gi._NEG_STRING_LITERAL) is False
    # 真调用的最小形态：名字 + 括号在**代码行**里
    assert gi._is_call_site("out = evaluate_gate_suite(req, pol)\n") is True
    assert gi._is_call_site('cfg = {"entry": "evaluate_gate_suite"}\n') is False


def test_comment_or_literal_mention_is_not_a_consumer() -> None:
    sources = {
        "app/services/talking.py": (
            "# 这里以前调过 evaluate_gate_suite( 后来撤了\n"
            '_DOC = "evaluate_gate_suite"\n'
            "from app.services.reverse_engineered_gates import GATE_SUITE\n"
        ),
    }
    rep = gi.scan_wiring(sources)
    assert rep["counts"]["consumers"] == 0, rep
    assert rep["counts"]["sites"] == 0, rep
    assert rep["consumer_sites"] == {}, rep


def test_unavailable_input_is_undetermined_not_zero() -> None:
    rep = gi.scan_wiring(None)
    assert rep["state"] == "undetermined"
    assert rep["counts"]["consumers"] == 0
    assert "既不记绿也不冒红" in rep["reason"]
    assert set(rep["suite_gates"]) == set(gi.gate_names())


def test_gate_names_is_live_view_of_aggregate_not_a_copy() -> None:
    """门名唯一真相源在聚合层：此处必须是同一内容的现读投影（§22c 零复算）。"""
    assert gi.gate_names() == tuple(agg.GATE_SUITE)
    assert "code_execution" in gi.gate_names()


def test_empty_scan_input_is_not_read_as_no_wiring_conclusion(monkeypatch: Any) -> None:
    """空注入 = 没扫到东西，与"扫过了且确实没人调"必须可区分。"""
    rep = gi.scan_wiring({})
    assert rep["state"] == "ok"
    assert rep["counts"]["consumers"] == 0
    assert rep["declaration_faces_excluded"] == []
    assert rep["consumer_sites"] == {}


def test_entry_tokens_are_the_only_vocabulary_and_are_exported() -> None:
    assert "ENTRY_TOKENS" in gi.__all__
    assert gi.ENTRY_TOKENS == ("evaluate_gate_suite", "evaluate_gate")
    # 观测仪不得自带第二套门名词表：门名只从聚合层取
    assert not hasattr(gi, "GATE_NAMES")
    assert not hasattr(gi, "SUITE_GATE_NAMES")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
