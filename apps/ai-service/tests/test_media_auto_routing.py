# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

from app.services import mcp_server
from app.services.conversation import (
    _MEDIA_INTENT_PATTERNS,
    _MEDIA_RENDER_PROMPT,
    _WEB_INTENT_PATTERNS,
    conversation_service,
)
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
            # 2026-09-09 深能力路由:图片理解/语音转写/余额/任务取件
            ("看看这张图片里有什么", ["vision_analyze"]),
            ("识别一下这张截图里的文字", ["vision_analyze"]),
            ("分析一下这张图片", ["vision_analyze"]),
            ("describe this image please", ["vision_analyze"]),
            ("把这段录音转成文字", ["audio_transcription"]),
            ("帮我听写这段音频", ["audio_transcription"]),
            ("transcribe this recording", ["audio_transcription"]),
            ("还剩多少额度", ["token6688_balance"]),
            ("查一下账户余额", ["token6688_balance"]),
            ("我的视频好了吗", ["video_generation"]),
            ("出片了吗", ["video_generation"]),
            ("歌好了吗", ["music_generation"]),
            # 2026-09-09 深能力路由(二):改图/取消长任务/模型价目
            ("把这张图去个水印", ["image_edit"]),
            ("帮我修一下这张图片", ["image_edit"]),
            ("扩图一下这个封面", ["image_edit"]),
            ("edit this image please", ["image_edit"]),
            ("取消这个视频任务", ["token6688_cancel_task"]),
            ("那个音乐别做了", ["token6688_cancel_task"]),
            ("cancel the task", ["token6688_cancel_task"]),
            ("生成这个视频要多少钱", ["token6688_model_info"]),
            ("这个模型的参数有哪些", ["token6688_model_info"]),
            ("how much does it cost", ["token6688_model_info"]),
            # 2026-09-09 深能力补齐:声纹克隆自动路由
            ("帮我克隆我的声音", ["token6688_voice_clone"]),
            ("把我的声音做成音色", ["token6688_voice_clone"]),
            ("上传这段录音做声纹", ["token6688_voice_clone"]),
            ("我的声纹库有哪些", ["token6688_voice_clone"]),
            ("clone my voice please", ["token6688_voice_clone"]),
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
            "把文件读一下",               # 文件读取,不是朗读/转写
            "看一下这个视频",             # 观看,不是生成/取件
            "这首歌很好听",               # 讨论,不是创作/取件
            "帮我写个 Python 函数",
        ],
    )
    def test_negative(self, text):
        got = conversation_service._media_intent_tools(text)
        assert got == [], f"{text!r} 不应命中媒体工具,实际 {got}"

    def test_patterns_cover_all_media_tools(self):
        assert set(_MEDIA_INTENT_PATTERNS) == {
            "image_generation", "video_generation", "music_generation", "voice_tts",
            "vision_analyze", "audio_transcription", "token6688_balance",
            "image_edit", "token6688_cancel_task", "token6688_model_info",
            "token6688_voice_clone",
        }


# =============================================================================
# Firecrawl web 意图预路由 _web_intent_tools(2026-09-09 极致融合补齐)
# =============================================================================


