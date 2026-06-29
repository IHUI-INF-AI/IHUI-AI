import { t } from '@/utils/i18n'

/**
 * 统一认证API - 支持多后端路由
 * 根据 source 参数调用对应子项目的后端认证服务
 *
 * 创建时间: 2025-12-18
 */

import axios from 'axios'
import { request } from '@/utils/request'
import { logger } from '@/utils/logger'

// AxiosResponseLike 接口定义
interface AxiosResponseLike {
  data: unknown
  status: number
  statusText: string
  headers: Record<string, string>
}

// 登录来源类型
export type LoginSource = 'main' | 'admin' | 'edu-web' | 'edu-admin' | 'user'

// 登录请求参数
export interface UnifiedLoginRequest {
  phone: string
  password: string
  email?: string // 邮箱（用于绑定或验证）
  code?: string // 验证码
  uuid?: string // 验证码UUID
  remember?: boolean
}

// 注册请求参数
export interface UnifiedRegisterRequest {
  username: string
  password: string
  email?: string
  phone?: string
  code?: string // 验证码
  captcha?: string // 图片验证码
  uuid?: string // 验证码UUID
  inviteCode?: string // 邀请码
}

// 统一登录响应
export interface UnifiedLoginResponse {
  success: boolean
  code: number
  message: string
  msg?: string
  data?: {
    token?: string
    accessToken?: string
    access_token?: string
    refreshToken?: string
    refresh_token?: string
    expiresIn?: number
    expires_in?: number
    tokenType?: string
    token_type?: string
    user?: Record<string, unknown>
    userInfo?: Record<string, unknown>
    roles?: string[]
    permissions?: string[]
  }
}

// 后端API配置
const API_CONFIG: Record<
  LoginSource,
  {
    baseUrl: string
    loginPath: string
    useProxy?: boolean
  }
> = {
  // 官网主项目 - 登录接口：/api/v1/auth/login（由 Vite 代理转发到 Python 后端）
  // 2026-06-21 联调: 对齐后端 v1/auth 真实路由
  main: {
    baseUrl: '',
    loginPath: '/api/v1/auth/login',
    useProxy: true,
  },
  // 官网用户端（同主项目）
  user: {
    baseUrl: '',
    loginPath: '/api/v1/auth/login',
    useProxy: true,
  },
  // Ruoyi管理后台（总管理端）- 使用 prod-api/auth/login（若用 IP 如 192.168.1.25:8080 则无需 /prod-api 前缀）
  // 1. 验证码：GET /code，返回 uuid + img(base64)；2. 登录：POST /auth/login，body: username, password, code, uuid
  admin: {
    baseUrl: '',
    loginPath: '/api/v1/auth/login',
    useProxy: true,
  },
  // 教育用户端 - 连接到192.168.1.25:8080
  'edu-web': {
    baseUrl: '',
    // 教育系统登录接口 - 根据Swagger文档，路径是 /login/pwd/login
    // 但实际测试发现需要路径前缀 /ai-program
    // 使用完整路径 /api/ai-program/login/pwd/login，代理会去掉 /api 前缀
    loginPath: '/api/ai-program/login/pwd/login',
    useProxy: true,
  },
  // 教育管理端 - 连接到192.168.1.25:8080
  'edu-admin': {
    baseUrl: '',
    // 教育管理端登录接口 - 根据Swagger文档，路径是 /login/pwd/login
    // 但实际测试发现需要路径前缀 /ai-program
    // 使用完整路径 /api/ai-program/login/pwd/login，代理会去掉 /api 前缀
    loginPath: '/api/ai-program/login/pwd/login',
    useProxy: true,
  },
}

/**
 * 规范化登录响应格式
 */
