import Taro from '@tarojs/taro'
import { voiceSttFromTaro } from '@ihui/api-client'

/**
 * 流式语音识别器(miniapp-taro)。
 *
 * 2026-07-28 改:从豆包付费 ASR(/ai-audio/asr/stream)迁移到
 * ai-service faster-whisper 本地推理(/api/voice/stt),零成本。
 *
 * 实现策略:录音用 Taro.RecorderManager(原生),停止后整段上传到
 * ai-service 转写(非流式)。原流式帧上传已废弃(豆包 API 付费 + 复杂)。
 */
export interface RecognizerConfig {
  /** ai-service 基础 URL(默认 http://localhost:8803) */
  aiServiceUrl?: string
  sampleRate?: number
  format?: string
  language?: string
}

export type RecognitionEventType = 'partial' | 'final' | 'error'

type ResultCallback = (text: string) => void
type ErrorCallback = (message: string) => void

class StreamingRecognizer {
  private config: Required<RecognizerConfig> = {
    aiServiceUrl: 'http://localhost:8803',
    sampleRate: 16000,
    format: 'mp3',
    language: 'zh',
  }

  private recorderManager: Taro.RecorderManager | null = null
  private isRecording = false
  private recognitionResult = ''
  private tempFilePath = ''

  private onFinalResult: ResultCallback | null = null
  private onError: ErrorCallback | null = null

  init(config?: RecognizerConfig): void {
    if (config) this.config = { ...this.config, ...config }
    this.recorderManager = Taro.getRecorderManager()
    this.recorderManager.onStop((res) => {
      this.tempFilePath = res.tempFilePath
      this.isRecording = false
      void this.finalizeRecognition()
    })
    this.recorderManager.onError((err) => {
      this.isRecording = false
      this.onError?.(err.errMsg || '录音错误')
    })
    // 流式帧上传已废弃(2026-07-28 改用整段上传 + faster-whisper 本地推理)
  }

  startRecognizing(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRecording) {
        reject(new Error('正在录音中'))
        return
      }
      if (!this.recorderManager) this.init()
      this.recognitionResult = ''
      this.isRecording = true
      this.recorderManager?.start({
        duration: 600000,
        sampleRate: this.config.sampleRate as keyof Taro.RecorderManager.SampleRate,
        numberOfChannels: 1,
        encodeBitRate: 24000,
        format: this.config.format as keyof Taro.RecorderManager.Format,
        frameSize: 20,
      })
      resolve()
    })
  }

  stopRecognizing(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.isRecording) {
        resolve(this.recognitionResult)
        return
      }
      this.recorderManager?.stop()
      setTimeout(() => resolve(this.recognitionResult), 500)
    })
  }

  /**
   * 录音停止后:整段上传到 ai-service /api/voice/stt 转写。
   * 用 packages/api-client 的 voiceSttFromTaro 跨端共用封装。
   */
  private async finalizeRecognition(): Promise<void> {
    if (!this.tempFilePath) return
    try {
      const text = await voiceSttFromTaro(this.tempFilePath, {
        language: this.config.language,
        aiServiceUrl: this.config.aiServiceUrl,
      })
      if (text) {
        this.recognitionResult = text
        this.onFinalResult?.(text)
      }
    } catch {
      this.onError?.('识别失败')
    }
  }

  cancel(): void {
    if (this.isRecording && this.recorderManager) {
      this.recorderManager.stop()
      this.isRecording = false
    }
    this.recognitionResult = ''
    this.tempFilePath = ''
  }

  on(event: RecognitionEventType, callback: ResultCallback | ErrorCallback): void {
    // 'partial' 事件已废弃(流式帧上传已移除),保留参数兼容但不存储回调
    if (event === 'final') this.onFinalResult = callback as ResultCallback
    else if (event === 'error') this.onError = callback as ErrorCallback
  }

  getIsRecording(): boolean {
    return this.isRecording
  }

  getResult(): string {
    return this.recognitionResult
  }
}

const streamingRecognizer = new StreamingRecognizer()
export default streamingRecognizer
