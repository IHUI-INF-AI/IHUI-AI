import { COZE_PATHS, LOGIN_PWD_PATHS } from '@/config/backend-paths'
import request from '@/utils/request'
import { t } from '@/utils/i18n'
import { logger } from '../utils/logger'
import type { ApiResponse } from '@/types'
import type { AuthResponse } from '@/api/auth/auth'
import { refreshAuthToken } from '@aizhs/shared-services'
import type { SharedRequestAdapter, SharedRequestConfig } from '@aizhs/shared-services'

// 类型别名，保持向后兼容
export type LoginResponseData = AuthResponse

// 从工具包导入响应处理函数
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 2026-06-25 优化: 委托 auth.service 消除 user.ts 与 auth.service 的实现重复
// 仅用于 login (见下), 不破坏向后兼容 (UserToken 类型被 UniversalLogin 等下游消费)
import { loginByPassword } from '@/api/services/auth.service'

// 响应数据规范化（使用工具包提供的函数）

// VIP等级VO (后端返回的等级详情)
export interface VipLevelVO {
  id?: string
  userUuid?: string
  vipLevelId?: string
  levelName: string      // 等级名称（后端配置）
  levelValue: number     // 等级值
  title?: string         // 等级标题（后端返回）
  level?: number         // 等级数值（后端返回）
  remark?: string        // 备注说明
  model1?: string        // 折扣比例
  model2?: string | null
  price?: number
  duration?: number
  description?: string
  benefits?: any
  expireTime?: string
  status?: number
  progress?: number      // 进度值
  // 用户 VIP 详情
  userVip?: {
    id?: string
    userUuid?: string
    vipId?: string
    progress?: number
    creator?: string
    createdTime?: string
    updator?: string | null
    updatedTime?: string
    isValid?: number     // 1-有效, 0-无效
    expireAt?: string | null
  }
}

// 用户信息相关接口
export interface UserInfoData {
  id: string
  uuid: string
  username: string
  email: string
  phone: string
  avatar: string
  nickname: string
  gender: number
  birthday: string
  signature: string
  status: number
  isVip: boolean
  inviteCode: string
  createTime: string
  updateTime: string
  lastPasswordChange?: string
  // 是否需要设置密码: 0-不需要, 1-需要
  needPwd?: number
  // 后端返回的VIP等级详情
  vipLevelVO?: VipLevelVO
  // 身份类型: 0-普通会员, 1-操盘手, 2-私董会
  identityType?: number
  identityTypy?: number  // 兼容后端拼写错误
  // 父级邀请人 ID
  parentId?: string
  // 用户角色（用于权限判断）
  roles?: string[]
}

// 用户认证信息
export interface UserAuthInfo {
  id: string
  userId: string
  realName: string
  idCard: string
  status: number
  auditTime: string
  auditRemark: string
  createTime: string
}

// ihui 用户信息（智汇智能体/API 侧）
export interface CozeUserInfo {
  id: string
  name: string
  email?: string
  avatar?: string
  [key: string]: any
}

// 用户资金信息
export interface UserFundInfo {
  id: string
  userId: string
  balance: number
  frozenAmount: number
  totalRecharge: number
  totalConsumption: number
  totalWithdraw: number
  updateTime: string
}

// 用户VIP信息
export interface UserVipInfo {
  id: string
  userId: string
  vipLevelId: string
  vipLevelName: string
  startTime: string
  endTime: string
  isExpired: boolean
  isActive: boolean
  privileges: string[]
}

// 用户登录日志
export interface UserLoginLog {
  id: string
  userId: string
  loginType: string
  loginIp: string
  loginAddress: string
  userAgent: string
  loginTime: string
  logoutTime: string
  status: number
}

// 用户第三方账号
export interface UserThirdPartyAccount {
  id: string
  userId: string
  platform: string
  platformUserId: string
  platformUsername: string
  platformAvatar: string
  bindTime: string
  status: number
}

