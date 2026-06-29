/**
 * 任务管理API
 * 提供任务查询、取消和WebSocket实时更新功能
 */

import { apiClient } from './client'
import type { ApiResponse } from '@/types'

/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

/**
 * 任务接口
 */
export interface Task {
  taskId: string
  type: string
  status: TaskStatus
  progress: number
  result?: unknown
  error?: string
  cancelledAt?: string
  cancelledBy?: string
  createdAt: string
  updatedAt: string
}

/**
 * 获取任务列表
 */
export async function getTasks(params?: {
  page?: number
  pageSize?: number
  status?: TaskStatus
  type?: string
}): Promise<
  ApiResponse<{
    items: Task[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  return apiClient.get('/ai/tasks', {
    params: {
      page: params?.page || 1,
      pageSize: params?.pageSize || 20,
      status: params?.status,
      type: params?.type,
    },
  })
}

/**
 * 获取任务状态
 */
export async function getTaskStatus(taskId: string): Promise<ApiResponse<Task>> {
  return apiClient.get(`/ai/tasks/${taskId}`)
}

/**
 * 取消任务
 */
export async function cancelTask(
  taskId: string
): Promise<ApiResponse<{ taskId: string; status: string }>> {
  return apiClient.post(`/ai/tasks/${taskId}/cancel`)
}

/**
 * WebSocket任务事件类型
 */
export type TaskEventType = 'task:created' | 'task:update' | 'task:cancelled'

/**
 * WebSocket任务事件
 */
export interface TaskEvent {
  taskId: string
  type: string
  status: TaskStatus
  progress: number
  userId?: string
  updatedAt: string
  result?: unknown
  error?: string
  cancelledBy?: string
  cancelledAt?: string
}
