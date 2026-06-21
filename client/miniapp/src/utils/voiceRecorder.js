export default {
    recorderManager: null,
    innerAudioContext: null,
    isRecording: false,
    tempFilePath: '',
    
    // 初始化录音管理器
    init() {
      // 初始化录音管理器
      this.recorderManager = uni.getRecorderManager()
      
      // 初始化音频播放上下文
      this.innerAudioContext = uni.createInnerAudioContext()
      this.innerAudioContext.autoplay = false
      
      // 监听录音结束
      this.recorderManager.onStop((res) => {
        this.tempFilePath = res.tempFilePath
        this.isRecording = false
      })
      
      // 监听录音错误
      this.recorderManager.onError((err) => {
        this.isRecording = false
      })
    },
    
    // 开始录音
    startRecording() {
      if (this.isRecording) return
      
      this.isRecording = true
      // 配置录音参数
      const options = {
        duration: 60000, // 最长录音时间，单位ms
        sampleRate: 16000, // 采样率，建议16000
        numberOfChannels: 1, // 声道数，单声道
        encodeBitRate: 96000, // 编码比特率
        format: 'mp3', // 音频格式
        frameSize: 50 // 帧大小
      }
      
      this.recorderManager.start(options)
    },
    
    // 停止录音
    stopRecording() {
      if (!this.isRecording) return
      
      this.recorderManager.stop()
      return new Promise((resolve) => {
        // 等待录音结束事件触发
        setTimeout(() => {
          resolve(this.tempFilePath)
        }, 500)
      })
    },
    
    // 取消录音
    cancelRecording() {
      if (this.isRecording) {
        this.recorderManager.abort()
        this.isRecording = false
      }
    },
    
    // 播放录音
    playRecording(filePath) {
      return new Promise((resolve, reject) => {
        this.innerAudioContext.src = filePath || this.tempFilePath
        this.innerAudioContext.play()
        
        this.innerAudioContext.onEnded(() => {
          resolve()
        })
        
        this.innerAudioContext.onError((err) => {
          reject(err)
        })
      })
    },
    
    // 停止播放
    stopPlayback() {
      if (this.innerAudioContext) {
        this.innerAudioContext.stop()
      }
    }
}
  