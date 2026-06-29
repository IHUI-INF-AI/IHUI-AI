// PWA 客户端 composable - Service Worker 注册 + 离线检测 + 推送订阅
import { ref, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from '@/utils/logger'
import { getUserToken } from '@/utils/request'

/** beforeinstallprompt 事件类型（非标准 API，TypeScript 未内置） */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

async function authFetch(url: string | URL, options: RequestInit = {}): Promise<Response> {
  const token = getUserToken()
  return fetch(url, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}


const isOnline = ref(navigator.onLine)
const isInstalled = ref(false)
const swRegistration = ref<ServiceWorkerRegistration | null>(null)
const updateAvailable = ref(false)
const pushSupported = ref(false)
const pushSubscribed = ref(false)
const isInstallable = ref(false)
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)

export function usePwa() {
  const cleanup = useCleanup()

  const register = async () => {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Worker 不支持')
      return null
    }

    // 2026-06-27 修复白屏:
    // 开发环境下 Service Worker 会用 SWR/cacheFirst 策略缓存旧 HTML + 旧 JS,
    // 导致 Vite HMR 修改后用户浏览器仍然加载旧 JS (含 useEduPlatformNav 修改前
    // 无 try/catch 兜底的版本), 抛 'injection Symbol(router) not found' 白屏.
    // Puppeteer (无 SW) 测试正常, 但用户浏览器 (有 SW 缓存) 白屏.
    // 修复: dev 模式注销所有 SW + 清除所有缓存, 仅生产构建注册 SW.
    if (import.meta.env.DEV) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
        logger.info(`[PWA] DEV mode: unregistered ${regs.length} SW(s), cleared ${keys.length} cache(s)`)
      } catch (e) {
        logger.warn('[PWA] DEV mode SW cleanup failed:', e)
      }
      return null
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })
      swRegistration.value = reg
      logger.info('[PWA] Service Worker 注册成功')

      // 检测更新
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            updateAvailable.value = true
            logger.info('[PWA] 新版本可用')
          }
        })
      })

      return reg
    } catch (err) {
      console.error('[PWA] Service Worker 注册失败', err)
      return null
    }
  }

  const checkPushSupport = () => {
    pushSupported.value = 'PushManager' in window && 'Notification' in window
    return pushSupported.value
  }

  const requestPushPermission = async () => {
    if (!checkPushSupport()) return 'unsupported'
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      await subscribePush()
      return 'granted'
    }
    return perm
  }

  const subscribePush = async () => {
    if (!swRegistration.value) {
      await register()
    }
    if (!swRegistration.value) return null
    try {
      const sub = await swRegistration.value.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          (window as Window & { __VAPID_KEY__?: string }).__VAPID_KEY__ || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        ),
      })
      pushSubscribed.value = true
      // 发送到后端
      await authFetch('/api/v1/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
      return sub
    } catch (err) {
      console.error('[PWA] Push 订阅失败', err)
      return null
    }
  }

  const applyUpdate = () => {
    if (!swRegistration.value?.waiting) return
    swRegistration.value.waiting.postMessage({ type: 'SKIP_WAITING' })
    updateAvailable.value = false
    window.location.reload()
  }

  const checkInstalled = () => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      isInstalled.value = true
    }
  }

  const onOnline = () => { isOnline.value = true }
  const onOffline = () => { isOnline.value = false }

  const onBeforeInstallPrompt = (e: Event) => {
    e.preventDefault()
    deferredPrompt.value = e as BeforeInstallPromptEvent
    isInstallable.value = true
  }

  const onAppInstalled = () => {
    isInstalled.value = true
    isInstallable.value = false
    deferredPrompt.value = null
  }

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt.value) return false
    deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    if (outcome === 'accepted') {
      deferredPrompt.value = null
      isInstallable.value = false
      return true
    }
    return false
  }

  onMounted(() => {
    void register()
    checkInstalled()
    checkPushSupport()
    cleanup.addEventListener(window, 'online', onOnline as EventListener)
    cleanup.addEventListener(window, 'offline', onOffline as EventListener)
    cleanup.addEventListener(window, 'beforeinstallprompt', onBeforeInstallPrompt as EventListener)
    cleanup.addEventListener(window, 'appinstalled', onAppInstalled as EventListener)
  })

  return {
    isOnline,
    isInstalled,
    isInstallable,
    updateAvailable,
    pushSupported,
    pushSubscribed,
    register,
    install,
    applyUpdate,
    requestPushPermission,
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
