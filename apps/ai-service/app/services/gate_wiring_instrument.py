# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""逆向复现判据的**装车观测仪**（R75 纠偏件 · 2026-11-18）。

它只回答一个问题：`evaluate_gate_suite` 这道聚合入口**到底有没有被生产代码调用**。
不假装能按门细分 —— 聚合层在调用点并不逐门写出名字（它按 `kind` 动态遍历 `GATE_SUITE`），
所以"这道门接了没接"在当前形态下测不出来，硬测就会把 import 行的提及读成接线。
本轮实测两次被自家自检抓到这个形状，故把面收窄到可诚实回答的那一维。

为什么本件存在（前一轮的错误留痕，防后人重踩）
------------------------------------------
* R74 在此处落过一个 `reverse_engineered_gate_wiring.py`，含 `evaluate_gate` + `describe_binding`。
  本轮实测**推翻其立论并摘除**：
  ① 聚合层 `evaluate_gate_suite` 早已支持多门（`_normalize`）、**位置绑定**
     `fn(*[inputs[k] for k in arg_keys], gate_policy)`、子策略注入（`policy["gates"][kind]`）、
     显式 opt-in、fail-closed，其自身测试 26/26 绿 ⇒ 聚合层没坏，接线层是重复件。
  ② `arg_keys` 是**取值清单（按位置消费）**，不是关键字名；拿它比 `inspect` 形参名是苹果对橘子，
     于是 `describe_binding` 恒报 `consistent=false`，我把这把错尺量出的 6/6 当成"上游真因"
     写进了提交信息与轮次留痕 —— 那条结论作废，以本文件为准。
* R74 的另一件真收获保留：扫描必须排除**声明面**（聚合层与本模块自身都写着门名，不排除会把 0
  个消费者报成有消费者）。

判据自证（§0.3 / 本轮教训 2）
----------------------------
`run_instrument_selfcheck()` 内置 1 条真阳性 + 3 条真阴性夹具：任一不合期望 ⇒ 仪器判据坏 ⇒
`scan_wiring` 的 `state` 落 `instrument-broken`，读数**不得用于任何结论**（修尺优先于读盘）。
取不到源码面 ⇒ `state=undetermined`，绝不把空集读成"没人接线"。
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from app.services.reverse_engineered_gates import GATE_SUITE

__all__ = [
    "ENTRY_TOKENS",
    "gate_names",
    "run_instrument_selfcheck",
    "scan_wiring",
    "selfcheck_state",
]

# 聚合层唯一入口的具名调用形态。
ENTRY_TOKENS: tuple[str, ...] = ("evaluate_gate_suite", "evaluate_gate")

# 声明面：路径含这些子串的，只算名单/说明书，不算消费者。
DECLARATION_SUBSTRINGS: tuple[str, ...] = (
    "reverse_engineered_gates",
    "reverse_engineered_gate_wiring",
    "gate_wiring_instrument",
)

# 夹具：正例 = 调用形态在代码行里；三条负例各自打掉一种误判形状。
_POSITIVE = (
    'from app.services import reverse_engineered_gates as reg\n'
    "out = reg.evaluate_gate_suite(request, policy)\n"
)
_NEG_COMMENT_ONLY = "# 历史说明里写过 evaluate_gate_suite( 调用已删除\n"
_NEG_IMPORT_ONLY = "from app.services.reverse_engineered_gates import GATE_SUITE\n"
_NEG_STRING_LITERAL = '_NOTE = "evaluate_gate_suite"  # 字面量里出现，不是调用\n'


def gate_names() -> tuple[str, ...]:
    """门名全集现读自聚合层（零复算：聚合层改名/加门，本层自动跟随）。"""
    return tuple(GATE_SUITE)


def _code_face(text: str) -> list[str]:
    """剥行注释后的代码行（注释里提及判据名 ≠ 接线；本轮教训：词表面与取值面分离）。"""
    out: list[str] = []
    for line in text.splitlines():
        body = line.split("#", 1)[0].rstrip()
        if not body.strip():
            continue
        stripped = body.strip()
        # import/from 行与纯字符串字面量赋值都不是调用点
        if stripped.startswith(("import ", "from ")):
            continue
        if stripped.startswith(("_NOTE", "_DOC", "__doc__")):
            continue
        out.append(stripped)
    return out


def _is_call_site(text: str) -> bool:
    for line in _code_face(text):
        # 字符串字面量里的提及不算：去掉引号段再判
        bare = line
        for q in ('"', "'"):
            while q in bare:
                head, _, rest = bare.partition(q)
                _, _, bare = rest.partition(q)
                bare = head + bare
        if any(tok in bare for tok in ENTRY_TOKENS) and "(" in bare:
            return True
    return False


def run_instrument_selfcheck() -> dict[str, Any]:
    """1 真阳 + 3 真阴全对才算仪器可用；任一不合 ⇒ ok=False。"""
    detail = {
        "positive_hit": _is_call_site(_POSITIVE),
        "negative_comment_only": _is_call_site(_NEG_COMMENT_ONLY),
        "negative_import_only": _is_call_site(_NEG_IMPORT_ONLY),
        "negative_string_literal": _is_call_site(_NEG_STRING_LITERAL),
    }
    ok = (
        detail["positive_hit"] is True
        and detail["negative_comment_only"] is False
        and detail["negative_import_only"] is False
        and detail["negative_string_literal"] is False
    )
    return {"ok": ok, "detail": detail}


def selfcheck_state() -> str:
    return "ok" if run_instrument_selfcheck()["ok"] else "instrument-broken"


def scan_wiring(
    module_sources: Mapping[str, str] | None,
    *,
    include_tokens: Sequence[str] = ENTRY_TOKENS,
    exclude_substrings: Sequence[str] = DECLARATION_SUBSTRINGS,
) -> dict[str, Any]:
    """量入口的消费者：`consumer_sites`（调用点）＋声明面排除清单＋仪器自检结论。"""
    tokens = tuple(include_tokens)
    if module_sources is None:
        return {
            "state": "undetermined",
            "reason": "module-sources-unavailable:取不到输入 ⇒ 既不记绿也不冒红(§0.3)",
            "instrument": run_instrument_selfcheck(),
            "entry_tokens": list(tokens),
            "suite_gates": list(gate_names()),
            "consumer_sites": {},
            "declaration_faces_excluded": [],
            "counts": {"consumers": 0, "sites": 0, "suite": len(gate_names())},
        }

    instrument = run_instrument_selfcheck()
    excluded: list[str] = []
    sites: dict[str, list[str]] = {}
    for path, text in module_sources.items():
        if any(s in path for s in exclude_substrings):
            excluded.append(path)
            continue
        if not any(tok in text for tok in tokens):
            continue
        if _is_call_site(text):
            # (path, token) 成对主键：审计按它对账，不按"文件名像不像自己的"判归属
            for tok in tokens:
                if tok in " ".join(_code_face(text)):
                    sites.setdefault(tok, []).append(path)

    state = "ok" if instrument["ok"] else "instrument-broken"
    return {
        "state": state,
        "reason": ""
        if instrument["ok"]
        else "仪器自检未过 ⇒ 读数不得用于任何结论；先修尺再读盘(本轮教训 2)",
        "instrument": instrument,
        "entry_tokens": list(tokens),
        "suite_gates": list(gate_names()),
        "consumer_sites": {k: sorted(set(v)) for k, v in sites.items()},
        "declaration_faces_excluded": sorted(excluded),
        "counts": {
            "consumers": len({p for ps in sites.values() for p in ps}),
            "sites": sum(len(set(v)) for v in sites.values()),
            "suite": len(gate_names()),
        },
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