// 用户Token信息
export interface UserToken {
  token: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

// VIP等级信息
export interface VipLevel {
  id: string
  name: string
  level: number
  price: number
  duration: number
  privileges: string[]
  description: string
  isActive: boolean
  sort: number
}

// 获取用户信息
export const getUserInfo = withApiResponseHandler(async (): Promise<ApiResponse<UserInfoData>> => {
  try {
    // 使用 Java 主后端（base: 2 -> /api），避免走 /api-kou
    const response = await request.get<UserInfoData>('/user/info', { base: 2 } as const)
    // 调试日志：查看 API 原始返回数据
    logger.debug('[getUserInfo] API raw response:', JSON.stringify(response, null, 2))
    const userData = normalizeApiResponse<UserInfoData>(response)
    logger.debug('[getUserInfo] Normalized data:', {
      nickname: (userData.data as unknown as Record<string, unknown>)?.nickname,
      email: (userData.data as unknown as Record<string, unknown>)?.email,
      phone: (userData.data as unknown as Record<string, unknown>)?.phone,
    })
    return userData
  } catch (error) {
    logger.error('Failed to get user info:', error)
    // 抛出错误，不再返回mock数据
    throw error
  }
})

// 更新用户信息
export const updateUserInfo = withApiResponseHandler(
  async (data: Partial<UserInfoData>): Promise<ApiResponse<UserInfoData>> => {
    const response = await request.put<UserInfoData>('/user/profile', data)
    return normalizeApiResponse(response)
  }
)

// 获取用户认证信息
export const getUserAuthInfo = withApiResponseHandler(
  async (): Promise<ApiResponse<UserAuthInfo>> => {
    const response = await request.get<UserAuthInfo>('/user/auth', {})
    return normalizeApiResponse(response)
  }
)

// 提交实名认证
export const submitUserAuth = withApiResponseHandler(
  async (data: { realName: string; idCard: string }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/user/auth', data)
    return normalizeApiResponse(response)
  }
)

// 查询智汇值（与小程序端一致）
export const getUserCoins = withApiResponseHandler(
  async (params: {
    userId: string
  }): Promise<ApiResponse<{ balance: number; frozen?: number; recharge_options?: any[] }>> => {
    const response = await request.get<{
      balance: number
      frozen?: number
      recharge_options?: any[]
    }>('/api/v1/user/coins', { params })
    return normalizeApiResponse(response)
  }
)

// 获取用户资金信息
export const getUserFundInfo = withApiResponseHandler(
  async (): Promise<ApiResponse<UserFundInfo>> => {
    const response = await request.get<UserFundInfo>('/user/fund', {})
    return normalizeApiResponse(response)
  }
)

// 获取用户VIP信息
export const getUserVipInfo = withApiResponseHandler(
  async (): Promise<ApiResponse<UserVipInfo>> => {
    const response = await request.get<UserVipInfo>('/user/vip', {})
    return normalizeApiResponse(response)
  }
)

// 获取用户登录日志
export const getUserLoginLogs = withApiResponseHandler(
  async (params: {
    page: number
    pageSize: number
  }): Promise<ApiResponse<{ list: UserLoginLog[]; total: number }>> => {
    const response = await request.get<{ list: UserLoginLog[]; total: number }>(
      '/user/login-logs',
      { params }
    )
    return normalizeApiResponse(response)
  }
)

// 获取用户第三方账号
export const getUserThirdPartyAccounts = withApiResponseHandler(
  async (): Promise<ApiResponse<UserThirdPartyAccount[]>> => {
    const response = await request.get<UserThirdPartyAccount[]>('/user/third-party-accounts', {})
    return normalizeApiResponse(response)
  }
)

// 绑定第三方账号
export const bindThirdPartyAccount = withApiResponseHandler(
  async (data: { platform: string; code: string }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/user/bind-third-party', data)
    return normalizeApiResponse(response)
  }
)

// 解绑第三方账号
export const unbindThirdPartyAccount = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<boolean>> => {
    const response = await request.delete<boolean>(`/user/unbind-third-party/${id}`)
    return normalizeApiResponse(response)
  }
)

// 获取VIP等级列表
export const getVipLevels = withApiResponseHandler(async (): Promise<ApiResponse<VipLevel[]>> => {
  const response = await request.get<VipLevel[]>('/vip/levels', {})
  return normalizeApiResponse(response)
})

// 获取VIP产品列表
export const getVipProducts = withApiResponseHandler(async (): Promise<ApiResponse<unknown[]>> => {
  const response = await request.get<unknown[]>('/vip/products', {})
  return normalizeApiResponse(response)
})