function normalizeLoginResponse(
  response: Record<string, unknown>,
  source: LoginSource
): UnifiedLoginResponse {
  // 处理不同后端的响应格式差异
  // ⚠️ 重要：后端可能直接返回数据，也可能包装在 data 字段中
  const data = (response.data || response) as Record<string, unknown>

  // 调试日志：查看实际响应格式
  if (import.meta.env.DEV) {
    logger.debug('[Normalized login response] Raw response', {
      source,
      responseKeys: Object.keys(response),
      hasData: !!response.data,
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
      responseSample: JSON.stringify(response).substring(0, 500),
    })
  }

  // 后端可能返回 code: 200 表示成功，或者 code: 0 表示成功
  // 也可能使用 success: true 或 status: 200
  // ⚠️ 注意：code: 500 且 msg: "404 NOT_FOUND" 表示接口不存在或路径不对
  const code = (response.code as number) ?? (data.code as number) ?? (response.status as number) ?? 0
  const msg = (response.msg as string) ?? (response.message as string) ?? (data.msg as string) ?? ''

  // 检查是否为 404 错误
  const isNotFound = code === 500 && (msg.includes('404') || msg.includes('NOT_FOUND'))

  const success =
    !isNotFound && (
      code === 0 ||
      code === 200 ||
      response.success === true ||
      (response.status as number) === 200 ||
      (data.status as number) === 200
    )

  // 提取token（支持多种格式）
  // ⚠️ 重要：token可能在多个位置，需要全面检查
  const tokenData = typeof data === 'object' && data !== null ? data : {}

  // 尝试从多个位置提取token
  let token = (
    tokenData.token ||
    tokenData.accessToken ||
    tokenData.access_token ||
    tokenData.value ||
    (response as { token?: string }).token ||
    (response as { accessToken?: string }).accessToken ||
    (response as { access_token?: string }).access_token
  ) as string | undefined

  // 如果还是没有找到，尝试从嵌套对象中提取
  if (!token && tokenData.data && typeof tokenData.data === 'object') {
    const nestedData = tokenData.data as Record<string, unknown>
    token = (
      nestedData.token ||
      nestedData.accessToken ||
      nestedData.access_token
    ) as string | undefined
  }

  // 新格式：data 直接是用户对象，token 在 thirdPartyAccounts 中
  if (!token && tokenData.thirdPartyAccounts && typeof tokenData.thirdPartyAccounts === 'object') {
    const thirdParty = tokenData.thirdPartyAccounts as Record<string, unknown>
    token = (thirdParty.accessToken || thirdParty.access_token || thirdParty.token) as string | undefined
  }

  interface ResponseWithTokens {
    refreshToken?: string
    refresh_token?: string
    expiresIn?: number
    expires_in?: number
    tokenType?: string
    token_type?: string
    user?: Record<string, unknown>
    userInfo?: Record<string, unknown>
    roles?: string[]
    permissions?: string[]
  }

  const responseWithTokens = response as ResponseWithTokens

  const refreshToken = (
    tokenData.refreshToken ||
    tokenData.refresh_token ||
    responseWithTokens.refreshToken ||
    responseWithTokens.refresh_token
  ) as string | undefined

  // 新格式：refreshToken 在 thirdPartyAccounts 中
  const thirdPartyRefreshToken =
    tokenData.thirdPartyAccounts && typeof tokenData.thirdPartyAccounts === 'object'
      ? ((tokenData.thirdPartyAccounts as Record<string, unknown>).refreshToken as string | undefined)
      : undefined

  const expiresIn = (
    tokenData.expiresIn ||
    tokenData.expires_in ||
    responseWithTokens.expiresIn ||
    responseWithTokens.expires_in
  ) as number | undefined

  const tokenType = (
    tokenData.tokenType ||
    tokenData.token_type ||
    responseWithTokens.tokenType ||
    responseWithTokens.token_type ||
    'Bearer'
  ) as string

  // 提取用户信息
  let user = (
    tokenData.user ||
    tokenData.userInfo ||
    tokenData.sysUser ||
    responseWithTokens.user ||
    responseWithTokens.userInfo
  ) as Record<string, unknown> | undefined

  // 新格式：data 本身就是用户对象（含 uuid / authInfo / thirdPartyAccounts 等）
  if (
    !user &&
    tokenData &&
    typeof tokenData === 'object' &&
    (('uuid' in tokenData) || ('id' in tokenData) || ('authInfo' in tokenData) || ('thirdPartyAccounts' in tokenData))
  ) {
    user = tokenData as Record<string, unknown>
  }

  const roles = (
    tokenData.roles ||
    responseWithTokens.roles
  ) as string[] | undefined

  const permissions = (
    tokenData.permissions ||
    responseWithTokens.permissions
  ) as string[] | undefined

  // 调试日志：查看提取结果
  if (import.meta.env.DEV) {
    logger.debug('[Normalized login response] Extraction result', {
      source,
      success,
      code,
      hasToken: !!token,
      hasRefreshToken: !!refreshToken,
      hasUser: !!user,
      tokenLength: token?.length || 0,
    })
  }

  return {
    success,
    code,
    message: (response.msg || response.message || (success ? '登录成功' : '登录失败')) as string,
    data: success
      ? {
          token,
          accessToken: token,
          access_token: token,
          refreshToken: refreshToken || thirdPartyRefreshToken,
          refresh_token: refreshToken || thirdPartyRefreshToken,
          expiresIn,
          expires_in: expiresIn,
          tokenType,
          token_type: tokenType,
          user,
          userInfo: user,
          roles,
          permissions,
        }
      : undefined,
  }
}

