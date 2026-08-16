/**
 * 音频模块 — TTS / ASR / 语音对话 / 声纹 / 音乐生成。
 *
 * 端点(8 个):
 * - GET  /v1/audio/voices
 * - POST /v1/audio/speech(TTS)
 * - POST /v1/audio/transcriptions(ASR)
 * - POST /v1/audio/chat(语音对话)
 * - GET  /v1/audio/speakers(声纹列表)
 * - POST /v1/audio/speakers(声纹注册)
 * - POST /v1/audio/speakers/compare(声纹比对)
 * - POST /v1/audio/music(音乐生成)
 */

import type { BaseClient } from './base.js'

// =============================================================================
// 内联类型定义
// =============================================================================

export interface V1AudioVoicesResponse {
  object: 'list'
  data: Array<{
    id: string
    name: string
    gender: string
    language: string
    preview?: string
  }>
}

export interface V1AudioSpeechRequest {
  model: string
  input: string
  voice: string
  responseFormat?: string
  speed?: number
}

export interface V1AudioSpeechResponse {
  audio: string
  format: string
  durationMs: number
}

export interface V1AudioTranscriptionsRequest {
  model: string
  audio: string
  language?: string
  prompt?: string
}

export interface V1AudioTranscriptionsResponse {
  text: string
  language: string
  duration: number
  segments?: Array<{
    id: number
    start: number
    end: number
    text: string
  }>
}

export interface V1AudioChatRequest {
  audio: string
  model: string
  sessionId?: string
}

export interface V1AudioChatResponse {
  text: string
  audio: string
  sessionId: string
}

export interface V1RegisterSpeakerRequest {
  name: string
  audio: string
}

export interface V1CompareSpeakersRequest {
  speakerId: string
  audio: string
}

export interface V1CompareSpeakersResponse {
  score: number
  matched: boolean
}

export interface V1MusicGenerationsRequest {
  prompt: string
  lyrics?: string
  duration?: number
}

export interface V1MusicGenerationsResponse {
  taskId: string
  status: 'pending' | 'processing' | 'completed'
}

/** 声纹注册响应。 */
export interface V1RegisterSpeakerResponse {
  speakerId: string
  status: 'registered'
}

/** 声纹列表响应。 */
export interface V1SpeakersListResponse {
  object: 'list'
  data: Array<{ id: string; name: string; registeredAt: string }>
}

// =============================================================================
// Module 接口 + 工厂函数
// =============================================================================

export interface AudioModule {
  /** GET /v1/audio/voices(音色列表)。 */
  listVoices(): Promise<V1AudioVoicesResponse>
  /** POST /v1/audio/speech(文字转语音)。 */
  speech(req: V1AudioSpeechRequest): Promise<V1AudioSpeechResponse>
  /** POST /v1/audio/transcriptions(语音转文字)。 */
  transcriptions(req: V1AudioTranscriptionsRequest): Promise<V1AudioTranscriptionsResponse>
  /** POST /v1/audio/chat(语音对话)。 */
  chat(req: V1AudioChatRequest): Promise<V1AudioChatResponse>
  /** GET /v1/audio/speakers(声纹列表)。 */
  listSpeakers(): Promise<V1SpeakersListResponse>
  /** POST /v1/audio/speakers(声纹注册)。 */
  registerSpeaker(req: V1RegisterSpeakerRequest): Promise<V1RegisterSpeakerResponse>
  /** POST /v1/audio/speakers/compare(声纹比对)。 */
  compareSpeakers(req: V1CompareSpeakersRequest): Promise<V1CompareSpeakersResponse>
  /** POST /v1/audio/music(音乐生成)。 */
  music(req: V1MusicGenerationsRequest): Promise<V1MusicGenerationsResponse>
}

export function createAudioModule(client: BaseClient): AudioModule {
  return {
    listVoices: () => client.request<V1AudioVoicesResponse>('GET', '/audio/voices'),
    speech: (req) => client.request<V1AudioSpeechResponse>('POST', '/audio/speech', req),
    transcriptions: (req) =>
      client.request<V1AudioTranscriptionsResponse>('POST', '/audio/transcriptions', req),
    chat: (req) => client.request<V1AudioChatResponse>('POST', '/audio/chat', req),
    listSpeakers: () => client.request<V1SpeakersListResponse>('GET', '/audio/speakers'),
    registerSpeaker: (req) =>
      client.request<V1RegisterSpeakerResponse>('POST', '/audio/speakers', req),
    compareSpeakers: (req) =>
      client.request<V1CompareSpeakersResponse>('POST', '/audio/speakers/compare', req),
    music: (req) => client.request<V1MusicGenerationsResponse>('POST', '/audio/music', req),
  }
}
