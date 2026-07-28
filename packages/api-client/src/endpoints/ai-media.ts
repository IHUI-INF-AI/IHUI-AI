/**
 * AI 生成结果媒体提取工具：从各厂商差异化的响应结构中
 * 递归提取图片/视频/音频/模型 URL 与文本内容。
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'

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

/** 语音对话结果 */
export interface VoiceChatResult {
  reply: string
  audio?: string
  audioUrl?: string
}

/** TTS 结果 */
export interface TtsResult {
  audio: string
  audioUrl?: string
}

/** 语音模型 */
export interface VoiceModel {
  id: string
  name: string
  desc: string
}

/** 发送语音消息（语音对话） */
export async function sendVoiceMessage(
  audioBase64: string,
  format = 'mp3',
): Promise<ApiResult<VoiceChatResult>> {
  return fetchApi<VoiceChatResult>('/api/ai-audio/voice/chat', {
    method: 'POST',
    body: JSON.stringify({ audio: audioBase64, format }),
  })
}

/** 文本转语音 */
export async function textToSpeech(
  text: string,
  voice = 'default',
): Promise<ApiResult<TtsResult>> {
  return fetchApi<TtsResult>('/api/ai-audio/tts', {
    method: 'POST',
    body: JSON.stringify({ text, voice }),
  })
}

/** 语音转文本 */
export async function speechToText(
  audioBase64: string,
  format = 'mp3',
): Promise<ApiResult<{ text: string }>> {
  return fetchApi<{ text: string }>('/api/ai-audio/asr', {
    method: 'POST',
    body: JSON.stringify({ audio: audioBase64, format }),
  })
}

/** 获取语音模型列表 */
export async function getVoiceModels(): Promise<ApiResult<{ list: VoiceModel[] }>> {
  return fetchApi<{ list: VoiceModel[] }>('/api/ai-audio/models')
}
