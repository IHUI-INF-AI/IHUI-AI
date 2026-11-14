# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""``context://`` 统一虚拟路径抽象的行为钉子(round 8 实现席 B)。

立因:对照程序只有「虚拟路径概念」;本仓复现时用测试把「解析/鉴权同一把尺子」+
      「半态显式拒绝」+「形状不认绝不回落宿主 FS」三件事钉死,至少一轴超越对照(§0.12)。
判据:表驱动覆盖八类安全判据 + 形状不认 + 白名单可配置;不变量测试逐例断言
      「verdict==allowed ⇔ canonical_path 齐备」,并直接验证生产出口 ``_emit`` 的半态防御。
刻意不做什么:不在测试里重写白名单/reason 字面量(全部 import 生产枚举,§0.6 单一真相源);
      不连生产库、不读磁盘、不引入第三方依赖;跑两次结果必须一致(纯函数)。
"""

import pytest

from app.core.context_fs import (
    DEFAULT_NAMESPACES,
    REASONS,
    Reason,
    Verdict,
    _emit,
    resolve_context_uri,
)

# 共享配置:四档白名单 + 四档虚拟根(全部取自生产常量,不复制字面量)。
ROOTS = {"workspace": "ws", "session": "sess", "artifact": "art", "skill": "sk"}
POLICY = {"allowed_namespaces": list(DEFAULT_NAMESPACES)}
ROOTS_NO_ARTIFACT = {"workspace": "ws", "session": "sess", "skill": "sk"}
POLICY_EMPTY = {}
POLICY_ONLY_SESSION = {"allowed_namespaces": ["session"]}

# 表驱动:(用例名, uri, roots, policy, 期望 verdict, 期望 reason)。
# 每条输入只触发目标判据,避开更早判据遮蔽,保证失败时能精确定位到哪条判据被摘。
CASES = [
    ("allowed_workspace", "context://workspace/src/app.py", ROOTS, POLICY, Verdict.ALLOWED.value, Reason.OK.value),
    ("allowed_skill", "context://skill/prompts/x.md", ROOTS, POLICY, Verdict.ALLOWED.value, Reason.OK.value),
    ("traversal", "context://workspace/a/../b", ROOTS, POLICY, Verdict.DENIED.value, Reason.TRAVERSAL.value),
    ("absolute_backslash", "context://workspace/C:\\Windows\\System32", ROOTS, POLICY, Verdict.DENIED.value, Reason.ABSOLUTE_PATH.value),
    ("absolute_double_slash", "context://workspace//etc/passwd", ROOTS, POLICY, Verdict.DENIED.value, Reason.ABSOLUTE_PATH.value),
    ("empty_segment", "context://workspace/a//b", ROOTS, POLICY, Verdict.DENIED.value, Reason.EMPTY_SEGMENT.value),
    ("url_encoded", "context://workspace/%2e%2e/secret", ROOTS, POLICY, Verdict.DENIED.value, Reason.URL_ENCODED.value),
    ("case_variant_scheme", "Context://workspace/a", ROOTS, POLICY, Verdict.DENIED.value, Reason.CASE_VARIANT.value),
    ("case_variant_ns", "context://WORKSPACE/a", ROOTS, POLICY, Verdict.DENIED.value, Reason.CASE_VARIANT.value),
    ("control_char", "context://workspace/a\x00b", ROOTS, POLICY, Verdict.DENIED.value, Reason.CONTROL_CHAR.value),
    ("symlink_dot", "context://workspace/a/./b", ROOTS, POLICY, Verdict.DENIED.value, Reason.SYMLINK_ESCAPE.value),
    ("symlink_arrow", "context://workspace/link->target/x", ROOTS, POLICY, Verdict.DENIED.value, Reason.SYMLINK_ESCAPE.value),
    ("symlink_tilde", "context://workspace/~/secret", ROOTS, POLICY, Verdict.DENIED.value, Reason.SYMLINK_ESCAPE.value),
    ("unregistered", "context://secret/a", ROOTS, POLICY, Verdict.DENIED.value, Reason.UNREGISTERED_NAMESPACE.value),
    ("wrong_scheme_bare", "workspace/src/app.py", ROOTS, POLICY, Verdict.UNJUDGED.value, Reason.WRONG_SCHEME.value),
    ("wrong_scheme_file", "file:///etc/passwd", ROOTS, POLICY, Verdict.UNJUDGED.value, Reason.WRONG_SCHEME.value),
    ("wrong_scheme_empty", "", ROOTS, POLICY, Verdict.UNJUDGED.value, Reason.WRONG_SCHEME.value),
    ("malformed_no_slash", "context://workspace", ROOTS, POLICY, Verdict.UNJUDGED.value, Reason.MALFORMED_URI.value),
    ("malformed_empty_ns", "context:///a", ROOTS, POLICY, Verdict.UNJUDGED.value, Reason.MALFORMED_URI.value),
    ("non_string_none", None, ROOTS, POLICY, Verdict.UNJUDGED.value, Reason.NON_STRING_INPUT.value),
    ("non_string_int", 123, ROOTS, POLICY, Verdict.UNJUDGED.value, Reason.NON_STRING_INPUT.value),
    ("policy_shape_bad", "context://workspace/a", ROOTS, POLICY_EMPTY, Verdict.UNJUDGED.value, Reason.POLICY_SHAPE_INVALID.value),
    ("roots_shape_bad", "context://workspace/a", None, POLICY, Verdict.UNJUDGED.value, Reason.POLICY_SHAPE_INVALID.value),
    ("missing_root", "context://artifact/x", ROOTS_NO_ARTIFACT, POLICY, Verdict.UNJUDGED.value, Reason.MISSING_NAMESPACE_ROOT.value),
]


@pytest.mark.parametrize(
    "case_id,uri,roots,policy,verdict,reason",
    CASES,
    ids=[c[0] for c in CASES],
)
def test_table_driven(case_id, uri, roots, policy, verdict, reason):
    """八类判据 + 形状不认 + 正向对照,逐例钉住 verdict/reason/半态/点名原因。"""
    result = resolve_context_uri(uri, roots, policy)
    assert result["verdict"] == verdict, case_id
    assert result["reason"] == reason, case_id
    assert set(result) == {"verdict", "namespace", "canonical_path", "reason", "detail"}, case_id
    assert result["reason"] in REASONS, case_id
    assert isinstance(result["detail"], str) and result["detail"], case_id
    if verdict == Verdict.ALLOWED.value:
        assert result["canonical_path"] is not None, case_id
        assert result["reason"] == Reason.OK.value, case_id
    else:
        # 半态显式拒绝:非 allowed 一律不带 canonical_path(绝不返回「解析成功但鉴权没跑」)。
        assert result["canonical_path"] is None, case_id
    if verdict == Verdict.UNJUDGED.value:
        # §0.10 失效方向 = 多要一次定向说明,不是多放一次跳门;且绝不静默放行。
        assert "点名" in result["detail"], case_id
        assert result["verdict"] != Verdict.ALLOWED.value, case_id


def test_allowed_canonical_path_is_virtual_uri():
    """正向对照:canonical_path 是 context:// 虚拟 URI,绝非宿主 FS 路径。"""
    r = resolve_context_uri("context://workspace/src/app.py", ROOTS, POLICY)
    assert r["verdict"] == Verdict.ALLOWED.value
    assert r["namespace"] == "workspace"
    assert r["canonical_path"] == "context://workspace/ws/src/app.py"
    assert r["canonical_path"].startswith("context://")
    assert not r["canonical_path"].startswith("/")
    assert "\\" not in r["canonical_path"]


