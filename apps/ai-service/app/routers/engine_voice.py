# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Voice Session 路由 — 语音↔引擎回合式全链路(2026-09-18 第六批)。

对标 Codex realtime-webrtc 的会话语义(回合式而非全双工流):
    音频上传 → faster-whisper 本地 STT(复用 /voice/stt 内核,零成本离线)
            → AgentEngine 线程 prompt(完整工具/审批/流式事件面)
            → edge-tts 本地合成(零 key)→ 音频返回

端点:
    POST   /api/engine/voice/sessions          创建语音会话(绑定/新建引擎线程)
    POST   /api/engine/voice/sessions/{sid}/turn  一轮语音对话(音频进→音频出)
    GET    /api/engine/voice/sessions/{sid}     会话状态(轮次/配置)
    DELETE /api/engine/voice/sessions/{sid}     关闭会话

设计:
- STT/TTS 复用既有零成本本地链路(faster-whisper + edge-tts),不新增付费依赖
- 引擎线程完整继承 AgentEngine 能力(工具/审批/预算/目标/代码会话),
  语音只是另一种"输入/输出编解码",不另起炉灶
- 单回合返回 base64 音频(回合式;客户端流式播放可自行走 /voice/tts)
"""

import asyncio
import base64
import contextlib
import logging
import os
import tempfile
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from ..core.jwt_auth import require_request_user_id, resolve_request_role_id
from .engine import ENGINE, _bind_principal, _mcp_principal_scope

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/engine/voice", tags=["voice", "agent-engine"])

# 会话空闲回收(秒)与全局会话上限
_VOICE_SESSION_TTL = 3600.0
_MAX_VOICE_SESSIONS = 32
# 单轮 TTS 文本上限(与 /voice/tts MAX_TEXT_CHARS 对齐的保守值)
_VOICE_TTS_MAX_CHARS = 3000

# 批58(接线):realtime_context 真接线开关(env ENGINE_VOICE_REALTIME_CONTEXT)。
# 对标 codex realtime_delegation.rs / realtime_start_instructions.rs:语音会话
# 是"中介转写委托"链路 —— on 时把 STT 转写经 <realtime_delegation> 片段委托给
# 引擎,并在首回合注入 <realtime_conversation> start 指令;off 时 transcript
# 原样进 prompt,与现状逐字节等价。


def _voice_realtime_context_enabled() -> bool:
    """读 realtime delegation 开关(env: ENGINE_VOICE_REALTIME_CONTEXT)。

    2026-10-11 修(CI run 38084051334):原先在模块导入时把开关冻结成常量 ——
    同进程里先有测试 setenv 后 reload 本模块(wiring 测试的正道变通),常量即被
    冻结成 ON,monkeypatch 恢复环境后也无法翻回,同 worker 的后续用例
    (test_engine_voice_session)吃到的全是污染值 ⇒ 顺序依赖的红。改为**调用时
    读 env**:flag 语义不变,冻结窗口归零,wiring 测试的 reload 变通也不再必要。
    """
    return os.environ.get("ENGINE_VOICE_REALTIME_CONTEXT", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _voice_wrap_delegation(transcript: str, *, first_turn: bool) -> str:
    """把 STT 转写包成 realtime delegation 文本(off/失败时原样返回)。

    对标 codex:首回合先注入 start 指令片段(告知引擎处于实时会话后端执行者
    语义),随后 user 角色的 <realtime_delegation> 包裹转写文本。转写上限
    4KiB(模块常量),超长中段截断由模块 escape_xml_text_bounded 承担。
    """
    if not _voice_realtime_context_enabled():
        return transcript
    try:
        from app.core.realtime_context import (
            build_realtime_delegation_fragment,
            build_realtime_start_instructions_fragment,
        )

        def _text_of(fragment: dict[str, Any]) -> str:
            content = fragment.get("content")
            if isinstance(content, list) and content:
                first = content[0]
                if isinstance(first, dict):
                    return str(first.get("text", ""))
            return content if isinstance(content, str) else ""

        parts: list[str] = []
        if first_turn:
            body = _text_of(build_realtime_start_instructions_fragment())
            if body:
                parts.append(body)
        dbody = _text_of(build_realtime_delegation_fragment(transcript))
        if dbody:
            parts.append(dbody)
        return "\n".join(parts) if parts else transcript
    except Exception as e:  # noqa: BLE001 - 片段构造失败降级为原文
        logger.warning("realtime delegation 片段构造失败(降级原文): %s", e)
        return transcript


class VoiceSessionCreate(BaseModel):
    """创建语音会话请求。"""

    threadId: str | None = None
    sttLanguage: str | None = None
    ttsVoice: str = "zh-CN-XiaoxiaoNeural"


_sessions: dict[str, dict[str, Any]] = {}


def _prune_sessions() -> None:
    now = time.time()
    for sid in list(_sessions):
        if now - _sessions[sid]["last_active"] > _VOICE_SESSION_TTL:
            _sessions.pop(sid, None)


async def _transcribe_audio(data: bytes, filename: str, language: str | None) -> str:
    """音频字节 → 文本(faster-whisper 本地推理;复用 voice_stt 内核)。"""
    from .voice_stt import _get_suffix, _get_whisper_model, _transcribe_sync

    model = await asyncio.to_thread(_get_whisper_model)
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=_get_suffix(filename))
    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(data)
            f.flush()
        return await asyncio.to_thread(_transcribe_sync, model, tmp_path, language)
    finally:
        with contextlib.suppress(OSError):
            os.unlink(tmp_path)


async def _synthesize_speech(text: str, voice: str) -> bytes:
    """文本 → mp3 音频字节(edge-tts 本地合成,零 key)。"""
    import edge_tts

    communicate = edge_tts.Communicate(text, voice=voice)
    chunks: list[bytes] = []
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio":
            chunks.append(chunk["data"])
    if not chunks:
        raise RuntimeError("edge-tts 未返回音频数据")
    return b"".join(chunks)


def _require_own_session(sid: str, user_id: str) -> dict[str, Any]:
    """取**自己的**语音会话;别人的 sid 与"没这个会话"回同一句 404、同一个文案。

    为什么刻意同形:`sid` 是 `vse_` + 12 位随机 hex,它本身是把手而不是公开清单 ——
    但"存在而不属于你"与"不存在"若在文案上可分,这个端点就变成 sid 枚举预言机
    (AGENTS §5「可清除的是业务元数据,不是授权凭据」同一条口径)。

    **行为变化如实登记**:本次之前建的会话没有 `owner_user_id` 键,升级后按"不是你的"
    处理 ⇒ 正在进行的语音会话会 404 一次。这不是数据损失 —— 会话表是进程内内存态、
    TTL 1h、重启即清,客户端重新 `POST /sessions` 就拿回一个带属主的新会话;反过来若给
    无主会话开"维持改动前行为"的口子,那等于把"没人认领就能被任何人用"永久写进这条链。
    """
    session = _sessions.get(sid)
    if session is None or session.get("owner_user_id") != user_id:
        raise HTTPException(status_code=404, detail=f"语音会话不存在: {sid}")
    return session


async def _engine_call(message: dict[str, Any], user_id: str, role_id: int) -> Any:
    """带**本请求的令牌主体**向引擎发一次合成报文(与 HTTP/WS 两条传输走同一条绑定路径)。

    两件事一起做,缺任何一条都不算修:

    ① `_bind_principal` 把 `params.userId` / `params.roleId` 写成宿主事实。此前这一支发的是
       **裸 params**(没有 `userId`),于是引擎侧 `_connection_principal` 恒为 `None`,
       而属主对账对 `None` 的规矩是"承载层没给身份 ⇒ 维持改动前行为" —— 那不是许可,
       但结果就是:任何已登录用户都能拿**别人的 threadId** 建语音会话,并在他人线程上
       发起 `thread.prompt`;新建的线程也没有属主,重启后任何人可继续用它对话(AGENTS §5
       记过的"认证不等于授权"成批形态,这一格是**同一身份的第二条通道没绑主体**)。
    ② `_mcp_principal_scope` 让无参回调 `tool_lister` 读到同一个主体。漏了这一条,语音会话
       的工具清单只剩部署级 server,用户自己注册的外部工具在语音链上静默消失(过度收窄
       同样是行为变更,而且账面全绿)。
    """
    bound = _bind_principal(message, user_id, role_id)
    with _mcp_principal_scope(bound):
        return await ENGINE.handle_message(bound)


@router.post("/sessions")
async def create_voice_session(
    req: VoiceSessionCreate,
    request: Request,
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """创建语音会话:绑定既有引擎线程,或自动新建一个(两者都**带着令牌主体**去问引擎)。"""
    role_id = resolve_request_role_id(request)
    _prune_sessions()
    if len(_sessions) >= _MAX_VOICE_SESSIONS:
        raise HTTPException(status_code=429, detail=f"语音会话数已达上限({_MAX_VOICE_SESSIONS})")
    thread_id = req.threadId
    if thread_id:
        state = await _engine_call(
            {"jsonrpc": "2.0", "id": 1, "method": "thread.state",
             "params": {"threadId": thread_id}},
            user_id,
            role_id,
        )
        if state is None or "error" in state:
            # 与"线程不存在"同一句文案:别人的 threadId 走到这里也是 404,不给枚举信号
            raise HTTPException(status_code=404, detail=f"线程不存在: {thread_id}")
    else:
        started = await _engine_call(
            {"jsonrpc": "2.0", "id": 1, "method": "thread.start", "params": {}},
            user_id,
            role_id,
        )
        assert started is not None and "error" not in started
        thread_id = str(started["result"]["threadId"])
    sid = f"vse_{uuid.uuid4().hex[:12]}"
    _sessions[sid] = {
        "id": sid,
        "threadId": thread_id,
        # 语音会话是**归属型记录**(它挂着一条线程的使用权)。缺这一格,sid 一旦泄露
        # 就等于把别人的线程交出去,而 sid 会出现在日志与客户端状态里。
        "owner_user_id": user_id,
        "stt_language": req.sttLanguage,
        "tts_voice": req.ttsVoice,
        "turns": 0,
        "created_at": time.time(),
        "last_active": time.time(),
    }
    return {"sessionId": sid, "threadId": thread_id, "ttsVoice": req.ttsVoice}


@router.post("/sessions/{sid}/turn")
async def voice_turn(
    sid: str,
    request: Request,
    file: UploadFile = File(..., description="音频文件(wav/mp3/webm 等)"),
    language: str | None = Form(None, description="覆盖会话级 STT 语言"),
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """一轮语音对话:音频 → STT → 引擎线程 → TTS → 音频。"""
    session = _require_own_session(sid, user_id)
    role_id = resolve_request_role_id(request)
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="音频内容为空")
    session["last_active"] = time.time()
    # 1) STT(失败降级为可读错误,保持回合语义)
    try:
        transcript = await _transcribe_audio(
            audio_bytes, file.filename or "audio.wav",
            language or session["stt_language"],
        )
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="faster-whisper 未安装,无法本地转写。请运行: pip install faster-whisper",
        ) from None
    except Exception as e:  # noqa: BLE001 - STT 失败不炸会话
        logger.warning("[voice-session] STT 失败: %s", e)
        raise HTTPException(status_code=502, detail=f"STT 转写失败: {type(e).__name__}") from None
    if not transcript.strip():
        return {
            "sessionId": sid,
            "transcript": "",
            "responseText": "",
            "audioBase64": None,
            "note": "未检测到语音内容",
        }
    # 2) 引擎线程 prompt(完整 agent 能力面)
    # 批58(接线):realtime delegation 包裹(对标 codex realtime_delegation.rs)。
    # off 时 transcript 原样进 prompt(逐字节等价);on 时首回合附 start 指令。
    prompt_input = _voice_wrap_delegation(
        transcript, first_turn=int(session.get("turns", 0)) == 0
    )
    response = await _engine_call(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "thread.prompt",
            "params": {"threadId": session["threadId"], "input": prompt_input},
        },
        user_id,
        role_id,
    )
    if response is None or "error" in response:
        detail = str((response or {}).get("error", {}).get("message", "引擎执行失败"))
        raise HTTPException(status_code=502, detail=f"引擎执行失败: {detail}")
    result = response["result"]
    response_text = str(result.get("finalResponse") or "")
    # 3) TTS(失败不炸回合:返回文本 + note)
    audio_b64: str | None = None
    tts_note: str | None = None
    if response_text.strip():
        try:
            speak_text = response_text[:_VOICE_TTS_MAX_CHARS]
            audio = await _synthesize_speech(speak_text, session["tts_voice"])
            audio_b64 = base64.b64encode(audio).decode("ascii")
        except Exception as e:  # noqa: BLE001 - TTS 失败降级为纯文本回合
            logger.warning("[voice-session] TTS 失败: %s", e)
            tts_note = f"TTS 合成失败({type(e).__name__}),本回合仅返回文本"
    session["turns"] += 1
    return {
        "sessionId": sid,
        "threadId": session["threadId"],
        "turnIndex": session["turns"],
        "transcript": transcript,
        "responseText": response_text,
        "audioBase64": audio_b64,
        "note": tts_note,
        "usage": result.get("usage"),
    }


@router.get("/sessions/{sid}")
async def voice_session_state(
    sid: str, user_id: str = Depends(require_request_user_id)
) -> dict[str, Any]:
    """语音会话状态(轮次/配置/绑定线程)——只回自己的。"""
    session = _require_own_session(sid, user_id)
    return {
        "sessionId": sid,
        "threadId": session["threadId"],
        "turns": session["turns"],
        "sttLanguage": session["stt_language"],
        "ttsVoice": session["tts_voice"],
        "ageSeconds": round(time.time() - session["created_at"], 1),
    }


@router.delete("/sessions/{sid}")
async def close_voice_session(
    sid: str, user_id: str = Depends(require_request_user_id)
) -> dict[str, Any]:
    """关闭语音会话(引擎线程保留,可继续用 RPC 文本对话)——只能关自己的。"""
    _require_own_session(sid, user_id)
    _sessions.pop(sid, None)
    return {"sessionId": sid, "closed": True}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
