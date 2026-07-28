import Taro from '@tarojs/taro'
import { post } from './api-bridge'
import { arrayBufferToBase64 } from '@ihui/shared/utils/base64'

export interface RecognizerConfig {
  apiUrl?: string
  sampleRate?: number
  format?: string
  language?: string
}

export type RecognitionEventType = 'partial' | 'final' | 'error'

type ResultCallback = (text: string) => void
type ErrorCallback = (message: string) => void

class StreamingRecognizer {
  private config: Required<RecognizerConfig> = {
    apiUrl: '/ai-audio/asr/stream',
    sampleRate: 16000,
    format: 'pcm',
    language: 'zh-CN',
  }

  private recorderManager: Taro.RecorderManager | null = null
  private isRecording = false
  private recognitionResult = ''
  private tempFilePath = ''

  private onPartialResult: ResultCallback | null = null
  private onFinalResult: ResultCallback | null = null
  private onError: ErrorCallback | null = null

  init(config?: RecognizerConfig): void {
    if (config) this.config = { ...this.config, ...config }
    this.recorderManager = Taro.getRecorderManager()
    this.recorderManager.onStop((res) => {
      this.tempFilePath = res.tempFilePath
      this.isRecording = false
      this.finalizeRecognition()
    })
    this.recorderManager.onError((err) => {
      this.isRecording = false
      this.onError?.(err.errMsg || '录音错误')
    })
    this.recorderManager.onFrameRecorded?.((res) => {
      if (this.isRecording && res.frameBuffer) {
        this.sendFrame(res.frameBuffer)
      }
    })
  }

  private async sendFrame(frameBuffer: ArrayBuffer): Promise<void> {
    try {
      const res = await post<{ text?: string }>(this.config.apiUrl, {
        frame: arrayBufferToBase64(frameBuffer),
      })
      if (res?.text) {
        this.onPartialResult?.(res.text)
      }
    } catch {
      // 流式帧发送失败忽略，继续后续帧
    }
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

  private async finalizeRecognition(): Promise<void> {
    if (!this.tempFilePath) return
    try {
      const res = await post<{ text?: string }>(this.config.apiUrl, {
        filePath: this.tempFilePath,
        action: 'finish',
      })
      if (res?.text) {
        this.recognitionResult = res.text
        this.onFinalResult?.(res.text)
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
    if (event === 'partial') this.onPartialResult = callback as ResultCallback
    else if (event === 'final') this.onFinalResult = callback as ResultCallback
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
