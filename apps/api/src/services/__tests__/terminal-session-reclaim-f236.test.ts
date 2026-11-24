// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-236 回归夹具:终端会话自然退出必须回收内存登记。
 *
 * 原实现 `handlePtyExit` 只置 status='exited',不 delete/unregister;同一用户
 * 自然 `exit` 5 次后 `countUserSessions` 恒为 5 ⇒ 永久撞「超过最大并发终端数」。
 * 夹具不依赖 node-pty,直接构造 PTYEntry 并驱动真实退出路径。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('ioredis', () => ({
  default: class FakeRedis {
    on(): this {
      return this
    }
    hset(): Promise<number> {
      return Promise.resolve(0)
    }
    expire(): Promise<number> {
      return Promise.resolve(0)
    }
    lpush(): Promise<number> {
      return Promise.resolve(0)
    }
    ltrim(): Promise<string> {
      return Promise.resolve('OK')
    }
    lrange(): Promise<string[]> {
      return Promise.resolve([])
    }
    quit(): Promise<string> {
      return Promise.resolve('OK')
    }
  },
}))

vi.mock('../../config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
  isProductionGuard: false,
}))

import { __test__ as T } from '../terminal-service.js'

function makeEntry(userId: string, sessionId: string): never {
  return {
    pty: {
      write: () => {},
      resize: () => {},
      kill: () => {},
      onData: () => ({ dispose: () => {} }),
      onExit: () => ({ dispose: () => {} }),
    },
    sessionId,
    userId,
    cwd: '/tmp',
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    status: 'active',
    dataListeners: new Set(),
    exitListeners: new Set(),
    kind: 'local',
    shellName: 'bash',
    scrollbackBuffer: '',
    scrollbackTimer: null,
    scrollbackBytes: 0,
    sessionTimeout: null,
  } as never
}

describe('F-236 终端自然退出回收', () => {
  beforeEach(() => {
    T.sessions.clear()
    T.userSessions.clear()
  })

  it('同一用户连续 5 次自然退出后配额归零(sessions 不再累积)', () => {
    const userId = 'user-1'
    for (let i = 0; i < 5; i++) {
      const id = `s-${i}`
      const entry = makeEntry(userId, id)
      T.sessions.set(id, entry)
      T.registerUserSession(userId, id)
      // 上一个会话已退出回收,配额应恒为 1(旧实现此处会一路涨到 5)
      expect(T.countUserSessions(userId)).toBe(1)
      T.handlePtyExit(entry, { exitCode: 0 })
    }
    expect(T.sessions.size).toBe(0)
    expect(T.countUserSessions(userId)).toBe(0)
    expect(T.userSessions.get(userId)).toBeUndefined()
  })

  it('重复退出事件幂等,不重复扣减他人会话', () => {
    const a = makeEntry('user-a', 'a-1')
    const b = makeEntry('user-b', 'b-1')
    T.sessions.set('a-1', a)
    T.registerUserSession('user-a', 'a-1')
    T.sessions.set('b-1', b)
    T.registerUserSession('user-b', 'b-1')

    T.handlePtyExit(a, { exitCode: 0 })
    T.handlePtyExit(a, { exitCode: 1 })
    expect(T.countUserSessions('user-a')).toBe(0)
    expect(T.countUserSessions('user-b')).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
