import { t } from '@/utils/i18n'

/**
 * OpenClaw Voice System
 * 
 * 语音功能模块:
 * - Voice Wake: 语音唤醒 (macOS/iOS/Android)
 * - Talk Mode: 对话模式
 * - TTS: 文本转语音 (ElevenLabs)
 * - STT: 语音转文本 (Web Speech API)
 * 
 * 参考: https://docs.clawd.bot/tts
 */

 

// Web Speech API 类型声明
 
type SpeechRecognitionType = any
 
type SpeechRecognitionConstructor = any

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
  }
}

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * 语音配置
 */
export interface VoiceConfig {
  /** 是否启用语音唤醒 */
  wakeEnabled?: boolean
  /** 唤醒词 */
  wakeWord?: string
  /** 语言 */
  language?: string
  /** TTS 提供商 */
  ttsProvider?: 'browser' | 'elevenlabs' | 'azure' | 'google'
  /** ElevenLabs API Key */
  elevenLabsApiKey?: string
  /** ElevenLabs Voice ID */
  elevenLabsVoiceId?: string
  /** 语速 */
  speechRate?: number
  /** 音调 */
  pitch?: number
  /** 音量 */
  volume?: number
  /** 自动播放回复 */
  autoPlayResponse?: boolean
  /** 打断播放 */
  interruptOnSpeech?: boolean
}

/**
 * 语音状态
 */
export interface VoiceStatus {
  /** 是否正在监听 */
  isListening: boolean
  /** 是否正在说话 */
  isSpeaking: boolean
  /** 是否已唤醒 */
  isAwake: boolean
  /** 当前转录文本 */
  transcript: string
  /** 语音活动级别 */
  volumeLevel: number
  /** 错误信息 */
  error: string | null
}

/**
 * 语音事件
 */
export interface VoiceEvents {
  /** 唤醒事件 */
  wake: { timestamp: number }
  /** 语音识别结果 */
  transcript: { text: string; isFinal: boolean }
  /** 语音合成完成 */
  speechEnd: { text: string }
  /** 错误事件 */
  error: { error: Error; context: string }
  /** 静音检测 */
  silence: { duration: number }
}

/**
 * ElevenLabs 语音选项
 */
export interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: string
  labels: Record<string, string>
  preview_url?: string
}

/**
 * 语音管理器
 */
export class VoiceManager extends EventEmitter {
  private config: Required<VoiceConfig>
  private status = reactive<VoiceStatus>({
    isListening: false,
    isSpeaking: false,
    isAwake: false,
    transcript: '',
    volumeLevel: 0,
    error: null,
  })

  // Web Speech API
  private recognition: SpeechRecognitionType | null = null
  private synthesis: SpeechSynthesis | null = null
  
  // Audio context for volume analysis
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private microphone: MediaStreamAudioSourceNode | null = null
  private mediaStream: MediaStream | null = null
  
  // 状态
  private initialized = ref(false)
  private wakeWordDetected = ref(false)
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private audioQueue: Array<{ text: string; priority: number }> = []
  private isProcessingQueue = false

  constructor(config: VoiceConfig = {}) {
    super()
    this.config = {
      wakeEnabled: config.wakeEnabled ?? false,
      wakeWord: config.wakeWord || '你好助手',
      language: config.language || 'zh-CN',
      ttsProvider: config.ttsProvider || 'browser',
      elevenLabsApiKey: config.elevenLabsApiKey || '',
      elevenLabsVoiceId: config.elevenLabsVoiceId || 'EXAVITQu4vr4xnSDxMaL', // 默认 Sarah 语音
      speechRate: config.speechRate ?? 1.0,
      pitch: config.pitch ?? 1.0,
      volume: config.volume ?? 1.0,
      autoPlayResponse: config.autoPlayResponse ?? true,
      interruptOnSpeech: config.interruptOnSpeech ?? true,
    }
  }

  /**
   * 初始化语音系统
   */
  async initialize(): Promise<boolean> {
    if (this.initialized.value) return true

    logger.info('[Voice] Initializing voice system...')

    try {
      // 检查浏览器支持
      if (!this.checkBrowserSupport()) {
        throw new Error(t('error.index.浏览器不支持语音'))
      }

      // 初始化语音识别
      await this.initializeSpeechRecognition()

      // 初始化语音合成
      this.initializeSpeechSynthesis()

      // 初始化音频分析
      await this.initializeAudioAnalysis()

      this.initialized.value = true
      logger.info('[Voice] Voice system initialized')

      return true
    } catch (error) {
      logger.error('[Voice] Initialization failed:', error)
      this.status.error = (error as Error).message
      return false
    }
  }

