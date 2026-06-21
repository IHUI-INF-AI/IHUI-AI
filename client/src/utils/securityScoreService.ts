import { TwoFactorService } from './twoFactorService'
import { SecurityLogService } from './securityLogService'
import { MultiDeviceService } from './multiDeviceService'

export interface SecurityScore {
  total: number
  maxScore: number
  level: 'critical' | 'low' | 'medium' | 'high' | 'excellent'
  items: SecurityScoreItem[]
  recommendations: string[]
}

export interface SecurityScoreItem {
  id: string
  name: string
  score: number
  maxScore: number
  status: 'pass' | 'warning' | 'fail'
  description: string
  recommendation?: string
}

function calculatePasswordScore(): SecurityScoreItem {
  const lastPasswordChange = localStorage.getItem('last_password_change')
  const hasPassword = true

  if (!hasPassword) {
    return {
      id: 'password',
      name: '密码设置',
      score: 0,
      maxScore: 20,
      status: 'fail',
      description: '未设置密码',
      recommendation: '请设置一个强密码',
    }
  }

  if (lastPasswordChange) {
    const daysSinceChange = (Date.now() - parseInt(lastPasswordChange)) / (1000 * 60 * 60 * 24)
    if (daysSinceChange > 90) {
      return {
        id: 'password',
        name: '密码强度',
        score: 10,
        maxScore: 20,
        status: 'warning',
        description: `密码已使用 ${Math.floor(daysSinceChange)} 天`,
        recommendation: '建议定期更换密码',
      }
    }
  }

  return {
    id: 'password',
    name: '密码强度',
    score: 20,
    maxScore: 20,
    status: 'pass',
    description: '密码设置正常',
  }
}

function calculate2FAScore(): SecurityScoreItem {
  const status = TwoFactorService.getStatus()

  if (!status.enabled) {
    return {
      id: '2fa',
      name: '双因素认证',
      score: 0,
      maxScore: 25,
      status: 'warning',
      description: '未启用双因素认证',
      recommendation: '强烈建议启用双因素认证以增强账户安全',
    }
  }

  return {
    id: '2fa',
    name: '双因素认证',
    score: 25,
    maxScore: 25,
    status: 'pass',
    description: '已启用双因素认证',
  }
}

function calculateDeviceScore(): SecurityScoreItem {
  const devices = MultiDeviceService.getLoginDevices()
  const deviceCount = devices.length

  if (deviceCount > 5) {
    return {
      id: 'devices',
      name: '设备管理',
      score: 10,
      maxScore: 15,
      status: 'warning',
      description: `${deviceCount} 台设备已登录`,
      recommendation: '建议移除不常用的设备',
    }
  }

  if (deviceCount > 3) {
    return {
      id: 'devices',
      name: '设备管理',
      score: 12,
      maxScore: 15,
      status: 'pass',
      description: `${deviceCount} 台设备已登录`,
    }
  }

  return {
    id: 'devices',
    name: '设备管理',
    score: 15,
    maxScore: 15,
    status: 'pass',
    description: `${deviceCount} 台设备已登录`,
  }
}

function calculateLoginScore(): SecurityScoreItem {
  const failedLogs = SecurityLogService.getFailedLogs()
  const recentFailed = failedLogs.filter(
    log => Date.now() - log.timestamp < 7 * 24 * 60 * 60 * 1000
  )

  if (recentFailed.length > 5) {
    return {
      id: 'login',
      name: '登录安全',
      score: 5,
      maxScore: 20,
      status: 'fail',
      description: `近期 ${recentFailed.length} 次登录失败`,
      recommendation: '请检查账户是否被攻击，建议修改密码',
    }
  }

  if (recentFailed.length > 2) {
    return {
      id: 'login',
      name: '登录安全',
      score: 15,
      maxScore: 20,
      status: 'warning',
      description: `近期 ${recentFailed.length} 次登录失败`,
    }
  }

  return {
    id: 'login',
    name: '登录安全',
    score: 20,
    maxScore: 20,
    status: 'pass',
    description: '登录记录正常',
  }
}

function calculateSessionScore(): SecurityScoreItem {
  const sessionStart = sessionStorage.getItem('session_start')
  const rememberMe = localStorage.getItem('remember_me')

  if (sessionStart) {
    const sessionHours = (Date.now() - parseInt(sessionStart)) / (1000 * 60 * 60)
    if (sessionHours > 24) {
      return {
        id: 'session',
        name: '会话安全',
        score: 8,
        maxScore: 20,
        status: 'warning',
        description: `会话已持续 ${Math.floor(sessionHours)} 小时`,
        recommendation: '建议重新登录以刷新会话',
      }
    }
  }

  if (rememberMe === 'true') {
    return {
      id: 'session',
      name: '会话安全',
      score: 15,
      maxScore: 20,
      status: 'pass',
      description: '已启用记住登录',
    }
  }

  return {
    id: 'session',
    name: '会话安全',
    score: 20,
    maxScore: 20,
    status: 'pass',
    description: '会话设置正常',
  }
}

function getScoreLevel(total: number): 'critical' | 'low' | 'medium' | 'high' | 'excellent' {
  if (total < 30) return 'critical'
  if (total < 50) return 'low'
  if (total < 70) return 'medium'
  if (total < 90) return 'high'
  return 'excellent'
}

function getRecommendations(items: SecurityScoreItem[]): string[] {
  return items
    .filter(item => item.status !== 'pass' && item.recommendation)
    .map(item => item.recommendation!)
}

export const SecurityScoreService = {
  calculateScore(): SecurityScore {
    const items: SecurityScoreItem[] = [
      calculatePasswordScore(),
      calculate2FAScore(),
      calculateDeviceScore(),
      calculateLoginScore(),
      calculateSessionScore(),
    ]

    const total = items.reduce((sum, item) => sum + item.score, 0)
    const maxScore = items.reduce((sum, item) => sum + item.maxScore, 0)
    const level = getScoreLevel(total)
    const recommendations = getRecommendations(items)

    return {
      total,
      maxScore,
      level,
      items,
      recommendations,
    }
  },

  getLevelLabel(level: SecurityScore['level']): string {
    const labels: Record<SecurityScore['level'], string> = {
      critical: '危险',
      low: '较低',
      medium: '中等',
      high: '良好',
      excellent: '优秀',
    }
    return labels[level]
  },

  getLevelColor(level: SecurityScore['level']): string {
    const colors: Record<SecurityScore['level'], string> = {
      critical: 'var(--color-danger-variant)',
      low: 'var(--color-warning-variant)',
      medium: 'var(--color-warning-variant)',
      high: 'var(--color-success)',
      excellent: 'var(--color-primary)',
    }
    return colors[level]
  },

  getLevelIcon(level: SecurityScore['level']): string {
    const icons: Record<SecurityScore['level'], string> = {
      critical: 'error',
      low: 'warning',
      medium: 'warning',
      high: 'success',
      excellent: 'success',
    }
    return icons[level]
  },
}