/**
 * 统一登录接口
 * 根据 source 参数自动路由到对应的后端认证服务
 *
 * @param source 登录来源（决定调用哪个后端）
 * @param credentials 登录凭证
 */
export async function unifiedLogin(
  source: LoginSource,
  credentials: UnifiedLoginRequest
): Promise<UnifiedLoginResponse> {
  const config = API_CONFIG[source] || API_CONFIG.main

  logger.info('[Unified Login] Starting login', {
    source,
    config: {
      baseUrl: config.baseUrl,
      loginPath: config.loginPath,
      useProxy: config.useProxy,
    },
  })

  try {
    let response: Record<string, unknown>
    // 在外部定义变量，确保存错误处理时可以访问
    let fullPath: string = ''
    let requestData: Record<string, unknown> = {}

    if (config.useProxy) {
      // 使用项目内代理请求
      // 构建完整路径
      // 注意：admin、edu-web、edu-admin 使用完整路径（包含 /api 前缀），代理会转发到 192.168.1.25:8080
      // 其他系统：baseUrl + loginPath（request.ts 会自动添加 /api 前缀）
      if (source === 'admin') {
        // 总管理端：POST /api/auth/login -> 192.168.1.25:8080/auth/login（使用 IP 时不拼 /prod-api）
        fullPath = config.loginPath
      } else if (source === 'edu-web' || source === 'edu-admin') {
        // 教育系统：POST /api/ai-program/login/pwd/login
        fullPath = config.loginPath
      } else {
        // 其他系统：使用配置的路径
        fullPath = config.baseUrl + config.loginPath
        // 以 /prod-api 开头的路径直接使用（会走 Python 后端代理），不加重写
        // 以 /api/v1/auth 开头的路径直接使用（走 Vite 代理到 Python 后端）
        if (!fullPath.startsWith('/prod-api') && !fullPath.startsWith('/api') && !fullPath.startsWith('/login/pwd')) {
          // 确保路径以 /api 开头（vite 代理需要）
          if (fullPath.startsWith('/')) {
            fullPath = '/api' + fullPath
          } else {
            fullPath = '/api/' + fullPath
          }
        }
      }

      // 根据不同的后端API调整请求参数格式
      if (source === 'admin') {
        // 总管理端：POST /auth/login 传 username、password、code、uuid（后端关闭验证码时 code/uuid 传空字符串）
        requestData = {
          username: credentials.phone, // 表单账号即用户名
          password: credentials.password,
          code: credentials.code ?? '',
          uuid: credentials.uuid ?? '',
        }
      } else if (source === 'edu-web' || source === 'edu-admin') {
        requestData = {
          phone: credentials.phone,
          password: credentials.password,
          source: source,
        }
        if (credentials.email) {
          requestData.email = credentials.email
        }
        requestData.code = credentials.code || ''
        requestData.uuid = credentials.uuid || ''
      } else {
        // 其他系统：后端接口 /login/pwd/login
        // 项目以手机号为唯一凭证，phone 是主要参数
        // ⚠️ 重要：后端需要 code 和 uuid 参数（即使为空字符串），否则返回 500 错误
        requestData = {
          phone: credentials.phone,
          password: credentials.password,
          code: credentials.code || '',
          uuid: credentials.uuid || '',
        }
        // 如果有邮箱，也添加（用于绑定或验证）
        if (credentials.email) {
          requestData.email = credentials.email
        }
        if (credentials.remember !== undefined) {
          requestData.remember = credentials.remember
        }
      }

      // ⚠️ 重要：request.post 返回的是 AxiosResponse，需要提取 data
      // 但响应拦截器可能已经处理过，需要检查实际返回格式
      // 通过配置对象传递 source 到请求头，让后端知道是哪个平台的请求

      // 调试日志：查看实际请求路径
      if (import.meta.env.DEV) {
        logger.info('[Unified Login] Preparing to send request', {
          source,
          fullPath,
          requestDataKeys: Object.keys(requestData),
          requestDataSample: JSON.stringify(requestData).substring(0, 200),
        })
      }

      // 总管理端/教育端：用原生 axios 发登录请求，不经过 request 拦截器，确保绝不携带 Authorization
      // 避免后端 192.168.1.25:8080 因收到任意 token 头而返回「令牌不能为空」
      const isAdminOrEdu = source === 'admin' || source === 'edu-web' || source === 'edu-admin'
      const postResponse = isAdminOrEdu
        ? await axios.post(fullPath, requestData, {
            baseURL: '', // 相对当前页 origin，由 Vite 代理转发
            timeout: 15000,
            headers: {
              'Content-Type': 'application/json',
              'X-Source': source,
              source: source,
              'platform-type': 'web',
            },
            withCredentials: false,
            validateStatus: () => true, // 不按状态码抛错，由上层根据 body 判断
          })
        : await request.post(fullPath, requestData, {
            headers: {
              'X-Source': source,
              source: source,
              'platform-type': 'web',
            },
          })

      // 调试日志：查看实际返回的数据结构
      if (import.meta.env.DEV) {
        logger.debug('[Unified Login] Login request returned', {
          source,
          responseType: typeof postResponse,
          isAxiosResponse: postResponse && typeof postResponse === 'object' && 'data' in postResponse && 'status' in postResponse,
          responseKeys: postResponse && typeof postResponse === 'object' ? Object.keys(postResponse) : [],
          responseSample: JSON.stringify(postResponse).substring(0, 800),
        })
      }

      // 如果返回的是 AxiosResponse（有 data 和 status 字段），提取 data
      if (postResponse && typeof postResponse === 'object' && 'data' in postResponse && 'status' in postResponse) {
        response = (postResponse as AxiosResponseLike).data as Record<string, unknown>
        if (import.meta.env.DEV) {
          logger.debug('[Unified Login] Extracting data from AxiosResponse', {
            source,
            dataKeys: response && typeof response === 'object' ? Object.keys(response) : [],
          })
        }
      } else {
        // 这已经是 data 了，直接使用
        response = postResponse as unknown as Record<string, unknown>
        if (import.meta.env.DEV) {
          logger.debug('[Unified Login] Using returned data directly', {
            source,
            dataKeys: response && typeof response === 'object' ? Object.keys(response) : [],
          })
        }
      }
    } else {
      // 直接请求外部API
      const axiosResponse = await axios({
        url: `${config.baseUrl}${config.loginPath}`,
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          // 账号密码登录与手机号登录保持一致：统一使用 web
          'platform-type': 'web',
        },
        data: {
          phone: credentials.phone,
          password: credentials.password,
          code: credentials.code,
          uuid: credentials.uuid,
        },
        timeout: 15000,
      })
      response = axiosResponse.data as Record<string, unknown>
    }

    // 详细日志：查看完整响应结构（开发环境）
    if (import.meta.env.DEV) {
      logger.info('[Unified Login] Received response (detailed)', {
        source,
        response: {
          code: response.code,
          msg: response.msg,
          message: response.message,
          success: response.success,
          hasData: !!response.data,
          responseKeys: Object.keys(response),
          dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data as object) : [],
          // 只记录前500个字符，避免日志过长
          responseSample: JSON.stringify(response).substring(0, 500),
        },
      })
    } else {
      logger.info('[Unified Login] Received response', {
        source,
        response: {
          code: response.code,
          msg: response.msg,
          success: response.success,
          hasData: !!response.data,
        },
      })
    }

    // ⚠️ 重要：检查是否为 404 错误（后端可能返回 {code: 500, msg: "404 NOT_FOUND"}）
    const responseMsg = (response.msg as string) ?? (response.message as string) ?? ''
    const isNotFoundError =
      (response.code === 500 && (responseMsg.includes('404') || responseMsg.includes('NOT_FOUND'))) ||
      (response.code === 404)

    if (isNotFoundError) {
      logger.error('[Unified Login] Endpoint does not exist', {
        source,
        code: response.code,
        msg: responseMsg,
        fullPath,
        requestData,
      })
      return {
        success: false,
        code: 404,
        message: t('api.unified_auth.登录接口不存在请') + responseMsg,
      }
    }

    const normalized = normalizeLoginResponse(response, source)

    logger.info('[Unified Login] Response normalization complete', {
      source,
      normalized: {
        success: normalized.success,
        code: normalized.code,
        hasToken: !!normalized.data?.token,
      },
    })

    return normalized
  } catch (error: unknown) {
    // 提取详细的错误信息
    let errorMessage = '登录请求失败'
    let errorCode = -1

    if (error instanceof Error) {
      errorMessage = error.message
    }

    // 如果是axios错误，尝试提取后端返回的错误信息
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { msg?: string; message?: string; code?: number }; status?: number } }
      if (axiosError.response?.data) {
        const errorData = axiosError.response.data
        errorMessage = errorData.msg || errorData.message || errorMessage
        errorCode = errorData.code ?? (axiosError.response.status ?? errorCode)
      } else if (axiosError.response?.status) {
        // HTTP 状态码错误
        errorCode = axiosError.response.status
        if (errorCode === 404) {
          errorMessage = '接口不存在，请检查后端服务是否正常运行'
        } else if (errorCode === 401) {
          errorMessage = '认证失败，请检查账号密码'
        } else if (errorCode === 403) {
          errorMessage = '权限不足'
        } else if (errorCode >= 500) {
          errorMessage = '服务器错误，请稍后重试'
        }
      }
    }

    // 检查响应中是否包含错误信息（即使不是异常）
    // 处理后端返回 {code: 500, msg: "404 NOT_FOUND"} 的情况
    if (error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 500) {
      const errorObj = error as { msg?: string; message?: string }
      if (errorObj.msg?.includes('404') || errorObj.msg?.includes('NOT_FOUND')) {
        errorCode = 404
        errorMessage = '接口不存在，请检查后端服务配置和路径是否正确'
      }
    }

    logger.error('[Unified Login] Error', {
      source,
      error: errorMessage,
      errorCode,
      errorDetails: error instanceof Error ? error.stack : undefined,
    })

    return {
      success: false,
      code: errorCode,
      message: errorMessage,
    }
  }
}

