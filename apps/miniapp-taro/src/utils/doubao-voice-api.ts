import { post, get } from './request'
import { readFileToBase64 } from './file-utils'

export interface VoiceChatResult {
  reply: string
  audio?: string
  audioUrl?: string
}

export interface TtsResult {
  audio: string
  audioUrl?: string
}

export async function voiceToBase64(filePath: string): Promise<string> {
  return readFileToBase64(filePath)
}

export function sendVoiceMessage(audioBase64: string, format = 'mp3'): Promise<VoiceChatResult> {
  return post<VoiceChatResult>('/ai-audio/voice/chat', { audio: audioBase64, format })
}

export function textToSpeech(text: string, voice = 'default'): Promise<TtsResult> {
  return post<TtsResult>('/ai-audio/tts', { text, voice })
}

export function speechToText(audioBase64: string, format = 'mp3'): Promise<{ text: string }> {
  return post<{ text: string }>('/ai-audio/asr', { audio: audioBase64, format })
}

export function getVoiceModels(): Promise<{
  list: Array<{ id: string; name: string; desc: string }>
}> {
  return get('/ai-audio/models')
}

export async function voiceChatByFile(filePath: string): Promise<VoiceChatResult> {
  const base64 = await voiceToBase64(filePath)
  return sendVoiceMessage(base64)
}
