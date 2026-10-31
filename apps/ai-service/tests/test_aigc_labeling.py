# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIGC 生成内容打标(goal-b40,对齐 Trae tagAigcMetadata / addAigcWatermark)。

覆盖:
- 纯函数:explicit_notice(kind 分词 + 未知回退)/ labeling_enabled(开关矩阵)
  / label_aigc_payload(新增 aigc 块、不改既有键、model 提取、关掉即逐字节旧行为)
- 接线:persist_media_task 落库 payload 真携带 aigc 块(开)/ 不携带(关)

立因:goal-b40 本机 Trae CN 1.107.1 toolhost.dll 字符串级取证(E1),
`icube.common.commands.tooling.tagAigcMetadata / addAigcWatermark / checkImageCompliance`
—— Trae 为按需命令,IHUI 做落库链路自动打标(全类型+显式标识文案+标准引用)。
"""
from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest

from app.services import media_tasks as mt
from app.services.aigc_labeling import (
    AIGC_LABELING_ENV,
    explicit_notice,
    label_aigc_payload,
    labeling_enabled,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# 纯函数
# ---------------------------------------------------------------------------


def test_explicit_notice_by_kind():
    """四类内容各有显式标识文案(办法要求可感知类型)。"""
    assert explicit_notice("image") == "AI 生成图像"
    assert explicit_notice("video") == "AI 生成视频"
    assert explicit_notice("music") == "AI 生成音频"
    assert explicit_notice("tts") == "AI 合成语音"


def test_explicit_notice_unknown_kind_falls_back():
    """未知 kind 回退通用词,绝不留空(空文案=未标识)。"""
    assert explicit_notice("hologram") == "AI 生成内容"
    assert explicit_notice("") == "AI 生成内容"


def test_labeling_enabled_default_on():
    """缺省(未设 env)= 开:合规增强是新增字段,不是行为破坏。"""
    with patch.dict("os.environ", {}, clear=False):
        import os

        os.environ.pop(AIGC_LABELING_ENV, None)
        assert labeling_enabled() is True


@pytest.mark.parametrize("raw", ["false", "0", "no", "off", "FALSE", " Off "])
def test_labeling_enabled_false_values(raw):
    """显式假值(含大小写/空白)才关;其余真值一律视为开。"""
    assert labeling_enabled(raw) is False


@pytest.mark.parametrize("raw", ["true", "1", "yes", "on", "anything-else"])
def test_labeling_enabled_true_values(raw):
    assert labeling_enabled(raw) is True


def test_label_payload_adds_aigc_block_without_touching_existing_keys():
    """aigc 块只增不改:既有键的值逐字节保持。"""
    payload = {"image_url": "https://cdn/x.png", "completed": True, "progress": None}
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=UTC)
    out = label_aigc_payload(
        payload, kind="image", tool="image_generation", provider="agnes", now=now
    )
    # 既有键不动
    assert out["image_url"] == "https://cdn/x.png"
    assert out["completed"] is True
    assert out["progress"] is None
    # 入参未被原地修改(返回新 dict)
    assert "aigc" not in payload
    aigc = out["aigc"]
    assert aigc["labeled"] is True
    assert aigc["label_type"] == "explicit+implicit"
    assert aigc["content_kind"] == "image"
    assert aigc["tool"] == "image_generation"
    assert aigc["generator"] == "agnes"
    assert aigc["labeled_at"] == "2026-10-31T12:00:00+00:00"
    assert aigc["explicit_notice"] == "AI 生成图像"
    assert "标识办法" in aigc["standard"]


def test_label_payload_carries_model_when_present():
    """payload 带 model/model_id 时进 aigc 块(审计可回溯到具体模型)。"""
    out = label_aigc_payload(
        {"model": "agnes-vision-2"}, kind="image", tool="image_edit", provider="p"
    )
    assert out["aigc"]["model"] == "agnes-vision-2"


def test_label_payload_no_model_no_fake():
    """拿不到 model 时不编造:aigc 块不带 model 键。"""
    out = label_aigc_payload({}, kind="video", tool="video_generation", provider="p")
    assert "model" not in out["aigc"]
    assert out["aigc"]["generator"] == "p"


def test_label_payload_disabled_is_byte_identical():
    """开关关掉 ⇒ 返回与入参逐字节相同的 dict(旧行为)。"""
    payload = {"image_url": "https://cdn/x.png", "completed": True}
    with patch.dict("os.environ", {AIGC_LABELING_ENV: "false"}):
        out = label_aigc_payload(payload, kind="image", tool="t", provider="p")
    assert out == payload
    assert "aigc" not in out


# ---------------------------------------------------------------------------
# 接线:persist_media_task
# ---------------------------------------------------------------------------


async def test_persist_writes_aigc_block_into_db_payload():
    """落库 payload 真携带 aigc 块(开)。"""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[{"id": 1}])
    with patch("app.services.media_tasks.get_db_conn", new_callable=AsyncMock) as m:
        m.return_value = conn
        ok = await mt.persist_media_task(
            "image_generation",
            {"ok": True, "task_id": "t-aigc-1", "image_url": "https://cdn/x.png", "provider": "agnes"},
            user_uuid="u1",
        )
    assert ok is True
    sql, *params = conn.fetch.call_args.args
    assert "INSERT INTO media_tasks" in sql
    result_json = params[-1]
    assert '"aigc"' in result_json
    assert '"labeled": true' in result_json
    assert "AI 生成图像" in result_json


async def test_persist_aigc_disabled_keeps_legacy_payload():
    """开关关 ⇒ 落库 payload 无 aigc 键(逐字节旧行为)。"""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[{"id": 2}])
    with patch("app.services.media_tasks.get_db_conn", new_callable=AsyncMock) as m:
        m.return_value = conn
        with patch.dict("os.environ", {AIGC_LABELING_ENV: "false"}):
            ok = await mt.persist_media_task(
                "image_generation",
                {"ok": True, "task_id": "t-aigc-2", "image_url": "https://cdn/y.png", "provider": "agnes"},
                user_uuid="u1",
            )
    assert ok is True
    _sql, *params = conn.fetch.call_args.args
    assert '"aigc"' not in params[-1]