/**
 * 获取登录来源对应的平台名称
 */
export function getSourceName(source: LoginSource): string {
  const names: Record<LoginSource, string> = {
    main: '官网主站',
    user: '官网用户端',
    admin: 'Ruoyi管理后台',
    'edu-web': '教育用户端',
    'edu-admin': '教育管理端',
  }
  return names[source] || '未知平台'
}

/**
 * 验证登录来源是否有效
 */
export function isValidSource(source: string): source is LoginSource {
  return ['main', 'user', 'admin', 'edu-web', 'edu-admin'].includes(source)
}

/**
 * 获取所有支持的登录来源
 */
export function getSupportedSources(): LoginSource[] {
  return ['main', 'admin', 'edu-web', 'edu-admin']
}

/**
 * 统一注册接口
 * 根据 source 参数自动路由到对应的后端认证服务
 *
 * @param source 注册来源（决定调用哪个后端）
 * @param credentials 注册凭证
 */
export async function unifiedRegister(
  source: LoginSource,
  credentials: UnifiedRegisterRequest
): Promise<UnifiedLoginResponse> {
  const config = API_CONFIG[source] || API_CONFIG.main

  logger.info('[Unified Register] Starting registration', {
    source,
    config: {
      baseUrl: config.baseUrl,
      loginPath: config.loginPath,
      useProxy: config.useProxy,
    },
  })

  try {
    let response: Record<string, unknown>
    // 在外部定义变量，确保存错误处理时可以访问
    let fullPath: string = ''
    let requestData: Record<string, unknown> = {}

    if (config.useProxy) {
      // 使用项目内代理请求
      // 注册接口路径：根据Swagger文档，路径是 /login/pwd/registerLogin
      // 注意：admin、edu-web、edu-admin 使用 /api/ai-program/...，代理会转发到 192.168.1.25:8080
      if (source === 'admin' || source === 'edu-web' || source === 'edu-admin') {
        fullPath = '/api/ai-program/login/pwd/registerLogin'
      } else {
        // 其他系统：使用配置的路径 (2026-06-21 联调: 对齐后端 v1/auth)
        fullPath = config.baseUrl + '/api/v1/auth/register'
      }

      // 根据不同的后端API调整请求参数格式
      if (source === 'admin' || source === 'edu-web' || source === 'edu-admin') {
        // 总管理端/教育系统：发送 username、password、source 等
        requestData = {
          username: credentials.username,
          password: credentials.password,
          source: source, // 传递 source 参数，让后端知道是哪个平台的请求
        }
        // 可选字段
        if (credentials.email) {
          requestData.email = credentials.email
        }
        if (credentials.phone) {
          requestData.phone = credentials.phone
        }
        if (credentials.code) {
          requestData.code = credentials.code
        }
        if (credentials.captcha) {
          requestData.captcha = credentials.captcha
        }
        if (credentials.uuid) {
          requestData.uuid = credentials.uuid
        }
        if (credentials.inviteCode) {
          requestData.inviteCode = credentials.inviteCode
        }
      } else {
        // 其他系统：发送 username、password、email 和 source
        requestData = {
          username: credentials.username,
          password: credentials.password,
          source: source, // 传递 source 参数，让后端知道是哪个平台的请求
        }
        // 可选字段
        if (credentials.email) {
          requestData.email = credentials.email
        }
        if (credentials.phone) {
          requestData.phone = credentials.phone
        }
        if (credentials.code) {
          requestData.code = credentials.code
        }
        if (credentials.captcha) {
          requestData.captcha = credentials.captcha
        }
        if (credentials.uuid) {
          requestData.uuid = credentials.uuid
        }
        if (credentials.inviteCode) {
          requestData.inviteCode = credentials.inviteCode
        }
      }

      // 发送注册请求
      // 通过配置对象传递 source 到请求头，让后端知道是哪个平台的请求
      const postResponse = await request.post(fullPath, requestData, {
        headers: {
          'X-Source': source, // 在请求头中传递 source
          'source': source, // 兼容性：也使用小写
        },
      })

      // 调试日志：查看实际返回的数据结构
      if (import.meta.env.DEV) {
        logger.debug('[Unified Register] request.post returned data', {
          source,
          responseType: typeof postResponse,
          isAxiosResponse: postResponse && typeof postResponse === 'object' && 'data' in postResponse && 'status' in postResponse,
          responseKeys: postResponse && typeof postResponse === 'object' ? Object.keys(postResponse) : [],
          responseSample: JSON.stringify(postResponse).substring(0, 800),
        })
      }

      // 如果返回的是 AxiosResponse（有 data 和 status 字段），提取 data
      // 如果返回的已经是 data（没有 status 字段），直接使用
      if (postResponse && typeof postResponse === 'object' && 'data' in postResponse && 'status' in postResponse) {
        // 这是完整的 AxiosResponse，提取 data
        response = (postResponse as AxiosResponseLike).data as Record<string, unknown>
        if (import.meta.env.DEV) {
          logger.debug('[Unified Register] Extracting data from AxiosResponse', {
            source,
            dataKeys: response && typeof response === 'object' ? Object.keys(response) : [],
          })
        }
      } else {
        // 这已经是 data 了，直接使用
        response = postResponse as unknown as Record<string, unknown>
        if (import.meta.env.DEV) {
          logger.debug('[Unified Register] Using returned data directly', {
            source,
            dataKeys: response && typeof response === 'object' ? Object.keys(response) : [],
          })
        }
      }
    } else {
      // 直接请求外部API（暂不支持）
      throw new Error(`不支持直接请求外部API注册，source: ${source}`)
    }

    // ⚠️ 重要：检查是否为 404 错误（后端可能返回 {code: 500, msg: "404 NOT_FOUND"}）
    const responseMsg = (response.msg as string) ?? (response.message as string) ?? ''
    const isNotFoundError =
      (response.code === 500 && (responseMsg.includes('404') || responseMsg.includes('NOT_FOUND'))) ||
      (response.code === 404)

    if (isNotFoundError) {
      logger.error('[Unified Register] Endpoint does not exist', {
        source,
        code: response.code,
        msg: responseMsg,
        fullPath,
        requestData,
      })
      return {
        success: false,
        code: 404,
        message: t('api.unified_auth.注册接口不存在请1') + responseMsg,
      }
    }

    // 规范化响应格式
    return normalizeLoginResponse(response, source)
  } catch (error: unknown) {
    let errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error')
    logger.error('[Unified Register] Registration failed', {
      source,
      error: errorMessage,
      errorDetails: error instanceof Error ? error.stack : undefined,
    })

    // 解析错误代码
    let errorCode = 500
    if (errorMessage.includes('404') || errorMessage.includes('Not Found') || errorMessage.includes('NOT_FOUND')) {
      errorCode = 404
    } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      errorCode = 401
    } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      errorCode = 403
    } else if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
      errorCode = 400
    }

    // 如果是axios错误，尝试提取后端返回的错误信息
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { msg?: string; message?: string; code?: number }; status?: number } }
      if (axiosError.response?.data) {
        const errorData = axiosError.response.data
        const extractedMsg = errorData.msg || errorData.message || errorMessage
        const extractedCode = errorData.code ?? (axiosError.response.status ?? errorCode)
        return {
          success: false,
          code: extractedCode,
          message: extractedMsg,
        }
      } else if (axiosError.response?.status) {
        errorCode = axiosError.response.status
        if (errorCode === 404) {
          errorMessage = '注册接口不存在，请检查后端服务是否正常运行'
        } else if (errorCode === 401) {
          errorMessage = '认证失败'
        } else if (errorCode === 403) {
          errorMessage = '权限不足'
        } else if (errorCode >= 500) {
          errorMessage = '服务器错误，请稍后重试'
        }
      }
    }

    return {
      success: false,
      code: errorCode,
      message: errorMessage,
    }
  }
}
