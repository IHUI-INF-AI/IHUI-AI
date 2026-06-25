import { API_USER_PATHS } from '@/config/backend-paths'

/**
 * 用户数据导出API
 */

import request from '@/utils/request'
import { normalizeApiResponse } from '@/utils/apiResponseFormatter'
import { logger } from '@/utils/logger'

/**
 * 用户数据导出接口
 */
export interface UserExportData {
  // 基本信息
  userInfo: {
    id: string
    uuid: string
    username: string
    email: string
    phone: string
    nickname: string
    avatar: string
    gender: number
    birthday: string
    signature: string
    createTime: string
    updateTime: string
  }
  // 订单数据
  orders: Array<{
    id: string
    orderNo: string
    type: string
    amount: number
    status: string
    createTime: string
  }>
  // 对话历史
  conversations: Array<{
    id: string
    title: string
    messageCount: number
    createTime: string
    updateTime: string
  }>
  // 收藏
  favorites: Array<{
    id: string
    type: string
    resourceId: string
    resourceName: string
    createTime: string
  }>
  // 评论
  comments: Array<{
    id: string
    content: string
    createTime: string
  }>
  // 导出时间
  exportTime: string
}

/**
 * 导出用户数据
 * @returns 用户数据JSON
 */
export async function exportUserData(): Promise<UserExportData> {
  try {
    const response = await request.get(API_USER_PATHS.export)
    const normalized = normalizeApiResponse<UserExportData>(response.data)
    
    if (!normalized.success || !normalized.data) {
      throw new Error(normalized.message || '导出失败')
    }

    return normalized.data
  } catch (error) {
    logger.error('[UserExport] Failed to export user data:', error)
    throw error
  }
}

/**
 * 下载用户数据（JSON格式）
 * @param data 用户数据
 * @param filename 文件名
 */
export function downloadUserData(data: UserExportData, filename?: string): void {
  try {
    const jsonContent = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `user_data_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    logger.info('[UserExport] User data downloaded successfully')
  } catch (error) {
    logger.error('[UserExport] Failed to download user data:', error)
    throw error
  }
}
