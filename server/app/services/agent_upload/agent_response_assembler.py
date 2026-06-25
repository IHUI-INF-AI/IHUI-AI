"""Agent 响应组装器.

迁移自 ZHS_Server_java/small/service/agent/AgentResponseAssembler.java.
处理 agent 返回的响应,按 type 分类,转换媒体 URL 上传,统计 token.
"""

import os
import tempfile
from typing import Any

import httpx
from loguru import logger

try:
    from pydub import AudioSegment
    _HAS_PYDUB = True
except ImportError:
    _HAS_PYDUB = False
    AudioSegment = None

from app.services.agent_upload.agent_json_helper import normalize, parse_array


def _analyze_audio_duration(audio_url: str) -> float:
    """通过 pydub 分析音频时长(秒),失败返回 0."""
    if not audio_url or not _HAS_PYDUB:
        return 0.0
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.get(audio_url)
            r.raise_for_status()
            data = r.content
        with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            audio = AudioSegment.from_file(tmp_path)
            return len(audio) / 1000.0
        finally:
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.debug("删除临时音频文件失败: %s", e)
    except Exception as e:
        logger.warning(f"分析音频时长失败: {e}")
        return 0.0


async def _upload_media_url(url: str, file_service: Any) -> str:
    """将媒体 URL 异步上传到文件服务(MinIO),返回内部 URL."""
    if not url or not file_service:
        return url or ""
    try:
        result = await file_service.upload_from_url(url) if hasattr(file_service, "upload_from_url") else None
        return result or url
    except Exception as e:
        logger.warning(f"媒体上传失败, 沿用原 URL: {e}")
        return url


def assemble(agent: Any, answer_object: dict[str, Any] | None, counting_unit: int | None = None) -> dict[str, Any]:
    """将 agent 响应组装为结构化输出格式."""
    if agent is None:
        raise ValueError("Agent must not be null")
    if not answer_object:
        return {}

    video_token = int(answer_object.get("token", 0) or 0)
    ratio = answer_object.get("ratio")
    variables_out_str = getattr(agent, "agent_variables_out", None) or "[]"
    try:
        variables_out_array = parse_array(variables_out_str, "agentVariablesOut")
    except ValueError:
        variables_out_array = []

    output_type_map: dict[str, dict[str, Any]] = {}
    for var_out in variables_out_array:
        target_param = var_out.get("parameterName")
        if not target_param:
            continue
        target_type = (var_out.get("type") or "").lower()
        answer_value = answer_object.get(target_param)
        if answer_value is None or (isinstance(answer_value, str) and not answer_value.strip()):
            answer_value = var_out.get("default")
        answer_value = normalize(answer_value)
        if answer_value is None:
            continue
        output_type_map.setdefault(target_type, {})[target_param] = answer_value

    final_output: dict[str, Any] = {
        "text": {},
        "image": {},
        "video": {},
        "audio": {},
    }
    agent_file_url_parts = []
    total_tokens_used = 0

    for type_key, params_by_name in output_type_map.items():
        for param_name, value in params_by_name.items():
            if type_key == "text" and isinstance(value, str):
                final_output["text"][param_name] = value
                if counting_unit is not None and counting_unit > 0:
                    total_tokens_used += max(1, len(value) // counting_unit)
            elif type_key in ("image", "image_url", "img"):
                final_output["image"][param_name] = value
                if isinstance(value, str):
                    agent_file_url_parts.append(value)
            elif type_key in ("video", "video_url"):
                final_output["video"][param_name] = value
                if isinstance(value, str):
                    agent_file_url_parts.append(value)
            elif type_key in ("audio", "audio_url", "voice"):
                final_output["audio"][param_name] = value
                if isinstance(value, str):
                    agent_file_url_parts.append(value)

    if counting_unit is not None and video_token > 0 and ratio:
        try:
            r = float(ratio)
            final_output["video_tokens"] = max(1, int(video_token * r))
            total_tokens_used += final_output["video_tokens"]
        except (ValueError, TypeError):
            pass

    final_output["agentFileUrl"] = ",".join(agent_file_url_parts) if agent_file_url_parts else None
    final_output["totalTokens"] = total_tokens_used
    final_output["token"] = video_token
    final_output["ratio"] = ratio
    return final_output