// 购买VIP
export const purchaseVip = withApiResponseHandler(
  async (data: {
    vipLevelId: string
    paymentMethod: string
  }): Promise<ApiResponse<{ orderId: string; paymentUrl?: string }>> => {
    const response = await request.post<{
      orderId: string
      paymentUrl?: string
    }>('/vip/purchase', data)
    return normalizeApiResponse(response)
  }
)

// 修改密码
export const changePassword = withApiResponseHandler(
  async (data: { oldPassword: string; newPassword: string }): Promise<ApiResponse<boolean>> => {
    // 2026-06-24 修复: 对齐后端 PUT /api/v1/auth/profile/password (Body: old_password, new_password)
    const response = await request.put<boolean>('/api/v1/auth/profile/password', {
      old_password: data.oldPassword,
      new_password: data.newPassword,
    })
    return normalizeApiResponse(response)
  }
)

// 重置密码
export const resetPassword = withApiResponseHandler(
  async (data: {
    email?: string
    phone?: string
    code: string
    newPassword: string
  }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/user/reset-password', data)
    return normalizeApiResponse(response)
  }
)

// 发送验证码
export const sendVerificationCode = withApiResponseHandler(
  async (data: {
    type: 'email' | 'phone'
    target: string
  }): Promise<ApiResponse<{ codeId: string }>> => {
    const response = await request.post<{ codeId: string }>('/user/send-code', data)
    return normalizeApiResponse(response)
  }
)

// 验证验证码
export const verifyCode = withApiResponseHandler(
  async (data: { codeId: string; code: string }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/user/verify-code', data)
    return normalizeApiResponse(response)
  }
)

// 上传头像
export const uploadAvatar = withApiResponseHandler(
  async (file: File): Promise<ApiResponse<{ url: string }>> => {
    // 使用文件上传接口上传头像
    const formData = new FormData()
    formData.append('file', file)
    const uploadResponseRaw = await request.post<{ url: string; id: string }>(
      '/fund/file/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )

    // 规范化响应
    const uploadResponse = normalizeApiResponse(uploadResponseRaw)

    // 如果上传成功，更新用户头像URL
    if (
      uploadResponse.code === 200 &&
      uploadResponse.data &&
      typeof uploadResponse.data === 'object' &&
      'url' in uploadResponse.data
    ) {
      const fileUrl = (uploadResponse.data as { url: string }).url
      const updateResponseRaw = await request.put<UserInfoData>('/user/profile', {
        avatar: fileUrl,
      })
      const updateResponse = normalizeApiResponse(updateResponseRaw)

      if (
        updateResponse.code === 200 &&
        updateResponse.data &&
        typeof updateResponse.data === 'object' &&
        'avatar' in updateResponse.data
      ) {
        return {
          code: 200,
          message: t('api.user.上传成功'),
          data: { url: (updateResponse.data as UserInfoData).avatar },
          success: true,
          timestamp: Date.now(),
        }
      }
    }

    // 如果上传成功但更新失败，返回上传的URL
    if (
      uploadResponse.code === 200 &&
      uploadResponse.data &&
      typeof uploadResponse.data === 'object' &&
      'url' in uploadResponse.data
    ) {
      return {
        code: 200,
        message: t('api.user.上传成功1'),
        data: { url: (uploadResponse.data as { url: string }).url },
        success: true,
        timestamp: Date.now(),
      }
    }

    throw new Error(t('error.user.上传失败2'))
  }
)

// 注销账号
export const deleteAccount = withApiResponseHandler(
  async (data: { password: string; reason: string }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/user/delete-account', data)
    return normalizeApiResponse(response)
  }
)

// 获取账号注销状态
export const getAccountDeletionStatus = withApiResponseHandler(
  async (): Promise<ApiResponse<{ status: string; submitTime?: string; processTime?: string }>> => {
    const response = await request.get<{
      status: string
      submitTime?: string
      processTime?: string
    }>('/user/deletion-status', {})
    return normalizeApiResponse(response)
  }
)

// 取消账号注销
export const cancelAccountDeletion = withApiResponseHandler(
  async (): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/user/cancel-deletion', {})
    return normalizeApiResponse(response)
  }
)

