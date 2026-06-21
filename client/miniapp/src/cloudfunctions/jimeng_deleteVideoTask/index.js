// jimeng_deleteVideoTask 云函数
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
    await axios({
      method: 'delete',
      url: `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${taskId}`,
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    })

    return {
      code: 204,
      message: '删除成功'
    }

  } catch (error) {
    return {
      code: 500,
      message: error.message || '删除任务失败'
    }
  }
}