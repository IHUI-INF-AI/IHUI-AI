# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""全模态自动路由 + 多 provider 自动切换单元测试(2026-09-08)。

覆盖:
- 模态预路由 _media_intent_tools:图/视频/音乐/TTS 强信号正判 + 负样本不误触
- image_generation:provider 自动切换链(凭据过滤/显式优先/显式未配置降级全链)、
  运行时故障转移(首选失败自动换下一家,返回 failover_attempts)、全链失败保留末次错误码、
  移出 admin 专属名单(对话链 user_role=0 可用)
- voice_tts:仅 edge-tts 单引擎、
  失败聚合、显式 engine 校验
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


@pytest.fixture(autouse=True)
def _tmp_path_is_workspace_root(monkeypatch, tmp_path):
    """AIS-050:audio_transcription 本地 path 分支现在过工作区白名单;造树根=tmp_path。"""
    real = mcp_server._get_workspace_roots
    monkeypatch.setattr(
        mcp_server,
        "_get_workspace_roots",
        lambda: [str(tmp_path.resolve()), *real()],
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
            ("我的视频好了吗", ["video_generation"]),
            ("出片了吗", ["video_generation"]),
            ("歌好了吗", ["music_generation"]),
            # 2026-09-09 深能力路由(二):改图/取消长任务/模型价目
            ("把这张图去个水印", ["image_edit"]),
            ("帮我修一下这张图片", ["image_edit"]),
            ("扩图一下这个封面", ["image_edit"]),
            ("edit this image please", ["image_edit"]),
            # 2026-09-09 深能力补齐:声纹克隆自动路由
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
            "vision_analyze", "audio_transcription", "image_edit",
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
def agnes_configured(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "llm_providers", json.dumps({
        "agnes": {"api_key": "test_agnes_key", "api_base": "https://apihub.agnes-ai.com/v1"},
    }))
    monkeypatch.delenv("IMAGE_PROVIDER", raising=False)


class TestImageProviderChain:
    def test_chain_filters_unconfigured(self, agnes_configured):
        assert _image_provider_chain(None) == ["agnes"]

    def test_explicit_configured_first(self, agnes_configured):
        assert _image_provider_chain("agnes") == ["agnes"]

    def test_explicit_unconfigured_falls_back_to_chain(self, agnes_configured):
        assert _image_provider_chain("kling") == ["agnes"]

    def test_no_creds_empty_chain(self, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "llm_providers", json.dumps({
            "agnes": {"api_key": ""},
        }))
        monkeypatch.delenv("IMAGE_PROVIDER", raising=False)
        assert _image_provider_chain(None) == []

    def test_env_override_order(self, agnes_configured, monkeypatch):
        monkeypatch.setenv("IMAGE_PROVIDER", "agnes,jimeng")
        assert _image_provider_chain(None) == ["agnes"]


class TestImageRuntimeFailover:
    async def test_first_provider_fails_switches_to_next(self, monkeypatch):
        """agnes 失败 → 自动换 kling 成功,带尝试明细。"""
        calls: list[str] = []

        async def _fake_once(provider, prompt, size, save_path, arguments):
            calls.append(provider)
            if provider == "agnes":
                return {"ok": False, "provider": provider,
                        "errorCode": "PROVIDER_ERROR", "error": "402 quota"}
            return {"ok": True, "provider": provider, "image_url": "https://cdn/x.png"}

        monkeypatch.setattr(mcp_server, "_image_provider_chain", lambda explicit: ["agnes", "kling"])
        monkeypatch.setattr(mcp_server, "_image_generate_once", _fake_once)
        out = await _tool_image_generation({"prompt": "一只猫"})
        assert out["ok"] is True
        assert out["provider"] == "kling"
        assert calls == ["agnes", "kling"]
        assert out["failover_attempts"][0]["provider"] == "agnes"
        assert out["failover_attempts"][0]["errorCode"] == "PROVIDER_ERROR"

    async def test_all_providers_fail_keeps_last_error_code(self, monkeypatch):
        """全链失败 → ok=False,errorCode 取末次。"""

        async def _fake_once(provider, prompt, size, save_path, arguments):
            code = "PROVIDER_ERROR" if provider == "agnes" else "EMPTY_RESULT"
            return {"ok": False, "provider": provider,
                    "errorCode": code, "error": "fail"}

        monkeypatch.setattr(mcp_server, "_image_provider_chain", lambda explicit: ["agnes", "kling"])
        monkeypatch.setattr(mcp_server, "_image_generate_once", _fake_once)
        out = await _tool_image_generation({"prompt": "一只猫"})
        assert out["ok"] is False
        assert out["errorCode"] == "EMPTY_RESULT"
        assert len(out["failover_attempts"]) == 2
        assert "全部 2 家图片 provider 均失败" in out["message"]

    async def test_no_provider_configured(self, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "llm_providers", json.dumps({
            "agnes": {"api_key": ""},
        }))
        monkeypatch.delenv("IMAGE_PROVIDER", raising=False)
        out = await _tool_image_generation({"prompt": "一只猫"})
        assert out["ok"] is False
        assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"

    async def test_invalid_provider_rejected(self, agnes_configured):
        out = await _tool_image_generation({"prompt": "x", "provider": "midjourney"})
        assert out["errorCode"] == "INVALID_PROVIDER"

    async def test_save_path_invalid_fails_fast_before_paid_call(
        self, agnes_configured, monkeypatch,
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
        assert "fetch_url" in _ADMIN_ONLY_TOOLS
        assert "run_command" in _ADMIN_ONLY_TOOLS


# =============================================================================
# voice_tts:engine=auto 引擎自动互备
# =============================================================================


class TestTtsEngineChain:
    def test_chain_only_edge(self):
        assert _tts_engine_chain("auto", "") == ["edge"]

    def test_explicit_engine_single(self):
        assert _tts_engine_chain("edge", "") == ["edge"]


class TestTtsRuntime:
    async def test_edge_success(self, monkeypatch):
        async def _fake_once(engine, text, arguments):
            assert engine == "edge"
            return (b"audio-bytes", "audio/mpeg", "zh-CN-XiaoxiaoNeural", "edge-tts", None)

        monkeypatch.setattr(mcp_server, "_tts_once", _fake_once)
        out = await _tool_voice_tts({"text": "你好世界"})
        assert out["ok"] is True
        assert out["provider"] == "free-voice"
        assert out["engine"] == "edge"
        assert out["audio_url"].startswith("data:audio/mpeg;base64,")

    async def test_edge_failure_aggregated(self, monkeypatch):
        async def _fake_once(engine, text, arguments):
            return b"", "", "", "edge-tts", {
                "ok": False, "provider": "edge-tts",
                "error": "network down", "errorCode": "ENGINE_ERROR", "audio_url": None,
            }

        monkeypatch.setattr(mcp_server, "_tts_once", _fake_once)
        out = await _tool_voice_tts({"text": "你好"})
        assert out["ok"] is False
        assert out["errorCode"] == "ENGINE_ERROR"

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
            "provider": "kling", "video_url": None,
        })
        note = _media_artifact_summary([tc])
        assert '"task_id": "t-123"' in note
        assert "media_context" in note
        assert "video_generation" in note

    def test_image_url_persisted(self):
        from app.services.conversation import _media_artifact_summary

        tc = _tc("image_generation", {
            "ok": True, "image_url": "https://cdn/a.png", "provider": "agnes",
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

    async def test_local_engine_fail_keeps_error(self, tmp_path, monkeypatch):
        wav = tmp_path / "a.wav"
        wav.write_bytes(b"RIFF")

        async def _fake_once(engine, audio_bytes, filename, language):
            return "", "", "faster-whisper", {
                "ok": False, "provider": "faster-whisper",
                "error": "local down", "errorCode": "ENGINE_ERROR",
            }

        monkeypatch.setattr(mcp_server, "_stt_once", _fake_once)
        out = await mcp_server._tool_audio_transcription({"audio": str(wav)})
        assert out["ok"] is False
        assert out["errorCode"] == "ENGINE_ERROR"
        assert len(out["failover_attempts"]) == 1
        assert "全部 1 个转写引擎均失败" in out["message"]
