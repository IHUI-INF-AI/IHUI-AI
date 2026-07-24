/**
 * API 桥接层 — 将 @ihui/api-client 的 ApiResult<T> 解包为 miniapp-taro 期望的 Promise<T>。
 *
 * 保留与原 utils/request.ts 相同的错误处理行为:
 * - 401: 清理登录态 + toast + 跳转登录页
 * - 其他错误: toast 提示 + throw
 */
import Taro from '@tarojs/taro'
import type { ApiResult } from '@ihui/types'
import { clearAuth } from './auth'

/** 解包 ApiResult,失败时 toast + throw(行为与原 request.ts 一致) */
export async function unwrapApi<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (!r.success) {
    if (r.status === 401) {
      clearAuth()
      Taro.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
      setTimeout(() => Taro.reLaunch({ url: '/pages/login/login' }), 800)
    } else {
      Taro.showToast({ title: r.error, icon: 'none' })
    }
    throw new Error(r.error)
  }
  return r.data
}
