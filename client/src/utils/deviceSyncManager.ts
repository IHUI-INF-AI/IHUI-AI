import { logger } from './logger'

export interface SyncDevice {
  id: string
  name: string
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  lastSyncedAt: number
  createdAt: number
  isCurrentDevice: boolean
  userAgent?: string
  ipAddress?: string
}

export interface DeviceSyncStatus {
  deviceId: string
  status: 'online' | 'offline' | 'syncing'
  lastSeen: number
  pendingChanges: number
}

const DEVICES_STORAGE_KEY = 'sync-devices'
const CURRENT_DEVICE_ID_KEY = 'current-device-id'

class DeviceSyncManager {
  private devices: SyncDevice[] = []
  private currentDeviceId: string

  constructor() {
    this.currentDeviceId = this.getOrCreateDeviceId()
    this.loadDevices()
  }

  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem(CURRENT_DEVICE_ID_KEY)
    
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem(CURRENT_DEVICE_ID_KEY, deviceId)
    }
    
    return deviceId
  }

  private loadDevices(): void {
    try {
      const saved = localStorage.getItem(DEVICES_STORAGE_KEY)
      if (saved) {
        this.devices = JSON.parse(saved)
      }
    } catch {
      this.devices = []
    }
  }

  private saveDevices(): void {
    try {
      localStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(this.devices))
    } catch {
      logger.warn('Failed to save devices')
    }
  }

  private detectDeviceType(): SyncDevice['type'] {
    const ua = navigator.userAgent.toLowerCase()
    
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      if (/tablet|ipad/i.test(ua)) {
        return 'tablet'
      }
      return 'mobile'
    }
    
    return 'desktop'
  }

  private generateDeviceName(): string {
    const type = this.detectDeviceType()
    const browser = this.detectBrowser()
    const os = this.detectOS()
    
    return `${os} ${browser} (${type})`
  }

  private detectBrowser(): string {
    const ua = navigator.userAgent
    
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Edg')) return 'Edge'
    if (ua.includes('Chrome')) return 'Chrome'
    if (ua.includes('Safari')) return 'Safari'
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera'
    
    return 'Unknown Browser'
  }

  private detectOS(): string {
    const ua = navigator.userAgent
    
    if (ua.includes('Windows NT 10')) return 'Windows 10'
    if (ua.includes('Windows NT 6.3')) return 'Windows 8.1'
    if (ua.includes('Windows NT 6.2')) return 'Windows 8'
    if (ua.includes('Windows NT 6.1')) return 'Windows 7'
    if (ua.includes('Mac OS X')) {
      const match = ua.match(/Mac OS X (\d+[._]\d+)/)
      return match ? `macOS ${match[1].replace('_', '.')}` : 'macOS'
    }
    if (ua.includes('Android')) {
      const match = ua.match(/Android (\d+\.?\d*)/)
      return match ? `Android ${match[1]}` : 'Android'
    }
    if (ua.includes('iPhone OS') || ua.includes('iPad')) {
      const match = ua.match(/OS (\d+[._]\d+)/)
      return match ? `iOS ${match[1].replace('_', '.')}` : 'iOS'
    }
    if (ua.includes('Linux')) return 'Linux'
    
    return 'Unknown OS'
  }

  registerCurrentDevice(): SyncDevice {
    const existingDevice = this.devices.find(d => d.id === this.currentDeviceId)
    
    if (existingDevice) {
      existingDevice.lastSyncedAt = Date.now()
      existingDevice.userAgent = navigator.userAgent
      this.saveDevices()
      return existingDevice
    }
    
    const newDevice: SyncDevice = {
      id: this.currentDeviceId,
      name: this.generateDeviceName(),
      type: this.detectDeviceType(),
      lastSyncedAt: Date.now(),
      createdAt: Date.now(),
      isCurrentDevice: true,
      userAgent: navigator.userAgent
    }
    
    this.devices.forEach(d => d.isCurrentDevice = false)
    this.devices.push(newDevice)
    this.saveDevices()
    
    return newDevice
  }

  updateDeviceLastSync(deviceId?: string): void {
    const id = deviceId || this.currentDeviceId
    const device = this.devices.find(d => d.id === id)
    
    if (device) {
      device.lastSyncedAt = Date.now()
      this.saveDevices()
    }
  }

  getDevices(): SyncDevice[] {
    return [...this.devices].sort((a, b) => b.lastSyncedAt - a.lastSyncedAt)
  }

  getCurrentDevice(): SyncDevice | undefined {
    return this.devices.find(d => d.id === this.currentDeviceId)
  }

  getDeviceById(deviceId: string): SyncDevice | undefined {
    return this.devices.find(d => d.id === deviceId)
  }

  removeDevice(deviceId: string): boolean {
    if (deviceId === this.currentDeviceId) {
      return false
    }
    
    const index = this.devices.findIndex(d => d.id === deviceId)
    if (index !== -1) {
      this.devices.splice(index, 1)
      this.saveDevices()
      return true
    }
    
    return false
  }

  renameDevice(deviceId: string, newName: string): boolean {
    const device = this.devices.find(d => d.id === deviceId)
    
    if (device) {
      device.name = newName
      this.saveDevices()
      return true
    }
    
    return false
  }

  getDeviceCount(): number {
    return this.devices.length
  }

  getActiveDevices(withinHours: number = 24): SyncDevice[] {
    const cutoff = Date.now() - withinHours * 60 * 60 * 1000
    return this.devices.filter(d => d.lastSyncedAt >= cutoff)
  }

  getInactiveDevices(withinDays: number = 30): SyncDevice[] {
    const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000
    return this.devices.filter(d => d.lastSyncedAt < cutoff)
  }

  cleanupOldDevices(olderThanDays: number = 90): number {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    const initialCount = this.devices.length
    
    this.devices = this.devices.filter(d => 
      d.id === this.currentDeviceId || d.lastSyncedAt >= cutoff
    )
    
    this.saveDevices()
    
    return initialCount - this.devices.length
  }

  getDeviceStats(): {
    total: number
    active: number
    byType: Record<SyncDevice['type'], number>
  } {
    const active = this.getActiveDevices(24)
    const byType: Record<SyncDevice['type'], number> = {
      desktop: 0,
      mobile: 0,
      tablet: 0,
      unknown: 0
    }
    
    this.devices.forEach(d => {
      byType[d.type]++
    })
    
    return {
      total: this.devices.length,
      active: active.length,
      byType
    }
  }

  clearAllDevices(): void {
    const currentDevice = this.getCurrentDevice()
    this.devices = currentDevice ? [currentDevice] : []
    this.saveDevices()
  }
}

export const deviceSyncManager = new DeviceSyncManager()
