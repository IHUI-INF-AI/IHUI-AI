# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""Harness 密钥脱敏(2026-09-18 第十五批,对标 Codex secrets crate)单测。

覆盖:
- 各类已知凭据形态的脱敏(Bearer / sk- / AKIA / ghp_ / AIza / xox / JWT / PEM /
  URL 内联凭据 / 通用 k=v 赋值)
- 误伤防护(get_token()、${VAR}、os.getenv、短值一律不动)
- 幂等性、空串、无凭据文本原样返回
- 出库边界接线:实时 terminal delta 流(早于汇总输出发出)同样被脱敏
"""

import asyncio

import pytest

from app.core.output_cleaning import redact_secrets

# ---------------------------------------------------------------------------
# 测试样本一律运行时拼接构造,不在源码里落任何"形似真实凭据"的整串字面量。
# 原因:GitHub push protection 会对提交的文本做密钥扫描,形似的假样本(尤其是
# Slack xox[baprs]-… 这类带长数字段的)会被判为 GH013 直接拒推。拼接后源码
# 不含连续可匹配串,既避开误报,又不削弱断言强度(断言的是脱敏结果)。
# ---------------------------------------------------------------------------
_TAIL_A = "a" * 26
_TAIL_B = "b" * 20
_AWS = "AK" + "IA" + "Z" * 16
_GHP = "gh" + "p_" + "c" * 36
_GOOG = "AI" + "za" + "d" * 35
_SLACK = "xox" + "b-" + "q" * 12 + "-" + "r" * 13
_BEARER = "Bear" + "er " + "d" * 30


def test_redact_bearer_token():
    text = f"Authorization: {_BEARER}"
    out = redact_secrets(text)
    assert "d" * 30 not in out
    assert "Bearer [REDACTED_SECRET]" in out


def test_redact_openai_and_ihui_prefixed_keys():
    out = redact_secrets(
        f"OPENAI_API_KEY=sk-proj-{_TAIL_A}\n"
        f"IHUI_KEY=ihui_{_TAIL_B}\n"
        f"UPSTREAM=sk_{_TAIL_B}"
    )
    assert f"sk-proj-{_TAIL_A}" not in out
    assert f"ihui_{_TAIL_B}" not in out
    assert f"sk_{_TAIL_B}" not in out
    assert out.count("[REDACTED_SECRET]") == 3


def test_redact_cloud_provider_credentials():
    out = redact_secrets(
        f"aws_key = {_AWS}\n"
        f"{_GHP}\n"
        f"{_GOOG}\n"
        f"{_SLACK}"
    )
    assert _AWS not in out
    assert _GHP not in out
    assert _GOOG not in out
    assert _SLACK not in out


def test_redact_jwt_and_pem_private_key_block():
    seg = "e" * 12
    jwt = "ey" + "J" + seg + "." + seg + "." + seg
    assert redact_secrets(jwt) == "[REDACTED_SECRET]"
    pem_body = "M" + "z" * 60
    pem = (
        "-----BEGIN RSA PRIVATE KEY-----\n"
        f"{pem_body}\n"
        "-----END RSA PRIVATE KEY-----\n"
    )
    assert pem_body not in redact_secrets(pem)


def test_redact_url_inline_basic_auth():
    out = redact_secrets("postgres://user:supersecret@db.host:5432/app")
    assert "supersecret" not in out
    assert "postgres://user:[REDACTED_SECRET]@db.host:5432/app" in out


def test_redact_assignment_preserves_key_name_and_delimiter():
    out = redact_secrets('password: "hunter2hunter2"')
    assert out == 'password: "[REDACTED_SECRET]"'
    out2 = redact_secrets("api_key=abcdefgh12345678")
    assert out2 == "api_key=[REDACTED_SECRET]"


def test_redact_avoids_false_positives():
    """占位/引用/函数调用不是真实凭据,一律不盖(盖了反而误导模型)。"""
    for text in (
        "token = get_token()",
        "api_key: ${ENV_VAR}",
        "password = os.getenv('DB_PASSWORD')",
        "token = settings.AUTH_TOKEN",
        "secret = short",
    ):
        assert redact_secrets(text) == text, text


def test_redact_empty_and_plain_text_unchanged():
    assert redact_secrets("") == ""
    plain = "nothing to see here; 正常运行输出 12345"
    assert redact_secrets(plain) == plain


def test_redact_is_idempotent():
    once = redact_secrets(f"OPENAI_API_KEY=sk-{_TAIL_A}")
    assert redact_secrets(once) == once


@pytest.mark.asyncio
async def test_terminal_delta_stream_is_redacted(monkeypatch):
    """实时 delta 早于汇总结果发往 SSE,必须在咽喉点就脱敏。"""
    from app.services import mcp_server

    captured: list[str] = []

    async def _fake_emit(command: str, stream_name: str, text: str) -> None:
        captured.append(text)

    monkeypatch.setattr(mcp_server, "_emit_terminal_delta", _fake_emit)
    mcp_server._spawn_terminal_delta(
        "printenv", "stdout", f"OPENAI_API_KEY=sk-{_TAIL_A}"
    )
    await asyncio.sleep(0)
    assert captured, "delta 未被发射"
    assert f"sk-{_TAIL_A}" not in captured[0]
    assert "[REDACTED_SECRET]" in captured[0]


@pytest.mark.asyncio
async def test_run_command_output_is_redacted_end_to_end():
    """端到端:命令输出里的真实密钥不会进入工具回执(模型上下文/SSE/transcript)。"""
    from app.services.mcp_server import _tool_run_command

    result = await _tool_run_command(
        {"command": f"echo OPENAI_API_KEY=sk-{_TAIL_A}"}
    )
    assert result["ok"] is True, result
    assert f"sk-{_TAIL_A}" not in result["stdout"]
    assert "[REDACTED_SECRET]" in result["stdout"]
    # 键名保留,模型仍看得懂"这里有个密钥",只是拿不到值
    assert "OPENAI_API_KEY=" in result["stdout"]
