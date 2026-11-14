# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""round 9 实现席 C:run_code vm 级能力禁令判据的测试钉。

立因
----
``app.core.code_exec_sandbox.decide_code_execution`` 是一层静态准入判据,
行为必须被测试逐条钉住:纯计算放行、七类宿主能力触碰拒绝、形状不认阻断、
声明与实测一致性、默认禁白名单制、解析失败阻断、绕过意图不放行。

判据
----
测试只 import 生产模块(``sb``),断言 verdict / tier / reason / findings /
detected_capabilities;规则 id 与能力标签一律引用模块常量,不复制判据(§0.6)。
负例统一断言"带非空 reason + 非空 findings",正例断言 allowed + 空 findings。

刻意不做什么
------------
* 不连库、不起服务、不 mock AST、不执行被测代码:全部用例是纯函数入出参断言,
  天然满足测试隔离铁律;
* 不在测试里重写一份危险名清单(那是第二份真相源);
* 不把"多声明"当缺陷测(生产判据刻意只卡漏声明)。
"""

from app.core import code_exec_sandbox as sb

# 覆盖全部能力标签的"在册"策略,供 host-ban / 纯计算等场景使用。
_ALL_CAPS = [
    sb.CAP_PROCESS,
    sb.CAP_NETWORK,
    sb.CAP_FS_WRITE,
    sb.CAP_DYNAMIC_IMPORT,
    sb.CAP_REFLECTION,
    sb.CAP_ENV,
    sb.CAP_FFI,
]


def _req(code: str, *, requested: list[str] | None = None, language: str = "python") -> dict:
    """构造形状合法的 request。"""
    return {
        "code": code,
        "language": language,
        "requested_capabilities": list(requested or []),
    }


def _policy(caps: list[str] | None = None) -> dict:
    """构造形状合法的 policy(白名单制:capabilities 是显式放行的能力集合)。"""
    return {"capabilities": list(caps or [])}


def _findings_with(verdict: dict, cap: str) -> list[dict]:
    return [f for f in verdict["findings"] if f["capability"] == cap]


def _assert_denied_for(code: str, cap: str) -> dict:
    """高危触碰的公共断言:denied + 实测能力 + 带证据 finding + 非空 reason。"""
    v = sb.decide_code_execution(_req(code, requested=[cap]), _policy())
    assert v["verdict"] == "denied", v
    assert cap in v["detected_capabilities"], v
    assert _findings_with(v, cap), "宿主能力触碰必须留下带证据的 finding"
    assert v["reason"], "负例必须带 reason"
    return v


# ---- 正例:只读纯计算 ----

def test_pure_compute_allowed():
    """判据:零宿主能力触碰 ⇒ allowed + compute-only 档。"""
    v = sb.decide_code_execution(_req("total = sum([1, 2, 3])\nprint(total)"), _policy(_ALL_CAPS))
    assert v["verdict"] == "allowed"
    assert v["tier"] == sb.TIER_COMPUTE_ONLY
    assert v["detected_capabilities"] == []
    assert v["findings"] == []


def test_pure_compute_with_stdlib_import_allowed():
    """刻意不做什么:按能力识别,不按'有 import / 有调用'一刀切(math/print 不在能力表)。"""
    v = sb.decide_code_execution(
        _req("import math\nprint(sum(math.sqrt(x) for x in [1, 4, 9]))"),
        _policy(_ALL_CAPS),
    )
    assert v["verdict"] == "allowed"


def test_static_only_does_not_execute_code():
    """边界钉:1/0 若被真执行会抛 ZeroDivisionError;本层只 parse,故 allowed 且不抛。"""
    v = sb.decide_code_execution(_req("x = 1 / 0"), _policy(_ALL_CAPS))
    assert v["verdict"] == "allowed"  # 没抛异常本身即证明未执行任何代码


# ---- 负例:七类宿主能力触碰,命中高危 ⇒ denied ----

def test_import_os_denied():
    _assert_denied_for("import os", sb.CAP_PROCESS)


def test_subprocess_denied():
    _assert_denied_for("import subprocess\nsubprocess.run(['ls'])", sb.CAP_PROCESS)


def test_socket_denied():
    _assert_denied_for("import socket\nsocket.socket()", sb.CAP_NETWORK)


def test_open_write_denied():
    _assert_denied_for("f = open('x.txt', 'w')\nf.write('data')", sb.CAP_FS_WRITE)


def test_eval_denied():
    _assert_denied_for("eval('2+2')", sb.CAP_REFLECTION)


def test_getattr_reflection_denied():
    _assert_denied_for("fn = getattr(obj, 'run')", sb.CAP_REFLECTION)


# ---- 形状不认 ⇒ unjudged 阻断(§0.3:绝不因解析不了就放行) ----

def test_syntax_error_unjudged():
    v = sb.decide_code_execution(_req("def f(:"), _policy(_ALL_CAPS))
    assert v["verdict"] == "unjudged"
    assert "语法" in v["reason"]
    assert v["findings"]


def test_unregistered_language_unjudged():
    v = sb.decide_code_execution(_req("x = 1", language="ruby"), _policy(_ALL_CAPS))
    assert v["verdict"] == "unjudged"
    assert "未登记" in v["reason"]
    assert v["findings"]


def test_policy_missing_capabilities_unjudged():
    v = sb.decide_code_execution(_req("x = 1"), {})
    assert v["verdict"] == "unjudged"
    assert "capabilities" in v["reason"]
    assert v["findings"]


def test_code_not_string_unjudged():
    r = _req("x = 1")
    r["code"] = 123
    v = sb.decide_code_execution(r, _policy(_ALL_CAPS))
    assert v["verdict"] == "unjudged"
    assert "code" in v["reason"]
    assert v["findings"]


# ---- 声明与实测一致性 / 默认禁白名单制 ----

def test_undeclared_capability_denied():
    """判据:声明少了也算不一致 ⇒ denied + reason 点名 + 具名 undeclared finding(§0.10)。"""
    v = sb.decide_code_execution(
        _req("import socket", requested=[]), _policy([sb.CAP_NETWORK])
    )
    assert v["verdict"] == "denied"
    assert sb.CAP_NETWORK in v["detected_capabilities"]
    assert "声明" in v["reason"]
    assert any(f["rule"] == sb.RULE_UNDECLARED for f in v["findings"])


def test_default_deny_rule_finding():
    """白名单制:未显式放行的 capability ⇒ 带 default-deny 判据 finding,不静默放行。"""
    v = sb.decide_code_execution(
        _req("import socket", requested=[sb.CAP_NETWORK]), _policy([])
    )
    assert v["verdict"] == "denied"
    assert "默认禁" in v["reason"]
    assert any(f["rule"] == sb.RULE_DEFAULT_DENY for f in v["findings"])


def test_allowlist_in_register_still_denied():
    """刻意不做什么:白名单命中不等于放行(禁令层不是授权层),在册能力仍 denied。"""
    v = sb.decide_code_execution(
        _req("import socket", requested=[sb.CAP_NETWORK]), _policy([sb.CAP_NETWORK])
    )
    assert v["verdict"] == "denied"
    assert "禁令" in v["reason"]
    assert any(f["rule"] == sb.RULE_HOST_BAN for f in v["findings"])


# ---- 绕过意图:大小写变体 / 字符串拼接 ⇒ 形状不认阻断 ----

def test_case_variant_evasion_unjudged():
    """形状不认:大小写变体名(GetAttr)不猜、不放行 ⇒ unjudged + 定向说明。"""
    v = sb.decide_code_execution(
        _req('GetAttr(__builtins__, "eval")("2+2")'), _policy(_ALL_CAPS)
    )
    assert v["verdict"] == "unjudged"
    assert v["reason"]
    assert any(f["capability"] == sb.CAP_DYNAMIC_SYMBOL for f in v["findings"])


def test_string_concat_evasion_unjudged():
    """形状不认:拼接出来的调用目标看不全 ⇒ unjudged,绝不因看不到字面危险名就放行。"""
    v = sb.decide_code_execution(
        _req('("__imp" + "ort__")("o" + "s")'), _policy(_ALL_CAPS)
    )
    assert v["verdict"] == "unjudged"
    assert any(f["rule"] == sb.RULE_OPAQUE_CALL for f in v["findings"])


# ---- 结构化 verdict 钉 ----

def test_every_finding_has_capability_evidence_rule():
    """每条 finding 三键齐备;AST finding 的 evidence 带 L<行号> 前缀可复核。"""
    v = sb.decide_code_execution(
        _req("import os\nos.system('ls')", requested=[sb.CAP_PROCESS]), _policy()
    )
    assert v["verdict"] == "denied"
    assert v["findings"]
    for f in v["findings"]:
        assert set(f) == {"capability", "evidence", "rule"}
        assert f["capability"] and f["evidence"] and f["rule"]
    assert any(f["evidence"].startswith("L1:") for f in v["findings"])


def test_unjudged_and_denied_always_have_reason():
    """§0.3 钉:任何非 allowed 结论都必须带非空 reason + 非空 findings,绝不静默。"""
    cases = [
        (_req("def f(:"), _policy(_ALL_CAPS)),
        (_req("x = 1", language="ruby"), _policy(_ALL_CAPS)),
        (_req("x = 1"), {}),
        (_req("import socket", requested=[sb.CAP_NETWORK]), _policy([])),
        (_req('("__imp" + "ort__")("os")'), _policy(_ALL_CAPS)),
    ]
    for req, pol in cases:
        v = sb.decide_code_execution(req, pol)
        assert v["verdict"] in ("unjudged", "denied")
        assert v["reason"], v
        assert v["findings"], v
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
