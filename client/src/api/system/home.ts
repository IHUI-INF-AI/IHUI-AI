/**
 * 首页相关API
 */

// 2026-06-24 修复: 路径前缀对齐后端 /api/v1/*
import request from '@/utils/request'
import { defaultCache } from '@/utils/requestCache'
import type { ApiResponse } from '@/types'

/**
 * 获取首页数据
 */
export async function getHomeData(): Promise<ApiResponse<unknown>> {
  return request.get('/api/v1/resource/home')
}

/**
 * 获取首页轮播图 - 缓存 5 分钟，轮播图不常变化
 */
export async function getBanners(): Promise<ApiResponse<unknown>> {
  return defaultCache.wrap(
    '/home/banners',
    () => request.get('/home/banners'),
    undefined,
    5 * 60 * 1000
  )
}

/**
 * 获取首页推荐
 */
export async function getRecommendations(): Promise<ApiResponse<unknown>> {
  return request.get('/home/recommendations')
}

/**
 * 获取首页资源
 */
export async function getHomePageResources(): Promise<ApiResponse<unknown>> {
  return request.get('/home/resources')
}

/**
 * 发布热门课程
 */
export async function postPopularCourses(data: any): Promise<ApiResponse<unknown>> {
  return request.post('/home/popular-courses', data)
}