def test_no_half_state_invariant():
    """超越轴②:全表逐例断言 verdict==allowed ⇔ canonical_path 齐备(半态零容忍)。"""
    for case_id, uri, roots, policy, _verdict, _reason in CASES:
        r = resolve_context_uri(uri, roots, policy)
        is_allowed = r["verdict"] == Verdict.ALLOWED.value
        has_path = r["canonical_path"] is not None
        assert is_allowed == has_path, case_id
        if is_allowed:
            assert r["canonical_path"].startswith("context://")
            assert r["reason"] == Reason.OK.value
        else:
            assert r["reason"] != Reason.OK.value


def test_resolution_and_authz_are_one_call():
    """超越轴①:late denied/unjudged 的 namespace 已解析,但 canonical_path 恒 None。

    解析已跑(namespace 非 None)、鉴权未放行 ⇒ 不出半态 path,证明解析与鉴权同一次收口。
    """
    for uri, roots in [
        ("context://workspace/a/../b", ROOTS),
        ("context://secret/a", ROOTS),
        ("context://artifact/x", ROOTS_NO_ARTIFACT),
        ("context://workspace/a/./b", ROOTS),
    ]:
        r = resolve_context_uri(uri, roots, POLICY)
        assert r["namespace"] is not None, uri
        assert r["verdict"] != Verdict.ALLOWED.value, uri
        assert r["canonical_path"] is None, uri


def test_wrong_scheme_never_falls_back_to_host_fs():
    """§0.3:裸路径/别的 scheme 形状不认 ⇒ unjudged,绝不回落宿主 FS 路径拼接。"""
    for uri in ("workspace/src/app.py", "file:///etc/passwd", "/etc/passwd"):
        r = resolve_context_uri(uri, ROOTS, POLICY)
        assert r["verdict"] == Verdict.UNJUDGED.value
        assert r["canonical_path"] is None
        assert "不回落" in r["detail"]


def test_whitelist_configurable():
    """白名单可配置:只登记 session 时,workspace 变未登记、session 仍放行。"""
    assert resolve_context_uri("context://session/a", ROOTS, POLICY_ONLY_SESSION)["verdict"] == Verdict.ALLOWED.value
    assert resolve_context_uri("context://workspace/a", ROOTS, POLICY_ONLY_SESSION)["reason"] == Reason.UNREGISTERED_NAMESPACE.value


def test_emit_rejects_half_state():
    """超越轴②的机器保证:直接用生产出口构造半态,必须改判 unjudged/half_state_rejected。

    刻意不做什么:不在测试里重写不变量,直接调用生产 ``_emit``(§0.6 单一真相源)。
    """
    half_allowed = _emit(Verdict.ALLOWED.value, "workspace", None, Reason.OK.value, "缺路径")
    assert half_allowed["verdict"] == Verdict.UNJUDGED.value
    assert half_allowed["reason"] == Reason.HALF_STATE.value
    assert half_allowed["canonical_path"] is None

    half_denied = _emit(Verdict.DENIED.value, "workspace", "context://workspace/ws/x",
                        Reason.TRAVERSAL.value, "带路径")
    assert half_denied["verdict"] == Verdict.UNJUDGED.value
    assert half_denied["reason"] == Reason.HALF_STATE.value
    assert half_denied["canonical_path"] is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
