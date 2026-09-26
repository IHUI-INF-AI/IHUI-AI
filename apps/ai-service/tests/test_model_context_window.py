#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""model_context_window 单测(V3 #55,2026-09-26 立)。

覆盖:
- 兜底值与 TS 侧 DEFAULT_CONTEXT_CAPACITY(128_000)同值;
- 例外表精确命中 / 未知模型兜底 / None / 空串 / 大小写与首尾空白归一;
- env 优先级:显式 >0 覆盖动态解析,0/缺省回落动态解析,非法值 fail-closed 回落;
- 例外表条目与 TS 侧表(exact-capacity 快照)的防漂移:低窗口集合不得无序扩张。
"""

from __future__ import annotations

from importlib import import_module
from pathlib import Path

import pytest

mcp = import_module("app.core.model_context_window")


class TestResolveBasics:
    def test_unknown_model_gets_default_128k(self):
        assert mcp.resolve_compaction_context_limit("gpt-4o") == 128_000

    def test_none_and_empty_get_default(self):
        assert mcp.resolve_compaction_context_limit(None) == 128_000
        assert mcp.resolve_compaction_context_limit("") == 128_000
        assert mcp.resolve_compaction_context_limit("   ") == 128_000

    def test_low_window_exact_hits(self):
        assert mcp.resolve_compaction_context_limit("deepseek-v3") == 64_000
        assert mcp.resolve_compaction_context_limit("qwen-max") == 32_768
        assert mcp.resolve_compaction_context_limit("moonshot-v1-8k") == 8_000
        assert mcp.resolve_compaction_context_limit("stepfun/step-3.7-flash") == 8_000

    def test_case_and_whitespace_normalized(self):
        assert mcp.resolve_compaction_context_limit("  DeepSeek-V3 ") == 64_000

    def test_variant_names_fall_back_to_default(self):
        # 保守原则:只做精确匹配,变体(版本号/日期后缀)一律兜底 ——
        # 过晚压缩失败方向是上游显式报错,优于按错误窗口静默丢上下文
        assert mcp.resolve_compaction_context_limit("deepseek-v3.1") == 128_000


class TestEnvPriority:
    def test_env_explicit_overrides_dynamic(self, monkeypatch):
        monkeypatch.setenv("AGENT_COMPACTION_CONTEXT_LIMIT", "64000")
        assert mcp.resolve_with_env_priority("gpt-4o") == 64_000

    def test_env_zero_falls_back_to_dynamic(self, monkeypatch):
        monkeypatch.setenv("AGENT_COMPACTION_CONTEXT_LIMIT", "0")
        assert mcp.resolve_with_env_priority("deepseek-v3") == 64_000

    def test_env_unset_falls_back_to_dynamic(self, monkeypatch):
        monkeypatch.delenv("AGENT_COMPACTION_CONTEXT_LIMIT", raising=False)
        assert mcp.resolve_with_env_priority("deepseek-v3") == 64_000

    def test_env_invalid_fails_closed_to_dynamic(self, monkeypatch):
        # 非法值与"未配置"同义(fail-closed 回落动态解析,不让坏配置炸构造点)
        monkeypatch.setenv("AGENT_COMPACTION_CONTEXT_LIMIT", "not-a-number")
        assert mcp.resolve_with_env_priority("deepseek-v3") == 64_000


class TestTSSync:
    """与 TS 侧 model-context-capacity.ts 的防漂移(静态快照对账,暂无自动门)。"""

    def test_low_window_entries_match_ts_snapshot(self):
        ts_low = {
            "gemma-2-27b-it": 8_192,
            "gemma-2-9b-it": 8_192,
            "deepseek-chat": 64_000,
            "deepseek-reasoner": 64_000,
            "deepseek-v3": 64_000,
            "qwen-max": 32_768,
            "moonshot-v1-8k": 8_000,
            "moonshot-v1-32k": 32_000,
            "doubao-1-6-pro": 32_000,
            "doubao-pro-32k": 32_000,
            "stepfun/step-3.7-flash": 8_000,
            "stepfun/step-3.5-flash": 8_000,
            "stepfun/step-router-v1": 8_000,
            "hunyuan-pro": 32_000,
            "hunyuan-turbo": 32_000,
            "ernie-4.0-turbo-8k": 8_000,
            "baichuan-4-turbo": 32_000,
            "spark-v4": 8_000,
            "yi-large": 32_000,
            "sensenova-5": 32_000,
            "skywork-4": 32_000,
            "internlm2.5-20b": 32_000,
        }
        assert mcp.LOW_WINDOW_OVERRIDES == ts_low

    def test_ts_source_snapshot_unchanged(self):
        """TS 表若被改动(新低窗口条目/值变化),本测试提醒同步 PY 侧。"""
        ts_file = (
            Path(__file__).resolve().parents[3]
            / "packages/api-client/src/model-context-capacity.ts"
        )
        assert ts_file.exists(), "TS 窗口表被移动,请同步本测试路径"
        text = ts_file.read_text(encoding="utf-8")
        assert "DEFAULT_CONTEXT_CAPACITY = 128_000" in text, (
            "TS 兜底值变化 —— resolve_with_env_priority 的 128K 兜底须同步"
        )
        for name, value in mcp.LOW_WINDOW_OVERRIDES.items():
            needle = f"'{name}': {value:,}".replace(",", "_")
            assert needle in text, f"TS 表已无 {name}={value} —— 两侧窗口表漂移"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
