/**
 * 访问埋点 Composable
 * 上报 page view / custom event 到后端 /visit/track
 * 自动采集 UA / 设备 / 来源 / 停留时长
 */

import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import http from '@/utils/request'

interface TrackOptions {
  targetType?: string
  targetId?: number | string
  duration?: number
}

const sessionId = ref('')

function _ensureSession() {
  if (sessionId.value) return sessionId.value
  try {
    let sid = sessionStorage.getItem('zhs_sid')
    if (!sid) {
      sid = 'sid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)
      sessionStorage.setItem('zhs_sid', sid)
    }
    sessionId.value = sid
  } catch {
    sessionId.value = 'sid_' + Date.now()
  }
  return sessionId.value
}

function _detectDevice() {
  const ua = navigator.userAgent
  if (/Mobile|Android|iPhone|iPad/.test(ua)) return 'mobile'
  return 'desktop'
}

function _detectOS() {
  const ua = navigator.userAgent
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac/.test(ua)) return 'MacOS'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad/.test(ua)) return 'iOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown'
}

function _detectBrowser() {
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari'
  return 'Other'
}

function _getReferer() {
  return document.referrer || undefined
}

function _getSource(): string {
  const ref = _getReferer()
  if (!ref) return 'direct'
  try {
    const host = new URL(ref).hostname
    if (host.includes('baidu')) return 'baidu'
    if (host.includes('google')) return 'google'
    if (host.includes('bing')) return 'bing'
    if (host.includes('weibo')) return 'weibo'
    if (host.includes('wechat')) return 'wechat'
    return host
  } catch {
    return 'unknown'
  }
}

async function _track(path: string, options: TrackOptions = {}) {
  _ensureSession()
  try {
    await http.post(
      '/visit/track',
      {
        path,
        user_agent: navigator.userAgent.slice(0, 200),
        device: _detectDevice(),
        os: _detectOS(),
        browser: _detectBrowser(),
        referer: _getReferer(),
        source: _getSource(),
        target_type: options.targetType,
        target_id: options.targetId ? String(options.targetId) : undefined,
        duration: options.duration || 0,
        session_id: sessionId.value,
      },
      { __skipAuth: true, __silent: true } as any
    )
  } catch {
    /* 埋点失败静默 */
  }
}

export function useTracking(targetType?: string, targetId?: number | string) {
  const route = useRoute()
  const enterTime = ref(Date.now())

  function record() {
    const duration = Math.floor((Date.now() - enterTime.value) / 1000)
    void _track(route.fullPath, { targetType, targetId, duration })
  }

  onMounted(() => {
    enterTime.value = Date.now()
    record()
  })

  onBeforeUnmount(() => {
    record()
  })

  return { track: _track }
}

export function trackEvent(eventName: string, targetType?: string, targetId?: number | string) {
  void _track(`/event/${eventName}`, { targetType, targetId })
}

export function trackCustom(path: string, options?: TrackOptions) {
  return _track(path, options)
}
