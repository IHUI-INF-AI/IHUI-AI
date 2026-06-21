import { logger } from './logger'

const DEVICE_FINGERPRINT_KEY = 'device_fingerprint'
const DEVICE_ID_KEY = 'device_id'

interface DeviceInfo {
  fingerprint: string
  deviceId: string
  userAgent: string
  platform: string
  language: string
  screenWidth: number
  screenHeight: number
  colorDepth: number
  timezone: string
  createdAt: number
}

async function generateFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return ''

  const components: string[] = []

  components.push(navigator.userAgent)
  components.push(navigator.language)
  components.push(String(navigator.hardwareConcurrency || 0))
  components.push(String(window.screen.width))
  components.push(String(window.screen.height))
  components.push(String(window.screen.colorDepth))
  components.push(String(new Date().getTimezoneOffset()))

  const canvas = document.createElement('canvas')
  try {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('fingerprint', 2, 2)
      components.push(canvas.toDataURL().slice(0, 100))
    }
  } catch {
    // Canvas 不可用
  }

  const webgl = document.createElement('canvas')
  try {
    const gl = webgl.getContext('webgl') || webgl.getContext('experimental-webgl')
    if (gl && gl instanceof window.WebGLRenderingContext) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '')
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
      }
    }
  } catch {
    // WebGL 不可用
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(components.join('|'))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateDeviceId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  return `${timestamp}-${random}`
}

export const DeviceService = {
  async getDeviceInfo(): Promise<DeviceInfo | null> {
    if (typeof window === 'undefined') return null

    const stored = localStorage.getItem(DEVICE_FINGERPRINT_KEY)
    if (stored) {
      try {
        return JSON.parse(stored) as DeviceInfo
      } catch {
        // 解析失败，重新生成
      }
    }

    return this.generateDeviceInfo()
  },

  async generateDeviceInfo(): Promise<DeviceInfo> {
    if (typeof window === 'undefined') {
      throw new Error('DeviceService can only be used in browser environment')
    }

    const fingerprint = await generateFingerprint()
    const deviceId = localStorage.getItem(DEVICE_ID_KEY) || generateDeviceId()

    const deviceInfo: DeviceInfo = {
      fingerprint,
      deviceId,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      colorDepth: window.screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      createdAt: Date.now(),
    }

    localStorage.setItem(DEVICE_FINGERPRINT_KEY, JSON.stringify(deviceInfo))
    localStorage.setItem(DEVICE_ID_KEY, deviceId)

    logger.info('[DeviceService] Device info generated', { deviceId })

    return deviceInfo
  },

  getDeviceId(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(DEVICE_ID_KEY)
  },

  async validateDevice(): Promise<{ valid: boolean; reason?: string }> {
    const stored = localStorage.getItem(DEVICE_FINGERPRINT_KEY)
    if (!stored) {
      return { valid: true, reason: '首次设备' }
    }

    try {
      const storedInfo = JSON.parse(stored) as DeviceInfo
      const currentFingerprint = await generateFingerprint()

      if (storedInfo.fingerprint !== currentFingerprint) {
        logger.warn('[DeviceService] Device fingerprint mismatch')
        return { valid: false, reason: '设备指纹不匹配' }
      }

      return { valid: true }
    } catch {
      return { valid: false, reason: '设备信息解析失败' }
    }
  },

  clearDeviceInfo(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(DEVICE_FINGERPRINT_KEY)
    localStorage.removeItem(DEVICE_ID_KEY)
    logger.info('[DeviceService] Device info cleared')
  },

  getHeaders(): Record<string, string> {
    const deviceId = this.getDeviceId()
    return deviceId ? { 'X-Device-Id': deviceId } : {}
  },
}