/**
 * 用户登录 (v1 简化版)
 * @deprecated 请使用 `@/api/services/auth.service` 中的 `loginByPassword` 函数
 * 2026-06-25 优化: 内部委托到 auth.service.loginByPassword, 消除实现重复
 * 行为不变: store/auth/index.ts:389 只传 username/password, 不传 captcha (captcha? 字段已被忽略)
 * 类型 cast: auth.service 返回 ApiResponse<LoginResponse>, 本函数历史返回 ApiResponse<UserToken>
 *   保持向后兼容, 下游 (UniversalLogin.vue:3408 等) 期望 UserToken 字段
 *   后续迭代可统一响应类型, 消除此 cast
 */
export const login = withApiResponseHandler(
  async (data: {
    username: string
    password: string
    captcha?: string
  }): Promise<ApiResponse<UserToken>> => {
    // 委托到 auth.service.loginByPassword
    const resp = await loginByPassword(data.username, data.password)
    return resp as unknown as ApiResponse<UserToken>
  }
)

/**
 * 用户登出
 * 2026-06-24 修复: 恢复调用后端 /api/v1/auth/logout 使 token 加入黑名单立即失效
 */
export const logout = withApiResponseHandler(async (): Promise<ApiResponse<boolean>> => {
  try {
    const response = await request.post<boolean>('/api/v1/auth/logout', {})
    return normalizeApiResponse(response)
  } catch {
    // 后端登出失败不阻塞本地清理
    return { code: 200, success: true, message: 'ok', data: true, timestamp: Date.now() }
  }
})

// 刷新Token
export const refreshToken = withApiResponseHandler(
  async (refreshToken: string): Promise<ApiResponse<UserToken>> => {
    const webAdapter: SharedRequestAdapter = {
      request<TResponse = unknown, TData = unknown>(config: SharedRequestConfig<TData>): Promise<TResponse> {
        return request({
          url: config.url,
          method: config.method || 'GET',
          data: config.data,
          params: config.params,
          headers: config.headers,
          timeout: config.timeout,
          base: config.base,
        } as unknown as Parameters<typeof request>[0]) as Promise<TResponse>
      },
    }

    const response = await refreshAuthToken(webAdapter, {
      refreshToken,
      platformType: 'web',
    })
    const data = response.data
    const tokenData: UserToken =
      typeof data === 'string'
        ? {
            token: data,
            refreshToken,
            expiresIn: 0,
            tokenType: 'Bearer',
          }
        : {
            token: data?.token || data?.accessToken || data?.access_token || '',
            refreshToken: data?.refreshToken || data?.refresh_token || refreshToken,
            expiresIn: data?.expiresIn || data?.expires_in || 0,
            tokenType: data?.tokenType || data?.token_type || 'Bearer',
          }

    return {
      code: typeof response.code === 'string' ? parseInt(response.code, 10) : response.code,
      message: response.message || response.msg || 'success',
      data: tokenData,
      success: response.success ?? (response.code === 200 || response.code === '200'),
      timestamp: response.timestamp || Date.now(),
    }
  }
)

/**
 * 用户注册 - 完全匹配后端数据库字段
 * @deprecated 请使用 `@/api/services/auth.service` 中的 `register` 函数
 */
export const register = withApiResponseHandler(
  async (data: {
    username: string
    password: string
    email: string
    phone?: string
    code?: string
    captcha?: string
    inviteCode?: string
  }): Promise<ApiResponse<UserToken | LoginResponseData>> => {
    // 构建请求数据，完全匹配后端数据库字段
    const requestData: {
      username: string
      password: string
      email: string
      phone?: string
      code?: string
      captcha?: string
      inviteCode?: string
    } = {
      username: data.username,
      password: data.password,
      email: data.email,
    }

    // 可选字段
    if (data.phone) requestData.phone = data.phone
    if (data.code) requestData.code = data.code
    if (data.captcha) requestData.captcha = data.captcha
    if (data.inviteCode) requestData.inviteCode = data.inviteCode

    const response = await request.post<UserToken | LoginResponseData>(
      '/auth/register',
      requestData
    )
    return normalizeApiResponse(response)
  }
)

