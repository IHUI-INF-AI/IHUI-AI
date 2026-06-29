// UserAuth API 调用
// 创建时间: 2025-12-15

import { request } from '@/utils/request'
import { logger } from '@/utils/logger'
import { AUTH_PATHS, LOGIN_PWD_PATHS } from '@/config/backend-paths'
// shared-logic: cross-platform utilities available for use
// import { request as sharedRequest } from '@aizhs/shared-logic'

// 用户接口定义
export interface User {
  id: number
  username: string
  email: string
  role: 'guest' | 'user' | 'vip' | 'admin' | 'super_admin'
  status: 'active' | 'inactive' | 'banned'
  email_verified: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export interface LoginRequest {
  identifier: string // 用户名或邮箱
  password: string
  remember?: boolean
  captcha?: string // 验证码
  uuid?: string // 验证码UUID
}

export interface AuthResponse {
  success: boolean
  message: string
  user?: User
  token?: string
  refreshToken?: string
}

export interface UpdateProfileRequest {
  username?: string
  email?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

/**
 * 用户注册
 * @deprecated 请使用 `@/api/services/auth.service` 中的 `register` 函数
 * 连接到192.168.1.25:8080
 * 根据Swagger文档，后端注册接口是 /login/pwd/registerLogin
 */
export const register = async (data: RegisterRequest): Promise<AuthResponse> => {
  // 优先使用 /login/pwd/registerLogin（账密注册接口）
  // 如果后端支持 /api/auth/register，也可以使用
  try {
    return await request.post(LOGIN_PWD_PATHS.registerLogin, {
      username: data.username,
      password: data.password,
      email: data.email,
    })
  } catch (error) {
    logger.warn('Registration API failed, trying fallback to /api/auth/register:', error)
    return request.post(AUTH_PATHS.register, data)
  }
}

/**
 * 用户登录
 * @deprecated 请使用 `@/api/services/auth.service` 中的 `login` 函数
 * 总管理端：POST /auth/login，body: username, password, code, uuid
 */
export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  return request.post(
    AUTH_PATHS.login,
    {
      username: data.identifier,
      password: data.password,
      code: data.captcha ?? '',
      uuid: data.uuid ?? '',
    },
    { headers: { 'platform-type': 'web' } }
  )
}

// 刷新Token（根据Swagger文档，使用 /login/pwd/refreshToken）
export const refreshToken = async (refreshToken: string): Promise<AuthResponse> => {
  return request.post(LOGIN_PWD_PATHS.refreshToken, { refreshToken })
}

/**
 * 用户登出
 * @deprecated 请使用 `@/api/services/auth.service` 中的 `logout` 函数
 * 已移除 auth/logout 接口
 * @deprecated 请使用 `@/api/services/auth.service` 中的 `logout` 函数
 */
export const logout = async (): Promise<{ success: boolean; message: string }> => {
  return { success: true, message: 'ok' }
}

// 获取当前用户信息
// ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
export const getCurrentUser = async (): Promise<{
  success: boolean
  message: string
  user: User
}> => {
  return request.get(AUTH_PATHS.profile)
}

// 更新用户信息
// ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
export const updateProfile = async (
  data: UpdateProfileRequest
): Promise<{ success: boolean; message: string; user: User }> => {
  return request.put(AUTH_PATHS.profile, data)
}

// 修改密码（根据Swagger文档，使用 /login/pwd/editPasswd）
export const changePassword = async (
  data: ChangePasswordRequest
): Promise<{ success: boolean; message: string }> => {
  return request.post(LOGIN_PWD_PATHS.editPasswd, {
    oldPassword: data.currentPassword,
    newPassword: data.newPassword,
  })
}

// 健康检查
// ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
export const healthCheck = async (): Promise<{
  success: boolean
  message: string
  timestamp: string
  version: string
}> => {
  return request.get(AUTH_PATHS.health)
}

// ==================== 从 api/login.ts 迁移的额外功能 ====================

import { StorageManager, STORAGE_KEYS, TokenStorage } from '@/utils/storage'
import axios from 'axios'
import { getBaseUrl } from '@/config/api-config'
import { ElMessage } from 'element-plus'
import { t } from '@/utils/i18n'

const baseUrl2 = getBaseUrl(2)

/**
 * 音频转文字响应
 */
export interface AudioTextResponse {
  text: string
  duration?: number
  language?: string
}

/**
 * 预注册登录（微信/OpenID登录）
 */
export function loginByOpenId(open_id: string, parentId?: string) {
  return request({
    url: '/login/login',
    method: 'POST',
    data: { open_id, parentId },
  })
}

/**
 * 用户绑定接口（旧版本）
 */
export function bindUser(
  open_id: string,
  nickname: string,
  phone: string,
  avatar: string,
  fileName?: string
) {
  return request({
    url: '/auth_accounts/bind',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: { open_id, nickname, phone, avatar, fileName },
    base: 2,
  })
}

/**
 * 用户绑定接口（新版本）
 */
export function bindUserNew(
  nickname: string,
  phone: string,
  avatar: string,
  fileName?: string
) {
  return new Promise((resolve, reject) => {
    const userData = StorageManager.getItem<{
      thirdPartyAccounts?: { accessToken?: string }
    }>(STORAGE_KEYS.USER_DATA)
    const zhsToken = userData?.thirdPartyAccounts

    axios
      .request({
        url: `${baseUrl2}/auth_accounts/bind`,
        method: 'POST',
        headers: {
          Authorization: zhsToken?.accessToken ? `Bearer ${zhsToken.accessToken}` : '',
          'platform-type': 'web',
        },
        data: { nickname, phone, avatar, fileName },
      })
      .then((res) => {
        resolve(res)
      })
      .catch((err) => {
        ElMessage.error(t('msg.login.请求失败'))
        reject(err)
      })
  })
}

/**
 * 发送手机号验证码（旧版本）- 走 /api 代理
 */
export function sendTextMsg(phone: string, tempId: string, tempCode: string) {
  const userData = StorageManager.getItem<{
    thirdPartyAccounts?: { accessToken?: string }
  }>(STORAGE_KEYS.USER_DATA)
  const zhsToken = userData?.thirdPartyAccounts
  return request
    .post(LOGIN_PWD_PATHS.smsVerify, { phone, tempId, tempCode }, {
      headers: {
        Authorization: zhsToken?.accessToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': 'web',
      },
    })
    .then((res) => res)
    .catch((err) => {
      ElMessage.error(t('msg.login.请求失败1'))
      throw err
    })
}

/**
 * 发送手机号验证码（新版本 - verify）- 走 /api 代理
 */
export function sendTextMsgNew(phone: string, code: string) {
  const userData = StorageManager.getItem<{
    thirdPartyAccounts?: { accessToken?: string }
  }>(STORAGE_KEYS.USER_DATA)
  const zhsToken = userData?.thirdPartyAccounts
  return request
    .post(LOGIN_PWD_PATHS.verify, { phone, code }, {
      headers: {
        Authorization: zhsToken?.accessToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': 'web',
      },
    })
    .then((res) => res)
    .catch((err) => {
      ElMessage.error(t('msg.login.请求失败2'))
      throw err
    })
}

/**
 * 发送手机号验证码（编辑版本）- 走 /api 代理
 */
export function sendTextMsgEdit(phone: string, code: string) {
  const zhsToken = TokenStorage.getToken()
  return request
    .post(LOGIN_PWD_PATHS.verify, { phone, code }, {
      headers: {
        EditAuth: zhsToken ? `Bearer ${zhsToken}` : '',
        'platform-type': 'web',
      },
    })
    .then((res) => res)
    .catch((err) => {
      ElMessage.error(t('msg.login.请求失败3'))
      throw err
    })
}

/**
 * 注册登录（手机号+密码）- 走 /api 代理
 */
export function registerLogin(phone: string, password: string, parentId?: string) {
  const zhsToken = TokenStorage.getToken()
  return request
    .post(LOGIN_PWD_PATHS.registerLogin, { phone, password, parentId }, {
      headers: {
        Authorization: zhsToken || '',
        'platform-type': 'web',
      },
    })
    .then((res) => res)
    .catch((err) => {
      ElMessage.error(t('msg.login.请求失败4'))
      throw err
    })
}

/**
 * 用户登录（手机号+密码）- 走 /api 代理
 */
export function userLogin(phone: string, password: string, code?: string) {
  const userData = StorageManager.getItem<{
    thirdPartyAccounts?: { accessToken?: string }
  }>(STORAGE_KEYS.USER_DATA)
  const zhsToken = userData?.thirdPartyAccounts
  return request
    .post(LOGIN_PWD_PATHS.login, { phone, password, code }, {
      headers: {
        Authorization: zhsToken?.accessToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': 'web',
      },
    })
    .then((res) => res)
    .catch((err) => {
      ElMessage.error(t('msg.login.请求失败5'))
      throw err
    })
}

/**
 * 修改手机号 - 走 /api 代理
 */
export function editPhone(phone: string, code: string, uuid: string) {
  const zhsToken = TokenStorage.getToken()
  return request
    .post(LOGIN_PWD_PATHS.replacePhone, { phone, code, uuid }, {
      headers: {
        EditAuth: `Bearer ${zhsToken}`,
        'platform-type': 'web',
      },
    })
    .then((res) => res)
    .catch((err) => {
      ElMessage.error(t('msg.login.请求失败8'))
      throw err
    })
}

/**
 * 批量发送短信验证码 - 走 /api 代理
 */
export function sendBatchSms(data: {
  phones: string[]
  tempId?: string
  tempCode?: string
}): Promise<unknown> {
  const userData = StorageManager.getItem<{
    thirdPartyAccounts?: { accessToken?: string }
  }>(STORAGE_KEYS.USER_DATA)
  const zhsToken = userData?.thirdPartyAccounts
  return request
    .post(LOGIN_PWD_PATHS.sendBatchSms, data, {
      headers: {
        Authorization: zhsToken?.accessToken ? `Bearer ${zhsToken.accessToken}` : '',
        'platform-type': 'web',
        'content-type': 'application/json',
      },
    })
    .then((res) => res)
    .catch((err) => {
      ElMessage.error(t('msg.login.批量发送短信验证9'))
      throw err
    })
}

/**
 * 获取音频转文字
 */
export function fetchAudioText(file: File | Blob): Promise<AudioTextResponse> {
  return new Promise((resolve, reject) => {
    const userData = StorageManager.getItem<{
      thirdPartyAccounts?: { accessToken?: string }
    }>(STORAGE_KEYS.USER_DATA)
    const zhsToken = userData?.thirdPartyAccounts

    axios
      .request({
        url: `${baseUrl2}/remote/get/tencent/sentence`,
        method: 'POST',
        headers: {
          Authorization: zhsToken?.accessToken ? `Bearer ${zhsToken.accessToken}` : '',
          'platform-type': 'web',
        },
        data: { file },
      })
      .then((res) => {
        resolve(res.data)
      })
      .catch((err) => {
        ElMessage.error(t('msg.login.请求失败7'))
        reject(err)
      })
  })
}