class TestWebIntentTools:
    """网页抓取/整站/结构化抽取强信号正判 + 负样本不误触。

    语义同 _media_intent_tools:命中即无条件并入 tool loop 工具集。
    关键约束:只路由 fetch_readable/map_site/extract_web 三个只读工具,
    crawl_site(递归爬取,admin-only)刻意不进对话自动路由。
    """

    @pytest.mark.parametrize(
        "text,expected",
        [
            ("帮我读一下 https://example.com", ["fetch_readable"]),
            ("看看这个网页讲了什么 https://openai.com", ["fetch_readable"]),
            ("抓取这个页面 https://a.com/x", ["fetch_readable"]),
            ("概括一下这篇文章 https://blog.example.com/p", ["fetch_readable"]),
            ("fetch this url https://x.com", ["fetch_readable"]),
            ("这个网站的结构有哪些", ["map_site"]),
            ("探查一下这个站点的链接", ["map_site"]),
            ("看看这个域名的页面地图", ["map_site"]),
            ("map this website", ["map_site"]),
            ("提取这个网页的价格信息", ["extract_web"]),
            ("把这个页面的字段抽出来", ["extract_web"]),
            ("从这网站里整理产品数据", ["extract_web"]),
            ("extract structured data from this page", ["extract_web"]),
        ],
    )
    def test_positive(self, text, expected):
        got = conversation_service._web_intent_tools(text)
        for tool in expected:
            assert tool in got, f"{text!r} 应命中 {tool},实际 {got}"

    @pytest.mark.parametrize(
        "text",
        [
            "今天天气怎么样?",
            "帮我写个 Python 函数",
            "我想学爬虫应该看什么书",
        ],
    )
    def test_negative(self, text):
        got = conversation_service._web_intent_tools(text)
        assert got == [], f"{text!r} 不应命中 web 工具,实际 {got}"

    def test_patterns_exclude_admin_only_crawl(self):
        # crawl_site(admin-only, 递归爬取)必须不在对话自动路由名单中
        assert "crawl_site" in _ADMIN_ONLY_TOOLS
        assert "crawl_site" not in _WEB_INTENT_PATTERNS
        assert set(_WEB_INTENT_PATTERNS) == {"fetch_readable", "map_site", "extract_web"}

    def test_web_tools_registered_and_callable(self):
        # 三个自动路由 web 工具必须已注册且不在 admin-only(普通对话 user_role=0 可用)
        names = {t.name for t in mcp_server._TOOLS}
        for n in ("fetch_readable", "map_site", "extract_web"):
            assert n in names, f"{n} should be registered"
            assert n in mcp_server._TOOL_HANDLERS
            assert n not in _ADMIN_ONLY_TOOLS


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

    def test_deep_media_tools_in_keyword_table(self):
        """2026-09-09 深能力:理解/转写/余额 均有关键词 fallback 兜底。"""
        assert conversation_service._tool_keywords.get("vision_analyze")
        assert conversation_service._tool_keywords.get("audio_transcription")
        assert conversation_service._tool_keywords.get("token6688_balance")
        assert conversation_service._tool_keywords.get("token6688_voice_clone")

    def test_media_render_prompt_present(self):
        assert "image_url" in _MEDIA_RENDER_PROMPT
        assert "task_id" in _MEDIA_RENDER_PROMPT
        assert "不要编造链接" in _MEDIA_RENDER_PROMPT

    def test_media_chain_prompt_present(self):
        from app.services.conversation import _MEDIA_CHAIN_PROMPT

        assert "image_generation" in _MEDIA_CHAIN_PROMPT
        assert "mode=first-frame" in _MEDIA_CHAIN_PROMPT
        assert "audio_transcription" in _MEDIA_CHAIN_PROMPT
        assert "严禁编造 task_id" in _MEDIA_CHAIN_PROMPT

    def test_media_tools_are_registered(self):
        """预路由命中的工具必须真实存在于 MCP 注册表(防注入幽灵工具)。"""
        registered = {t.name for t in mcp_server.mcp_server.list_tools()}
        for tool in _MEDIA_INTENT_PATTERNS:
            assert tool in registered


# =============================================================================
# 2026-09-09 全模态深度适配:媒体产物记忆延续 + ASR 工具 + 余额工具
# =============================================================================


def _tc(tool: str, result: dict, ok: bool = True):
    from app.services.conversation import ToolCallRecord

    return ToolCallRecord(tool=tool, arguments={}, result=result, ok=ok)


