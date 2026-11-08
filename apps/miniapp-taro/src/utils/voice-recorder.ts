// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D43/G-51 会话内快捷笔记 — 小程序端豁免标注(平台独占:录音 API 差异):
 * Taro.getRecorderManager 的授权模型与生命周期和 web MediaRecorder 不同,12 相状态机的
 * 权限/中断/后台回收语义在本端无从逐相映射 ⇒ 本端不做语音笔记 UI,票面以登记行为准,
 * 不得当成漏做。归档/检索/插入闭环的端上承载 = web(message-input)+ RN(chat/VoiceNote)。
 */
import Taro from '@tarojs/taro'

export type RecordOptions = Partial<Taro.RecorderManager.StartOption>

const DEFAULT_OPTIONS: Taro.RecorderManager.StartOption = {
  duration: 60000,
  sampleRate: 16000,
  numberOfChannels: 1,
  encodeBitRate: 96000,
  format: 'mp3',
  frameSize: 50,
}

/** onStop 回调不可靠时的兜底等待上限(以回调为准,此值只防回调彻底丢失) */
const STOP_FALLBACK_MS = 5000

class VoiceRecorder {
  private recorderManager: Taro.RecorderManager | null = null
  private innerAudioContext: Taro.InnerAudioContext | null = null
  private isRecording = false
  private tempFilePath = ''
  /** 本次录音是否已被用户取消(由下一次 onStop/onError 消费,避免迟到回调写回旧路径) */
  private discarded = false
  private pendingStop: ((path: string) => void) | null = null
  private stopTimer: ReturnType<typeof setTimeout> | null = null

  init(): void {
    // 幂等:录音管理器是全局单例,重复 init 会累积 onStop/onError 回调与音频上下文
    if (this.recorderManager) return
    this.recorderManager = Taro.getRecorderManager()

    this.recorderManager.onStop((res) => {
      const path = this.discarded ? '' : res.tempFilePath
      this.discarded = false
      this.tempFilePath = path
      this.isRecording = false
      this.settleStop(path)
    })
    this.recorderManager.onError(() => {
      this.discarded = false
      this.isRecording = false
      this.settleStop('')
    })
  }

  private settleStop(path: string): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
      this.stopTimer = null
    }
    const resolve = this.pendingStop
    this.pendingStop = null
    resolve?.(path)
  }

  startRecording(options: RecordOptions = {}): void {
    if (this.isRecording || !this.recorderManager) return
    this.tempFilePath = ''
    this.isRecording = true
    this.recorderManager.start({ ...DEFAULT_OPTIONS, ...options })
  }

  stopRecording(): Promise<string> {
    if (!this.isRecording || !this.recorderManager) return Promise.resolve('')
    return new Promise((resolve) => {
      this.pendingStop = resolve
      // 以 onStop 真回调为准;旧实现用固定 500ms 赌回调已到,慢机型会 resolve 空路径丢音
      this.stopTimer = setTimeout(() => this.settleStop(''), STOP_FALLBACK_MS)
      this.recorderManager?.stop()
    })
  }

  cancelRecording(): void {
    if (!this.isRecording || !this.recorderManager) return
    this.discarded = true
    this.isRecording = false
    this.tempFilePath = ''
    this.recorderManager.stop()
    this.settleStop('')
  }

  playRecording(filePath?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 播放能力当前无端内消费方;上下文按需创建,避免每次 init 都占一个小程序音频实例
      if (!this.innerAudioContext) {
        this.innerAudioContext = Taro.createInnerAudioContext()
        this.innerAudioContext.autoplay = false
      }
      this.innerAudioContext.src = filePath || this.tempFilePath
      this.innerAudioContext.play()
      this.innerAudioContext.onEnded(() => resolve())
      this.innerAudioContext.onError((err) => reject(err))
    })
  }

  stopPlayback(): void {
    this.innerAudioContext?.stop()
  }

  getIsRecording(): boolean {
    return this.isRecording
  }

  getTempFilePath(): string {
    return this.tempFilePath
  }
}

const voiceRecorder = new VoiceRecorder()
export default voiceRecorder
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
