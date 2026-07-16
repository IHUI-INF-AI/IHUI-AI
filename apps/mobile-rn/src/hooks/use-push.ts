import { useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { fetchApi } from '@ihui/api-client'

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
          lightColor: '#FF231F7C',
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
    listener.current = Notifications.addNotificationReceivedListener((n) => {
      const body = (n.request.content.data as { body?: string } | undefined)?.body
      cb(typeof body === 'string' ? body : (n.request.content.title ?? ''))
    })
  }, [])

  return { state, register, subscribe }
}
