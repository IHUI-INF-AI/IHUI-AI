import request from '@/utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import type { ApiResponse } from '@/types'

/**
 * 学习中心服务
 */

// 获取视频列表
export const getVideoList = withApiResponseHandler(
  async (params: { page?: number; pageSize?: number; category?: string; courseId?: string; pageNum?: number; creator?: string; [key: string]: unknown }): Promise<ApiResponse<{ list: unknown[]; total: number }>> => {
    const response = await request.get('/study/videos', { params })
    return normalizeApiResponse(response)
  }
)

// 添加视频
export const addVideo = withApiResponseHandler(
  async (data: { title: string; url: string; cover?: string; description?: string }): Promise<ApiResponse<{ id: string }>> => {
    const response = await request.post('/study/videos', data)
    return normalizeApiResponse(response)
  }
)

// 删除视频
export const videoDelete = withApiResponseHandler(
  async (ids: string[]): Promise<ApiResponse<boolean>> => {
    const response = await request.post('/study/videos/delete', { ids })
    return normalizeApiResponse(response)
  }
)

// 更新视频
export const videoPut = withApiResponseHandler(
  async (data: { id: string; title?: string; url?: string; cover?: string; description?: string }): Promise<ApiResponse<boolean>> => {
    const response = await request.put('/study/videos', data)
    return normalizeApiResponse(response)
  }
)

// 发布视频
export const issue = withApiResponseHandler(
  async (data?: { id: string }): Promise<ApiResponse<{ id: string }>> => {
    const response = await request.post('/study/videos/issue', data)
    return normalizeApiResponse(response)
  }
)

// 获取智能体列表
export const getAgentsAlllist = withApiResponseHandler(
  async (params?: { page?: number; pageSize?: number; uuid?: string; agentName?: string; [key: string]: unknown }): Promise<ApiResponse<{ agents: unknown[] }>> => {
    const response = await request.get('/agents', { params })
    return normalizeApiResponse(response)
  }
)

// 分块上传文件
export const uploadChunkedFile = withApiResponseHandler(
  async (file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<{ url: string }>> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await request.post('/upload/chunked', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
        }
      },
    })
    return normalizeApiResponse(response)
  }
)

// 合并分块上传
export const uploadChunkedFileJoint = withApiResponseHandler(
  async (data: { urls?: string[]; path?: string; fileName: string; [key: string]: unknown }): Promise<ApiResponse<{ url: string }>> => {
    const response = await request.post('/upload/chunked/joint', data)
    return normalizeApiResponse(response)
  }
)

// 获取用户视频评论列表
export const getUserVideoCommentList = withApiResponseHandler(
  async (params: { videoId: string; page?: number; pageSize?: number; pageNum?: number; [key: string]: unknown }): Promise<ApiResponse<{ list: unknown[]; total: number }>> => {
    const response = await request.get('/study/videos/comments', { params })
    return normalizeApiResponse(response)
  }
)

// 用户视频评论
export const userVideoComment = withApiResponseHandler(
  async (data: { videoId: string; content: string; userUuid?: string; parentId?: string; [key: string]: unknown }): Promise<ApiResponse<{ id: string }>> => {
    const response = await request.post('/study/videos/comments', data)
    return normalizeApiResponse(response)
  }
)

// 添加分组
export const addGroup = withApiResponseHandler(
  async (data: { name: string; description?: string }): Promise<ApiResponse<{ id: string }>> => {
    const response = await request.post('/study/groups', data)
    return normalizeApiResponse(response)
  }
)

// 获取课程详情
export const getCourseDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<unknown>> => {
    const response = await request.get(`/study/courses/${id}`)
    return normalizeApiResponse(response)
  }
)

// 删除课程
export const courseDelete = withApiResponseHandler(
  async (ids: string[]): Promise<ApiResponse<boolean>> => {
    const response = await request.post('/study/courses/delete', { ids })
    return normalizeApiResponse(response)
  }
)

// 更新课程
export const coursePut = withApiResponseHandler(
  async (data: { id: string; [key: string]: unknown }): Promise<ApiResponse<boolean>> => {
    const response = await request.put('/study/courses', data)
    return normalizeApiResponse(response)
  }
)

// 下架课程
export const delist = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<boolean>> => {
    const response = await request.post('/study/courses/delist', { id })
    return normalizeApiResponse(response)
  }
)
