import { t } from '@/utils/i18n'

import { logger } from '@/utils/logger'

/**
 * 语音识别工具
 * 使用Web Speech API进行语音转文字
 */

// 语音识别类型定义
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
  onend: (() => void) | null
  onstart: (() => void) | null
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionOptions {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
}

export interface SpeechRecognitionCallbacks {
  onResult?: (text: string, isFinal: boolean) => void
  onError?: (error: string) => void
  onStart?: () => void
  onEnd?: (finalText?: string) => void
}

class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null
  private isSupported: boolean = false
  private currentCallbacks: SpeechRecognitionCallbacks = {} // 保存当前的回调函数
  private isUserStopped: boolean = false // 保存用户停止标志
  private accumulatedText: string = '' // 累积的识别文本（包括临时和最终结果）

  constructor() {
    // 检查浏览器支持
    const SpeechRecognition =
      (typeof window !== 'undefined'
        ? (
            window as {
              SpeechRecognition?: { new (): SpeechRecognition }
              webkitSpeechRecognition?: { new (): SpeechRecognition }
            }
          ).SpeechRecognition
        : undefined) ||
      (typeof window !== 'undefined'
        ? (
            window as {
              SpeechRecognition?: { new (): SpeechRecognition }
              webkitSpeechRecognition?: { new (): SpeechRecognition }
            }
          ).webkitSpeechRecognition
        : undefined)

    if (SpeechRecognition) {
      this.isSupported = true
      this.recognition = new SpeechRecognition()
      this.setupDefaultOptions()
      this.setupEventListeners()
    }
  }

  private setupDefaultOptions() {
    if (!this.recognition) return

    // 设置默认选项
    this.recognition.lang = 'zh-CN' // 默认中文
    this.recognition.continuous = true // 连续识别
    this.recognition.interimResults = true // 返回临时结果
    this.recognition.maxAlternatives = 1
  }

  private setupEventListeners() {
    if (!this.recognition) return

    // 设置事件监听器（只设置一次，不每次重新设置）
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
          // 累积最终结果
          this.accumulatedText += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      // 回调临时结果
      if (interimTranscript && this.currentCallbacks.onResult) {
        this.currentCallbacks.onResult(interimTranscript, false)
      }

      // 回调最终结果
      if (finalTranscript && this.currentCallbacks.onResult) {
        this.currentCallbacks.onResult(finalTranscript.trim(), true)
      }
    }

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = '语音识别错误'
      switch (event.error) {
        case 'no-speech':
          errorMessage = '未检测到语音，请重试'
          break
        case 'audio-capture':
          errorMessage = '未检测到麦克风'
          break
        case 'not-allowed':
          errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许访问'
          break
        case 'network':
          errorMessage = '网络错误，请检查网络连接'
          break
        case 'aborted':
          errorMessage = '语音识别已中止'
          break
        default:
          errorMessage = `语音识别错误: ${event.error}`
      }

      if (this.currentCallbacks.onError) {
        this.currentCallbacks.onError(errorMessage)
      }
    }

    this.recognition.onstart = () => {
      this.isUserStopped = false // 重置用户停止标志
      if (this.currentCallbacks.onStart) {
        this.currentCallbacks.onStart()
      }
    }

    this.recognition.onend = () => {
      // 在 continuous 模式下，onEnd 会在识别暂停时触发，但 API 会自动重启
      // 只有在用户主动停止（isUserStopped）时才触发 onEnd 回调
      // 如果用户没有停止，API 会自动重启，我们不应该触发 onEnd 回调
      logger.info(
        '[SpeechRecognitionService] onEnd triggered, isUserStopped:',
        this.isUserStopped,
        'continuous:',
        this.recognition?.continuous
      )

      // 关键：只有在用户主动停止时才触发 onEnd 回调
      // 在 continuous 模式下，如果用户没有停止，API 会自动重启，onStart 会被触发
      // 我们不应该触发 onEnd 回调，因为录音实际上还在继续
      if (this.isUserStopped && this.currentCallbacks.onEnd) {
        logger.info('[SpeechRecognitionService] User stopped, triggering onEnd callback')
        // 在 onEnd 时，传递累积的识别文本
        // 注意：Web Speech API 在 stop() 后，onresult 可能还会被调用一次
        // 所以我们在 onEnd 时传递累积文本，确保获取所有识别结果
        const finalText = this.accumulatedText.trim()
        logger.info('[SpeechRecognitionService] Final accumulated text:', finalText)
        this.currentCallbacks.onEnd(finalText)
      } else {
        // 用户没有停止，在 continuous 模式下，API 会自动重启
        // 我们完全不触发 onEnd 回调
        logger.info(
          '[SpeechRecognitionService] User did not stop, API will auto-restart, skipping onEnd callback'
        )
      }
    }
  }

  /**
   * 检查浏览器是否支持语音识别
   */
  checkSupport(): boolean {
    return this.isSupported
  }

  /**
   * 获取支持的语音识别语言列表
   */
  getSupportedLanguages(): string[] {
    // 常见语言列表
    return [
      'zh-CN', // 中文（简体）
      'zh-TW', // 中文（繁体）
      'en-US', // 英语（美国）
      'en-GB', // 英语（英国）
      'ja-JP', // 日语
      'ko-KR', // 韩语
      'fr-FR', // 法语
      'de-DE', // 德语
      'es-ES', // 西班牙语
    ]
  }

  /**
   * 开始语音识别
   */
  start(
    options: SpeechRecognitionOptions = {},
    callbacks: SpeechRecognitionCallbacks = {}
  ): boolean {
    if (!this.isSupported || !this.recognition) {
      if (callbacks.onError) {
        callbacks.onError('浏览器不支持语音识别功能')
      }
      return false
    }

    try {
      // 保存当前的回调函数
      this.currentCallbacks = callbacks
      this.isUserStopped = false // 重置用户停止标志
      this.accumulatedText = '' // 重置累积文本

      // 配置选项
      if (options.lang) {
        this.recognition.lang = options.lang
      }
      if (options.continuous !== undefined) {
        this.recognition.continuous = options.continuous
      }
      if (options.interimResults !== undefined) {
        this.recognition.interimResults = options.interimResults
      }
      if (options.maxAlternatives !== undefined) {
        this.recognition.maxAlternatives = options.maxAlternatives
      }

      // 开始识别
      this.recognition.start()
      return true
    } catch (error: any) {
      if (callbacks.onError) {
        let errorMessage = error instanceof Error ? error.message : t('api.speech_recognition.启动语音识别失败')
        
        // 检测特定的错误消息并进行国际化处理
        if (errorMessage.includes('recognition has already started') || 
            errorMessage.includes('already started') ||
            errorMessage.includes('Failed to execute \'start\' on \'SpeechRecognition\'')) {
          // 返回一个标识，让调用方使用 i18n 翻译
          errorMessage = 'VOICE_RECOGNITION_ALREADY_STARTED'
        }
        
        callbacks.onError(errorMessage)
      }
      return false
    }
  }

  /**
   * 停止语音识别
   */
  stop(): void {
    if (this.recognition) {
      try {
        this.isUserStopped = true // 设置用户停止标志
        this.recognition.stop()
      } catch (_error) {
        // 忽略停止时的错误
      }
    }
  }

  /**
   * 获取累积的识别文本
   */
  getAccumulatedText(): string {
    return this.accumulatedText.trim()
  }

  /**
   * 中止语音识别
   */
  abort(): void {
    if (this.recognition) {
      try {
        this.isUserStopped = true // 设置用户停止标志
        this.recognition.abort()
      } catch (_error) {
        // 忽略中止时的错误
      }
    }
  }

  /**
   * 获取当前识别状态
   */
  isRunning(): boolean {
    // 通过检查recognition的状态来判断
    // 注意：这个实现可能不是100%准确，因为Web Speech API没有直接的状态属性
    return this.recognition !== null
  }
}

// 创建单例
export const speechRecognition = new SpeechRecognitionService()

/**
 * 便捷函数：开始语音识别
 */
export async function startSpeechRecognition(
  options: SpeechRecognitionOptions = {},
  callbacks: SpeechRecognitionCallbacks = {}
): Promise<boolean> {
  return speechRecognition.start(options, callbacks)
}

/**
 * 便捷函数：停止语音识别
 */
export function stopSpeechRecognition(): void {
  speechRecognition.stop()
}

/**
 * 便捷函数：获取累积的识别文本
 */
export function getAccumulatedText(): string {
  return speechRecognition.getAccumulatedText()
}

/**
 * 便捷函数：检查是否支持
 */
export function isSpeechRecognitionSupported(): boolean {
  return speechRecognition.checkSupport()
}
