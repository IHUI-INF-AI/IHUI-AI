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

class VoiceRecorder {
  private recorderManager: Taro.RecorderManager | null = null
  private innerAudioContext: Taro.InnerAudioContext | null = null
  private isRecording = false
  private tempFilePath = ''

  init(): void {
    this.recorderManager = Taro.getRecorderManager()
    this.innerAudioContext = Taro.createInnerAudioContext()
    this.innerAudioContext.autoplay = false

    this.recorderManager.onStop((res) => {
      this.tempFilePath = res.tempFilePath
      this.isRecording = false
    })
    this.recorderManager.onError(() => {
      this.isRecording = false
    })
  }

  startRecording(options: RecordOptions = {}): void {
    if (this.isRecording || !this.recorderManager) return
    this.isRecording = true
    this.recorderManager.start({ ...DEFAULT_OPTIONS, ...options })
  }

  stopRecording(): Promise<string> {
    if (!this.isRecording || !this.recorderManager) return Promise.resolve('')
    this.recorderManager.stop()
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.tempFilePath), 500)
    })
  }

  cancelRecording(): void {
    if (this.isRecording && this.recorderManager) {
      this.recorderManager.stop()
      this.isRecording = false
      this.tempFilePath = ''
    }
  }

  playRecording(filePath?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.innerAudioContext) {
        reject(new Error('音频上下文未初始化'))
        return
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
