# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""钩子配置只读自述(describe_command_hooks)的形状锁(第 31 项)。

钉住四条硬事实:
1. 四态可分:「没建文件 / 空表 / JSON 或形状坏 / 未受信任」各自有独立 status,
   不再一律表现为"钩子没跑";
2. **任何输入都不抛错**(自述面失败不能把排障端点拖红);
3. 展示面不带完整命令行(只给可执行文件名 + 参数个数),避免把可能的凭据
   复制到第二个读面;
4. 判据复用既有实现:trusted 判定与 ``load_command_hooks`` 同一套哈希闸。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.command_hooks import (
    describe_command_hooks,
    trust_hooks_config,
)


@pytest.fixture(autouse=True)
def _isolate(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("IHUI_HOOKS_CONFIG", raising=False)


def _write_config(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    path.write_text(text, encoding="utf-8")


def _config() -> dict:
    return {
        "hooks": {
            "pre_tool_use": [
                {
                    "matcher": "*",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "python3 /opt/secret-tool.py --token=abc123",
                            "timeout": 5,
                        }
                    ],
                }
            ]
        }
    }


def test_missing_config_is_legal_default(tmp_path: Path) -> None:
    info = describe_command_hooks(tmp_path / "hooks.json")
    assert info["configured"] is False
    assert info["status"] == "not-configured"
    assert info["specs"] == []
    assert info["error"] is None


def test_empty_table_distinct_from_unconfigured(tmp_path: Path) -> None:
    path = tmp_path / "hooks.json"
    _write_config(path, {"hooks": {}})
    info = describe_command_hooks(path)
    assert info["configured"] is True
    assert info["status"] == "empty"
    assert info["specs"] == []
    assert info["content_hash"]


def test_broken_json_returns_invalid_without_raising(tmp_path: Path) -> None:
    path = tmp_path / "hooks.json"
    _write_config(path, "{not json")
    info = describe_command_hooks(path)
    assert info["status"] == "invalid"
    assert info["error"] and "JSON" in info["error"]


def test_shape_error_returns_invalid_without_raising(tmp_path: Path) -> None:
    path = tmp_path / "hooks.json"
    _write_config(path, {"hooks": {"unknown_event": [{"matcher": "*", "hooks": []}]}})
    info = describe_command_hooks(path)
    assert info["status"] == "invalid"
    assert info["error"]


def test_untrusted_config_lists_specs_but_masks_command(tmp_path: Path) -> None:
    path = tmp_path / "hooks.json"
    _write_config(path, _config())
    info = describe_command_hooks(path)
    assert info["status"] == "untrusted"
    assert info["trusted_hash"] is None
    assert info["content_hash"]
    assert len(info["specs"]) == 1
    spec = info["specs"][0]
    assert spec["event"] == "pre_tool_use"
    assert spec["matcher"] == "*"
    assert spec["command_preview"] == "python3"
    assert spec["arg_count"] == 2
    # 完整命令行(含内联凭据)绝不出现在自述面
    assert "abc123" not in json.dumps(info, ensure_ascii=False)


def test_trusted_config_reports_trusted(tmp_path: Path) -> None:
    path = tmp_path / "hooks.json"
    _write_config(path, _config())
    digest = trust_hooks_config(path)
    info = describe_command_hooks(path)
    assert info["status"] == "trusted"
    assert info["trusted_hash"] == digest
    assert info["content_hash"] == digest


def test_tampered_after_trust_flips_back_to_untrusted(tmp_path: Path) -> None:
    path = tmp_path / "hooks.json"
    _write_config(path, _config())
    trust_hooks_config(path)
    tampered = _config()
    tampered["hooks"]["post_tool_use"] = [
        {"matcher": "*", "hooks": [{"type": "command", "command": "python3 x.py"}]}
    ]
    _write_config(path, tampered)
    info = describe_command_hooks(path)
    assert info["status"] == "untrusted"
    assert info["trusted_hash"] != info["content_hash"]
    assert len(info["specs"]) == 2
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
