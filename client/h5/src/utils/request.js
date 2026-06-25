import axios from 'axios'
import { uni } from './uni-adapter'

// API基础URL配置
const BASE_URLS = {
  1: 'https://kou.aizhs.top',
  2: 'https://bsm.aizhs.top/prod-api/ai',
  3: 'https://zca.aizhs.top',
  4: 'https://bsm.aizhs.top/prod-api',
  5: 'https://kou.aizhs.top'
}

// 白名单接口（不需要认证）
const WHITE_LIST = [
  '/login/wechat/getOpenId',
  '/resource/getHomePageResources',
  '/login/wechat/getPhoneNumber',
  '/general/remote/third/group/list',
  '/information/list',
  '/coze/agents',
  '/remote/get/true',
  '/cozeZhsApi/agents/list',
  '/agent/rule/search/bylink',
  '/ali/audio/sys',
  '/cozeZhsApi/ai-model-info/list',
  '/resource/first/share/show',
  '/remote/agent/task/need/task',
  '/agent/use/history',
  '/cozeZhsApi/cache/agent-category-dict/categories',
  '/remote/agent/category',
  '/information/dictionary',
  '/resource/getUserContext',
  '/cozeZhsApi/file/upload/base64',
  '/agent/creation/share/detail',
  '/agent/creation/share/third'
]

// 创建axios实例
const axiosInstance = axios.create({
  timeout: 500000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    const { url, base = 1 } = config

    // 检查是否在白名单中
    const isWhitelisted = WHITE_LIST.some(whiteUrl => url.includes(whiteUrl))

    // 开发环境使用代理，生产环境使用完整URL
    const isDev = import.meta.env.DEV
    let fullUrl = ''
    let baseUrl = ''

    if (isDev) {
      // 开发环境：使用代理路径 /api
      fullUrl = '/api' + url
      baseUrl = '/api'
    } else {
      // 生产环境：使用完整URL
      baseUrl = BASE_URLS[base] || BASE_URLS[1]
      fullUrl = baseUrl + url
    }

    config.url = fullUrl

    // 调试信息
    console.log('请求配置:', {
      originalUrl: url,
      baseUrl: baseUrl,
      fullUrl: fullUrl,
      isDev: isDev,
      isWhitelisted: isWhitelisted,
      method: config.method
    })

    // 如果不是白名单接口，尝试添加认证信息
    if (!isWhitelisted) {
      const storageData = uni.getStorageSync('data')
      const zhsTokenInfo = storageData?.thirdPartyAccounts

      if (zhsTokenInfo?.accessToken) {
        config.headers.Authorization = `Bearer ${zhsTokenInfo.accessToken}`
      }
    }

    // 添加平台类型
    config.headers['platform-type'] = 'h5'

    return config
  },
  (error) => {
    console.error('请求拦截器错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response) => {
    const { data } = response

    // 调试信息
    console.log('响应拦截器 - 成功响应:', {
      status: response.status,
      data: data,
      dataType: typeof data,
      hasCode: 'code' in (data || {}),
      code: data?.code
    })

    // 如果 data 是字符串 "success"，直接返回
    if (data === 'success' || data === 'Success') {
      console.log('响应是字符串 success，直接返回')
      return data
    }

    // 如果 data 不是对象，直接返回（可能是字符串、数字等）
    if (typeof data !== 'object' || data === null) {
      console.log('响应不是对象，直接返回')
      return data
    }

    // 检查业务错误码
    const code = data?.code

    // 如果 code 是字符串 "success"，也认为是成功
    if (code === 'success' || code === 'Success') {
      console.log('code 是 success，返回数据')
      return data
    }

    // 处理 code 为字符串 "200" 或数字 200 的情况
    const codeValue = typeof code === 'string' ? parseInt(code) : code
    const isSuccess = codeValue === 200 || codeValue === 0 || code === '200' || code === '0'

    // 只有当 code 不是成功值（200、0、"200"、"0"）时，才当作错误处理
    if (code !== undefined && code !== null && !isSuccess) {
      const message = data?.message || data?.msg || '请求失败'

      console.log('业务错误码:', code, '错误信息:', message)

      // token过期处理
      if (code === 40101 || code === 499 || code === 401) {
        uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
        // 可以在这里处理跳转到登录页
      } else {
        uni.showToast({ title: message, icon: 'none' })
      }

      return Promise.reject(new Error(message))
    }

    // 成功情况：code 为 200、0、undefined、null 或字符串，都认为是成功
    console.log('响应成功，返回数据')
    return data
  },
  (error) => {
    let message = '网络错误'

    // 详细的错误日志
    console.error('响应拦截器错误:', {
      message: error.message,
      code: error.code,
      response: error.response,
      request: error.request,
      config: error.config
    })

    if (error.response) {
      // 服务器返回了错误响应
      const status = error.response.status
      message = error.response?.data?.message || error.response?.data?.msg || error.message || '请求失败'
      console.error('服务器错误响应:', {
        status: status,
        data: error.response.data,
        url: error.config?.url
      })
    } else if (error.request) {
      // 请求已发出但没有收到响应
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        message = '请求超时，请稍后重试'
      } else {
        message = '网络连接失败，请检查网络'
      }
      console.error('请求失败:', {
        code: error.code,
        message: error.message,
        url: error.config?.url
      })
    } else {
      // 请求配置错误或其他错误
      message = error.message || '网络错误'
      console.error('请求配置错误:', error)
    }

    // 只在非静默模式下显示 toast
    if (!error.config?.silent) {
      uni.showToast({ title: message, icon: 'none' })
    }

    // 保留原始错误信息以便上层处理
    const enhancedError = new Error(message)
    enhancedError.originalError = error
    enhancedError.code = error.code
    enhancedError.response = error.response
    return Promise.reject(enhancedError)
  }
)

/**
 * 通用请求函数
 * @param {Object} options - 请求配置
 * @param {String} options.url - 请求路径
 * @param {String} options.method - 请求方法
 * @param {Object} options.data - 请求数据
 * @param {Object} options.header - 请求头
 * @param {Number} options.base - 基础URL索引（1-5）
 */
export function request(options) {
  const { url, method = 'GET', data = {}, header = {}, base = 1 } = options

  return axiosInstance({
    url,
    method,
    data: method.toUpperCase() === 'GET' ? undefined : data,
    params: method.toUpperCase() === 'GET' ? data : undefined,
    headers: header,
    base
  })
}

export default request
