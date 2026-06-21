// 分片上传工具类
export class ChunkUploader {
  constructor (options) {
    this.filePath = options.filePath // 文件路径
    this.fileSize = options.fileSize // 文件大小
    this.chunkSize = options.chunkSize || 5 * 1024 * 1024 // 5MB 每片
    this.totalChunks = Math.ceil(this.fileSize / this.chunkSize) // 总片数
    this.uploadUrl = options.uploadUrl // 分片上传接口
    this.mergeUrl = options.mergeUrl // 合并分片接口
    this.fileName = options.fileName // 文件名
    this.fileType = options.fileType // 文件类型
    this.fileId = null // 服务器返回的文件唯一标识
  }

  // 初始化上传（获取文件唯一标识）
  async initUpload () {
    const res = await uni.request({
      url: this.uploadUrl + '/init',
      method: 'POST',
      data: {
        fileName: this.fileName,
        fileSize: this.fileSize,
        totalChunks: this.totalChunks
      }
    })
    this.fileId = res.data.fileId // 服务器生成的唯一标识
    return this.fileId
  }

  // 读取分片内容
  readChunk (chunkIndex) {
    return new Promise((resolve, reject) => {
      const fs = uni.getFileSystemManager()
      const start = chunkIndex * this.chunkSize
      const end = Math.min(start + this.chunkSize, this.fileSize)

      fs.readFile({
        filePath: this.filePath,
        position: start,
        length: end - start,
        success: res => {
          resolve({
            chunkIndex,
            data: res.data
          })
        },
        fail: reject
      })
    })
  }

  // 上传单个分片
  async uploadChunk (chunkIndex) {
    const { data } = await this.readChunk(chunkIndex)

    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url: this.uploadUrl + '/chunk',
        filePath: data.path, // 临时文件路径
        name: 'chunk',
        formData: {
          fileId: this.fileId,
          chunkIndex,
          totalChunks: this.totalChunks
        },
        success: res => {
          resolve(JSON.parse(res.data))
        },
        fail: reject
      })
    })
  }

  // 上传所有分片
  async uploadAllChunks (progressCallback) {
    for (let i = 0; i < this.totalChunks; i++) {
      try {
        await this.uploadChunk(i)
        const progress = Math.round(((i + 1) / this.totalChunks) * 100)
        progressCallback && progressCallback(progress)
      } catch (error) {
        console.error(`分片 ${i} 上传失败`, error)
        throw new Error(`分片 ${i} 上传失败，请重试`)
      }
    }
  }

  // 合并分片
  async mergeChunks () {
    const res = await uni.request({
      url: this.mergeUrl,
      method: 'POST',
      data: {
        fileId: this.fileId,
        fileName: this.fileName,
        totalChunks: this.totalChunks
      }
    })
    return res.data
  }

  // 完整上传流程
  async start (progressCallback) {
    try {
      await this.initUpload()
      await this.uploadAllChunks(progressCallback)
      return await this.mergeChunks()
    } catch (error) {
      console.error('上传失败', error)
      throw error
    }
  }
}

/**
 * 判断当前微信小程序运行环境是手机端还是PC端
 * @returns {boolean} 是否为PC端
 * pc 端微信小程序的请求头只能是 "Content-Type": "multipart/form-data"
 */
export function isPCEnvironment () {
  try {
    const systemInfo = uni.getSystemInfoSync()
    console.log('systemInfo', systemInfo)
    // 微信小程序中，PC端的platform值为windows或mac
    return systemInfo.platform === 'windows' || systemInfo.platform === 'mac'
  } catch (e) {
    console.error('获取系统信息失败：', e)
    // 异常情况下默认视为手机端
    return false
  }
}
