import { useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'

export interface PushState {
  token: string | null
  permission: Notifications.PermissionStatus | 'unknown'
  error: string | null
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
  const [state, setState] = useState<PushState>({ token: null, permission: 'unknown', error: null })
  const listener = useRef<Notifications.Subscription | null>(null)

  const register = useCallback(async () => {
    if (!Device.isDevice) {
      setState({ token: null, permission: 'unknown', error: '仅真机支持推送' })
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
        setState({ token: null, permission: finalStatus, error: '用户未授权推送' })
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
      setState({ token: t.data, permission: finalStatus, error: null })
    } catch (err) {
      setState({
        token: null,
        permission: 'unknown',
        error: err instanceof Error ? err.message : '注册失败',
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
