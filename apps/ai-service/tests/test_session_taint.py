# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""会话级污点追踪内核单测(2026-10-26 P0-2)。"""

from app.core.session_taint import (
    SessionTaint,
    TaintSource,
    requires_egress_approval,
    url_in_allowlist,
)


def test_clean_session_never_blocks() -> None:
    taint = SessionTaint()
    assert not taint.tainted
    assert not requires_egress_approval(taint, "https://api.openai.com/v1")


def test_tainted_blocks_unlisted_egress() -> None:
    taint = SessionTaint().mark(TaintSource.SECRET)
    assert taint.tainted
    assert requires_egress_approval(taint, "https://evil.example.com/exfil")


def test_tainted_allows_allowlisted_egress() -> None:
    taint = SessionTaint().mark(TaintSource.PRIVATE_DATA).with_allowlist(
        [".github.com", "internal.corp.com"]
    )
    # 精确后缀命中
    assert not requires_egress_approval(taint, "https://api.github.com/x")
    # 精确 host 命中
    assert not requires_egress_approval(taint, "https://internal.corp.com/y")
    # 未列目标仍拦
    assert requires_egress_approval(taint, "https://other.com/z")


def test_mark_is_idempotent_and_immutable() -> None:
    base = SessionTaint()
    once = base.mark(TaintSource.VAULT)
    twice = once.mark(TaintSource.VAULT)
    # 同一来源二次 mark 返回自身(值相等)
    assert twice is once
    assert once.sources == frozenset({TaintSource.VAULT})
    # 不同来源累积
    third = once.mark(TaintSource.SECRET)
    assert third.sources == frozenset({TaintSource.VAULT, TaintSource.SECRET})
    # 原对象未被改(frozen 语义)
    assert base.sources == frozenset()


def test_allowlist_exact_vs_suffix() -> None:
    assert url_in_allowlist("https://a.github.com/x", [".github.com"])
    assert url_in_allowlist("https://github.com/x", ["github.com"])
    assert not url_in_allowlist("https://notgithub.com/x", [".github.com"])
    assert not url_in_allowlist("https://example.com/x", ["github.com"])


def test_localhost_only_if_explicitly_allowed() -> None:
    taint = SessionTaint().mark(TaintSource.SECRET)
    # 内网 localhost 不默认放行 —— 污点会话外送任何未列目标都要批
    assert requires_egress_approval(taint, "http://127.0.0.1:8802/api")
    # 用户显式把内网加白则可放行
    allowed = taint.with_allowlist(["127.0.0.1", "localhost"])
    assert not requires_egress_approval(allowed, "http://127.0.0.1:8802/api")


def test_unparseable_url_never_matches_allowlist() -> None:
    assert not url_in_allowlist("not a url", [".example.com"])
    taint = SessionTaint().mark(TaintSource.SECRET).with_allowlist([".example.com"])
    # 解析不出的 url 视为未命中白名单 → 仍拦
    assert requires_egress_approval(taint, "not a url")
