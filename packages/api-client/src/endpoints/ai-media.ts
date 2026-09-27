// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 生成结果媒体提取工具：从各厂商差异化的响应结构中
 * 递归提取图片/视频/音频/模型 URL 与文本内容。
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi, fetchRaw } from '../client.js'

/** 异步任务状态（对应后端 AsyncTask）。 */
export interface AsyncTask {
  taskId: string
  vendor: string
  type: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  result?: unknown
  error?: string
  createdAt: number
  updatedAt: number
}

const HTTP_RE = /^https?:\/\//i
const MEDIA_KEY_RE = /url|image|video|audio|download|result/i

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && HTTP_RE.test(value)
}

/** 递归提取响应中所有 http(s) 媒体 URL。 */
export function extractMediaUrls(data: unknown): string[] {
  const urls = new Set<string>()
  const walk = (obj: unknown): void => {
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item)
      return
    }
    if (obj === null || typeof obj !== 'object') return
    const record = obj as Record<string, unknown>
    for (const [key, value] of Object.entries(record)) {
      if (MEDIA_KEY_RE.test(key)) {
        if (isHttpUrl(value)) {
          urls.add(value)
        } else if (Array.isArray(value)) {
          for (const v of value) if (isHttpUrl(v)) urls.add(v)
        }
      }
      walk(value)
    }
  }
  walk(data)
  return [...urls]
}

/** 提取响应中的文本分析结果（兼容 Gemini / DashScope / OpenAI 通用结构）。 */
export function extractText(data: unknown): string {
  if (typeof data === 'string') return data
  if (data === null || typeof data !== 'object') return ''
  const obj = data as Record<string, unknown>

  for (const key of ['text', 'content', 'reply', 'answer', 'description', 'message']) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) return v
  }

  const output = obj.output
  if (output !== null && typeof output === 'object') {
    const out = output as Record<string, unknown>
    const text = out.text
    if (typeof text === 'string' && text.trim()) return text
    const choices = out.choices
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0]
      if (first !== null && typeof first === 'object') {
        const msg = (first as Record<string, unknown>).message
        if (msg !== null && typeof msg === 'object') {
          const content = (msg as Record<string, unknown>).content
          if (typeof content === 'string' && content.trim()) return content
        }
      }
    }
  }

  const candidates = obj.candidates
  if (Array.isArray(candidates) && candidates.length > 0) {
    const first = candidates[0]
    if (first !== null && typeof first === 'object') {
      const content = (first as Record<string, unknown>).content
      if (content !== null && typeof content === 'object') {
        const parts = (content as Record<string, unknown>).parts
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (part !== null && typeof part === 'object') {
              const text = (part as Record<string, unknown>).text
              if (typeof text === 'string' && text.trim()) return text
            }
          }
        }
      }
    }
  }

  return ''
}

// ===================== 豆包语音 API（doubao voice）=====================

/** 语音对话结果(后端 /audio/chat 只回文本;音频需另调 fetchTextToSpeechAudio 合成) */
export interface VoiceChatResult {
  reply: string
  audio?: string
  audioUrl?: string
}

/** 语音模型 */
export interface VoiceModel {
  id: string
  name: string
  desc: string
}

/** 发送语音消息(语音对话:后端先 ASR 再对话,只回文本)
 * 门 8 死调用清账(2026-09-28):上一版 POST /api/ai-audio/voice/chat {audio, format} 从未注册;
 * 真路由 = POST /api/ai/audio/chat(ai-audio.ts:488,字段 audio_base64),响应 {user_text, ai_text}
 * 映射进既有 VoiceChatResult.reply,消费方(voiceChatByFile)签名不变。format 参数后端从未接受,摘掉。 */
export async function sendVoiceMessage(audioBase64: string): Promise<ApiResult<VoiceChatResult>> {
  const res = await fetchApi<{ user_text: string; ai_text: string }>('/api/ai/audio/chat', {
    method: 'POST',
    body: JSON.stringify({ audio_base64: audioBase64 }),
  })
  return res.success ? { ...res, data: { reply: res.data.ai_text } } : res
}

/** 文本转语音 —— 2026-09-28 门 8 死调用清账:删除。
 * 上一版 POST /api/ai-audio/tts 从未注册;真 TTS 面(POST /api/ai/audio/speech)**成功时直返
 * 音频二进制**(ai-audio.ts:284-289),JSON 信封只在异步任务/错误时出现 —— 没有任何后端形状
 * 能诚实填 TtsResult{audio},而可用的音频通道早已存在(fetchTextToSpeechAudio,走真路由)。
 * 留一个"看起来能用、拿到的永远是解析失败或 task_id"的函数 = 台账里"把没判写成判过了"的 API 版。 */

/** 获取真实 TTS 音频二进制,供移动端直接播放。 */
export async function fetchTextToSpeechAudio(text: string, voice = 'longxiaochun'): Promise<Blob> {
  return fetchRaw('/api/ai/audio/speech', {
    method: 'POST',
    body: JSON.stringify({ text, voice_id: voice, response_format: 'mp3' }),
    headers: { 'Content-Type': 'application/json' },
  })
}

/** 语音转文本(同步转写走 qwen3-asr 多模态对话端点;paraformer 默认档是异步任务,不适合本同步签名)
 * 门 8 死调用清账(2026-09-28):上一版 POST /api/ai-audio/asr 从未注册;
 * 真路由 = POST /api/ai/audio/recognize(ai-audio.ts:315),响应 {transcription} 映射为 {text}。 */
export async function speechToText(audioBase64: string): Promise<ApiResult<{ text: string }>> {
  const res = await fetchApi<{ transcription: string }>('/api/ai/audio/recognize', {
    method: 'POST',
    body: JSON.stringify({ audio_base64: audioBase64, model: 'qwen3-asr' }),
  })
  return res.success ? { ...res, data: { text: res.data.transcription } } : res
}

/** 获取语音模型列表
 * 门 8 死调用清账(2026-09-28):上一版 GET /api/ai-audio/models 从未注册;
 * 真路由 = GET /api/ai/audio/models(ai-audio.ts:880),响应 {models} 映射为 {list},
 * description → desc 对齐本包既有 VoiceModel 形状。 */
export async function getVoiceModels(): Promise<ApiResult<{ list: VoiceModel[] }>> {
  const res = await fetchApi<{ models: Array<{ id: string; name: string; description?: string }> }>(
    '/api/ai/audio/models',
  )
  return res.success
    ? {
        ...res,
        data: {
          list: res.data.models.map((m) => ({ id: m.id, name: m.name, desc: m.description ?? '' })),
        },
      }
    : res
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
