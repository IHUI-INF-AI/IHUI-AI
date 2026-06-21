/**
 * 语音识别类型定义
 */

// 语音识别错误类型
export class SpeechRecognitionError extends Error {
  suggestion?: string
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'SpeechRecognitionError'
  }
}

// 语音识别提供商
export enum SpeechProvider {
  WEBKIT = 'webkit',
  MOZ = 'moz',
  STANDARD = 'standard',
  BAIDU = 'baidu',
  WHISPER = 'whisper',
  WEB_SPEECH = 'webSpeech'
}

// 语音识别回调
export interface SpeechRecognitionCallbacks {
  onResult?: (text: string, isFinal: boolean) => void
  onError?: (error: SpeechRecognitionError) => void
  onStart?: () => void
  onEnd?: () => void
  onVolumeChange?: (volume: number) => void
  onStatusChange?: (status: string) => void
}

// 提供商状态
export interface ProviderStatus {
  available: boolean
  name: string
}

// 语音配置
export interface SpeechConfig {
  lang?: string
  continuous?: boolean
  provider?: SpeechProvider
  baidu?: {
    appId: string
    apiKey: string
    secretKey?: string
  }
  whisper?: {
    apiKey: string
    mode?: string
    modelSize?: string
    apiEndpoint?: string
    language?: string
  }
  webSpeech?: {
    lang: string
  }
}
