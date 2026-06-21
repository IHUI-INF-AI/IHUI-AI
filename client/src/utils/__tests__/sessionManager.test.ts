import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createSession,
  getSession,
  saveSession,
  updateSessionData,
  clearSession,
  sessionManager,
  useSessionManager,
  initSessionManager,
  SessionData,
} from '../sessionManager'

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

const mockSessionStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(global, 'sessionStorage', {
  value: mockSessionStorage,
})

describe('sessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('createSession', () => {
    it('应该创建新会话', () => {
      const session = createSession()
      expect(session.id).toBeDefined()
      expect(session.startTime).toBeDefined()
      expect(session.lastActivity).toBeDefined()
      expect(session.data).toEqual({})
    })

    it('每次创建的会话ID应该不同', () => {
      const session1 = createSession()
      const session2 = createSession()
      expect(session1.id).not.toBe(session2.id)
    })
  })

  describe('getSession', () => {
    it('没有会话时应该返回null', () => {
      mockSessionStorage.getItem.mockReturnValue(null)
      const session = getSession()
      expect(session).toBeNull()
    })

    it('有会话时应该返回会话数据', () => {
      const mockSession: SessionData = {
        id: 'test-id',
        startTime: Date.now(),
        lastActivity: Date.now(),
        data: { key: 'value' },
      }
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(mockSession))
      const session = getSession()
      expect(session).toEqual(mockSession)
    })

    it('JSON解析失败时应该返回null', () => {
      mockSessionStorage.getItem.mockReturnValue('invalid-json')
      const session = getSession()
      expect(session).toBeNull()
    })
  })

  describe('saveSession', () => {
    it('应该保存会话', () => {
      const session: SessionData = {
        id: 'test-id',
        startTime: Date.now(),
        lastActivity: Date.now(),
        data: {},
      }
      saveSession(session)
      expect(mockSessionStorage.setItem).toHaveBeenCalled()
    })

    it('应该更新lastActivity', () => {
      const session: SessionData = {
        id: 'test-id',
        startTime: 1000,
        lastActivity: 1000,
        data: {},
      }
      saveSession(session)
      expect(session.lastActivity).toBeGreaterThan(1000)
    })
  })

  describe('updateSessionData', () => {
    it('应该更新会话数据', () => {
      const mockSession: SessionData = {
        id: 'test-id',
        startTime: Date.now(),
        lastActivity: Date.now(),
        data: {},
      }
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(mockSession))
      updateSessionData('newKey', 'newValue')
      expect(mockSessionStorage.setItem).toHaveBeenCalled()
    })

    it('没有会话时应该不执行', () => {
      mockSessionStorage.getItem.mockReturnValue(null)
      updateSessionData('key', 'value')
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled()
    })
  })

  describe('clearSession', () => {
    it('应该清除会话', () => {
      clearSession()
      expect(mockSessionStorage.removeItem).toHaveBeenCalled()
    })
  })

  describe('sessionManager', () => {
    it('应该提供所有方法', () => {
      expect(typeof sessionManager.init).toBe('function')
      expect(typeof sessionManager.createSession).toBe('function')
      expect(typeof sessionManager.getSession).toBe('function')
      expect(typeof sessionManager.saveSession).toBe('function')
      expect(typeof sessionManager.updateSessionData).toBe('function')
      expect(typeof sessionManager.clearSession).toBe('function')
    })
  })

  describe('useSessionManager', () => {
    it('应该返回会话管理方法', () => {
      const { session, createSession, getSession, saveSession, updateSessionData, clearSession } = useSessionManager()
      expect(session.value).toBeNull()
      expect(typeof createSession).toBe('function')
      expect(typeof getSession).toBe('function')
      expect(typeof saveSession).toBe('function')
      expect(typeof updateSessionData).toBe('function')
      expect(typeof clearSession).toBe('function')
    })
  })

  describe('initSessionManager', () => {
    it('应该初始化会话管理器', () => {
      mockSessionStorage.getItem.mockReturnValue(null)
      initSessionManager()
      expect(mockSessionStorage.setItem).toHaveBeenCalled()
    })
  })
})