  /**
   * 检查浏览器支持
   */
  private checkBrowserSupport(): boolean {
    const hasRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    const hasSynthesis = 'speechSynthesis' in window
    const hasMediaDevices = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices

    logger.info(`[Voice] Browser support: recognition=${hasRecognition}, synthesis=${hasSynthesis}, media=${hasMediaDevices}`)

    return hasRecognition && hasSynthesis
  }

  /**
   * 初始化语音识别
   */
  private async initializeSpeechRecognition(): Promise<void> {
     
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    
    this.recognition = new SpeechRecognitionClass()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = this.config.language

     
    this.recognition.onresult = (event: any) => {
      let transcript = ''
      let isFinal = false

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
        if (event.results[i].isFinal) {
          isFinal = true
        }
      }

      this.status.transcript = transcript

      // 检查唤醒词
      if (this.config.wakeEnabled && !this.wakeWordDetected.value) {
        if (transcript.toLowerCase().includes(this.config.wakeWord.toLowerCase())) {
          this.wakeWordDetected.value = true
          this.status.isAwake = true
          this.emit('wake', { timestamp: Date.now() })
          logger.info('[Voice] Wake word detected')
        }
      }

      this.emit('transcript', { text: transcript, isFinal })

      // 重置静音计时器
      this.resetSilenceTimer()
    }

     
    this.recognition.onerror = (event: any) => {
      logger.error('[Voice] Speech recognition error:', event.error)
      this.status.error = event.error
      this.emit('error', { error: new Error(event.error), context: 'recognition' })
    }

