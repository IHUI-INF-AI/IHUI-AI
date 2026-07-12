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