// 修改密码
export const updatePassword = withApiResponseHandler(
  async (data: { oldPassword: string; newPassword: string }): Promise<ApiResponse<boolean>> => {
    // 2026-06-24 修复: 对齐后端 PUT /api/v1/auth/profile/password (Body: old_password, new_password)
    const response = await request.put<boolean>('/api/v1/auth/profile/password', {
      old_password: data.oldPassword,
      new_password: data.newPassword,
    })
    return normalizeApiResponse(response)
  }
)

// 检查微信登录状态
export const checkWechatLoginStatus = withApiResponseHandler(
  async (code: string): Promise<ApiResponse<unknown>> => {
    const response = await request.get<unknown>(`/api/auth/wechat/check?code=${code}`, {})
    return normalizeApiResponse(response)
  }
)

// 发送手机登录验证码（第一步）
export const sendPhoneLoginCode = withApiResponseHandler(
  async (
    phone: string,
    tempId?: number,
    tempCode?: string
  ): Promise<ApiResponse<string>> => {
    let cleanPhone = phone.replace(/[\s+-]/g, '')
    if (cleanPhone.startsWith('86') && cleanPhone.length === 13) {
      cleanPhone = cleanPhone.substring(2)
    }

    const requestData: {
      phone: string
      tempId?: number
      tempCode?: string
    } = {
      phone: cleanPhone,
    }
    if (tempId !== undefined) {
      requestData.tempId = tempId
    }
    if (tempCode !== undefined && tempCode.trim() !== '') {
      requestData.tempCode = tempCode
    }

    const response = await request.post<string>(LOGIN_PWD_PATHS.smsVerify, requestData, {
      headers: {
        'platform-type': 'web'
      }
    })
    return normalizeApiResponse(response)
  }
)

// 验证验证码并获取临时密钥（第二步）
export const verifyPhoneCode = withApiResponseHandler(
  async (data: { phone: string; code: string }): Promise<ApiResponse<string>> => {
    let normalizedPhone = data.phone.replace(/[\s+-]/g, '')
    if (normalizedPhone.startsWith('86') && normalizedPhone.length === 13) {
      normalizedPhone = normalizedPhone.substring(2)
    }

    // 安全修复：移除硬编码管理员验证，所有验证码校验都通过后端完成
    const response = await request.post<string>(
      LOGIN_PWD_PATHS.verify,
      {
        phone: normalizedPhone,
        code: data.code,
      },
      {
        // 登录前接口不会走“已登录(token)后自动补 platform-type”的拦截逻辑，这里需要显式带上
        headers: {
          'platform-type': 'web',
        },
      }
    )

    // 添加详细日志
    logger.info('[verifyPhoneCode] Raw response:', JSON.stringify(response, null, 2))

    // 处理后端返回的格式：{ code: "200", msg: "success", data: "临时密钥" }
    let normalizedResponse: ApiResponse<string>

    // 检查是否是 axios 响应格式（response.data 包含实际数据）
    if (response && typeof response === 'object' && 'data' in response) {
      const axiosResponse = response as { data: any }
      const responseData = axiosResponse.data

      // 处理后端格式：{ code: "200" | 200, msg: "success", data: "临时密钥" }
      if (
        responseData &&
        typeof responseData === 'object' &&
        responseData !== null &&
        ('code' in responseData || 'msg' in responseData)
      ) {
        const resp = responseData as {
          code?: string | number
          msg?: string
          message?: string
          data?: string
        }

        // 转换 code 为数字
        const codeNum =
          typeof resp.code === 'string' ? parseInt(resp.code, 10) : resp.code || 200

        // 使用 msg 或 message
        const message = resp.msg || resp.message || 'success'

        normalizedResponse = {
          code: codeNum,
          message: message,
          data: (resp.data || '') as string,
          success: codeNum === 200,
          timestamp: Date.now(),
        }
      } else {
        // 如果 data 不是对象格式，直接使用 normalizeApiResponse
        normalizedResponse = normalizeApiResponse<string>(response)
      }
    } else {
      // 直接使用 normalizeApiResponse
      normalizedResponse = normalizeApiResponse<string>(response)
    }

    logger.info('[verifyPhoneCode] Normalized response:', JSON.stringify(normalizedResponse, null, 2))
    logger.info('[verifyPhoneCode] Temp key:', normalizedResponse.data)

    // 检查响应是否成功
    if (!normalizedResponse.success || !normalizedResponse.data) {
      logger.error('[verifyPhoneCode] Verification failed:', {
        code: normalizedResponse.code,
        message: normalizedResponse.message,
        data: normalizedResponse.data,
      })
      throw new Error(normalizedResponse.message || '校验验证码失败')
    }

    return normalizedResponse
  }
)

