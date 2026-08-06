/**
 * 小程序全局崩溃上报(2026-08-06 新增,打通崩溃率链路)。
 *
 * Taro 小程序没有 React ErrorBoundary 全局兜底,用 Taro.onError + Taro.onUnhandledRejection
 * 捕获全局 JS 错误与未处理 Promise 拒绝,POST 到 /api/crash-reports(匿名可上报)。
 * 上报静默失败,绝不干扰业务。
 */

import Taro from '@tarojs/taro'
import { BASE_URL } from './api-config'

let inited = false

/** 初始化全局崩溃捕获(幂等:多入口调用只注册一次)。 */
export function initCrashReport(): void {
  if (inited) return
  inited = true
  try {
    Taro.onError((error) => {
      reportCrash(String(error ?? 'unknown error'))
    })
    Taro.onUnhandledRejection((res) => {
      const reason = (res as { reason?: unknown } | undefined)?.reason
      reportCrash(`unhandled rejection: ${String(reason ?? 'unknown')}`)
    })
  } catch {
    /* 小程序低版本无 onUnhandledRejection 时静默 */
  }
}

function reportCrash(errorMessage: string): void {
  try {
    Taro.request({
      url: `${BASE_URL}/crash-reports`,
      method: 'POST',
      data: {
        platform: 'wechat-miniapp',
        errorMessage: errorMessage.slice(0, 4000),
      },
      header: { 'Content-Type': 'application/json' },
      success: () => {},
      fail: () => {},
    })
  } catch {
    /* 上报失败静默 */
  }
}
