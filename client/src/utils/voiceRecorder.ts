/**
 * 录音工具
 * 迁移自 Ai-WXMiniVue/src/utils/voiceRecorder.js
 * 转换：JS -> TS, uni.getRecorderManager -> MediaRecorder API
 */

import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import { getI18nGlobal } from '@/locales'

const { t } = getI18nGlobal()

interface VoiceRecorder {
  recorderManager: MediaRecorder | null
  audioContext: AudioContext | null
  mediaStream: MediaStream | null
  audioElement: HTMLAudioElement | null
  isRecording: boolean
  tempFilePath: string
  chunks: Blob[]
  init: () => void
  startRecording: () => void
  stopRecording: () => Promise<string>
  cancelRecording: () => void
  playRecording: (filePath?: string) => Promise<void>
  stopPlayback: () => void
}

const voiceRecorder: VoiceRecorder = {
  recorderManager: null,
  audioContext: null,
  mediaStream: null,
  audioElement: null,
  isRecording: false,
  tempFilePath: '',
  chunks: [],

  /**
   * 初始化录音管理器
   */
  init(): void {
    try {
      // Web 环境下，不需要特殊的初始化
      // 录音和播放将在实际使用时初始化
      this.audioElement = new Audio()
      this.audioElement.autoplay = false
    } catch (error) {
      logger.error('Failed to initialize recording manager:', error)
    }
  },

  /**
   * 开始录音
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) return

    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000, // 采样率
          channelCount: 1, // 单声道
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      this.mediaStream = stream
      this.chunks = []

      // 创建 MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus', // 使用 webm 格式
      }

      // 尝试使用 mp3 格式，如果不支持则使用 webm
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm;codecs=opus'
      }

      this.recorderManager = new MediaRecorder(stream, options)

      this.recorderManager.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data)
        }
      }

      this.recorderManager.onstop = () => {
        // 创建 Blob 对象
        const blob = new Blob(this.chunks, { type: this.recorderManager?.mimeType || 'audio/webm' })
        this.tempFilePath = URL.createObjectURL(blob)
        this.isRecording = false

        // 停止所有轨道
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
          this.mediaStream = null
        }
      }

      this.recorderManager.onerror = (event: Event) => {
        logger.error('Recording error:', event)
        this.isRecording = false
        ElMessage.error(t('utils.voiceRecorder.recordingFailed'))
      }

      this.isRecording = true
      this.recorderManager.start(100) // 每 100ms 收集一次数据
    } catch (error: any) {
      this.isRecording = false
      logger.error('Failed to start recording:', error)
      ElMessage.error(t('utils.voiceRecorder.microphonePermissionDenied'))
      throw error
    }
  },

  /**
   * 停止录音
   */
  stopRecording(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isRecording || !this.recorderManager) {
        reject(new Error('当前未在录音'))
        return
      }

      this.recorderManager.onstop = () => {
        // 创建 Blob 对象
        const blob = new Blob(this.chunks, {
          type: this.recorderManager?.mimeType || 'audio/webm',
        })
        this.tempFilePath = URL.createObjectURL(blob)
        this.isRecording = false

        // 停止所有轨道
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
          this.mediaStream = null
        }

        resolve(this.tempFilePath)
      }

      try {
        this.recorderManager.stop()
      } catch (error) {
        logger.error('Failed to stop recording:', error)
        reject(error)
      }
    })
  },

  /**
   * 取消录音
   */
  cancelRecording(): void {
    if (this.isRecording && this.recorderManager) {
      try {
        this.recorderManager.stop()
        this.isRecording = false
        this.chunks = []

        // 停止所有轨道
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
          this.mediaStream = null
        }

        // 清理临时文件
        if (this.tempFilePath) {
          URL.revokeObjectURL(this.tempFilePath)
          this.tempFilePath = ''
        }
      } catch (error) {
        logger.error('Failed to cancel recording:', error)
      }
    }
  },

  /**
   * 播放录音
   */
  playRecording(filePath?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.audioElement) {
        reject(new Error('音频元素未初始化'))
        return
      }

      const audioPath = filePath || this.tempFilePath
      if (!audioPath) {
        reject(new Error('没有可播放的音频文件'))
        return
      }

      this.audioElement.src = audioPath

      this.audioElement.onended = () => {
        resolve()
      }

      this.audioElement.onerror = (err: Event | string) => {
        reject(err instanceof Error ? err : new Error(String(err)))
      }

      this.audioElement
        .play()
        .then(() => {
          // 播放成功，等待播放结束
        })
        .catch((err: any) => {
          reject(err instanceof Error ? err : new Error(String(err)))
        })
    })
  },

  /**
   * 停止播放
   */
  stopPlayback(): void {
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.currentTime = 0
    }
  },
}

// 自动初始化
voiceRecorder.init()

export default voiceRecorder
