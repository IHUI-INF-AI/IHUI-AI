// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { t } from '@/i18n'
import Taro from '@tarojs/taro'
import { voiceSttFromTaro } from '@ihui/api-client/endpoints/voice-stt.taro'
import { getToken } from './auth'
// ai-service 地址统一从 api-config 取(支持 TARO_APP_AI_SERVICE_BASE 覆盖),
// 不再在本文件抄第二份 localhost:8803 默认值 —— 真机必须能改,硬编码等于永远连不上。
import { AI_SERVICE_BASE_URL } from './api-config'

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

/**
 * 一次录音会话。Taro 的 onStop 只带音频结果、不带会话标识,所以用会话对象 +
 * `pendingStopIds` 队列把"这次 stop 属于哪次录音"钉死:cancel/卸载后再到达的
 * onStop 匹配不到有效会话,既不发起上传,也不回填文字。
 */
interface RecognitionSession {
  readonly id: number
  cancelled: boolean
  finalizing: boolean
}

export class StreamingRecognizer {
  private config: Required<RecognizerConfig> = {
    aiServiceUrl: AI_SERVICE_BASE_URL,
    sampleRate: 16000,
    format: 'mp3',
    language: 'zh',
  }

  private recorderManager: Taro.RecorderManager | null = null
  private isRecording = false
  private recognitionResult = ''
  private tempFilePath = ''

  private session: RecognitionSession | null = null
  private nextSessionId = 1
  /** 已请求 stop、尚未收到 onStop 的会话 id(按调用顺序;onStop 无法自带会话标识) */
  private pendingStopIds: number[] = []

  private onFinalResult: ResultCallback | null = null
  private onError: ErrorCallback | null = null

  init(config?: RecognizerConfig): void {
    if (config) this.configure(config)
    // 重复 init 只更新配置,不重复注册录音回调(否则一次 stop 会被多个 handler 消费)
    if (this.recorderManager) return
    this.recorderManager = Taro.getRecorderManager()
    this.recorderManager.onStop((res) => this.handleStop(res.tempFilePath))
    this.recorderManager.onError((err) => {
      this.isRecording = false
      this.session = null
      this.onError?.(err.errMsg || t('utilsStreamingrecognizer.q1'))
    })
    // 流式帧上传已废弃(2026-07-28 改用整段上传 + faster-whisper 本地推理)
  }

  /**
   * 平台统一入口别名(2026-11-04):VoiceInput.tsx 与 RN/桌面端一样调用 configure(),
   * 命名对齐消除 typecheck TS2339。上游委托 init(),但 init 会重挂 onStop/onError
   * (重复注册),故此处只合并配置、不重挂录音回调 —— 供调用方在 prop 变化时透传。
   */
  configure(config?: Partial<RecognizerConfig>): void {
    if (!config) return
    // undefined 键不覆盖内置默认值(VoiceInput 的 prop 缺省时传的就是 undefined)
    this.config = {
      aiServiceUrl: config.aiServiceUrl ?? this.config.aiServiceUrl,
      sampleRate: config.sampleRate ?? this.config.sampleRate,
      format: config.format ?? this.config.format,
      language: config.language ?? this.config.language,
    }
  }

  /**
   * 录音停止:先确认这次 onStop 属于哪个会话。
   * - 显式 stop/cancel:必须与 `pendingStopIds` 队首一致;
   * - 无对应 stop 请求 = 录音时长上限触发的自动停止,只认当前仍在录的会话;
   * - 取消/卸载后晚到的 onStop:会话已作废 ⇒ 直接丢弃。
   */
  private handleStop(tempFilePath: string): void {
    const session = this.session
    const stoppedSessionId = this.pendingStopIds.shift()

    let target: RecognitionSession | null = null
    if (stoppedSessionId === undefined) {
      // 录音时长上限触发的自动停止:只认当前仍在录的会话
      if (session && !session.cancelled && !session.finalizing) target = session
    } else if (session && session.id === stoppedSessionId && !session.cancelled) {
      target = session
    }
    // 晚到的 onStop(已取消/已卸载/已被新会话取代)⇒ 丢弃,且不得改动当前会话状态
    if (!target) return

    this.isRecording = false
    target.finalizing = true
    this.tempFilePath = tempFilePath
    void this.finalizeRecognition(target)
  }

  startRecognizing(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRecording) {
        reject(new Error('正在录音中'))
        return
      }
      if (!this.recorderManager) this.init()
      this.session = { id: this.nextSessionId++, cancelled: false, finalizing: false }
      this.recognitionResult = ''
      this.tempFilePath = ''
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
      const session = this.session
      if (!this.isRecording || !session) {
        resolve(this.recognitionResult)
        return
      }
      if (!this.pendingStopIds.includes(session.id)) {
        this.pendingStopIds.push(session.id)
        this.recorderManager?.stop()
      }
      setTimeout(() => resolve(this.recognitionResult), 500)
    })
  }

  /**
   * 录音停止后:整段上传到 ai-service /api/voice/stt 转写。
   * 用 packages/api-client 的 voiceSttFromTaro 跨端共用封装。
   *
   * 上传前与上传后都复核会话:取消/卸载(会话已作废)或已被新会话取代时,
   * 既不再发请求,也不把晚到的文本回填给调用方。
   */
  private async finalizeRecognition(session: RecognitionSession): Promise<void> {
    if (!this.tempFilePath) {
      if (this.session === session) this.session = null
      return
    }
    try {
      const text = await voiceSttFromTaro(this.tempFilePath, {
        language: this.config.language,
        aiServiceUrl: this.config.aiServiceUrl,
        // ai-service JWT 鉴权:必须携带 Bearer token(2026-08-31 修复)
        token: getToken() || undefined,
      })
      if (session.cancelled || this.session !== session) return
      if (text) {
        this.recognitionResult = text
        this.onFinalResult?.(text)
      }
    } catch {
      if (!session.cancelled && this.session === session) {
        this.onError?.(t('utilsStreamingrecognizer.q1'))
      }
    } finally {
      if (this.session === session) this.session = null
    }
  }

  cancel(): void {
    const session = this.session
    if (session) {
      session.cancelled = true
      if (this.isRecording && !this.pendingStopIds.includes(session.id)) {
        this.pendingStopIds.push(session.id)
        this.recorderManager?.stop()
      }
    }
    this.session = null
    this.isRecording = false
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
