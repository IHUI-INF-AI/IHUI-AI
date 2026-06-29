export default {
    // 替换为你的API密钥
    API_KEY: 'your_api_key',
    API_SECRET: 'your_api_secret',
    // 豆包语音API地址
    API_URL: 'https://api.doubao.com/voice/chat/completions',
    
    // 获取访问令牌
    async getAccessToken() {
      const response = await uni.request({
        url: 'https://aip.baidubce.com/oauth/2.0/token',
        method: 'GET',
        data: {
          grant_type: 'client_credentials',
          client_id: this.API_KEY,
          client_secret: this.API_SECRET
        }
      })

      if (response[1].statusCode === 200) {
        return response[1].data.access_token
      } else {
        throw new Error('获取访问令牌失败: ' + JSON.stringify(response[1].data))
      }
    },
    
    // 处理语音文件并转换为Base64
    async voiceToBase64(filePath) {
      return new Promise((resolve, reject) => {
        uni.getFileSystemManager().readFile({
          filePath: filePath,
          encoding: 'base64',
          success: (res) => {
            resolve(res.data)
          },
          fail: (err) => {
            reject(err)
          }
        })
      })
    },
    
    // 发送语音请求到豆包API
    async sendVoiceRequest(audioBase64) {
      const accessToken = await this.getAccessToken()

      const response = await uni.request({
        url: `${this.API_URL}?access_token=${accessToken}`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          model: 'ernie-bot-voice', // 豆包语音模型
          input: {
            audio: audioBase64,
            format: 'mp3',
            rate: 16000
          },
          parameters: {
            response_mode: 'streaming', // 实时流式响应
            temperature: 0.7
          }
        }
      })

      if (response[1].statusCode === 200) {
        return response[1].data
      } else {
        throw new Error('API请求失败: ' + JSON.stringify(response[1].data))
      }
    },
    
    // 处理API返回的语音结果
    async handleVoiceResponse(response) {
      // 这里根据实际API返回格式处理
      if (response.audio) {
        // 将返回的base64音频转换为临时文件
        const tempFilePath = `${wx.env.USER_DATA_PATH}/response.mp3`
        
        return new Promise((resolve, reject) => {
          uni.getFileSystemManager().writeFile({
            filePath: tempFilePath,
            data: response.audio,
            encoding: 'base64',
            success: () => {
              resolve(tempFilePath)
            },
            fail: (err) => {
              reject(err)
            }
          })
        })
      } else {
        throw new Error('API返回中没有音频数据')
      }
    }
  }
  
