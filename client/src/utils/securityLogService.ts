import { logger } from './logger'
import { DeviceService } from './deviceService'

const SECURITY_LOG_KEY = 'security_logs'
const MAX_LOGS = 100

export type SecurityEventType =
  | 'login'
  | 'logout'
  | 'password_change'
  | 'device_remove'
  | 'suspicious_login'
  | 'token_refresh'
  | 'account_update'

export interface SecurityLogEntry {
  id: string
  type: SecurityEventType
  timestamp: number
  deviceId?: string
  deviceName?: string
  ipAddress?: string
  location?: string
  details?: string
  success: boolean
}

function generateLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export const SecurityLogService = {
  getLogs(): SecurityLogEntry[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(SECURITY_LOG_KEY)
    if (!stored) return []
    try {
      return JSON.parse(stored) as SecurityLogEntry[]
    } catch {
      return []
    }
  },

  async addLog(
    type: SecurityEventType,
    options: {
      success?: boolean
      details?: string
      ipAddress?: string
      location?: string
    } = {}
  ): Promise<SecurityLogEntry> {
    if (typeof window === 'undefined') {
      throw new Error('SecurityLogService can only be used in browser environment')
    }

    const deviceInfo = await DeviceService.getDeviceInfo()
    const entry: SecurityLogEntry = {
      id: generateLogId(),
      type,
      timestamp: Date.now(),
      deviceId: deviceInfo?.deviceId,
      deviceName: deviceInfo ? `${deviceInfo.platform} - ${deviceInfo.screenWidth}x${deviceInfo.screenHeight}` : undefined,
      ipAddress: options.ipAddress,
      location: options.location,
      details: options.details,
      success: options.success ?? true,
    }

    const logs = this.getLogs()
    logs.unshift(entry)

    const trimmedLogs = logs.slice(0, MAX_LOGS)
    localStorage.setItem(SECURITY_LOG_KEY, JSON.stringify(trimmedLogs))

    logger.info('[SecurityLog] Security event recorded', { type, success: entry.success })
    return entry
  },

  async logLogin(success: boolean = true, details?: string): Promise<SecurityLogEntry> {
    return this.addLog('login', { success, details })
  },

  async logLogout(details?: string): Promise<SecurityLogEntry> {
    return this.addLog('logout', { success: true, details })
  },

  async logPasswordChange(success: boolean = true): Promise<SecurityLogEntry> {
    return this.addLog('password_change', { success })
  },

  async logDeviceRemove(deviceId: string, deviceName?: string): Promise<SecurityLogEntry> {
    return this.addLog('device_remove', {
      success: true,
      details: `移除设备: ${deviceName || deviceId}`,
    })
  },

  async logSuspiciousLogin(details: string): Promise<SecurityLogEntry> {
    return this.addLog('suspicious_login', { success: false, details })
  },

  async logTokenRefresh(success: boolean = true): Promise<SecurityLogEntry> {
    return this.addLog('token_refresh', { success })
  },

  clearLogs(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(SECURITY_LOG_KEY)
    logger.info('[SecurityLog] Security logs cleared')
  },

  getRecentLogs(count: number = 10): SecurityLogEntry[] {
    return this.getLogs().slice(0, count)
  },

  getLogsByType(type: SecurityEventType): SecurityLogEntry[] {
    return this.getLogs().filter((log: SecurityLogEntry) => log.type === type)
  },

  getFailedLogs(): SecurityLogEntry[] {
    return this.getLogs().filter((log: SecurityLogEntry) => !log.success)
  },
}
