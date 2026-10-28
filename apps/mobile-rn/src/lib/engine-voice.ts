// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 语音回合客户端(D126)—— 引擎侧「按住说话」回合式语音会话。
 *
 * 代理契约(api 侧并行落地,路径钉死):
 * - POST /api/engine/voice/sessions           建会话(body: threadId?/sttLanguage?/ttsVoice?)
 * - POST /api/engine/voice/sessions/{sid}/turn 回合(body: audioBase64 + filename?/language?;
 *   RN 发 JSON+base64,multipart 由 api 代理组装)
 * - DELETE /api/engine/voice/sessions/{sid}    关会话
 *
 * 网络一律走 @ihui/api-client 的 fetchApi(401→登录弹窗、续期、timeoutMs、
 * `{ code, message, data }` 解包都在传输层),此处只做 ApiResult 解包:
 * success=false 时抛 Error 携带服务端 message,由调用方 try/catch 展示。
 */
import { fetchApi } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'

/** 语音回合会话(建会话响应) */
export interface EngineVoiceSession {
  sessionId: string
  threadId: string
  ttsVoice?: string
}

/** 单个语音回合结果(转写 + 回复文本 + 可选 TTS 音频/备注) */
export interface EngineVoiceTurnResult {
  sessionId: string
  threadId: string
  turnIndex: number
  transcript: string
  responseText: string
  /** TTS 回复音频(服务端不可用时为 null) */
  audioBase64: string | null
  /** 服务端备注(如降级说明,非空时 UI 透出一行灰字) */
  note: string | null
}

/** 建会话入参(全可选;不传由服务端默认) */
export interface CreateVoiceSessionInput {
  threadId?: string
  sttLanguage?: string
  ttsVoice?: string
}

/** 回合调用可选参数 */
export interface VoiceTurnOptions {
  filename?: string
  language?: string
}

/** ApiResult 解包:失败分支抛 Error 携带服务端 message(空 error 用兜底文案)。 */
function unwrap<T>(res: ApiResult<T>, fallbackMessage: string): T {
  if (!res.success) {
    const msg = res.error.trim() === '' ? fallbackMessage : res.error
    throw new Error(msg)
  }
  return res.data
}

/** 创建语音回合会话。 */
export async function createVoiceSession(
  input: CreateVoiceSessionInput = {},
): Promise<EngineVoiceSession> {
  const res = await fetchApi<EngineVoiceSession>('/api/engine/voice/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return unwrap(res, '创建语音会话失败')
}

/** 关闭语音回合会话(幂等:服务端已关/不存在也按成功处理)。 */
export async function closeVoiceSession(sessionId: string): Promise<void> {
  const res = await fetchApi<unknown>(`/api/engine/voice/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  })
  void unwrap(res, '关闭语音会话失败')
}

/** 提交一个语音回合:上传录音 base64,取回转写 + 回复文本 + 可选 TTS 音频。 */
export async function turnVoiceSession(
  sessionId: string,
  audioBase64: string,
  opts: VoiceTurnOptions = {},
): Promise<EngineVoiceTurnResult> {
  const res = await fetchApi<EngineVoiceTurnResult>(
    `/api/engine/voice/sessions/${encodeURIComponent(sessionId)}/turn`,
    {
      method: 'POST',
      body: JSON.stringify({
        audioBase64,
        filename: opts.filename,
        language: opts.language,
      }),
    },
  )
  return unwrap(res, '语音回合处理失败')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
