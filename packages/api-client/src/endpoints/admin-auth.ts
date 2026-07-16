/**
 * B 端用户中心管理 API
 * 对接后端 apps/api/src/routes/admin/ 下 auth-* / user-roles / system-login-logs 模块,
 * 覆盖 auth-accounts / auth-info / auth-role / auth-tokens / auth-user-vip / auth-vip-level / auth-sms-temp / user-roles / login-logs 九大模块。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs, type PageData, type PageQuery } from '../utils'

// ===================== 类型定义 =====================

/** 第三方账号关联(userThirdPartyAccounts) */
export interface AuthAccount {
  id: string
  userId: string
  platform: string
  openId?: string
  unionId?: string
  nickname?: string
  avatar?: string
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

/** 用户认证身份信息(userAuthInfo) */
export interface AuthInfo {
  id: string
  userUuid: string
  phone?: string | null
  authStatus?: string
  realName?: string | null
  idCard?: string | null
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

/** 角色(roles) */
export interface AuthRole {
  id: string
  name: string
  displayName: string
  description?: string | null
  scope?: string
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

/** 用户令牌(userSk) */
export interface AuthToken {
  id: string
  userId: string
  key: string
  name?: string
  status?: number
  expiresAt?: string
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

/** 用户 VIP 进度(userVips) */
export interface AuthUserVip {
  id: string
  userId: string
  vipLevelId?: string | number
  startTime?: string
  endTime?: string
  status?: number
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

/** VIP 等级(vipLevels) */
export interface AuthVipLevel {
  id: string
  levelName: string
  levelValue?: number
  price?: number
  durationDays?: number
  status?: number
  sortOrder?: number
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

/** 短信模板(messageTemplates, channel=sms) */
export interface AuthSmsTemp {
  id: string
  code: string
  channel: string
  title: string
  content: string
  status?: number
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

/** 用户角色关联(userRoles) */
export interface AuthUserRole {
  id: string
  userId: string
  roleId: string
  scopeResourceId?: string | null
  createdAt: string
  [key: string]: unknown
}

/** 登录日志(sysLogininfor) */
export interface LoginLog {
  infoId?: number
  loginName?: string
  ipaddr?: string
  loginLocation?: string
  browser?: string
  os?: string
  status?: string
  msg?: string
  loginTime?: string
  [key: string]: unknown
}

/** 通用删除结果 */
export interface DeleteResult {
  id: string
  deleted: boolean
}

// ===================== auth-accounts（第三方账号关联） =====================

export async function listAuthAccounts(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AuthAccount>>> {
  return fetchApi<PageData<AuthAccount>>(`/api/admin/auth-accounts${buildQs(params)}`)
}

export async function getAuthAccount(id: string): Promise<ApiResult<AuthAccount>> {
  return fetchApi<AuthAccount>(`/api/admin/auth-accounts/${id}`)
}

export async function addAuthAccount(
  body: Partial<AuthAccount> & { userId: string; platform: string },
): Promise<ApiResult<AuthAccount>> {
  return fetchApi<AuthAccount>('/api/admin/auth-accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAuthAccount(
  id: string,
  body: Partial<AuthAccount>,
): Promise<ApiResult<AuthAccount>> {
  return fetchApi<AuthAccount>(`/api/admin/auth-accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delAuthAccount(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/auth-accounts/${id}`, { method: 'DELETE' })
}

// ===================== auth-info（用户认证身份信息） =====================

export async function listAuthInfo(params: PageQuery = {}): Promise<ApiResult<PageData<AuthInfo>>> {
  return fetchApi<PageData<AuthInfo>>(`/api/admin/auth-info${buildQs(params)}`)
}

export async function getAuthInfo(id: string): Promise<ApiResult<AuthInfo>> {
  return fetchApi<AuthInfo>(`/api/admin/auth-info/${id}`)
}

export async function addAuthInfo(
  body: Partial<AuthInfo> & { userUuid: string },
): Promise<ApiResult<AuthInfo>> {
  return fetchApi<AuthInfo>('/api/admin/auth-info', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAuthInfo(
  id: string,
  body: { phone?: string | null; authStatus?: string; realName?: string | null },
): Promise<ApiResult<AuthInfo>> {
  return fetchApi<AuthInfo>(`/api/admin/auth-info/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delAuthInfo(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/auth-info/${id}`, { method: 'DELETE' })
}

// ===================== auth-role（角色） =====================

export async function listAuthRoles(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AuthRole>>> {
  return fetchApi<PageData<AuthRole>>(`/api/admin/auth-role${buildQs(params)}`)
}

export async function getAuthRole(id: string): Promise<ApiResult<AuthRole>> {
  return fetchApi<AuthRole>(`/api/admin/auth-role/${id}`)
}

export async function addAuthRole(body: {
  name: string
  displayName: string
  description?: string | null
  scope?: string
}): Promise<ApiResult<AuthRole>> {
  return fetchApi<AuthRole>('/api/admin/auth-role', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAuthRole(
  id: string,
  body: {
    name?: string
    displayName?: string
    description?: string | null
    scope?: string
  },
): Promise<ApiResult<AuthRole>> {
  return fetchApi<AuthRole>(`/api/admin/auth-role/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delAuthRole(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/auth-role/${id}`, { method: 'DELETE' })
}

// ===================== auth-tokens（用户令牌） =====================

export async function listAuthTokens(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AuthToken>>> {
  return fetchApi<PageData<AuthToken>>(`/api/admin/auth-tokens${buildQs(params)}`)
}

export async function getAuthToken(id: string): Promise<ApiResult<AuthToken>> {
  return fetchApi<AuthToken>(`/api/admin/auth-tokens/${id}`)
}

export async function addAuthToken(
  body: Partial<AuthToken> & { userId: string; key: string },
): Promise<ApiResult<AuthToken>> {
  return fetchApi<AuthToken>('/api/admin/auth-tokens', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAuthToken(
  id: string,
  body: Partial<AuthToken>,
): Promise<ApiResult<AuthToken>> {
  return fetchApi<AuthToken>(`/api/admin/auth-tokens/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delAuthToken(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/auth-tokens/${id}`, { method: 'DELETE' })
}

// ===================== auth-user-vip（用户 VIP 进度） =====================

export async function listAuthUserVip(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AuthUserVip>>> {
  return fetchApi<PageData<AuthUserVip>>(`/api/admin/auth-user-vip${buildQs(params)}`)
}

export async function getAuthUserVip(id: string): Promise<ApiResult<AuthUserVip>> {
  return fetchApi<AuthUserVip>(`/api/admin/auth-user-vip/${id}`)
}

export async function addAuthUserVip(
  body: Partial<AuthUserVip> & { userId: string },
): Promise<ApiResult<AuthUserVip>> {
  return fetchApi<AuthUserVip>('/api/admin/auth-user-vip', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAuthUserVip(
  id: string,
  body: Partial<AuthUserVip>,
): Promise<ApiResult<AuthUserVip>> {
  return fetchApi<AuthUserVip>(`/api/admin/auth-user-vip/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delAuthUserVip(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/auth-user-vip/${id}`, { method: 'DELETE' })
}

// ===================== auth-vip-level（VIP 等级） =====================

export async function listAuthVipLevels(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AuthVipLevel>>> {
  return fetchApi<PageData<AuthVipLevel>>(`/api/admin/auth-vip-level${buildQs(params)}`)
}

export async function getAuthVipLevel(id: string): Promise<ApiResult<AuthVipLevel>> {
  return fetchApi<AuthVipLevel>(`/api/admin/auth-vip-level/${id}`)
}

export async function addAuthVipLevel(body: {
  levelName: string
  levelValue?: number
  price?: number
  durationDays?: number
  status?: number
  sortOrder?: number
}): Promise<ApiResult<AuthVipLevel>> {
  return fetchApi<AuthVipLevel>('/api/admin/auth-vip-level', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAuthVipLevel(
  id: string,
  body: {
    levelName?: string
    levelValue?: number
    price?: number
    durationDays?: number
    status?: number
    sortOrder?: number
  },
): Promise<ApiResult<AuthVipLevel>> {
  return fetchApi<AuthVipLevel>(`/api/admin/auth-vip-level/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delAuthVipLevel(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/auth-vip-level/${id}`, { method: 'DELETE' })
}

// ===================== auth-sms-temp（短信模板） =====================

export async function listAuthSmsTemps(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AuthSmsTemp>>> {
  return fetchApi<PageData<AuthSmsTemp>>(`/api/admin/auth-sms-temp${buildQs(params)}`)
}

export async function getAuthSmsTemp(id: string): Promise<ApiResult<AuthSmsTemp>> {
  return fetchApi<AuthSmsTemp>(`/api/admin/auth-sms-temp/${id}`)
}

export async function addAuthSmsTemp(body: {
  code: string
  title: string
  content: string
  status?: number
}): Promise<ApiResult<AuthSmsTemp>> {
  return fetchApi<AuthSmsTemp>('/api/admin/auth-sms-temp', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAuthSmsTemp(
  id: string,
  body: { title?: string; content?: string; status?: number },
): Promise<ApiResult<AuthSmsTemp>> {
  return fetchApi<AuthSmsTemp>(`/api/admin/auth-sms-temp/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delAuthSmsTemp(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/auth-sms-temp/${id}`, { method: 'DELETE' })
}

// ===================== user-roles（用户角色关联） =====================

export async function listUserRoles(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AuthUserRole>>> {
  return fetchApi<PageData<AuthUserRole>>(`/api/admin/user-roles${buildQs(params)}`)
}

export async function getUserRole(id: string): Promise<ApiResult<AuthUserRole>> {
  return fetchApi<AuthUserRole>(`/api/admin/user-roles/${id}`)
}

export async function addUserRole(body: {
  userId: string
  roleId: string
  scopeResourceId?: string | null
}): Promise<ApiResult<AuthUserRole>> {
  return fetchApi<AuthUserRole>('/api/admin/user-roles', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateUserRole(
  id: string,
  body: Partial<AuthUserRole>,
): Promise<ApiResult<AuthUserRole>> {
  return fetchApi<AuthUserRole>(`/api/admin/user-roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delUserRole(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/user-roles/${id}`, { method: 'DELETE' })
}

// ===================== login-logs（登录日志） =====================

export async function listLoginLogs(
  params: PageQuery = {},
): Promise<ApiResult<PageData<LoginLog>>> {
  return fetchApi<PageData<LoginLog>>(`/api/admin/system/login-logs${buildQs(params)}`)
}

export async function getLoginLog(id: string | number): Promise<ApiResult<LoginLog>> {
  return fetchApi<LoginLog>(`/api/admin/system/login-logs/${id}`)
}

export async function addLoginLog(body: Partial<LoginLog>): Promise<ApiResult<LoginLog>> {
  return fetchApi<LoginLog>('/api/admin/system/login-logs', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateLoginLog(
  id: string | number,
  body: Partial<LoginLog>,
): Promise<ApiResult<LoginLog>> {
  return fetchApi<LoginLog>(`/api/admin/system/login-logs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delLoginLog(id: string | number): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/system/login-logs/${id}`, { method: 'DELETE' })
}
