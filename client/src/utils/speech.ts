/**
 * 语音识别工具
 * 提供语音识别相关功能
 */

import { logger } from './logger'

// SpeechRecognition 类型定义
interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onstart: (() => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

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
  WEB_SPEECH = 'webSpeech',
  IFLYTEK = 'iflytek'
}

// 语音服务配置
export interface SpeechServiceConfig {
  provider?: SpeechProvider
  lang?: string
  continuous?: boolean
  baidu?: {
    appId: string
    apiKey: string
    secretKey?: string
    endpoint?: string
    tokenEndpoint?: string
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
  iflytek?: {
    appId: string
    apiKey: string
    apiSecret?: string
  }
  fallbackOrder?: SpeechProvider[]
}

// 语音识别回调
export interface SpeechRecognitionCallbacks {
  onResult?: (text: string, isFinal: boolean) => void
  onError?: (error: SpeechRecognitionError) => void
  onStart?: () => void
  onEnd?: () => void
}

// 提供商状态
interface ProviderStatus {
  available: boolean
  name: string
}

// 获取语音识别构造函数
function getSpeechRecognitionConstructor(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null

  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
    mozSpeechRecognition?: new () => SpeechRecognition
  }

  if (win.SpeechRecognition) {
    return win.SpeechRecognition
  }
  if (win.webkitSpeechRecognition) {
    return win.webkitSpeechRecognition
  }
  if (win.mozSpeechRecognition) {
    return win.mozSpeechRecognition
  }
  return null
}

// 检查是否支持语音识别
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null
}

// 累积的文本
let accumulatedText = ''

// 当前识别实例
let currentRecognition: SpeechRecognition | null = null

// 当前提供商
let currentProvider: SpeechProvider = SpeechProvider.WEBKIT

// 提供商状态
const providerStatus: Record<SpeechProvider, ProviderStatus> = {
  [SpeechProvider.WEBKIT]: { available: typeof window !== 'undefined' && 'webkitSpeechRecognition' in window, name: 'WebKit' },
  [SpeechProvider.MOZ]: { available: typeof window !== 'undefined' && 'mozSpeechRecognition' in window, name: 'Mozilla' },
  [SpeechProvider.STANDARD]: { available: typeof window !== 'undefined' && 'SpeechRecognition' in window, name: 'Standard' },
  [SpeechProvider.BAIDU]: { available: false, name: 'Baidu' },
  [SpeechProvider.WHISPER]: { available: false, name: 'Whisper' },
  [SpeechProvider.WEB_SPEECH]: { available: typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window), name: 'Web Speech' },
  [SpeechProvider.IFLYTEK]: { available: false, name: 'iFlytek' },
}

// 开始语音识别
export function startSpeechRecognition(callbacks: SpeechRecognitionCallbacks = {}): void {
  const SpeechRecognitionConstructor = getSpeechRecognitionConstructor()

  if (!SpeechRecognitionConstructor) {
    const error = new SpeechRecognitionError('浏览器不支持语音识别', 'NOT_SUPPORTED')
    error.suggestion = '请使用支持 Web Speech API 的浏览器，如 Chrome、Edge 或 Safari'
    callbacks.onError?.(error)
    return
  }

  // 停止之前的识别
  stopSpeechRecognition()

  try {
    const recognition = new SpeechRecognitionConstructor()
    currentRecognition = recognition

    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => {
      accumulatedText = ''
      callbacks.onStart?.()
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript) {
        accumulatedText += finalTranscript
        callbacks.onResult?.(accumulatedText, true)
      } else if (interimTranscript) {
        callbacks.onResult?.(accumulatedText + interimTranscript, false)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const error = new SpeechRecognitionError(event.message || '语音识别错误', event.error)
      callbacks.onError?.(error)
    }

    recognition.onend = () => {
      callbacks.onEnd?.()
    }

    recognition.start()
  } catch (_error) {
    const speechError = new SpeechRecognitionError('启动语音识别失败', 'START_FAILED')
    speechError.suggestion = '请检查麦克风权限是否已授予'
    callbacks.onError?.(speechError)
  }
}

// 停止语音识别
export function stopSpeechRecognition(): void {
  if (currentRecognition) {
    currentRecognition.stop()
    currentRecognition = null
  }
}

// 获取提供商状态
export function getProviderStatus(): Record<SpeechProvider, ProviderStatus> {
  return { ...providerStatus }
}

// 获取当前提供商
export function getCurrentProvider(): SpeechProvider {
  return currentProvider
}

// 设置提供商
export function setProvider(provider: SpeechProvider): void {
  currentProvider = provider
}

// 获取最佳可用提供商
export function getBestAvailableProvider(): SpeechProvider {
  if (providerStatus[SpeechProvider.WEBKIT].available) {
    return SpeechProvider.WEBKIT
  }
  if (providerStatus[SpeechProvider.STANDARD].available) {
    return SpeechProvider.STANDARD
  }
  if (providerStatus[SpeechProvider.MOZ].available) {
    return SpeechProvider.MOZ
  }
  return SpeechProvider.WEB_SPEECH
}

// 语音服务管理器
export const speechManager = {
  getProviderStatus,
  getCurrentProvider,
  setProvider,
  getBestAvailableProvider,
  startRecognition: startSpeechRecognition,
  stopRecognition: stopSpeechRecognition,
}

// 配置语音服务
export function configureSpeechService(config: SpeechServiceConfig): void {
  if (config.provider) {
    currentProvider = config.provider
  }
  if (config.fallbackOrder) {
    // 保存降级顺序配置
    logger.info('[Speech] Configure fallback order:', config.fallbackOrder)
  }
}

// 获取累积的文本
export function getAccumulatedText(): string {
  return accumulatedText
}
