import { logger } from './logger'
import { DeviceService } from './deviceService'

const LOGIN_DEVICES_KEY = 'login_devices'
const MAX_DEVICES = 5

interface LoginDevice {
  deviceId: string
  deviceName: string
  loginTime: number
  lastActiveTime: number
  ipAddress?: string
}

export const MultiDeviceService = {
  getLoginDevices(): LoginDevice[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(LOGIN_DEVICES_KEY)
    if (!stored) return []
    try {
      return JSON.parse(stored) as LoginDevice[]
    } catch {
      return []
    }
  },

  async registerCurrentDevice(): Promise<void> {
    if (typeof window === 'undefined') return

    const deviceId = DeviceService.getDeviceId()
    if (!deviceId) return

    const devices = this.getLoginDevices()
    const existingIndex = devices.findIndex((d: LoginDevice) => d.deviceId === deviceId)

    const deviceInfo = await DeviceService.getDeviceInfo()
    const deviceName = deviceInfo
      ? `${deviceInfo.platform} - ${deviceInfo.screenWidth}x${deviceInfo.screenHeight}`
      : '未知设备'

    const now = Date.now()

    if (existingIndex >= 0) {
      devices[existingIndex].lastActiveTime = now
      devices[existingIndex].deviceName = deviceName
    } else {
      devices.push({
        deviceId,
        deviceName,
        loginTime: now,
        lastActiveTime: now,
      })
    }

    const validDevices = devices
      .filter((d: LoginDevice) => now - d.lastActiveTime < 30 * 24 * 60 * 60 * 1000)
      .slice(-MAX_DEVICES)

    localStorage.setItem(LOGIN_DEVICES_KEY, JSON.stringify(validDevices))
    logger.info('[MultiDeviceService] Device registered', { deviceId, deviceCount: validDevices.length })
  },

  async validateCurrentDevice(): Promise<{ valid: boolean; reason?: string }> {
    if (typeof window === 'undefined') return { valid: true }

    const deviceId = DeviceService.getDeviceId()
    if (!deviceId) return { valid: true, reason: 'No device ID' }

    const devices = this.getLoginDevices()
    const device = devices.find((d: LoginDevice) => d.deviceId === deviceId)

    if (!device) {
      logger.warn('[MultiDeviceService] Device not registered')
      return { valid: false, reason: 'Device not registered' }
    }

    return { valid: true }
  },

  removeDevice(deviceId: string): void {
    if (typeof window === 'undefined') return

    const devices = this.getLoginDevices()
    const filtered = devices.filter((d: LoginDevice) => d.deviceId !== deviceId)
    localStorage.setItem(LOGIN_DEVICES_KEY, JSON.stringify(filtered))
    logger.info('[MultiDeviceService] Device removed', { deviceId })
  },

  clearAllDevices(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(LOGIN_DEVICES_KEY)
    logger.info('[MultiDeviceService] All devices cleared')
  },

  getDeviceCount(): number {
    return this.getLoginDevices().length
  },

  isMaxDevicesReached(): boolean {
    return this.getDeviceCount() >= MAX_DEVICES
  },
}
