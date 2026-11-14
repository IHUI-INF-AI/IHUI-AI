// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { Notifications } from '@/platform/push'
import * as Device from '@/platform/device'
import { fetchApi } from '@ihui/api-client'
import { rnTokens } from '@ihui/design-tokens'

export interface PushState {
  token: string | null
  permission: Notifications.PermissionStatus | 'unknown'
  error: string | null
  registered: boolean
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export function usePush() {
  const [state, setState] = useState<PushState>({
    token: null,
    permission: 'unknown',
    error: null,
    registered: false,
  })
  const listener = useRef<Notifications.Subscription | null>(null)

  // 卸载时清理通知监听,避免向已卸载组件回调(陈旧闭包)或重复订阅叠加。
  useEffect(() => {
    return () => {
      if (listener.current) {
        listener.current.remove()
        listener.current = null
      }
    }
  }, [])

  const register = useCallback(async () => {
    if (!Device.isDevice) {
      setState({ token: null, permission: 'unknown', error: '仅真机支持推送', registered: false })
      return
    }
    try {
      const { status } = await Notifications.getPermissionsAsync()
      let finalStatus = status
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync()
        finalStatus = req.status
      }
      if (finalStatus !== 'granted') {
        setState({
          token: null,
          permission: finalStatus,
          error: '用户未授权推送',
          registered: false,
        })
        return
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          // 呼吸灯色取品牌墨档(brand.DEFAULT:亮=纯黑/暗=纯白),不再写死一枚带 alpha 的红色。
          // 原 #FF231F7C 是历史遗留的红灯,与本应用"去绿色、中性墨色"的品牌定档不一致,
          // 且 Android 对 lightColor 的解析是 ARGB(这枚值实际会被读成 alpha=FF 的蓝紫),
          // 屏上观感与预期红完全不是一回事 —— 取值走 token 后它才真的跟品牌一致。
          lightColor: rnTokens.brand.DEFAULT,
        })
      }
      const t = await Notifications.getExpoPushTokenAsync()
      const deviceToken = t.data
      // 注册到后端,否则后端 edu_notification_device 表无此设备记录,推送链路断裂
      const regRes = await fetchApi<{ registered: boolean }>('/push/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceToken, deviceType: Platform.OS }),
      })
      if (!regRes.success) {
        setState({
          token: deviceToken,
          permission: finalStatus,
          error: regRes.error || '后端注册失败',
          registered: false,
        })
        return
      }
      setState({ token: deviceToken, permission: finalStatus, error: null, registered: true })
    } catch (err) {
      setState({
        token: null,
        permission: 'unknown',
        error: err instanceof Error ? err.message : '注册失败',
        registered: false,
      })
    }
  }, [])

  const subscribe = useCallback((cb: (data: string) => void) => {
    // 注册新监听前先移除旧监听,防止重复订阅叠加。
    if (listener.current) {
      listener.current.remove()
      listener.current = null
    }
    listener.current = Notifications.addNotificationReceivedListener((n) => {
      const body = (n.request.content.data as { body?: string } | undefined)?.body
      cb(typeof body === 'string' ? body : (n.request.content.title ?? ''))
    })
  }, [])

  return { state, register, subscribe }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