class TestMediaArtifactSummary:
    """_media_artifact_summary:媒体工具产物 → 下轮可用的记忆摘要。"""

    def test_empty_when_no_media_tools(self):
        from app.services.conversation import _media_artifact_summary

        assert _media_artifact_summary([_tc("web_search", {"ok": True})]) == ""

    def test_empty_when_all_failed(self):
        from app.services.conversation import _media_artifact_summary

        tc = _tc("video_generation", {"ok": False, "error": "x"}, ok=False)
        assert _media_artifact_summary([tc]) == ""

    def test_video_task_id_persisted(self):
        from app.services.conversation import _media_artifact_summary

        tc = _tc("video_generation", {
            "ok": True, "task_id": "t-123", "status": "processing",
            "provider": "token6688", "video_url": None,
        })
        note = _media_artifact_summary([tc])
        assert '"task_id": "t-123"' in note
        assert "media_context" in note
        assert "video_generation" in note

    def test_image_url_persisted(self):
        from app.services.conversation import _media_artifact_summary

        tc = _tc("image_generation", {
            "ok": True, "image_url": "https://cdn/a.png", "provider": "stepfun",
        })
        note = _media_artifact_summary([tc])
        assert "https://cdn/a.png" in note

    def test_data_uri_audio_not_persisted(self):
        """voice_tts 的 data URI 超长:绝不入库,只记元信息。"""
        from app.services.conversation import _media_artifact_summary

        tc = _tc("voice_tts", {
            "ok": True, "engine": "edge", "voice": "zh-CN-XiaoxiaoNeural",
            "audio_url": "data:audio/mpeg;base64,AAAA" + "x" * 100000,
            "saved_path": None,
        })
        note = _media_artifact_summary([tc])
        assert "base64" not in note
        assert "edge" in note

    def test_music_data_uri_replaced(self):
        from app.services.conversation import _media_artifact_summary

        tc = _tc("music_generation", {
            "ok": True, "task_id": "m-1", "audio_url": "data:audio/mpeg;base64,AAAA",
        })
        note = _media_artifact_summary([tc])
        assert "[data-uri-omitted]" in note
        assert "AAAA" not in note

    def test_vision_and_transcript_excerpt_capped(self):
        from app.services.conversation import _media_artifact_summary

        tc1 = _tc("vision_analyze", {"ok": True, "analysis": "图里是一只猫" * 100})
        tc2 = _tc("audio_transcription", {"ok": True, "text": "今天天气不错" * 100})
        note = _media_artifact_summary([tc1, tc2])
        assert len(note) <= 1200
        assert "analysis_excerpt" in note
        assert "transcript_excerpt" in note

    def test_voice_clone_voice_id_persisted(self):
        """声纹克隆的 voice_id 必须入记忆(下轮 voice_tts 复用克隆音色的钥匙)。"""
        from app.services.conversation import _media_artifact_summary

        tc = _tc("token6688_voice_clone", {
            "ok": True, "action": "upload", "voice_id": "v-abc123",
        })
        note = _media_artifact_summary([tc])
        assert '"voice_id": "v-abc123"' in note
        assert "token6688_voice_clone" in note

    def test_voice_clone_list_no_voice_id_skipped(self):
        """action=list 无 voice_id 时不写记忆(避免无意义条目)。"""
        from app.services.conversation import _media_artifact_summary

        tc = _tc("token6688_voice_clone", {"ok": True, "action": "list", "count": 2})
        assert _media_artifact_summary([tc]) == ""


class TestAudioTranscriptionTool:
    """audio_transcription:参数校验 + 引擎链故障转移。"""

    async def test_missing_audio_rejected(self):
        out = await mcp_server._tool_audio_transcription({})
        assert out["ok"] is False
        assert out["errorCode"] == "MISSING_PARAMS"

    async def test_bad_data_uri_rejected(self):
        out = await mcp_server._tool_audio_transcription({"audio": "data:audio/wav;base64,!!!"})
        assert out["ok"] is False
        assert out["errorCode"] == "BAD_PARAMS"

    async def test_local_file_not_found(self, tmp_path):
        out = await mcp_server._tool_audio_transcription(
            {"audio": str(tmp_path / "nope.wav")},
        )
        assert out["ok"] is False
        assert out["errorCode"] == "FILE_NOT_FOUND"

    async def test_local_failover_to_token6688(self, tmp_path, monkeypatch):
        """local 失败 → 自动换 token6688,聚合 attempts。"""
        wav = tmp_path / "a.wav"
        wav.write_bytes(b"RIFF-fake-audio")

        async def _fake_once(engine, audio_bytes, filename, language):
            if engine == "local":
                return "", "", "faster-whisper", {
                    "ok": False, "provider": "faster-whisper",
                    "error": "engine down", "errorCode": "ENGINE_ERROR",
                }
            return "你好世界", "whisper-1", "token6688", None

        monkeypatch.setattr(mcp_server, "_stt_once", _fake_once)
        out = await mcp_server._tool_audio_transcription({"audio": str(wav)})
        assert out["ok"] is True
        assert out["provider"] == "token6688"
        assert out["text"] == "你好世界"
        assert out["failover_attempts"][0]["engine"] == "local"

    async def test_all_engines_fail_keeps_last_error(self, tmp_path, monkeypatch):
        wav = tmp_path / "a.wav"
        wav.write_bytes(b"RIFF")

        async def _fake_once(engine, audio_bytes, filename, language):
            code = "PROVIDER_NOT_CONFIGURED" if engine == "token6688" else "ENGINE_ERROR"
            return "", "", engine, {
                "ok": False, "provider": engine,
                "error": f"{engine} down", "errorCode": code,
            }

        monkeypatch.setattr(mcp_server, "_stt_once", _fake_once)
        out = await mcp_server._tool_audio_transcription({"audio": str(wav)})
        assert out["ok"] is False
        assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"
        assert len(out["failover_attempts"]) == 2
        assert "均失败" in out["message"]


