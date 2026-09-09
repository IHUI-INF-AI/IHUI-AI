# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""全模态自动路由 + 多 provider 自动切换单元测试(2026-09-08)。

覆盖:
- 模态预路由 _media_intent_tools:图/视频/音乐/TTS 强信号正判 + 负样本不误触
- image_generation:provider 自动切换链(凭据过滤/显式优先/显式未配置降级全链)、
  运行时故障转移(首选失败自动换下一家,返回 failover_attempts)、全链失败保留末次错误码、
  移出 admin 专属名单(对话链 user_role=0 可用)
- voice_tts:engine=auto 引擎链排序(OpenAI 音色 → token6688 优先;默认 edge 优先)、
  失败互备、全引擎失败聚合、显式 engine 单引擎
- conversation 关键词表含 image_generation(关键词 fallback 路径可用)

测试隔离:monkeypatch 凭据与模块内 _image_generate_once/_tts_once,不触网。
"""

from __future__ import annotations

import json

import pytest

from app.services.conversation import (
    _MEDIA_INTENT_PATTERNS,
    _MEDIA_RENDER_PROMPT,
    conversation_service,
)
from app.services import mcp_server
from app.services.mcp_server import (
    _ADMIN_ONLY_TOOLS,
    _image_provider_chain,
    _tool_image_generation,
    _tool_voice_tts,
    _tts_engine_chain,
)


# =============================================================================
# 模态预路由 _media_intent_tools
# =============================================================================


class TestMediaIntentTools:
    """媒体模态强信号检测:正样本命中对应工具,负样本不误触。"""

    @pytest.mark.parametrize(
        "text,expected",
        [
            ("帮我画一张猫的图片", ["image_generation"]),
            ("画个赛博朋克城市", ["image_generation"]),
            ("画一下今天的天气示意图", ["image_generation"]),
            ("设计一个 logo", ["image_generation"]),
            ("生成一张海报", ["image_generation"]),
            ("generate an image of a cat", ["image_generation"]),
            ("帮我做一个视频", ["video_generation"]),
            ("生成一段 5 秒的视频", ["video_generation"]),
            ("画一只橘猫", ["image_generation"]),
            ("火柴人打架出片", ["video_generation"]),
            ("make a video about cats", ["video_generation"]),
            ("帮我写一首关于秋天的歌", ["music_generation"]),
            ("来段背景音乐", ["music_generation"]),
            ("做一个 BGM", ["music_generation"]),
            ("write a song for me", ["music_generation"]),
            ("把这段文字朗读出来", ["voice_tts"]),
            ("给视频配个音", ["voice_tts"]),
            ("text to speech please", ["voice_tts"]),
            # 跨模态同时命中
            ("画一张图然后做个视频", ["image_generation", "video_generation"]),
        ],
    )
    def test_positive(self, text, expected):
        got = conversation_service._media_intent_tools(text)
        for tool in expected:
            assert tool in got, f"{text!r} 应命中 {tool},实际 {got}"

    @pytest.mark.parametrize(
        "text",
        [
            "今天天气怎么样?",
            "看看这张图片里有什么",       # 图片理解,不是生成
            "把文件读一下",               # 文件读取,不是朗读
            "看一下这个视频",             # 观看,不是生成
            "这首歌很好听",               # 讨论,不是创作
            "帮我写个 Python 函数",
        ],
    )
    def test_negative(self, text):
        got = conversation_service._media_intent_tools(text)
        assert got == [], f"{text!r} 不应命中媒体工具,实际 {got}"

    def test_patterns_cover_all_media_tools(self):
        assert set(_MEDIA_INTENT_PATTERNS) == {
            "image_generation", "video_generation", "music_generation", "voice_tts",
        }


# =============================================================================
# image_generation:多 provider 自动切换
# =============================================================================


@pytest.fixture
def stepfun_configured(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "llm_providers", json.dumps({
        "stepfun": {"api_key": "test_stepfun_key", "api_base": "https://api.stepfun.com/step_plan/v1"},
        "agnes": {"api_key": "", "api_base": ""},
        "token6688": {"api_key": "", "api_base": ""},
    }))


@pytest.fixture
def token6688_and_stepfun(monkeypatch):
    """token6688(env)+ stepfun 双厂商,验证链序与故障转移。"""
    from app.core.config import settings

    monkeypatch.setenv("TOKEN6688_API_KEY", "sk-test-6688")
    monkeypatch.setattr(settings, "llm_providers", json.dumps({
        "stepfun": {"api_key": "test_stepfun_key", "api_base": "https://api.stepfun.com/step_plan/v1"},
        "agnes": {"api_key": "", "api_base": ""},
        "token6688": {"api_key": "", "api_base": ""},
    }))


class TestImageProviderChain:
    def test_chain_filters_unconfigured(self, stepfun_configured):
        assert _image_provider_chain(None) == ["stepfun"]

    def test_explicit_provider_first(self, token6688_and_stepfun):
        # 默认 token6688 优先;显式 stepfun → 提到链首但保留兜底
        assert _image_provider_chain(None)[0] == "token6688"
        assert _image_provider_chain("stepfun") == ["stepfun", "token6688"]

    def test_explicit_unconfigured_falls_back_to_chain(self, stepfun_configured):
        # 显式 agnes 无 key → 不再空手而归,降级自动链(兼容旧降级语义)
        assert _image_provider_chain("agnes") == ["stepfun"]

    def test_no_creds_empty_chain(self, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "llm_providers", json.dumps({
            "stepfun": {"api_key": ""},
            "agnes": {"api_key": ""},
            "token6688": {"api_key": ""},
        }))
        monkeypatch.delenv("TOKEN6688_API_KEY", raising=False)
        assert _image_provider_chain(None) == []

    def test_env_override_order(self, token6688_and_stepfun, monkeypatch):
        monkeypatch.setenv("IMAGE_PROVIDER", "stepfun,token6688")
        assert _image_provider_chain(None) == ["stepfun", "token6688"]


class TestImageRuntimeFailover:
    async def test_first_provider_fails_switches_to_next(
        self, token6688_and_stepfun, monkeypatch,
    ):
        """token6688 提交失败(如 402/429)→ 自动换 stepfun 成功,带尝试明细。"""
        calls: list[str] = []

        async def _fake_once(provider, prompt, size, save_path, arguments):
            calls.append(provider)
            if provider == "token6688":
                return {"ok": False, "provider": provider,
                        "errorCode": "PROVIDER_ERROR", "error": "402 quota"}
            return {"ok": True, "provider": provider, "image_url": "https://cdn/x.png"}

        monkeypatch.setattr(mcp_server, "_image_generate_once", _fake_once)
        out = await _tool_image_generation({"prompt": "一只猫"})
        assert out["ok"] is True
        assert out["provider"] == "stepfun"
        assert calls == ["token6688", "stepfun"]
        assert out["failover_attempts"][0]["provider"] == "token6688"
        assert out["failover_attempts"][0]["errorCode"] == "PROVIDER_ERROR"

    async def test_all_providers_fail_keeps_last_error_code(
        self, token6688_and_stepfun, monkeypatch,
    ):
        """全链失败 → ok=False,errorCode 取末次(兼容单 provider 旧语义)。"""

        async def _fake_once(provider, prompt, size, save_path, arguments):
            if provider == "token6688":
                return {"ok": False, "provider": provider,
                        "errorCode": "PROVIDER_ERROR", "error": "402"}
            return {"ok": False, "provider": provider,
                    "errorCode": "EMPTY_RESULT", "error": "空 data"}

        monkeypatch.setattr(mcp_server, "_image_generate_once", _fake_once)
        out = await _tool_image_generation({"prompt": "一只猫"})
        assert out["ok"] is False
        assert out["errorCode"] == "EMPTY_RESULT"
        assert len(out["failover_attempts"]) == 2
        assert "均失败" in out["message"]

    async def test_no_provider_configured(self, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "llm_providers", json.dumps({
            "stepfun": {"api_key": ""},
            "agnes": {"api_key": ""},
            "token6688": {"api_key": ""},
        }))
        monkeypatch.delenv("TOKEN6688_API_KEY", raising=False)
        out = await _tool_image_generation({"prompt": "一只猫"})
        assert out["ok"] is False
        assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"

    async def test_invalid_provider_rejected(self, stepfun_configured):
        out = await _tool_image_generation({"prompt": "x", "provider": "midjourney"})
        assert out["errorCode"] == "INVALID_PROVIDER"

    async def test_save_path_invalid_fails_fast_before_paid_call(
        self, token6688_and_stepfun, monkeypatch,
    ):
        """save_path 校验前置:格式错误不触发任何 provider 调用(不浪费付费 API)。"""
        called: list[str] = []

        async def _fake_once(provider, prompt, size, save_path, arguments):
            called.append(provider)
            return {"ok": True, "provider": provider, "image_url": "https://cdn/x.png"}

        monkeypatch.setattr(mcp_server, "_image_generate_once", _fake_once)
        out = await _tool_image_generation({
            "prompt": "一只猫", "save_path": "/tmp/test.txt",
        })
        assert out["ok"] is False
        assert out["errorCode"] == "INVALID_EXTENSION"
        assert called == []

    def test_image_generation_removed_from_admin_only(self):
        """全模态断链修复:对话链 call_tool 默认 user_role=0,图片生成必须全员可用。"""
        assert "image_generation" not in _ADMIN_ONLY_TOOLS
        # 其余高危工具仍在名单
        assert "fetch_url" in _ADMIN_ONLY_TOOLS
        assert "run_command" in _ADMIN_ONLY_TOOLS


# =============================================================================
# voice_tts:engine=auto 引擎自动互备
# =============================================================================


class TestTtsEngineChain:
    def test_auto_default_edge_first(self):
        assert _tts_engine_chain("auto", "") == ["edge", "token6688"]

    def test_auto_openai_voice_token6688_first(self):
        assert _tts_engine_chain("auto", "alloy") == ["token6688", "edge"]

    def test_auto_voice_id_token6688_first(self):
        assert _tts_engine_chain("auto", "voice_abc123") == ["token6688", "edge"]

    def test_explicit_engine_single(self):
        assert _tts_engine_chain("edge", "") == ["edge"]
        assert _tts_engine_chain("token6688", "") == ["token6688"]


class TestTtsRuntimeFailover:
    async def test_edge_fails_falls_back_token6688(self, monkeypatch):
        """edge 不可达 → 自动换 token6688(已配置),带尝试明细。"""
        calls: list[str] = []

        async def _fake_once(engine, text, arguments):
            calls.append(engine)
            if engine == "edge":
                return b"", "", "", "edge-tts", {
                    "ok": False, "provider": "edge-tts",
                    "error": "network down", "errorCode": "ENGINE_ERROR",
                    "audio_url": None,
                }
            return (b"audio-bytes", "audio/mpeg", "alloy", "token6688", None)

        monkeypatch.setattr(mcp_server, "_tts_once", _fake_once)
        monkeypatch.setenv("TOKEN6688_API_KEY", "sk-test-6688")
        out = await _tool_voice_tts({"text": "你好世界"})
        assert out["ok"] is True
        assert out["provider"] == "token6688"
        assert out["engine"] == "token6688"
        assert calls == ["edge", "token6688"]
        assert out["failover_attempts"][0]["engine"] == "edge"
        assert out["audio_url"].startswith("data:audio/mpeg;base64,")

    async def test_openai_voice_routes_token6688_first(self, monkeypatch):
        """auto + OpenAI 音色 → token6688 优先(edge 发不出该音色)。"""
        calls: list[str] = []

        async def _fake_once(engine, text, arguments):
            calls.append(engine)
            return (b"audio", "audio/mpeg", "alloy", "token6688", None)

        monkeypatch.setattr(mcp_server, "_tts_once", _fake_once)
        monkeypatch.setenv("TOKEN6688_API_KEY", "sk-test-6688")
        out = await _tool_voice_tts({"text": "你好", "voice": "alloy"})
        assert out["ok"] is True
        assert calls == ["token6688"]

    async def test_all_engines_fail_aggregated(self, monkeypatch):
        async def _fake_once(engine, text, arguments):
            code = "PROVIDER_NOT_CONFIGURED" if engine == "token6688" else "ENGINE_ERROR"
            return b"", "", "", engine, {
                "ok": False, "provider": engine,
                "error": f"{engine} down", "errorCode": code, "audio_url": None,
            }

        monkeypatch.setattr(mcp_server, "_tts_once", _fake_once)
        monkeypatch.delenv("TOKEN6688_API_KEY", raising=False)
        out = await _tool_voice_tts({"text": "你好"})
        assert out["ok"] is False
        assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"
        assert len(out["failover_attempts"]) == 2

    async def test_unknown_engine_rejected(self):
        out = await _tool_voice_tts({"text": "你好", "engine": "azure"})
        assert out["ok"] is False
        assert out["errorCode"] == "BAD_PARAMS"

    async def test_missing_text_rejected(self):
        out = await _tool_voice_tts({"text": "  "})
        assert out["ok"] is False
        assert out["errorCode"] == "MISSING_PARAMS"


# =============================================================================
# conversation:关键词表 + 渲染规范
# ==============================================================================


class TestConversationMediaKeywords:
    def test_image_generation_in_keyword_table(self):
        kws = conversation_service._tool_keywords.get("image_generation")
        assert kws and "画一张" in kws and "生成图片" in kws

    def test_media_render_prompt_present(self):
        assert "image_url" in _MEDIA_RENDER_PROMPT
        assert "task_id" in _MEDIA_RENDER_PROMPT
        assert "不要编造链接" in _MEDIA_RENDER_PROMPT

    def test_media_tools_are_registered(self):
        """预路由命中的工具必须真实存在于 MCP 注册表(防注入幽灵工具)。"""
        registered = {t.name for t in mcp_server.mcp_server.list_tools()}
        for tool in _MEDIA_INTENT_PATTERNS:
            assert tool in registered