    this.recognition.onend = () => {
      logger.debug('[Voice] Speech recognition ended')
      if (this.status.isListening) {
        // 自动重启
        try {
          this.recognition?.start()
        } catch (e) {
          logger.warn('[Voice] Failed to restart speech recognition:', e)
        }
      }
    }
  }

  /**
   * 初始化语音合成
   */
  private initializeSpeechSynthesis(): void {
    this.synthesis = window.speechSynthesis
  }

  /**
   * 初始化音频分析
   */
  private async initializeAudioAnalysis(): Promise<void> {
    try {
      this.audioContext = new AudioContext()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256

      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.microphone.connect(this.analyser)

      // 开始分析音量
      this.startVolumeAnalysis()
    } catch (error) {
      logger.warn('[Voice] Audio analysis initialization failed:', error)
    }
  }

  /**
   * 开始音量分析
   */
  private startVolumeAnalysis(): void {
    if (!this.analyser) return

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    const analyze = () => {
      if (!this.analyser || !this.initialized.value) return

      this.analyser.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      this.status.volumeLevel = average / 255

      requestAnimationFrame(analyze)
    }

    analyze()
  }

  /**
   * 重置静音计时器
   */
  private resetSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
    }

    this.silenceTimer = setTimeout(() => {
      this.emit('silence', { duration: 3000 })
    }, 3000)
  }

  /**
   * 开始监听
   */
  startListening(): void {
    if (!this.initialized.value || !this.recognition) {
      logger.warn('[Voice] Voice system not initialized')
      return
    }

    try {
      this.recognition.start()
      this.status.isListening = true
      this.status.error = null
      logger.info('[Voice] Start listening')
    } catch (error) {
      logger.error('[Voice] Start listening failed:', error)
    }
  }

  /**
   * 停止监听
   */
  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop()
      this.status.isListening = false
      logger.info('[Voice] Stop listening')
    }
  }

  /**
   * 语音合成 - 朗读文本
   */
  async speak(text: string, options: { priority?: number; voice?: string } = {}): Promise<void> {
    const { priority = 1 } = options

    // 添加到队列
    this.audioQueue.push({ text, priority })
    this.audioQueue.sort((a, b) => b.priority - a.priority)

    // 如果正在说话且允许打断
    if (this.status.isSpeaking && this.config.interruptOnSpeech && priority > 1) {
      this.stopSpeaking()
    }

    // 处理队列
    await this.processAudioQueue()
  }

  /**
   * 处理音频队列
   */
  private async processAudioQueue(): Promise<void> {
    if (this.isProcessingQueue || this.audioQueue.length === 0) return

    this.isProcessingQueue = true

    while (this.audioQueue.length > 0) {
      const item = this.audioQueue.shift()
      if (!item) break

      await this.performSpeak(item.text)
    }

    this.isProcessingQueue = false
  }

  /**
   * 执行语音合成
   */
  private async performSpeak(text: string): Promise<void> {
    this.status.isSpeaking = true

    try {
      if (this.config.ttsProvider === 'elevenlabs' && this.config.elevenLabsApiKey) {
        await this.speakWithElevenLabs(text)
      } else {
        await this.speakWithBrowser(text)
      }
    } catch (error) {
      logger.error('[Voice] Speech synthesis failed:', error)
      this.emit('error', { error: error as Error, context: 'synthesis' })
    } finally {
      this.status.isSpeaking = false
      this.emit('speechEnd', { text })
    }
  }

  /**
   * 使用浏览器 TTS
   */
  private speakWithBrowser(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('语音合成不可用'))
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = this.config.language
      utterance.rate = this.config.speechRate
      utterance.pitch = this.config.pitch
      utterance.volume = this.config.volume

      // 选择中文语音
      const voices = this.synthesis.getVoices()
      const chineseVoice = voices.find(v => v.lang.startsWith('zh'))
      if (chineseVoice) {
        utterance.voice = chineseVoice
      }

      utterance.onend = () => resolve()
      utterance.onerror = (event) => reject(new Error(event.error))

      this.synthesis.speak(utterance)
    })
  }

  /**
   * 使用 ElevenLabs TTS
   */
  private async speakWithElevenLabs(text: string): Promise<void> {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.config.elevenLabsVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.config.elevenLabsApiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`ElevenLabs API 错误: ${response.status}`)
    }

    const audioBlob = await response.blob()
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)
    audio.volume = this.config.volume

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        resolve()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        reject(new Error('音频播放失败'))
      }
      void audio.play()
    })
  }

  /**
   * 停止说话
   */
  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel()
    }
    this.status.isSpeaking = false
    this.audioQueue = []
  }

  /**
   * 获取可用语音列表
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synthesis?.getVoices() || []
  }

  /**
   * 获取 ElevenLabs 语音列表
   */
  async getElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.config.elevenLabsApiKey) {
      return []
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': this.config.elevenLabsApiKey,
        },
      })

      if (!response.ok) {
        throw new Error(`API 错误: ${response.status}`)
      }

      const data = await response.json()
      return data.voices || []
    } catch (error) {
      logger.error('[Voice] Failed to get ElevenLabs voice list:', error)
      return []
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VoiceConfig>): void {
    Object.assign(this.config, config)
    
    // 更新语音识别语言
    if (config.language && this.recognition) {
      this.recognition.lang = config.language
    }

    logger.info('[Voice] Configuration updated')
  }

  /**
   * 获取状态
   */
  getStatus(): VoiceStatus {
    return { ...this.status }
  }

  /**
   * 重置唤醒状态
   */
  resetWake(): void {
    this.wakeWordDetected.value = false
    this.status.isAwake = false
  }

  /**
   * 进入对话模式
   */
  enterTalkMode(): void {
    this.status.isAwake = true
    this.wakeWordDetected.value = true
    this.startListening()
    logger.info('[Voice] Enter dialogue mode')
  }

  /**
   * 退出对话模式
   */
  exitTalkMode(): void {
    this.stopListening()
    this.stopSpeaking()
    this.resetWake()
    logger.info('[Voice] Exit dialogue mode')
  }

  /**
   * 关闭语音系统
   */
  shutdown(): void {
    this.stopListening()
    this.stopSpeaking()

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
    }

    if (this.audioContext) {
      void this.audioContext.close()
    }

    this.initialized.value = false
    logger.info('[Voice] Voice system shut down')
  }
}

// 单例实例
let voiceManagerInstance: VoiceManager | null = null

/**
 * 获取语音管理器实例
 */
export function getVoiceManager(config?: VoiceConfig): VoiceManager {
  if (!voiceManagerInstance) {
    voiceManagerInstance = new VoiceManager(config)
  }
  return voiceManagerInstance
}

export default VoiceManager
