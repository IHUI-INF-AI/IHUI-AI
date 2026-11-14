# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""read_image 多模态工具结果契约(2026-11-14 立,对标 DSH dsh-tool-fs/read-image.ts)。

① 工具只回小体积元数据 + content_id,图片本体进有界暂存(不进 tool 正文/SSE 帧);
② 主循环在本轮 tool 消息之后追加一条 role=user 的 vision content 消息;
③ 扩展名/文件头/大小/解码四道校验,越权路径与不存在同形拒绝;
④ 修复层不得丢弃多模态 user 消息(_repair_agent_loop_messages / repair_messages)。
"""

from __future__ import annotations

import base64

import pytest

from app.core.llm_gateway import _repair_agent_loop_messages, repair_messages
from app.services import mcp_server as mcp
from app.services import tool_image_delivery as delivery
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition
from app.services.mcp_server import _tool_read_image

# 1x1 红色 PNG(固定字节,避免测试依赖 Pillow 编码结果)
_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


@pytest.fixture(autouse=True)
def _clean_stash():
    delivery.reset_image_stash()
    yield
    delivery.reset_image_stash()


def _write_image(tmp_path, name: str = "shot.png", data: bytes = _PNG_BYTES):
    path = tmp_path / name
    path.write_bytes(data)
    return path


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    """把工作区白名单钉到 tmp_path(与 terminal 测试同口径)。"""
    monkeypatch.setattr(mcp, "_get_workspace_roots", lambda: [str(tmp_path)])
    return tmp_path


def test_read_image_registered_in_both_surfaces() -> None:
    assert "read_image" in {t.name for t in mcp._TOOLS}
    assert mcp._TOOL_HANDLERS.get("read_image") is _tool_read_image


@pytest.mark.asyncio
async def test_read_image_returns_metadata_and_stashes_payload(workspace) -> None:
    path = _write_image(workspace)

    result = await _tool_read_image({"file_path": str(path)})

    assert result["ok"] is True
    image = result["image"]
    assert image["media_type"] == "image/png"
    assert image["width"] == 1 and image["height"] == 1
    assert image["name"] == "shot.png"
    assert image["content_id"].startswith("img_")
    # tool 正文不得携带 base64(否则会被截断护栏截坏 / 撑爆 SSE 帧)
    assert "base64" not in str(result)

    images = delivery.take_images([image["content_id"]])
    assert len(images) == 1
    assert images[0]["data_url"].startswith("data:image/png;base64,")
    # 读取即弹出:第二次取不到
    assert delivery.take_images([image["content_id"]]) == []

    message = delivery.build_image_followup_message(images)
    assert message is not None and message["role"] == "user"
    parts = message["content"]
    assert parts[0]["type"] == "text" and "<type>image</type>" in parts[0]["text"]
    assert parts[1]["type"] == "image_url"
    assert parts[1]["image_url"]["url"].startswith("data:image/png;base64,")


@pytest.mark.asyncio
async def test_read_image_rejects_path_outside_workspace(workspace) -> None:
    outside = workspace.parent / "outside.png"
    outside.write_bytes(_PNG_BYTES)

    result = await _tool_read_image({"file_path": str(outside)})

    assert result["ok"] is False
    assert result["errorCode"] == "PATH_NOT_ALLOWED"


@pytest.mark.asyncio
async def test_read_image_rejects_unknown_extension_even_with_png_bytes(workspace) -> None:
    path = _write_image(workspace, "note.txt")

    result = await _tool_read_image({"file_path": str(path)})

    assert result["ok"] is False
    assert result["errorCode"] == "IMAGE_UNSUPPORTED_FORMAT"


@pytest.mark.asyncio
async def test_read_image_rejects_extension_signature_mismatch(workspace) -> None:
    path = _write_image(workspace, "actually_png.jpg")

    result = await _tool_read_image({"file_path": str(path)})

    assert result["ok"] is False
    assert result["errorCode"] == "IMAGE_TYPE_MISMATCH"


@pytest.mark.asyncio
async def test_read_image_rejects_oversize(workspace, monkeypatch) -> None:
    monkeypatch.setattr(delivery, "MAX_IMAGE_BYTES", 8)
    path = _write_image(workspace)

    result = await _tool_read_image({"file_path": str(path)})

    assert result["ok"] is False
    assert result["errorCode"] == "IMAGE_TOO_LARGE"


@pytest.mark.asyncio
async def test_read_image_rejects_pixel_bomb(workspace, monkeypatch) -> None:
    """解压炸弹防线:字节数合规但像素总量超限也必须拒绝(对标 DSH maxImagePixels)。"""
    monkeypatch.setattr(delivery, "MAX_IMAGE_PIXELS", 0)
    path = _write_image(workspace)

    result = await _tool_read_image({"file_path": str(path)})

    assert result["ok"] is False
    assert result["errorCode"] == "IMAGE_TOO_LARGE"


def test_repair_paths_preserve_multimodal_user_message() -> None:
    multimodal = {
        "role": "user",
        "content": [
            {"type": "text", "text": "<type>image</type>"},
            {"type": "image_url", "image_url": {"url": "data:image/png;base64,AA=="}},
        ],
    }
    messages = [
        {"role": "user", "content": "看图"},
        {
            "role": "assistant",
            "content": "",
            "tool_calls": [{"id": "c1", "name": "read_image", "args": {}}],
        },
        {"role": "tool", "tool_call_id": "c1", "name": "read_image", "content": "{}"},
        multimodal,
    ]

    agent_repaired, _ = _repair_agent_loop_messages(messages)
    assert agent_repaired[-1] is multimodal or agent_repaired[-1]["content"] == multimodal["content"]

    repaired, removed, _ = repair_messages(
        [{"role": "user", "content": "看图"}, multimodal], keep_trailing_user=True
    )
    assert removed == 0
    assert repaired[-1]["content"] == multimodal["content"]


def test_missing_image_delivery_is_reported() -> None:
    """暂存上限/过期导致的缺图必须如实回执,不能静默消失。"""
    images, missing = delivery.take_images_with_report(["img_never_existed"])
    assert images == []
    assert missing == ["img_never_existed"]

    message = delivery.build_image_followup_message([], missing=len(missing))
    assert message is not None
    text = " ".join(p["text"] for p in message["content"] if p["type"] == "text")
    assert "另有 1 张图片未送达" in text
    assert "重新调用 read_image" in text


@pytest.mark.asyncio
async def test_agent_loop_delivers_image_as_user_multimodal_message(workspace) -> None:
    """端到端:第 1 轮模型调 read_image,第 2 轮请求里必须出现图片本体。"""
    path = _write_image(workspace)
    captured: list[list[dict]] = []

    async def mock_llm(messages, tools):
        captured.append([dict(m) for m in messages])
        if len(captured) == 1:
            return {
                "content": "我看一下",
                "tool_calls": [
                    {"id": "c1", "name": "read_image", "args": {"file_path": str(path)}}
                ],
            }
        return {"content": "图里是一块红色", "tool_calls": None}

    tool = ToolDefinition(
        name="read_image",
        description="读取图片",
        parameters={
            "type": "object",
            "properties": {"file_path": {"type": "string"}},
            "required": ["file_path"],
        },
        executor=_tool_read_image,
    )
    loop = AgentLoopV2(mock_llm, [tool], max_iterations=3)
    result = await loop.run(
        [
            {"role": "system", "content": "你是助手"},
            {"role": "user", "content": "看看这张图"},
        ]
    )

    assert result.success is True
    assert len(captured) == 2
    second = captured[1]
    image_messages = [
        m for m in second
        if m.get("role") == "user" and isinstance(m.get("content"), list)
    ]
    assert len(image_messages) == 1
    parts = image_messages[0]["content"]
    assert any(p.get("type") == "image_url" for p in parts)
    # tool 正文只有元数据,base64 不在 tool 消息里
    tool_messages = [m for m in second if m.get("role") == "tool"]
    assert tool_messages and all("base64" not in str(m.get("content")) for m in tool_messages)


@pytest.mark.asyncio
async def test_read_image_applies_exif_orientation(workspace) -> None:
    """手机照片的 EXIF Orientation 必须先转正:否则模型看到躺倒的图,坐标也错位。"""
    from PIL import Image

    path = workspace / "rotated.jpg"
    image = Image.new("RGB", (4, 2), (255, 0, 0))
    exif = Image.Exif()
    exif[0x0112] = 6  # 实际内容是顺时针转 90° 才正立
    image.save(path, format="JPEG", exif=exif)

    result = await _tool_read_image({"file_path": str(path)})

    assert result["ok"] is True
    meta = result["image"]
    # 交付的是转正后的图:宽高互换
    assert (meta["width"], meta["height"]) == (2, 4)
    assert (meta["source_width"], meta["source_height"]) == (2, 4)
    images = delivery.take_images([meta["content_id"]])
    assert len(images) == 1
    assert images[0]["data_url"].startswith("data:image/")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
