import { USER_SETTINGS_PATHS } from '@/config/backend-paths'
import request from '@/utils/request'
import type { ApiResponse } from '@/api/core/types'
import type { UserSettings } from '@/shared/api'

// 获取用户设置（后端可能尚未实现该接口，404 时静默由调用方使用默认设置）
export function getUserSettings(): Promise<ApiResponse<UserSettings>> {
  return request.get(USER_SETTINGS_PATHS.base, { skip404Toast: true } as import('axios').AxiosRequestConfig)
}

// 更新用户设置
export function updateUserSettings(data: Partial<UserSettings>): Promise<ApiResponse<void>> {
  return request.put(USER_SETTINGS_PATHS.base, data)
}

// 更新通知设置
export function updateNotificationSettings(
  data: NonNullable<UserSettings['notifications']>
): Promise<ApiResponse<void>> {
  return request.put(USER_SETTINGS_PATHS.notifications, data)
}

// 更新隐私设置
export function updatePrivacySettings(
  data: NonNullable<UserSettings['privacy']>
): Promise<ApiResponse<void>> {
  return request.put(USER_SETTINGS_PATHS.privacy, data)
}

// 更新偏好设置
export function updatePreferences(
  data: NonNullable<UserSettings['preferences']>
): Promise<ApiResponse<void>> {
  return request.put(USER_SETTINGS_PATHS.preferences, data)
}

// 获取登录设备列表
export function getLoginDevices(): Promise<
  ApiResponse<
    Array<{
      id: string
      deviceName: string
      deviceType: string
      browser: string
      os: string
      ip: string
      location: string
      lastActive: string
      isCurrent: boolean
    }>
  >
> {
  return request.get(USER_SETTINGS_PATHS.devices)
}

// 移除登录设备
export function removeLoginDevice(deviceId: string): Promise<ApiResponse<void>> {
  return request.delete(USER_SETTINGS_PATHS.deviceById(deviceId))
}

// 清除所有数据
export function clearAllData(): Promise<ApiResponse<void>> {
  return request.post(USER_SETTINGS_PATHS.clearData)
}

// 导出用户数据
export function exportUserData(): Promise<
  ApiResponse<{
    url: string
    filename: string
    expiresAt: string
  }>
> {
  return request.post(USER_SETTINGS_PATHS.exportData)
}

// 删除账户
export function deleteAccount(password: string, reason?: string): Promise<ApiResponse<void>> {
  return request.post(USER_SETTINGS_PATHS.deleteAccount, { password, reason })
}

// 获取账户删除状态
export function getAccountDeletionStatus(): Promise<
  ApiResponse<{
    isScheduled: boolean
    scheduledDate?: string
    canCancel: boolean
  }>
> {
  return request.get(USER_SETTINGS_PATHS.deleteAccountStatus)
}

// 取消账户删除
export function cancelAccountDeletion(): Promise<ApiResponse<void>> {
  return request.post(USER_SETTINGS_PATHS.deleteAccountCancel)
}

// 发送邮箱验证码
export function sendEmailVerificationCode(email: string): Promise<ApiResponse<void>> {
  return request.post(USER_SETTINGS_PATHS.sendEmailCode, { email })
}

// 验证邮箱
export function verifyEmail(email: string, code: string): Promise<ApiResponse<void>> {
  return request.post(USER_SETTINGS_PATHS.verifyEmail, { email, code })
}

// 发送手机验证码
export function sendPhoneVerificationCode(phone: string): Promise<ApiResponse<void>> {
  return request.post(USER_SETTINGS_PATHS.sendPhoneCode, { phone })
}

// 验证手机号
export function verifyPhone(phone: string, code: string): Promise<ApiResponse<void>> {
  return request.post(USER_SETTINGS_PATHS.verifyPhone, { phone, code })
}

// 获取安全日志
export function getSecurityLogs(params: {
  page: number
  pageSize: number
  type?: string
  startDate?: string
  endDate?: string
}): Promise<
  ApiResponse<{
    list: Array<{
      id: string
      type:
        | 'login'
        | 'logout'
        | 'password_change'
        | 'email_change'
        | 'phone_change'
        | 'two_factor_enable'
        | 'two_factor_disable'
      description: string
      ip: string
      location: string
      device: string
      createTime: string
      status: 'success' | 'failed'
    }>
    total: number
  }>
> {
  return request.get(USER_SETTINGS_PATHS.securityLogs, { params })
}

export interface ThemeSyncData {
  themeMode: string
  presets: Array<{
    id: string
    name: string
    mode: string
    customColors?: Record<string, string>
    createdAt: number
    updatedAt: number
  }>
  activePresetId: string | null
  updatedAt: number
  deviceId: string
}

export interface ThemePresetData {
  id: string
  name: string
  mode: string
  customColors?: Record<string, string>
  createdAt: number
  updatedAt: number
}

export function syncThemeToCloud(data: ThemeSyncData): Promise<ApiResponse<{ syncedAt: number }>> {
  return request.post(USER_SETTINGS_PATHS.themeSync, data)
}

export function syncThemeFromCloud(): Promise<ApiResponse<ThemeSyncData>> {
  return request.get(USER_SETTINGS_PATHS.themeSync)
}

export function getThemePresets(): Promise<ApiResponse<ThemePresetData[]>> {
  return request.get(USER_SETTINGS_PATHS.themePresets)
}

export function createThemePreset(
  data: Omit<ThemePresetData, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ApiResponse<ThemePresetData>> {
  return request.post(USER_SETTINGS_PATHS.themePresets, data)
}

export function updateThemePreset(
  id: string,
  data: Partial<Omit<ThemePresetData, 'id' | 'createdAt'>>
): Promise<ApiResponse<ThemePresetData>> {
  return request.put(USER_SETTINGS_PATHS.themePresetById(id), data)
}

export function deleteThemePreset(id: string): Promise<ApiResponse<void>> {
  return request.delete(USER_SETTINGS_PATHS.themePresetById(id))
}
