// jimeng_getVideoTask 云函数
const cloud = require('wx-server-sdk')
const axios = require('axios')
const API_KEY = process.env.JIMENG_API_KEY
if (!API_KEY) throw new Error('JIMENG_API_KEY 环境变量未配置')

cloud.init()

exports.main = async (event, context) => {
  const { taskId } = event

  if (!taskId) {
    return { code: 400, message: '缺少任务ID参数' }
  }

  try {
    
    const response = await axios({
      method: 'get',
      url: `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${taskId}`,
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    })
    
    
    // 检查任务状态并标准化输出格式
    const taskData = response.data;
    
    // 标准化状态字段
    if (!taskData.status && taskData.task_status) {
      taskData.status = taskData.task_status;
    }
    
    // 标准化结果URL
    if (taskData.status === 'SUCCESS' || taskData.status === 'COMPLETED' || taskData.status === 'succeeded') {
      // 处理火山方舟API返回的多种URL格式
      if (!taskData.result) {
        taskData.result = {};
      }
      
      // 新格式: content.video_url
      if (taskData.content && taskData.content.video_url) {
        taskData.result.url = taskData.content.video_url;
      }
      // 优先处理output.videos数组
      else if (taskData.output && taskData.output.videos && taskData.output.videos.length > 0) {
        taskData.result.url = taskData.output.videos[0];
      }
      // 其次处理output.url
      else if (taskData.output && taskData.output.url) {
        taskData.result.url = taskData.output.url;
      }
      // 直接处理顶层url
      else if (taskData.url) {
        taskData.result.url = taskData.url;
      }
      
    }

    return {
      code: 200,
      data: taskData
    }

  } catch (error) {
    
    // 更详细的错误信息
    let errorMessage = error.message || '查询任务失败'
    let errorCode = 500
    
    if (error.response) {
      // 服务器响应错误
      errorMessage = `服务器返回错误: ${error.response.status} - ${JSON.stringify(error.response.data || {})}`
      errorCode = error.response.status
    }
    
    return {
      code: errorCode,
      message: errorMessage
    }
  }
}