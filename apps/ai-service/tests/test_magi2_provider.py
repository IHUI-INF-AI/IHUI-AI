# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""magi2_provider.py 单元测试(2026-11-25 接入)。

覆盖:
- 凭据解析(MAGI2_API_KEY / SAND_API_KEY 兜底)与默认 base/model
- 未配置 503 / chat 显式 400
- build_payload:纯文本、首帧、参考素材、比例归一、时长夹取、首帧与参考互斥
- generate_video:wait=False 只提交 / 缺 id 报错
- get_task_status:succeeded / failed / running 三态映射
- _poll:成功返回 / 失败抛错
- video_generation 接线:_instantiate("magi2") 与优先级
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from app.providers.base_provider import ProviderError
from app.providers.magi2_provider import Magi2Provider


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for name in (
        "MAGI2_API_KEY",
        "SAND_API_KEY",
        "MAGI2_API_BASE",
        "MAGI2_MODEL",
        "MAGI2_MAX_WAIT",
        "VIDEO_PROVIDER",
    ):
        monkeypatch.delenv(name, raising=False)


def _mock_request(provider: Magi2Provider, result: dict) -> AsyncMock:
    mock = AsyncMock(return_value=result)
    provider._request = mock  # type: ignore[method-assign]
    return mock


# =============================================================================
# 凭据 / 基础属性
# =============================================================================


def test_configured_and_defaults(monkeypatch):
    monkeypatch.setenv("MAGI2_API_KEY", "sand-key")
    p = Magi2Provider()
    assert p.configured is True
    assert p.base_url == "https://api.sand.ai"
    assert p.model == "magi-2"


def test_sand_api_key_fallback(monkeypatch):
    monkeypatch.setenv("SAND_API_KEY", "sand-fallback")
    p = Magi2Provider()
    assert p.configured is True
    assert p.api_key == "sand-fallback"


def test_custom_base_and_model(monkeypatch):
    monkeypatch.setenv("MAGI2_API_KEY", "k")
    monkeypatch.setenv("MAGI2_API_BASE", "https://proxy.example/")
    monkeypatch.setenv("MAGI2_MODEL", "magi-2-preview-latest")
    p = Magi2Provider()
    assert p.base_url == "https://proxy.example"
    assert p.model == "magi-2-preview-latest"


def test_unconfigured_headers_raise_503():
    p = Magi2Provider()
    assert p.configured is False
    with pytest.raises(ProviderError) as exc:
        p._headers()
    assert exc.value.status_code == 503


async def test_chat_is_rejected():
    p = Magi2Provider("k")
    with pytest.raises(ProviderError) as exc:
        await p.complete([], "magi-2")
    assert exc.value.status_code == 400
    with pytest.raises(ProviderError):
        await p.astream([], "magi-2").__anext__()


# =============================================================================
# build_payload
# =============================================================================


def test_payload_text_only():
    p = Magi2Provider("k")
    payload = p.build_payload("镜头缓慢推近，海浪拍打礁石", duration=10)
    assert payload["model"] == "magi-2"
    assert payload["content"] == [{"type": "text", "text": "镜头缓慢推近，海浪拍打礁石"}]
    assert payload["duration"] == 10
    assert payload["ratio"] == "16:9"
    assert payload["resolution"] == "1080p"
    assert payload["generate_audio"] is True
    assert "seed" not in payload


def test_payload_clamps_duration_and_ratio():
    p = Magi2Provider("k")
    assert p.build_payload("x", duration=3)["duration"] == 4
    assert p.build_payload("x", duration=99)["duration"] == 30
    assert p.build_payload("x", duration=10, aspect_ratio="2:1")["ratio"] == "16:9"
    assert p.build_payload("x", duration=10, aspect_ratio="9:16")["ratio"] == "9:16"


def test_payload_first_frame_and_seed():
    p = Magi2Provider("k")
    payload = p.build_payload(
        "转场", duration=5, image="https://cdn.example/a.png", seed=42, generate_audio=False
    )
    assert payload["content"] == [
        {"type": "text", "text": "转场"},
        {
            "type": "image_url",
            "role": "first_frame",
            "image_url": {"url": "https://cdn.example/a.png"},
        },
    ]
    assert payload["seed"] == 42
    assert payload["generate_audio"] is False


def test_payload_reference_media_roles():
    p = Magi2Provider("k")
    payload = p.build_payload(
        "同款风格",
        duration=8,
        images=["https://cdn.example/1.png", "https://cdn.example/2.png"],
        videos=["https://cdn.example/v.mp4"],
        audios=["https://cdn.example/a.mp3"],
    )
    roles = [item.get("role") for item in payload["content"] if item["type"] != "text"]
    assert roles == ["reference_image", "reference_image", "reference_video", "reference_audio"]
    assert len(payload["content"]) == 5


def test_payload_frames_exclude_references():
    p = Magi2Provider("k")
    with pytest.raises(ProviderError) as exc:
        p.build_payload("x", duration=5, first_frame="https://a.png", images=["https://b.png"])
    assert exc.value.status_code == 400