class TestToken6688BalanceTool:
    async def test_not_configured_clear_error(self, monkeypatch):
        """未配置 key → PROVIDER_NOT_CONFIGURED(文案含配置指引)。"""
        from app.services import video_generation as vg

        monkeypatch.setattr(vg, "_instantiate", lambda name: None)
        out = await mcp_server._tool_token6688_balance({})
        assert out["ok"] is False
        assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"
        assert "TOKEN6688_API_KEY" in out["error"]

    async def test_balance_returned(self, monkeypatch):
        from app.services import video_generation as vg

        class _FakeInst:
            async def get_balance(self):
                return {"balance": 12.5, "available_balance": 10.0, "frozen": 2.5}

        monkeypatch.setattr(vg, "_instantiate", lambda name: _FakeInst())
        out = await mcp_server._tool_token6688_balance({})
        assert out["ok"] is True
        assert out["balance"] == 12.5
        assert out["available_balance"] == 10.0
        assert out["currency"] == "USD"

    def test_new_tools_not_admin_only(self):
        """只读工具:对话链 user_role=0 必须可用。"""
        assert "audio_transcription" not in _ADMIN_ONLY_TOOLS
        assert "token6688_balance" not in _ADMIN_ONLY_TOOLS
        assert "vision_analyze" not in _ADMIN_ONLY_TOOLS
        assert "image_edit" not in _ADMIN_ONLY_TOOLS
        assert "token6688_cancel_task" not in _ADMIN_ONLY_TOOLS
        assert "token6688_model_info" not in _ADMIN_ONLY_TOOLS
        assert "token6688_voice_clone" not in _ADMIN_ONLY_TOOLS


