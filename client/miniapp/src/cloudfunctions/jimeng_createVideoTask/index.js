// jimeng_createVideoTask 云函数
const cloud = require('wx-server-sdk')
const axios = require('axios')
const API_KEY = process.env.JIMENG_API_KEY
if (!API_KEY) throw new Error('JIMENG_API_KEY 环境变量未配置')

cloud.init()

exports.main = async (event, context) => {
  const { 
    model, 
    content,
    resolution = '720p',         // 视频分辨率，默认720p
    ratio = '16:9',              // 宽高比，默认16:9
    duration = 5,                // 时长，默认5秒
    framepersecond = 24,         // 帧率，默认24
    watermark = false,           // 水印，默认false
    seed = -1,                   // 种子值，默认-1（随机）
    camerafixed = false          // 固定摄像头，默认false
  } = event

  // 验证必要参数
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return {
      code: 400,
      message: '内容参数不能为空'
    }
  }

  // 默认视频生成模型
  const videoModel = model || 'wan2-1-14b-t2v-250225'
  
  // 构建命令参数字符串
  const commandParams = [];
  commandParams.push(`--rs ${resolution}`);  // 分辨率
  commandParams.push(`--rt ${ratio}`);       // 比例
  commandParams.push(`--dur ${duration}`);   // 时长
  commandParams.push(`--fps ${framepersecond}`); // 帧率
  
  if (watermark) {
    commandParams.push('--wm true');
  }
  
  if (camerafixed) {
    commandParams.push('--cf true');
  }
  
  if (seed !== -1) {
    commandParams.push(`--seed ${seed}`);
  }
  
  // 将参数添加到提示词后面
  const contentWithCommands = `${content} ${commandParams.join(' ')}`;

  try {

    const response = await axios({
      method: 'post',
      url: 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: videoModel,
        content: [
          {
            type: "text",
            text: contentWithCommands
          }
        ]
      }
    })


    return {
      code: 200,
      data: response.data
    }

  } catch (error) {
    
    // 更详细的错误信息
    let errorMessage = error.message || '创建任务失败'
    let errorCode = 500
    
    if (error.response) {
      // 服务器响应错误
      errorMessage = `服务器返回错误: ${error.response.status} - ${JSON.stringify(error.response.data || {})}`
      errorCode = error.response.status
    } else if (error.request) {
      // 请求已发送但没有收到响应
      errorMessage = '无法连接到服务器，请检查网络'
    }
    
    return {
      code: errorCode,
      message: errorMessage
    }
  }
}