/**
 * doubao-voice-api — 纯 API 调用已下沉到 @ihui/api-client,本文件仅做 re-export。
 *
 * 平台特定逻辑(如 voiceChatByFile 需读取本地音频文件为 base64)保留在本端:
 * 各端文件读取 API 不同(RN: expo-file-system / Taro: Taro.readFile),故不下沉。
 *
 * 注意:@ihui/api-client 的 sendVoiceMessage 等返回 Promise<ApiResult<T>>,
 * voiceChatByFile 通过 unwrapApi 解包为 Promise<T>,保持原签名向后兼容。
 */
import { sendVoiceMessage } from '@ihui/api-client'
import type { VoiceChatResult } from '@ihui/api-client'
import { readFileToBase64 } from './file-utils'
import { unwrapApi } from './api-bridge'

export { sendVoiceMessage, textToSpeech, speechToText, getVoiceModels } from '@ihui/api-client'
export type { VoiceChatResult, TtsResult } from '@ihui/api-client'

export async function voiceToBase64(filePath: string): Promise<string> {
  return readFileToBase64(filePath)
}

export async function voiceChatByFile(filePath: string): Promise<VoiceChatResult> {
  const base64 = await voiceToBase64(filePath)
  return unwrapApi(sendVoiceMessage(base64))
}
