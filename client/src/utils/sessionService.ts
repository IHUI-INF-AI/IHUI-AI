import { logger } from './logger'

const SESSION_KEY = 'session_data'
const SESSION_TIMEOUT = 30 * 60 * 1000
const MAX_SESSIONS = 5

export interface Session {
  id: string
  deviceId: string
  deviceName: string
  startTime: number
  lastActiveTime: number
  ipAddress?: string
  location?: string
  isCurrent: boolean
}

interface SessionData {
  sessions: Session[]
  currentSessionId: string
}

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function getDeviceName(): string {
  const ua = navigator.userAgent
  let deviceName = 'Unknown Device'

  if (ua.includes('Windows NT 10')) deviceName = 'Windows 10'
  else if (ua.includes('Windows NT 11')) deviceName = 'Windows 11'
  else if (ua.includes('Mac OS X')) deviceName = 'Mac OS'
  else if (ua.includes('iPhone')) deviceName = 'iPhone'
  else if (ua.includes('iPad')) deviceName = 'iPad'
  else if (ua.includes('Android')) deviceName = 'Android'
  else if (ua.includes('Linux')) deviceName = 'Linux'

  if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    const match = ua.match(/Chrome\/(\d+)/)
    if (match) deviceName += ` - Chrome ${match[1]}`
  } else if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/)
    if (match) deviceName += ` - Firefox ${match[1]}`
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/)
    if (match) deviceName += ` - Safari ${match[1]}`
  } else if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/)
    if (match) deviceName += ` - Edge ${match[1]}`
  }

  return deviceName
}

export const SessionService = {
  getSessions(): Session[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) return []

    try {
      const data = JSON.parse(stored) as SessionData
      return data.sessions || []
    } catch {
      return []
    }
  },

  getCurrentSession(): Session | null {
    const sessions: Session[] = this.getSessions()
    return sessions.find((s: Session) => s.isCurrent) || null
  },

  createSession(deviceId: string): Session {
    const sessionId = generateSessionId()
    const newSession: Session = {
      id: sessionId,
      deviceId,
      deviceName: getDeviceName(),
      startTime: Date.now(),
      lastActiveTime: Date.now(),
      isCurrent: true,
    }

    let sessions: Session[] = this.getSessions()

    sessions = sessions.map((s: Session) => ({ ...s, isCurrent: false }))

    sessions.unshift(newSession)

    sessions = sessions.slice(0, MAX_SESSIONS)

    const data: SessionData = {
      sessions,
      currentSessionId: sessionId,
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(data))
    sessionStorage.setItem('session_start', Date.now().toString())

    logger.info('[SessionService] New session created', { sessionId, deviceName: newSession.deviceName })
    return newSession
  },

  updateActivity(): void {
    if (typeof window === 'undefined') return

    const sessions: Session[] = this.getSessions()
    const currentSession = sessions.find((s: Session) => s.isCurrent)

    if (currentSession) {
      currentSession.lastActiveTime = Date.now()
      localStorage.setItem(SESSION_KEY, JSON.stringify({ sessions, currentSessionId: currentSession.id }))
    }
  },

  endSession(sessionId: string): boolean {
    if (typeof window === 'undefined') return false

    const sessions: Session[] = this.getSessions()
    const index = sessions.findIndex((s: Session) => s.id === sessionId)

    if (index === -1) return false

    if (sessions[index].isCurrent) {
      return false
    }

    sessions.splice(index, 1)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ sessions, currentSessionId: '' }))

    logger.info('[SessionService] Session terminated', { sessionId })
    return true
  },

  endAllOtherSessions(): number {
    if (typeof window === 'undefined') return 0

    const sessions: Session[] = this.getSessions()
    const currentSession = sessions.find((s: Session) => s.isCurrent)

    if (!currentSession) return 0

    const count = sessions.length - 1
    const newSessions = [currentSession]
    localStorage.setItem(SESSION_KEY, JSON.stringify({ sessions: newSessions, currentSessionId: currentSession.id }))

    logger.info('[SessionService] All other sessions terminated', { count })
    return count
  },

  isSessionExpired(session: Session): boolean {
    return Date.now() - session.lastActiveTime > SESSION_TIMEOUT
  },

  getActiveSessions(): Session[] {
    return this.getSessions().filter((s: Session) => !this.isSessionExpired(s))
  },

  clearSessions(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem('session_start')
    logger.info('[SessionService] All sessions cleared')
  },

  formatSessionDuration(startTime: number): string {
    const duration = Date.now() - startTime
    const hours = Math.floor(duration / (1000 * 60 * 60))
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    }
    return `${minutes}分钟`
  },
}
