// 云函数入口文件
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({
  env: 'cloud1-5gszljn762dc4719'  // 直接使用您的环境ID
})

// HTTPS请求辅助函数
function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          let result = data
          // 尝试解析JSON
          try {
            result = JSON.parse(data)
          } catch (e) {
          }
          
          resolve({
            statusCode: res.statusCode,
            data: result,
            headers: res.headers
          })
        } catch (error) {
          reject(error)
        }
      })
    })
    
    req.on('error', (error) => {
      reject(error)
    })
    
    if (postData) {
      req.write(postData)
    }
    
    req.end()
  })
}

// 云函数入口函数
exports.main = async (event, context) => {
  
  try {
    // 检查必要参数
    if (!event.token || !event.workflowId) {
      return {
        code: 400,
        msg: '缺少必要参数: token或workflowId',
        data: null
      };
    }
    
    // 确保parameters存在
    if (!event.parameters) {
      return {
        code: 400,
        msg: '缺少必要参数: parameters',
        data: null
      };
    }
    
    // 获取prompt
    let inputPrompt = ''
    if (typeof event.parameters === 'string') {
      inputPrompt = event.parameters
    } else if (event.parameters.prompt) {
      inputPrompt = event.parameters.prompt
    } else if (event.parameters.input) {
      inputPrompt = event.parameters.input
    } else {
      inputPrompt = JSON.stringify(event.parameters)
    }
    
    // 构建API请求参数
    const hostname = 'api.coze.cn'
    const path = '/v1/workflow/run'
    
    const postData = JSON.stringify({
      workflow_id: event.workflowId,
      parameters: {
        input: inputPrompt
      },
      is_async: true
    })
    
    
    // 设置请求选项
    const options = {
      hostname: hostname,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${event.token}`
      }
    }
    
    // 发送请求
    const response = await httpsRequest(options, postData)
    
    
    if (response.statusCode !== 200) {
      throw new Error(`请求失败: ${response.statusCode}`)
    }
    
    // 解析响应数据
    const result = response.data
    
    // 检查API返回状态
    if (result.code !== 0) {
      throw new Error(`API返回错误: ${result.code} - ${result.msg || '未知错误'}`)
    }
    
    // 获取执行ID
    const executeId = result.execute_id
    if (!executeId) {
      throw new Error('未获取到执行ID')
    }
    
    // 返回结果
    return {
      code: 0,
      msg: '请求成功',
      data: {
        execute_id: executeId,
        debugUrl: result.debug_url || null
      }
    }
  } catch (error) {
    return {
      code: 500,
      msg: '云函数执行失败: ' + error.message,
      data: null
    }
  }
} 