// 兼容旧接口名称
export const phoneLogin = verifyPhoneCode

// 使用临时密钥完成登录/注册（第三步）
export const completePhoneLogin = withApiResponseHandler(
  async (data: {
    phone: string
    password?: string
    tempKey: string
    parentId?: string
    unionId?: string
    openId?: string
    platformType?: string // 微信登录平台类型（需要时传给后端）
  }): Promise<ApiResponse<UserToken | LoginResponseData>> => {
    let normalizedPhone = data.phone.replace(/[\s+-]/g, '')
    if (normalizedPhone.startsWith('86') && normalizedPhone.length === 13) {
      normalizedPhone = normalizedPhone.substring(2)
    }

    // 默认请求头 platform-type: web；其他登录方式（如微信绑定）传入 platformType 时会覆盖该默认值
    const platformTypeHeader = data.platformType?.trim() || 'web'

    // 兼容微信/支付宝等绑定：openId 必传（有则传），unionId 仅非空时传（空的就不传），platform-type 有则传
    const requestData: Record<string, string> = {
      phone: normalizedPhone,
      password: data.password || '',
      parentId: data.parentId || '',
      openId: data.openId || '',
      ...(data.platformType && data.platformType.trim() !== ''
        ? { 'platform-type': data.platformType }
        : {}),
      ...(data.unionId && data.unionId.trim() !== '' ? { unionId: data.unionId } : {}),
    }

    logger.info('[completePhoneLogin] Full request data:', {
      url: LOGIN_PWD_PATHS.registerLogin,
      method: 'POST',
      data: requestData,
      headers: {
        EditAuth: data.tempKey,
        'platform-type': platformTypeHeader,
      },
    })

    const response = await request({
      url: LOGIN_PWD_PATHS.registerLogin,
      method: 'POST',
      data: requestData,
      headers: {
        EditAuth: data.tempKey,
        'platform-type': platformTypeHeader,
      }
    })

    // 处理后端返回的格式：{ code: "200" | 200, msg: "success", data: {...} }
    let normalizedResponse: ApiResponse<UserToken | LoginResponseData>

    // 检查是否是 axios 响应格式（response.data 包含实际数据）
    if (response && typeof response === 'object' && 'data' in response) {
      const axiosResponse = response as { data: any }
      const responseData = axiosResponse.data

      // 处理后端格式：{ code: "200" | 200, msg: "success", data: {...} }
      if (
        responseData &&
        typeof responseData === 'object' &&
        responseData !== null &&
        ('code' in responseData || 'msg' in responseData)
      ) {
        const resp = responseData as {
          code?: string | number
          msg?: string
          message?: string
          data?: any
        }

        // 转换 code 为数字
        const codeNum =
          typeof resp.code === 'string' ? parseInt(resp.code, 10) : resp.code || 200

        // 使用 msg 或 message
        const message = resp.msg || resp.message || 'success'

        normalizedResponse = {
          code: codeNum,
          message: message,
          data: (resp.data || {}) as UserToken | LoginResponseData,
          success: codeNum === 200 && resp.data !== undefined && resp.data !== null,
          timestamp: Date.now(),
        }
      } else {
        // 如果 data 不是对象格式，直接使用 normalizeApiResponse
        normalizedResponse = normalizeApiResponse<UserToken | LoginResponseData>(response)
        // 确保 success 字段正确设置
        const codeNum = typeof normalizedResponse.code === 'string'
          ? parseInt(normalizedResponse.code, 10)
          : normalizedResponse.code
        if (codeNum === 200 && normalizedResponse.data) {
          normalizedResponse.success = true
        }
      }
    } else {
      // 直接使用 normalizeApiResponse
      normalizedResponse = normalizeApiResponse<UserToken | LoginResponseData>(response)
      // 确保 success 字段正确设置
      const codeNum = typeof normalizedResponse.code === 'string'
        ? parseInt(normalizedResponse.code, 10)
        : normalizedResponse.code
      if (codeNum === 200 && normalizedResponse.data) {
        normalizedResponse.success = true
      }
    }

    // 打印后台返回的用户数据
    logger.info('[completePhoneLogin] ========== User data returned from backend ==========')
    logger.info('[completePhoneLogin] Full response:', normalizedResponse)
    if (normalizedResponse.data) {
      logger.info('[completePhoneLogin] Response data:', normalizedResponse.data)
      if (typeof normalizedResponse.data === 'object') {
        const data = normalizedResponse.data as unknown as Record<string, unknown>
        if ('token' in data || 'accessToken' in data) {
          logger.info('[completePhoneLogin] Token:', data.token || data.accessToken)
        }
        if ('user' in data || 'userInfo' in data) {
          logger.info('[completePhoneLogin] User info:', data.user || data.userInfo)
        }
        if ('refreshToken' in data) {
          logger.info('[completePhoneLogin] RefreshToken:', data.refreshToken)
        }
      }
    }
    logger.info('[completePhoneLogin] =========================================')

    return normalizedResponse
  }
)

