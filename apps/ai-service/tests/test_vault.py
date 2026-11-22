# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""凭据保险库内核单测(2026-10-26 P0-2)。"""

from app.core.vault import (
    REDACTED_FMT,
    VAULT_PLACEHOLDER_RE,
    VaultStore,
    filter_vault_env,
    mask_vault_values,
    redact_vault_values,
    resolve_vault_references,
)


def _store() -> VaultStore:
    s = VaultStore()
    s.put("OPENAI_KEY", "sk-proj-REALVALUE123", env_key="OPENAI_API_KEY")
    s.put("DB_URL", "postgres://u:p@db/internal", env_key="DATABASE_URL")
    return s


def test_placeholder_syntax() -> None:
    m = VAULT_PLACEHOLDER_RE.fullmatch("{{vault:OPENAI_KEY}}")
    assert m is not None
    assert m.group(1) == "OPENAI_KEY"
    # 允许空白与连字符
    assert VAULT_PLACEHOLDER_RE.fullmatch("{{ vault:my-key }}").group(1) == "my-key"
    assert VAULT_PLACEHOLDER_RE.fullmatch("{{vault:BAD NAME}}") is None


def test_resolve_known_and_unknown() -> None:
    store = _store()
    out = resolve_vault_references("key={{vault:OPENAI_KEY}} end", store)
    assert out == "key=sk-proj-REALVALUE123 end"
    # 未知 NAME 保留占位符(不泄漏、不编造)
    out2 = resolve_vault_references("x={{vault:GHOST}}", store)
    assert out2 == "x={{vault:GHOST}}"


def test_mask_hides_real_values() -> None:
    store = _store()
    text = "call with sk-proj-REALVALUE123 please"
    out = mask_vault_values(text, store)
    assert "sk-proj-REALVALUE123" not in out
    assert "{{vault:OPENAI_KEY}}" in out


def test_redact_produces_named_token() -> None:
    store = _store()
    text = "log: postgres://u:p@db/internal done"
    out = redact_vault_values(text, store)
    assert "postgres://u:p@db/internal" not in out
    assert out == "log: " + REDACTED_FMT.format("DB_URL") + " done"


def test_filter_vault_env_strips_credential_vars() -> None:
    store = _store()
    env = {
        "PATH": "/usr/bin",
        "OPENAI_API_KEY": "sk-proj-REALVALUE123",
        "DATABASE_URL": "postgres://u:p@db/internal",
        "HOME": "/root",
    }
    out = filter_vault_env(env, store)
    assert "OPENAI_API_KEY" not in out
    assert "DATABASE_URL" not in out
    assert out["PATH"] == "/usr/bin"
    assert out["HOME"] == "/root"
    # 原 env 不被改(副本)
    assert "OPENAI_API_KEY" in env
