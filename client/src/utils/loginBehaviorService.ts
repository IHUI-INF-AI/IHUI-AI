import { logger } from './logger'
import type { LoginLocation } from './locationService'

const LOGIN_BEHAVIOR_KEY = 'login_behavior'

export interface LoginPattern {
  hour: number
  count: number
}

export interface DevicePattern {
  deviceId: string
  deviceName: string
  loginCount: number
  lastLogin: number
  trusted: boolean
}

export interface LocationPattern {
  country?: string
  region?: string
  city?: string
  loginCount: number
  lastLogin: number
}

export interface LoginBehavior {
  totalLogins: number
  avgLoginInterval: number
  commonHours: number[]
  commonDevices: DevicePattern[]
  commonLocations: LocationPattern[]
  firstLogin: number
  lastLogin: number
}

export interface BehaviorAnalysis {
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  anomalies: string[]
  recommendations: string[]
}

function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length
}

function _calculateStandardDeviation(values: number[]): number {
  return Math.sqrt(calculateVariance(values))
}

export const LoginBehaviorService = {
  getBehavior(): LoginBehavior | null {
    if (typeof window === 'undefined') return null

    const stored = localStorage.getItem(LOGIN_BEHAVIOR_KEY)
    if (!stored) return null

    try {
      return JSON.parse(stored) as LoginBehavior
    } catch {
      return null
    }
  },

  recordLogin(
    deviceId: string,
    deviceName: string,
    location?: Partial<LoginLocation>
  ): void {
    if (typeof window === 'undefined') return

    const behavior = this.getBehavior() || {
      totalLogins: 0,
      avgLoginInterval: 0,
      commonHours: [],
      commonDevices: [],
      commonLocations: [],
      firstLogin: Date.now(),
      lastLogin: Date.now(),
    }

    const now = Date.now()
    const currentHour = new Date().getHours()

    behavior.totalLogins++

    if (behavior.lastLogin > 0) {
      const interval = now - behavior.lastLogin
      behavior.avgLoginInterval = (behavior.avgLoginInterval * (behavior.totalLogins - 1) + interval) / behavior.totalLogins
    }

    behavior.lastLogin = now

    const hourCount = behavior.commonHours.filter((h: number) => h === currentHour).length
    if (hourCount < 10) {
      behavior.commonHours.push(currentHour)
    }

    const existingDevice = behavior.commonDevices.find((d: DevicePattern) => d.deviceId === deviceId)
    if (existingDevice) {
      existingDevice.loginCount++
      existingDevice.lastLogin = now
    } else {
      behavior.commonDevices.push({
        deviceId,
        deviceName,
        loginCount: 1,
        lastLogin: now,
        trusted: false,
      })
    }

    if (behavior.commonDevices.length > 10) {
      behavior.commonDevices.sort((a: DevicePattern, b: DevicePattern) => b.loginCount - a.loginCount)
      behavior.commonDevices = behavior.commonDevices.slice(0, 10)
    }

    if (location && (location.city || location.region)) {
      const locationKey = `${location.country || ''}-${location.region || ''}-${location.city || ''}`
      const existingLocation = behavior.commonLocations.find(
        (l: LocationPattern) => `${l.country || ''}-${l.region || ''}-${l.city || ''}` === locationKey
      )

      if (existingLocation) {
        existingLocation.loginCount++
        existingLocation.lastLogin = now
      } else {
        behavior.commonLocations.push({
          country: location.country,
          region: location.region,
          city: location.city,
          loginCount: 1,
          lastLogin: now,
        })
      }

      if (behavior.commonLocations.length > 10) {
        behavior.commonLocations.sort((a: LocationPattern, b: LocationPattern) => b.loginCount - a.loginCount)
        behavior.commonLocations = behavior.commonLocations.slice(0, 10)
      }
    }

    localStorage.setItem(LOGIN_BEHAVIOR_KEY, JSON.stringify(behavior))
    logger.info('[LoginBehavior] Login behavior recorded', { deviceId, totalLogins: behavior.totalLogins })
  },

  analyzeBehavior(
    currentDeviceId: string,
    currentLocation?: Partial<LoginLocation>
  ): BehaviorAnalysis {
    const behavior = this.getBehavior()
    const anomalies: string[] = []
    const recommendations: string[] = []
    let riskScore = 0

    if (!behavior || behavior.totalLogins < 3) {
      return {
        riskScore: 0,
        riskLevel: 'low',
        anomalies: [],
        recommendations: ['继续使用以建立登录模式'],
      }
    }

    const currentHour = new Date().getHours()
    const hourFrequency = behavior.commonHours.filter((h: number) => h === currentHour).length
    const hourTotal = behavior.commonHours.length
    const hourProbability = hourFrequency / hourTotal

    if (hourProbability < 0.05) {
      anomalies.push(`异常登录时间: ${currentHour}:00 (历史登录概率: ${(hourProbability * 100).toFixed(1)}%)`)
      riskScore += 15
    }

    const deviceMatch = behavior.commonDevices.find((d: DevicePattern) => d.deviceId === currentDeviceId)
    if (!deviceMatch) {
      anomalies.push('新设备登录')
      riskScore += 20
      recommendations.push('建议验证此设备是否为本人使用')
    } else if (deviceMatch.loginCount < 3) {
      anomalies.push('较少使用的设备')
      riskScore += 10
    }

    if (currentLocation && behavior.commonLocations.length > 0) {
      const locationMatch = behavior.commonLocations.find(
        (l: LocationPattern) => l.city === currentLocation.city || l.region === currentLocation.region
      )

      if (!locationMatch) {
        anomalies.push(`异常登录位置: ${currentLocation.city || currentLocation.region || '未知'}`)
        riskScore += 25
        recommendations.push('检测到异地登录，建议启用双因素认证')
      }
    }

    const _loginIntervals: number[] = []
    if (behavior.avgLoginInterval > 0) {
      const expectedInterval = behavior.avgLoginInterval
      const timeSinceLastLogin = Date.now() - behavior.lastLogin
      const deviation = Math.abs(timeSinceLastLogin - expectedInterval) / expectedInterval

      if (deviation > 2) {
        anomalies.push('登录间隔异常')
        riskScore += 10
      }
    }

    if (behavior.commonDevices.length > 5) {
      recommendations.push('检测到多设备登录，建议定期检查设备列表')
    }

    if (riskScore >= 50) {
      recommendations.push('检测到高风险行为，建议立即修改密码')
    } else if (riskScore >= 30) {
      recommendations.push('存在安全风险，建议检查账户安全设置')
    }

    let riskLevel: BehaviorAnalysis['riskLevel']
    if (riskScore >= 50) riskLevel = 'critical'
    else if (riskScore >= 30) riskLevel = 'high'
    else if (riskScore >= 15) riskLevel = 'medium'
    else riskLevel = 'low'

    return {
      riskScore: Math.min(100, riskScore),
      riskLevel,
      anomalies,
      recommendations,
    }
  },

  getMostCommonHours(): { hour: number; count: number }[] {
    const behavior = this.getBehavior()
    if (!behavior) return []

    const hourCounts: Record<number, number> = {}
    behavior.commonHours.forEach((h: number) => {
      hourCounts[h] = (hourCounts[h] || 0) + 1
    })

    return Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour, 10), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  },

  getTrustedDevices(): DevicePattern[] {
    const behavior = this.getBehavior()
    if (!behavior) return []

    return behavior.commonDevices.filter((d: DevicePattern) => d.trusted || d.loginCount >= 5)
  },

  markDeviceTrusted(deviceId: string): void {
    if (typeof window === 'undefined') return

    const behavior = this.getBehavior()
    if (!behavior) return

    const device = behavior.commonDevices.find((d: DevicePattern) => d.deviceId === deviceId)
    if (device) {
      device.trusted = true
      localStorage.setItem(LOGIN_BEHAVIOR_KEY, JSON.stringify(behavior))
    }
  },

  clearBehavior(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(LOGIN_BEHAVIOR_KEY)
    logger.info('[LoginBehavior] Login behavior data cleared')
  },
}