class TestImageEditTool:
    """image_edit:参数校验 + 图片来源解析 + 未配置降级。"""

    async def test_missing_params_rejected(self):
        out = await mcp_server._tool_image_edit({})
        assert out["ok"] is False
        assert out["errorCode"] == "MISSING_PARAMS"

    async def test_prompt_required(self):
        out = await mcp_server._tool_image_edit({"image": "https://x/img.png"})
        assert out["ok"] is False
        assert out["errorCode"] == "MISSING_PARAMS"

    async def test_not_configured_clear_error(self, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "llm_providers", json.dumps({
            "token6688": {"api_key": "", "api_base": ""},
        }))
        monkeypatch.delenv("TOKEN6688_API_KEY", raising=False)
        out = await mcp_server._tool_image_edit(
            {"image": "https://x/img.png", "prompt": "去水印"},
        )
        assert out["ok"] is False
        assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"
        assert "TOKEN6688_API_KEY" in out["error"]

    async def test_invalid_source_rejected(self, monkeypatch):
        """无法解析的图片来源 → 明确错误码,不触网。"""
        from app.core.config import settings

        monkeypatch.setattr(settings, "llm_providers", json.dumps({
            "token6688": {"api_key": "sk-test", "api_base": "https://k.token6688.com"},
        }))
        out = await mcp_server._tool_image_edit(
            {"image": "not-a-real-source", "prompt": "改一下"},
        )
        assert out["ok"] is False
        assert out["errorCode"] == "INVALID_SOURCE"

    async def test_save_path_validated_before_call(self, monkeypatch, tmp_path):
        from app.core.config import settings

        monkeypatch.setattr(settings, "llm_providers", json.dumps({
            "token6688": {"api_key": "sk-test", "api_base": "https://k.token6688.com"},
        }))
        # 非法后缀 → 校验前置 fail-fast(不调用上游)
        out = await mcp_server._tool_image_edit(
            {"image": "https://x/img.png", "prompt": "改一下", "save_path": "C:/tmp/a.txt"},
        )
        assert out["ok"] is False
        assert out["errorCode"] == "INVALID_EXTENSION"

    async def test_success_with_b64_result(self, monkeypatch):
        """b64_json 返回 → image_url 为 data URI,ok=True。"""
        from app.core.config import settings
        from app.providers.token6688_provider import Token6688Provider

        monkeypatch.setattr(settings, "llm_providers", json.dumps({
            "token6688": {"api_key": "sk-test", "api_base": "https://k.token6688.com"},
        }))
        import base64

        b64 = base64.b64encode(b"fake-png-bytes").decode("ascii")

        async def _fake_edits(self, *a, **kw):
            return {"provider": "token6688", "model": "gpt-image-2",
                    "images": [{"b64_json": b64}]}

        monkeypatch.setattr(Token6688Provider, "images_edits", _fake_edits)
        out = await mcp_server._tool_image_edit(
            {"image": "data:image/png;base64," + b64, "prompt": "加个边框"},
        )
        assert out["ok"] is True
        assert out["image_url"].startswith("data:image/png;base64,")

    async def test_success_with_url_result(self, monkeypatch):
        from app.core.config import settings
        from app.providers.token6688_provider import Token6688Provider

        monkeypatch.setattr(settings, "llm_providers", json.dumps({
            "token6688": {"api_key": "sk-test", "api_base": "https://k.token6688.com"},
        }))

        async def _fake_edits(self, *a, **kw):
            return {"provider": "token6688", "model": "gpt-image-2",
                    "images": [{"url": "https://cdn.x/edited.png"}]}

        monkeypatch.setattr(Token6688Provider, "images_edits", _fake_edits)
        out = await mcp_server._tool_image_edit(
            {"image": "data:image/png;base64,QUJD", "prompt": "改背景"},
        )
        assert out["ok"] is True
        assert out["image_url"] == "https://cdn.x/edited.png"

    async def test_provider_error_kept(self, monkeypatch):
        from app.core.config import settings
        from app.providers.base_provider import ProviderError
        from app.providers.token6688_provider import Token6688Provider

        monkeypatch.setattr(settings, "llm_providers", json.dumps({
            "token6688": {"api_key": "sk-test", "api_base": "https://k.token6688.com"},
        }))

        async def _fake_edits(self, *a, **kw):
            raise ProviderError("余额不足", 402)

        monkeypatch.setattr(Token6688Provider, "images_edits", _fake_edits)
        out = await mcp_server._tool_image_edit(
            {"image": "data:image/png;base64,AAAA", "prompt": "改一下"},
        )
        assert out["ok"] is False
        assert out["errorCode"] == "PROVIDER_ERROR"
        assert "余额不足" in out["error"]


class TestCancelTaskRouting:
    async def test_missing_task_id_rejected(self):
        out = await mcp_server._tool_token6688_cancel_task({})
        assert out["ok"] is False
        assert out["errorCode"] == "MISSING_PARAMS"

    async def test_not_configured(self, monkeypatch):
        from app.services import video_generation as vg

        monkeypatch.setattr(vg, "_instantiate", lambda name: None)
        out = await mcp_server._tool_token6688_cancel_task({"task_id": "t-123"})
        assert out["ok"] is False
        assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"

    async def test_cancel_ok(self, monkeypatch):
        from app.services import video_generation as vg

        class _FakeInst:
            async def cancel_task(self, task_id):
                return {"ok": True, "status": "cancelled"}

        monkeypatch.setattr(vg, "_instantiate", lambda name: _FakeInst())
        out = await mcp_server._tool_token6688_cancel_task({"task_id": "t-123"})
        assert out["ok"] is True
        assert out["task_id"] == "t-123"
        assert out["status"] == "cancelled"

    async def test_cancel_unsupported_truthful(self, monkeypatch):
        from app.services import video_generation as vg

        class _FakeInst:
            async def cancel_task(self, task_id):
                return {"ok": False, "status": "unsupported", "error": "取消端点均不可用"}

        monkeypatch.setattr(vg, "_instantiate", lambda name: _FakeInst())
        out = await mcp_server._tool_token6688_cancel_task({"task_id": "t-123"})
        assert out["ok"] is False
        assert out["status"] == "unsupported"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
