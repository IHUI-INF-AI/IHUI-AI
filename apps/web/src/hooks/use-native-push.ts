// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { deviceEndpoints } from '@ihui/api-client'
import { useAuthStore } from '@/stores/auth'

/**
 * App 端(Capacitor 壳)推送令牌注册 hook(2026-09-06,mobile-cap 推送链路)。
 *
 * 机制:壳以远程模式加载本 Web 端,Capacitor 原生桥会把 window.Capacitor 注入页面,
 * 页面 JS 可直接使用 Plugins.PushNotifications(MainActivity 注入的 window.IHUINative
 * 桥未暴露 token,故此处直连官方插件,无需改壳、无需重打 APK)。
 *
 * 流程:App 环境 + 已登录 → 监听 registration 事件拿 FCM token →
 * 经 @ihui/api-client 上报 PUT /api/devices/token(后端按 token upsert,
 * 重复回调安全);并主动 register() 一次兜底(壳启动期的注册事件可能早于
 * 本监听挂载而错过)。纯浏览器环境 getPushPlugin 返回 null,零影响。
 */

/** Capacitor PushNotifications 插件页面内最小类型(仅用到的能力) */
interface PushPluginMinimal {
  register: () => Promise<void>
  addListener: (
    eventName: 'registration' | 'registrationError',
    listenerFunc: (payload: { value?: string; error?: string; message?: string }) => void,
  ) => { remove: () => void }
}

/** 类型守卫:运行时校验插件形状(禁 any,unknown + 守卫) */
function isPushPlugin(v: unknown): v is PushPluginMinimal {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return typeof p.register === 'function' && typeof p.addListener === 'function'
}

/** 取 PushNotifications 插件;非 App 环境返回 null */
function getPushPlugin(): PushPluginMinimal | null {
  if (typeof window === 'undefined') return null
  const capacitor = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } })
    .Capacitor
  const plugin = capacitor?.Plugins?.PushNotifications
  return isPushPlugin(plugin) ? plugin : null
}

export function useNativePushRegister(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  React.useEffect(() => {
    if (!isAuthenticated) return
    const plugin = getPushPlugin()
    if (!plugin) return

    const registrationHandle = plugin.addListener('registration', (payload) => {
      const token = payload?.value
      if (!token) return
      void deviceEndpoints.registerToken({
        token,
        platform: 'android',
        deviceType: navigator.userAgent.slice(0, 100),
        locale: navigator.language,
      })
    })
    const errorHandle = plugin.addListener('registrationError', (payload) => {
      console.warn('[native-push] registration failed:', payload?.error ?? payload?.message)
    })
    // 主动 register 一次:壳启动期(MainActivity bootstrapBridge)的注册事件
    // 可能早于本监听挂载而错过;register 幂等,重复触发 registration 安全
    void plugin.register().catch(() => {})

    return () => {
      registrationHandle.remove()
      errorHandle.remove()
    }
  }, [isAuthenticated])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