def test_payload_empty_input_rejected():
    p = Magi2Provider("k")
    with pytest.raises(ProviderError) as exc:
        p.build_payload("   ", duration=5)
    assert exc.value.status_code == 400


def test_payload_too_many_images_rejected():
    p = Magi2Provider("k")
    urls = [f"https://cdn.example/{i}.png" for i in range(11)]
    with pytest.raises(ProviderError) as exc:
        p.build_payload("x", duration=5, images=urls)
    assert exc.value.status_code == 400


# =============================================================================
# generate_video / get_task_status / _poll
# =============================================================================


async def test_generate_video_submit_only():
    p = Magi2Provider("k")
    _mock_request(p, {"id": 987654321, "status": "queued"})
    result = await p.generate_video("海浪", "", duration=10, wait=False)
    assert result["provider"] == "magi2"
    assert result["task_id"] == "987654321"
    assert result["video_url"] == ""
    assert result["status"] == "queued"
    call = p._request.call_args
    assert call.args[0] == "POST"
    assert call.kwargs["json"]["duration"] == 10
    assert call.kwargs["headers"]["Authorization"] == "Bearer k"


async def test_generate_video_without_id_raises():
    p = Magi2Provider("k")
    _mock_request(p, {"status": "queued"})
    with pytest.raises(ProviderError) as exc:
        await p.generate_video("x", "", duration=5, wait=False)
    assert exc.value.status_code == 502


async def test_task_status_succeeded():
    p = Magi2Provider("k")
    _mock_request(p, {
        "id": "42", "status": "succeeded",
        "content": {"video_url": "https://files.example/v.mp4?sign=x"}, "duration": 10,
    })
    st = await p.get_task_status("42")
    assert st["ok"] is True
    assert st["failed"] is False
    assert st["video_url"].startswith("https://files.example/")


async def test_task_status_failed():
    p = Magi2Provider("k")
    _mock_request(p, {
        "id": "42", "status": "failed",
        "error": {"code": "GenerationFailed", "message": "内容审核未通过"},
    })
    st = await p.get_task_status("42")
    assert st["failed"] is True
    assert "审核" in st["error"]


async def test_task_status_running():
    p = Magi2Provider("k")
    _mock_request(p, {"id": "42", "status": "running"})
    st = await p.get_task_status("42")
    assert st["ok"] is False
    assert st["failed"] is False
    assert st["status"] == "running"


async def test_task_status_404_is_terminal():
    p = Magi2Provider("k")
    p._request = AsyncMock(side_effect=ProviderError("not found", 404))
    st = await p.get_task_status("42")
    assert st["failed"] is True


async def test_poll_success():
    p = Magi2Provider("k")
    p.get_task_status = AsyncMock(side_effect=[
        {"ok": False, "failed": False, "status": "running", "video_url": ""},
        {"ok": True, "failed": False, "status": "succeeded", "video_url": "https://f/v.mp4"},
    ])
    base = {"provider": "magi2", "model": "magi-2", "task_id": "42", "duration": 10}
    result = await p._poll("42", base, interval=0.0, max_wait=60)
    assert result["video_url"] == "https://f/v.mp4"
    assert result["status"] == "succeeded"


async def test_poll_failure_raises():
    p = Magi2Provider("k")
    p.get_task_status = AsyncMock(return_value={
        "ok": False, "failed": True, "status": "failed", "error": "生成失败",
    })
    with pytest.raises(ProviderError) as exc:
        await p._poll("42", {"provider": "magi2"}, interval=0.0, max_wait=60)
    assert exc.value.status_code == 502


# =============================================================================
# video_generation 接线
# =============================================================================


def test_instantiate_returns_provider(monkeypatch):
    from app.services import video_generation

    monkeypatch.setenv("MAGI2_API_KEY", "k")
    inst = video_generation._instantiate("magi2")
    assert isinstance(inst, Magi2Provider)


def test_instantiate_skips_without_credentials():
    from app.services import video_generation

    assert video_generation._instantiate("magi2") is None


def test_instantiate_reads_llm_providers_json(monkeypatch):
    """生产环境常把凭据收在 LLM_PROVIDERS JSON,不能只认扁平 env。"""
    from app.core.config import settings
    from app.services import video_generation

    monkeypatch.setattr(
        settings,
        "llm_providers",
        json.dumps({
            "magi2": {
                "api_key": "sk-sand",
                "api_base": "https://sand-proxy.example.com",
                "default_model": "magi-2-preview-latest",
            },
        }),
    )
    inst = video_generation._instantiate("magi2")
    assert isinstance(inst, Magi2Provider)
    assert inst.api_key == "sk-sand"
    assert inst.base_url == "https://sand-proxy.example.com"
    assert inst.model == "magi-2-preview-latest"


def test_default_priority_contains_magi2():
    from app.services import video_generation

    assert "magi2" in video_generation._DEFAULT_PRIORITY
