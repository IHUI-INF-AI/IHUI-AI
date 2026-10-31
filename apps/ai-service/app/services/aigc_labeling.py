# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIGC 生成内容打标(goal-b40,对齐 Trae toolhost tagAigcMetadata / addAigcWatermark)。

取证立因(goal-b40 本机 Trae CN 1.107.1 toolhost.dll 字符串级,E1):
    icube.common.commands.tooling.tagAigcMetadata / addAigcWatermark / checkImageCompliance
Trae 把 AIGC 打标做成工具宿主的按需命令;本模块把它做成**落库链路自动打标**:
每条媒体任务(图像/音频/视频)落 media_tasks 表时自动携带 `aigc` 元数据块,
内容含显式标识文案、标识类型(显式+隐式)、生成方与标准引用 —— 对应
《人工智能生成合成内容标识办法》(2025-09-01 施行)的显式+隐式双标识要求。

判据:
1. **默认开**:`AIGC_LABELING_ENABLED`(env,缺省 'true')。合规增强是"新增字段"
   不是行为破坏 —— payload 新增 `aigc` 键,既有消费方零改动;关掉即逐字节旧行为。
2. **纯函数**:本模块不做任何 IO(落库在 media_tasks.persist_media_task),全部可脱栈测。
3. **不冒充**:拿不到 provider/model 时如实落空串,不编造生成方;`labeled` 恒 true
   仅表示"本条已按本模块规则打标",不代表产物字节层带了水印(字节级改写属于
   对外部产物 URL 的二次分发,不在本模块射程,留作下游下载侧的后续件)。

依赖方向:本模块不得 import app.routers.*(路由层依赖服务层,反向即循环)。
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any, Final

#: env 开关(与 media_tasks / fim 的命名习惯同一条线:模块级小写 snake + _ENABLED)
AIGC_LABELING_ENV: Final[str] = "AIGC_LABELING_ENABLED"

#: 显式标识文案按内容类型分词(办法要求"显式标识"让用户可感知类型)
_KIND_NOTICE: Final[dict[str, str]] = {
    "image": "AI 生成图像",
    "video": "AI 生成视频",
    "music": "AI 生成音频",
    "tts": "AI 合成语音",
    "media": "AI 生成内容",
}

#: 标识办法的标准引用口径(写进元数据,审计可回溯依据)
_LABEL_STANDARD: Final[str] = "GB 45438-2025 兼容口径 / 《人工智能生成合成内容标识办法》"


def labeling_enabled(env: str | None = None) -> bool:
    """开关判据:env 缺省 'true';显式 'false'/'0'/'no' 才关(其余真值均视为开)。"""
    raw = (env if env is not None else os.environ.get(AIGC_LABELING_ENV, "true")).strip().lower()
    return raw not in {"false", "0", "no", "off"}


def explicit_notice(kind: str) -> str:
    """显式标识文案:未知 kind 回退到通用词,绝不留空(空文案=未标识)。"""
    return _KIND_NOTICE.get(kind, _KIND_NOTICE["media"])


def label_aigc_payload(
    payload: dict[str, Any],
    *,
    kind: str,
    tool: str,
    provider: str,
    now: datetime | None = None,
) -> dict[str, Any]:
    """给媒体任务 payload 追加 `aigc` 元数据块(返回新 dict,不改入参)。

    payload 是 persist_media_task 构造的窄字典;打标字段只增不改,
    逐字节保持既有键的值不变(§向后兼容:消费方零破坏)。
    """
    if not labeling_enabled():
        return payload
    labeled_at = (now or datetime.now(UTC)).isoformat()
    aigc: dict[str, Any] = {
        "labeled": True,
        "label_type": "explicit+implicit",
        "content_kind": kind,
        "tool": tool,
        "generator": provider or "",
        "labeled_at": labeled_at,
        "explicit_notice": explicit_notice(kind),
        "standard": _LABEL_STANDARD,
    }
    model = payload.get("model") or payload.get("model_id")
    if isinstance(model, str) and model.strip():
        aigc["model"] = model.strip()
    return {**payload, "aigc": aigc}


__all__ = [
    "AIGC_LABELING_ENV",
    "explicit_notice",
    "label_aigc_payload",
    "labeling_enabled",
]
