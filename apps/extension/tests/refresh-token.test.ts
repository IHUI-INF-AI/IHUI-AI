/**
 * Extension refresh token 流程单元测试
 *
 * 锁定:
 * 1. setTokenPair 持久化 access + refresh + expiresIn
 * 2. getRefreshToken / getExpiresIn 读取
 * 3. clearAllTokens 同时清三键
 * 4. readExp 解析 JWT exp
 * 5. scheduleRefreshAlarm 正常时创建 alarm
 * 6. doRefresh 成功路径 + 失败路径
 * 7. startAutoRefresh / stopAutoRefresh 注册/移除监听
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// === 全局 chrome mock ===
const chromeStorage: Record<string, unknown> = {}
const chromeAlarmsCreate = vi.fn()
const chromeAlarmsClear = vi.fn(async () => true)
const chromeAlarmsOnAlarmAdd = vi.fn()
const chromeAlarmsOnAlarmRemove = vi.fn()

;(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
        const keyArr = Array.isArray(keys) ? keys : [keys]
        const result: Record<string, unknown> = {}
        for (const k of keyArr) if (k in chromeStorage) result[k] = chromeStorage[k]
        return result
      }),
      set: vi.fn(async (obj: Record<string, unknown>) => {
        Object.assign(chromeStorage, obj)
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const keyArr = Array.isArray(keys) ? keys : [keys]
        for (const k of keyArr) delete chromeStorage[k]
      }),
      onChanged: {
        addListener: vi.fn(),
      },
    },
  },
  alarms: {
    create: chromeAlarmsCreate,
    clear: chromeAlarmsClear,
    onAlarm: {
      addListener: chromeAlarmsOnAlarmAdd,
      removeListener: chromeAlarmsOnAlarmRemove,
    },
  },
  runtime: {
    onInstalled: { addListener: vi.fn() },
  },
}

// === Mock @ihui/api-client 的 refreshAccessToken ===
const mockRefreshAccessToken = vi.fn()
vi.mock('@ihui/api-client', () => ({
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}))

// === Mock defineBackground(WXT API) ===
;(globalThis as unknown as { defineBackground: unknown }).defineBackground = (fn: () => void) => fn

// === 工具:构造 JWT ===
function makeJwt(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  const signature = 'mock-signature'
  return `${header}.${payload}.${signature}`
}

// 每个测试前重置模块状态(清空 inFlightRefresh / alarmListener 模块级变量)
async function loadFreshModules() {
  vi.resetModules()
  // 重新 mock @ihui/api-client(resetModules 后需要重新注册)
  vi.doMock('@ihui/api-client', () => ({
    setBaseUrl: vi.fn(),
    setTokenProvider: vi.fn(),
    refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
  }))
  const token = await import('../lib/token')
  const tokenUtils = await import('../lib/token-utils')
  return { token, tokenUtils }
}

import { setTokenPair, getRefreshToken, getExpiresIn, clearAllTokens, getToken } from '../lib/token'
import { readExp, scheduleRefreshAlarm } from '../lib/token-utils'

describe('Extension refresh token 流程', () => {
  beforeAll(() => {
    if (typeof globalThis.atob !== 'function') {
      globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary')
    }
  })

  beforeEach(() => {
    for (const k of Object.keys(chromeStorage)) delete chromeStorage[k]
    chromeAlarmsCreate.mockClear()
    chromeAlarmsClear.mockClear()
    chromeAlarmsOnAlarmAdd.mockClear()
    chromeAlarmsOnAlarmRemove.mockClear()
    mockRefreshAccessToken.mockReset()
  })

  describe('token.ts — TokenPair 管理', () => {
    it('setTokenPair 同时持久化 access + refresh + expiresIn 到 storage', async () => {
      await setTokenPair({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 3600,
      })
      expect(chromeStorage['ihui_token']).toBe('access-123')
      expect(chromeStorage['ihui_refresh_token']).toBe('refresh-456')
      expect(chromeStorage['ihui_token_expires_in']).toBe(3600)
      expect(getToken()).toBe('access-123')
      expect(getRefreshToken()).toBe('refresh-456')
      expect(getExpiresIn()).toBe(3600)
    })

    it('setTokenPair 不传 expiresIn 时不覆盖既有 expiresIn', async () => {
      await setTokenPair({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresIn: 3600,
      })
      await setTokenPair({
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
      })
      expect(getToken()).toBe('access-2')
      expect(getRefreshToken()).toBe('refresh-2')
      expect(getExpiresIn()).toBe(3600)
    })

    it('clearAllTokens 同时清三键', async () => {
      await setTokenPair({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 3600,
      })
      await clearAllTokens()
      expect(chromeStorage['ihui_token']).toBeUndefined()
      expect(chromeStorage['ihui_refresh_token']).toBeUndefined()
      expect(chromeStorage['ihui_token_expires_in']).toBeUndefined()
      expect(getToken()).toBeNull()
      expect(getRefreshToken()).toBeNull()
      expect(getExpiresIn()).toBeNull()
    })
  })

  describe('token-utils.ts — JWT 解析', () => {
    it('readExp 正确解析 JWT exp', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600
      const token = makeJwt(exp)
      expect(readExp(token)).toBe(exp)
    })

    it('readExp 返回 null 处理非法 token', () => {
      expect(readExp('not-a-jwt')).toBeNull()
      expect(readExp('a.b')).toBeNull()
      expect(readExp('a.b.c.d')).toBeNull()
    })

    it('readExp 返回 null 处理无 exp 的 payload', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
      const payload = Buffer.from(JSON.stringify({ sub: 'user' })).toString('base64url')
      const token = `${header}.${payload}.sig`
      expect(readExp(token)).toBeNull()
    })
  })

  describe('token-utils.ts — scheduleRefreshAlarm', () => {
    it('正常时创建 alarm(delayInMinutes >= 1)', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600 // 1 小时后
      const token = makeJwt(futureExp)
      scheduleRefreshAlarm(token)
      expect(chromeAlarmsCreate).toHaveBeenCalledTimes(1)
      const call = chromeAlarmsCreate.mock.calls[0]
      expect(call[0]).toBe('ihui-refresh-token')
      const opts = call[1] as { delayInMinutes: number }
      expect(opts.delayInMinutes).toBeGreaterThanOrEqual(1)
      expect(opts.delayInMinutes).toBeLessThanOrEqual(60)
    })

    it('无 exp 时不创建 alarm', () => {
      scheduleRefreshAlarm('invalid-token')
      expect(chromeAlarmsCreate).not.toHaveBeenCalled()
    })
  })

  describe('token-utils.ts — doRefresh', () => {
    it('成功路径:setTokenPair 更新 + 返回 true', async () => {
      const { token, tokenUtils } = await loadFreshModules()
      await token.setTokenPair({
        accessToken: 'access-old',
        refreshToken: 'refresh-old',
        expiresIn: 3600,
      })
      mockRefreshAccessToken.mockResolvedValueOnce({
        success: true,
        data: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          expiresIn: 3600,
          refreshExpiresIn: 604800,
          user: { id: 'u1' },
        },
      })
      const result = await tokenUtils.doRefresh()
      expect(result).toBe(true)
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1)
      expect(mockRefreshAccessToken).toHaveBeenCalledWith('refresh-old')
      expect(token.getToken()).toBe('new-access')
      expect(token.getRefreshToken()).toBe('new-refresh')
    })

    it('失败路径:refreshAccessToken 返回失败时清 token + 返回 false', async () => {
      const { token, tokenUtils } = await loadFreshModules()
      await token.setTokenPair({
        accessToken: 'access-old',
        refreshToken: 'refresh-old',
        expiresIn: 3600,
      })
      mockRefreshAccessToken.mockResolvedValueOnce({
        success: false,
        error: 'invalid refresh token',
      })
      const result = await tokenUtils.doRefresh()
      expect(result).toBe(false)
      expect(token.getToken()).toBeNull()
      expect(token.getRefreshToken()).toBeNull()
    })

    it('异常路径:refreshAccessToken 抛异常时清 token + 返回 false', async () => {
      const { token, tokenUtils } = await loadFreshModules()
      await token.setTokenPair({
        accessToken: 'access-old',
        refreshToken: 'refresh-old',
        expiresIn: 3600,
      })
      mockRefreshAccessToken.mockRejectedValueOnce(new Error('network error'))
      const result = await tokenUtils.doRefresh()
      expect(result).toBe(false)
      expect(token.getToken()).toBeNull()
    })

    it('无 refreshToken 时返回 false(不调 refreshAccessToken)', async () => {
      const { tokenUtils } = await loadFreshModules()
      // 不 setTokenPair,refreshToken 为 null
      const result = await tokenUtils.doRefresh()
      expect(result).toBe(false)
      expect(mockRefreshAccessToken).not.toHaveBeenCalled()
    })

    it('并发去重:同时调用两次,refreshAccessToken 只被调用一次', async () => {
      const { token, tokenUtils } = await loadFreshModules()
      await token.setTokenPair({
        accessToken: 'access-old',
        refreshToken: 'refresh-old',
        expiresIn: 3600,
      })
      let resolveRefresh: ((val: unknown) => void) | null = null
      mockRefreshAccessToken.mockReturnValueOnce(
        new Promise<unknown>((resolve) => {
          resolveRefresh = resolve
        }),
      )
      // 并发两次调用
      const p1 = tokenUtils.doRefresh()
      const p2 = tokenUtils.doRefresh()
      // refreshAccessToken 只被调用一次(去重)
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1)
      // resolve
      resolveRefresh!({
        success: true,
        data: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          expiresIn: 3600,
          refreshExpiresIn: 604800,
          user: { id: 'u1' },
        },
      })
      const results = await Promise.all([p1, p2])
      expect(results[0]).toBe(true)
      expect(results[1]).toBe(true)
      expect(token.getToken()).toBe('new-access')
    })
  })

  describe('token-utils.ts — startAutoRefresh / stopAutoRefresh', () => {
    it('startAutoRefresh 注册 onAlarm 监听,幂等', async () => {
      const { tokenUtils } = await loadFreshModules()
      tokenUtils.startAutoRefresh()
      tokenUtils.startAutoRefresh()
      expect(chromeAlarmsOnAlarmAdd).toHaveBeenCalledTimes(1)
      tokenUtils.stopAutoRefresh()
    })

    it('stopAutoRefresh 清除 alarm + 移除监听', async () => {
      const { tokenUtils } = await loadFreshModules()
      tokenUtils.startAutoRefresh()
      tokenUtils.stopAutoRefresh()
      expect(chromeAlarmsClear).toHaveBeenCalledWith('ihui-refresh-token')
      expect(chromeAlarmsOnAlarmRemove).toHaveBeenCalledTimes(1)
    })

    it('onAlarm 监听器匹配 REFRESH_ALARM_NAME 时调用 doRefresh', async () => {
      const { token, tokenUtils } = await loadFreshModules()
      await token.setTokenPair({
        accessToken: 'access-old',
        refreshToken: 'refresh-old',
        expiresIn: 3600,
      })
      mockRefreshAccessToken.mockResolvedValueOnce({
        success: true,
        data: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          expiresIn: 3600,
          refreshExpiresIn: 604800,
          user: { id: 'u1' },
        },
      })
      tokenUtils.startAutoRefresh()
      const listener = chromeAlarmsOnAlarmAdd.mock.calls[0][0] as (a: { name: string }) => void
      listener({ name: 'ihui-refresh-token' })
      // 等待 doRefresh 异步完成
      await new Promise((r) => setTimeout(r, 100))
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1)
      tokenUtils.stopAutoRefresh()
    })

    it('onAlarm 监听器不匹配的 alarm name 不调用 doRefresh', async () => {
      const { tokenUtils } = await loadFreshModules()
      tokenUtils.startAutoRefresh()
      const listener = chromeAlarmsOnAlarmAdd.mock.calls[0][0] as (a: { name: string }) => void
      listener({ name: 'other-alarm' })
      await new Promise((r) => setTimeout(r, 50))
      expect(mockRefreshAccessToken).not.toHaveBeenCalled()
      tokenUtils.stopAutoRefresh()
    })
  })
})
