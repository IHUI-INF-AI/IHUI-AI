# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""L8064 写入前脱敏带的单元测试(memory_service._redact_legacy_pattern_tail)。

判据与清洗器(redact_legacy_procedural_patterns.py)同形:
- 64 位 hex 尾 / redacted-<hex16> 尾 ⇒ 原样放行(幂等:清洗器产出与本带产出同形);
- doom_loop 族其余尾段(旧明文)⇒ 改写为 redacted-<sha256(尾段)[:16]>,且**同输入
  恒同输出**(同尾段两次写入得到同一脱敏形态,唯一约束不炸);
- 非 doom_loop 族 ⇒ 一律不碰(乱改写=伪造用户记忆);
- 明文永不回显:断言只比形态,不落原文到任何输出面。
"""

from __future__ import annotations

import hashlib

from app.services.memory_service import _redact_legacy_pattern_tail


def _legacy(tool: str, plaintext: str) -> str:
    return f"doom_loop:{tool}:{plaintext}"


def test_hex_tail_passes_through() -> None:
    tail = "a" * 64
    assert _redact_legacy_pattern_tail(_legacy("run_command", tail)) == _legacy("run_command", tail)


def test_redacted_tail_passes_through() -> None:
    tail = "redacted-" + "b" * 16
    assert _redact_legacy_pattern_tail(_legacy("run_command", tail)) == _legacy("run_command", tail)


def test_legacy_plaintext_tail_is_redacted() -> None:
    p = _legacy("run_command", "C:/Users/x/file.py --flag")
    out = _redact_legacy_pattern_tail(p)
    assert out.startswith("doom_loop:run_command:redacted-")
    # 形态钉死:redacted- 后恰 16 位 hex(与清洗器逐字同形)
    tail = out.rsplit(":", 1)[1]
    assert tail == f"redacted-{hashlib.sha256('C:/Users/x/file.py --flag'.encode()).hexdigest()[:16]}"


def test_same_input_yields_same_redaction() -> None:
    a = _redact_legacy_pattern_tail(_legacy("write_file", "some plaintext"))
    b = _redact_legacy_pattern_tail(_legacy("write_file", "some plaintext"))
    assert a == b


def test_non_doom_loop_untouched() -> None:
    for p in ("用户偏好用 vim", "", "preference:编辑器", "doom_loop_without_colon_suffix"):
        assert _redact_legacy_pattern_tail(p) == p


def test_output_never_contains_plaintext() -> None:
    secret = "C:/Users/x/secret-token-abc.txt"
    out = _redact_legacy_pattern_tail(_legacy("run_command", secret))
    assert secret not in out
