// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-236 回归锁(2026-11-08)。
 *
 * 缺陷:本地 PTY 自然退出(handlePtyExit)只把 status 置 exited 并通知监听者,
 *      不从 sessions/userSessions 移除,并发额度永不释放 —— 同一用户退出 5 次后
 *      第 6 次创建永久 500「超过最大并发终端数」。
 * 判据:连续 6 次 create + exit 全部成功;每次退出后 getPTYEntry 返回 null。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  exitCallbacks: [] as Array<(e: { exitCode: number; signal?: number }) => void>,
}))

vi.mock('node:module', () => ({
  createRequire: () => (id: string) => {
    if (id === 'node-pty') return { spawn: mocks.spawn }
    throw new Error(`${id} not installed`)
  },
}))
vi.mock('ioredis', () => ({
  default: class RedisStub {
    on() {
      return this
    }
    set() {
      return Promise.resolve('OK')
    }
    lpush() {
      return Promise.resolve(1)
    }
    ltrim() {
      return Promise.resolve('OK')
    }
    expire() {
      return Promise.resolve(1)
    }
    lrange() {
      return Promise.resolve([])
    }
    hset() {
      return Promise.resolve(1)
    }
    del() {
      return Promise.resolve(1)
    }
    quit() {
      return Promise.resolve('OK')
    }
  },
}))
vi.mock('../src/config/index.js', () => ({ config: { REDIS_URL: undefined } }))

import { createSession, getPTYEntry } from '../src/services/terminal-service.js'

beforeEach(() => {
  mocks.exitCallbacks.length = 0
  mocks.spawn.mockReset().mockImplementation(() => ({
    write: () => undefined,
    resize: () => undefined,
    kill: () => undefined,
    onData: () => ({ dispose: () => undefined }),
    onExit: (cb: (e: { exitCode: number }) => void) => {
      mocks.exitCallbacks.push(cb)
      return { dispose: () => undefined }
    },
  }))
})

describe('F-236 终端会话回收', () => {
  it('连续 6 次创建+自然退出不被并发上限卡死,退出后条目被移除', () => {
    for (let i = 0; i < 6; i++) {
      const session = createSession('u1')
      expect(getPTYEntry(session.id)).not.toBeNull()
      const exit = mocks.exitCallbacks[mocks.exitCallbacks.length - 1]
      expect(exit).toBeTypeOf('function')
      exit!({ exitCode: 0 })
      expect(getPTYEntry(session.id)).toBeNull()
    }
    expect(mocks.spawn).toHaveBeenCalledTimes(6)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
