# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""污点维度叠加到工具审批的组合判据单测(2026-10-26 P0-2)。"""

from app.core.mcp_tool_approval import requires_approval_with_taint
from app.core.session_taint import SessionTaint, TaintSource


def test_base_true_short_circuits() -> None:
    taint = SessionTaint().mark(TaintSource.SECRET)
    assert requires_approval_with_taint(True, taint, "https://evil.example.com/x")


def test_clean_session_false() -> None:
    assert not requires_approval_with_taint(False, SessionTaint(), "https://api.openai.com/v1")


def test_tainted_egress_escalates() -> None:
    taint = SessionTaint().mark(TaintSource.VAULT)
    assert requires_approval_with_taint(False, taint, "https://evil.example.com/exfil")


def test_tainted_allowlisted_no_escalation() -> None:
    taint = SessionTaint().mark(TaintSource.SECRET).with_allowlist([".github.com"])
    assert not requires_approval_with_taint(False, taint, "https://api.github.com/x")


def test_no_url_skips_taint() -> None:
    taint = SessionTaint().mark(TaintSource.PRIVATE_DATA)
    # url=None 不参与污点叠加(工具无出网语义)
    assert not requires_approval_with_taint(False, taint, None)