// 第三方登录回调处理
export const handleThirdPartyCallback = withApiResponseHandler(
  async (data: {
    platform: string
    code: string
    state?: string
  }): Promise<ApiResponse<UserToken & { user: UserInfoData }>> => {
    const response = await request.post<UserToken & { user: UserInfoData }>(
      '/auth/third-party/callback',
      data
    )
    return normalizeApiResponse(response)
  }
)

// 获取第三方登录配置
export const getThirdPartyLoginConfig = withApiResponseHandler(
  async (): Promise<
    ApiResponse<{
      wechat: { enabled: boolean; appId: string }
      alipay: { enabled: boolean; appId: string }
    }>
  > => {
    const response = await request.get<{
      wechat: { enabled: boolean; appId: string }
      alipay: { enabled: boolean; appId: string }
    }>('/auth/third-party/config', {})
    return normalizeApiResponse(response)
  }
)

// 获取用户订单
export const getUserOrders = withApiResponseHandler(
  async (params?: {
    page?: number
    pageSize?: number
    status?: string
  }): Promise<ApiResponse<unknown>> => {
    const response = await request.get<unknown>('/user/orders', { params })
    return normalizeApiResponse(response)
  }
)

// 获取用户 ihui 信息
export const getUserCozeInfo = withApiResponseHandler(
  async (): Promise<ApiResponse<CozeUserInfo>> => {
    const response = await request({
      url: COZE_PATHS.users.meCoze,
      method: 'GET',
      base: 3,
    })
    return normalizeApiResponse(response)
  }
)

// 绑定用户信息
export const bindUserNew = withApiResponseHandler(
  async (data: {
    username: string
    phone: string
    avatarUrl: string
    fileName: string
  }): Promise<ApiResponse<unknown>> => {
    const response = await request.post<unknown>(COZE_PATHS.users.bind, data)
    return normalizeApiResponse(response)
  }
)

// 设置邮箱
export const setEmail = withApiResponseHandler(
  async (params: { uuid: string; email: string }): Promise<ApiResponse<unknown>> => {
    const response = await request.post<unknown>(
      LOGIN_PWD_PATHS.setEmail,
      params
    )
    return normalizeApiResponse(response)
  }
)

// 设置/绑定密码（第三方登录后补齐密码）
// 兼容调用方传参：AccountBindDialog.vue 传 { phone, password }
export const setPwd = withApiResponseHandler(
  async (params: {
    phone: string
    password: string
    uuid?: string
  }): Promise<ApiResponse<unknown>> => {
    // 某些后端实现要求临时授权头（EditAuth）。这里尝试从统一存储里读取（若不存在则不带）。
    let editAuth: string | null = null
    try {
      const { StorageManager, STORAGE_KEYS } = await import('@/utils/storage')
      editAuth = StorageManager.getItem<string>(STORAGE_KEYS.TEMP_AUTH_KEY)
    } catch (_e) {
      // 忽略：不影响正常 token 鉴权场景
    }

    const response = await request.post<unknown>(
      LOGIN_PWD_PATHS.modifyPassword,
      {
        phone: params.phone,
        password: params.password,
        uuid: params.uuid,
      },
      editAuth
        ? {
            headers: {
              EditAuth: editAuth,
            },
          }
        : undefined
    )
    return normalizeApiResponse(response)
  }
)
