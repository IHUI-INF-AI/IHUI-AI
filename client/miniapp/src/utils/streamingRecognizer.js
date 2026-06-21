export default {
  // 配置参数
  config: {
    apiUrl: 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream', // 流式API的WebSocket地址
    appKey: '8311440652',
    sampleRate: 16000, // 采样率
    format: 'pcm', // 音频格式
    language: 'zh-CN' // 识别语言
  },
  
  // 状态变量
  state: {
    isRecording: false,
    isConnected: false,
    socketTask: null,
    recorderManager: null,
    recognitionResult: '',
    tempFilePath: ''
  },
  
  // 初始化
  init() {
    // 初始化录音管理器
    this.state.recorderManager = uni.getRecorderManager()
    
    // 配置录音参数（注意：流式识别通常要求特定格式）
    this.recordOptions = {
      duration: 600000, // 最长录音时间
      sampleRate: this.config.sampleRate,
      numberOfChannels: 1, // 单声道
      encodeBitRate: 24000,
      format: this.config.format, // 通常流式识别需要pcm格式
      frameSize: 20 // 每20ms返回一帧
    }
    
    // 监听录音帧数据（关键：实时获取音频帧）
    this.state.recorderManager.onFrameRecorded((res) => {
      if (this.state.isRecording && this.state.isConnected && res.frameBuffer) {
        // 发送音频帧到服务器
        this.sendAudioFrame(res.frameBuffer)
      }
    })
    
    console.log('流式语音识别工具初始化完成')
  },
  
  // 连接到流式API
  connect() {
    return new Promise((resolve, reject) => {
      // 关闭已有连接
      if (this.state.socketTask) {
        this.state.socketTask.close()
      }
      
      // 建立WebSocket连接
      this.state.socketTask = uni.connectSocket({
        url: `${this.config.apiUrl}`,
        
        method: 'GET',
        success: () => {
          console.log('WebSocket连接成功')
        },
        fail: (err) => {
          console.error('WebSocket连接失败:', err)
          reject(err)
        }
      })
      
      // 监听连接打开
      this.state.socketTask.onOpen(() => {
        console.log('WebSocket连接已打开')
        this.state.isConnected = true
        resolve()
      })
      
      // 监听收到消息（实时识别结果）
      this.state.socketTask.onMessage((res) => {
        try {
          const result = JSON.parse(res.data)
          this.handleRecognitionResult(result)
        } catch (e) {
          console.error('解析识别结果失败:', e)
        }
      })
      
      // 监听连接关闭
      this.state.socketTask.onClose((res) => {
        console.log('WebSocket连接已关闭', res)
        this.state.isConnected = false
      })
      
      // 监听连接错误
      this.state.socketTask.onError((err) => {
        console.error('WebSocket错误:', err)
        this.state.isConnected = false
        reject(err)
      })
    })
  },
  
  // 开始录音并发送
  startRecognizing() {
    return new Promise((resolve, reject) => {
      if (this.state.isRecording) {
        reject(new Error('正在录音中'))
        return
      }
      
      // 重置识别结果
      this.state.recognitionResult = ''
      
      // 开始录音
      this.state.recorderManager.start(this.recordOptions)
      this.state.isRecording = true
      
      console.log('开始录音和流式识别')
      resolve()
    })
  },
  
  // 停止录音和识别
  stopRecognizing() {
    return new Promise((resolve) => {
      if (!this.state.isRecording) {
        resolve(this.state.recognitionResult)
        return
      }
      
      // 停止录音
      this.state.recorderManager.stop()
      this.state.isRecording = false
      
      // 发送结束标记
      if (this.state.isConnected) {
        this.state.socketTask.send({
          data: JSON.stringify({ type: 'end' })
        })
      }
      
      console.log('停止录音和流式识别')
      
      // 等待最后结果返回
      setTimeout(() => {
        resolve(this.state.recognitionResult)
      }, 500)
    })
  },
  
  // 发送音频帧数据
  sendAudioFrame(frameBuffer) {
    try {
      // 对于二进制帧数据，直接发送ArrayBuffer
      this.state.socketTask.send({
        data: frameBuffer,
        success: () => {
          // 发送成功
        },
        fail: (err) => {
          console.error('发送音频帧失败:', err)
        }
      })
    } catch (e) {
      console.error('处理音频帧失败:', e)
    }
  },
  
  // 处理识别结果
  handleRecognitionResult(result) {
    if (!result) return
    
    // 根据API实际返回格式处理
    if (result.type === 'partial') {
      // 中间结果（实时展示）
      this.state.recognitionResult = result.text
      // 触发实时结果回调
      this.onPartialResult && this.onPartialResult(result.text)
    } else if (result.type === 'final') {
      // 最终结果
      this.state.recognitionResult = result.text
      // 触发最终结果回调
      this.onFinalResult && this.onFinalResult(result.text)
    } else if (result.type === 'error') {
      // 错误信息
      console.error('识别错误:', result.message)
      this.onError && this.onError(result.message)
    }
  },
  
  // 取消识别
  cancel() {
    if (this.state.isRecording) {
      this.state.recorderManager.abort()
      this.state.isRecording = false
    }
    
    if (this.state.isConnected) {
      this.state.socketTask.close()
      this.state.isConnected = false
    }
    
    this.state.recognitionResult = ''
    console.log('已取消识别')
  },
  
  // 注册回调函数
  on(event, callback) {
    if (event === 'partial') {
      this.onPartialResult = callback
    } else if (event === 'final') {
      this.onFinalResult = callback
    } else if (event === 'error') {
      this.onError = callback
    }
  }
}
