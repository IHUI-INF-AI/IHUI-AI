/**
 * 会话管理工具
 * 管理用户会话状态
 */

import { ref, onMounted } from 'vue'
import { logger } from './logger'

const SESSION_KEY = 'app_session'

/**
 * 会话数据
 */
export interface SessionData {
  id: string
  startTime: number
  lastActivity: number
  data: Record<string, unknown>
}

/**
 * 创建新会话
 */
export function createSession(): SessionData {
  const session: SessionData = {
    id: generateSessionId(),
    startTime: Date.now(),
    lastActivity: Date.now(),
    data: {},
  }
  saveSession(session)
  return session
}

/**
 * 获取当前会话
 */
export function getSession(): SessionData | null {
  const sessionData = sessionStorage.getItem(SESSION_KEY)
  if (sessionData) {
    try {
      return JSON.parse(sessionData) as SessionData
    } catch {
      return null
    }
  }
  return null
}

/**
 * 保存会话
 */
export function saveSession(session: SessionData): void {
  session.lastActivity = Date.now()
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

/**
 * 更新会话数据
 */
export function updateSessionData(key: string, value: unknown): void {
  const session = getSession()
  if (session) {
    session.data[key] = value
    saveSession(session)
  }
}

/**
 * 清除会话
 */
export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

/**
 * 生成会话ID
 */
function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

/**
 * 会话管理器
 */
export const sessionManager = {
  init: initSessionManager,
  createSession,
  getSession,
  saveSession,
  updateSessionData,
  clearSession,
}

/**
 * 使用会话管理
 */
export function useSessionManager() {
  const session = ref<SessionData | null>(null)

  onMounted(() => {
    let currentSession = getSession()
    if (!currentSession) {
      currentSession = createSession()
    }
    session.value = currentSession
  })

  return {
    session,
    createSession,
    getSession,
    saveSession,
    updateSessionData,
    clearSession,
  }
}

/**
 * 初始化会话管理
 */
export function initSessionManager(): void {
  let session = getSession()
  if (!session) {
    session = createSession()
  }
  logger.info('Session manager initialized:', session.id)
}
