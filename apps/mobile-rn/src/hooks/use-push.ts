// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// i18n-content-exempt-file: 多语言常量数据定义(label/title/description等选项值,内容体系定为中文单语,产品决策2026-11-15) until 2027-05-31

import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { Notifications } from '@/platform/push'
import * as Device from '@/platform/device'
import { fetchApi } from '@ihui/api-client'
import { buildAndroidChannelSpecs } from '@/lib/notification-channels'

export interface PushState {
  token: string | null
  permission: Notifications.PermissionStatus | 'unknown'
  error: string | null
  registered: boolean
}

/**
 * 前台收到推送时**故意不出声**（2026-11-26 取舍，别顺手改成 true）：
 *  - App 在前台时，消息由 WS 到达页面，`RootNavigator` 已用 `playRingtone(当前铃声)` 发声；
 *    系统通知再响一次就是"铃 + 系统声"双响。
 *  - App 在后台/被杀时，前台 handler 根本不执行，声由通知**渠道**（res/raw 音源）负责。
 *  - 想验证真机铃声，必须退到后台/锁屏再发，前台不响是设计而非缺陷。
 */
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
        // 启动时预建全部通知渠道:8 条铃声 + 静音 + 历史兜底。
        // 渠道一旦创建,sound/importance 在 Android 侧即不可再改(卸载重装才复位),
        // 所以"按 id 分 channel"而不是"改一条 channel 的 sound"——用户切换铃声/开关后,
        // 下一条推送落到对应新建渠道即生效,渠道 id 与音源名全部由 shared 单一真相源派生。
        const channelSpecs = buildAndroidChannelSpecs(Notifications)
        for (const spec of channelSpecs) {
          try {
            await Notifications.setNotificationChannelAsync(spec.channelId, spec)
          } catch (channelErr) {
            // 个别 ROM 拒绝创建某条渠道时只告警继续下一条;绝不能因单条失败让 register 整体失败。
            console.warn(`[push] 创建通知渠道 ${spec.channelId} 失败`, channelErr)
          }
        }
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
