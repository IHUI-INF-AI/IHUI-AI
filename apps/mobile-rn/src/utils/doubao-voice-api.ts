/**
 * doubao-voice-api — 纯 API 调用已下沉到 @ihui/api-client,本文件仅做 re-export。
 *
 * 平台特定逻辑(如 voiceChatByFile 需读取本地音频文件为 base64)由调用方
 * 自行实现:调 sendVoiceMessage 前先把文件读取为 base64。
 * 各端文件读取 API 不同(RN: expo-file-system / Taro: Taro.readFile),故不下沉。
 */
export { sendVoiceMessage, textToSpeech, speechToText, getVoiceModels } from '@ihui/api-client'
export type { VoiceChatResult, TtsResult } from '@ihui/api-client'
