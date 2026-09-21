// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * workspace-lock 跨服务协议兼容测试(与 apps/ai-service tests/test_workspace_lock.py 对应)。
 *
 * 覆盖(全部走内存 FakeRedis,禁连真实 Redis):
 *  - ② TS 解析 Python(snake_case)格式锁值 → 识别为持有、不删
 *  - TS 写入 canonical snake_case 格式
 *  - ③ token 不匹配 → 拒绝释放/续期/覆盖
 *  - ④ TTL 过期 → 可正常抢锁
 *  - 未知格式/损坏 value → 视为未知活锁:不删除、不抢锁
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const fakeRedis = vi.hoisted(() => {
  const s = new Map<string, string>()
  /** 模拟 Lua:pcall(cjson.decode) 后比较 token 字段;del / expire 两段 */
  const evalLua = async (
    script: string,
    _numkeys: number,
    key: string,
    ...args: string[]
  ): Promise<number> => {
    const raw = s.get(key)
    if (raw === undefined) return 0
    let d: { token?: unknown }
    try {
      d = JSON.parse(raw) as { token?: unknown }
    } catch {
      return 0
    }
    if (typeof d !== 'object' || d === null || d.token !== args[0]) return 0
    if (script.includes('del')) {
      s.delete(key)
      return 1
    }
    return 1
  }
  return {
    store: s,
    get: vi.fn(async (key: string) => s.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ...rest: string[]) => {
      const nx = rest.includes('NX')
      if (nx && s.has(key)) return null
      s.set(key, value)
      return 'OK'
    }),
    del: vi.fn(async (key: string) => (s.delete(key) ? 1 : 0)),
    eval: vi.fn(evalLua),
    on: vi.fn(),
    quit: vi.fn(async () => 'OK'),
  }
})

vi.mock('ioredis', () => ({
  default: vi.fn(function () {
    return fakeRedis
  }),
}))

vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://localhost' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import {
  acquireWorkspaceLock,
  getWorkspaceLock,
  releaseWorkspaceLock,
  renewWorkspaceLock,
} from '../src/services/workspace-lock.js'

/** 与 fakeRedis 内部共享的同一存储(别名,便于断言) */
const store: Map<string, string> = fakeRedis.store

/** Python(ai-service)写入格式:snake_case(canonical) */
function pythonFormatValue(holder: string, token: string): string {
  const now = Date.now() / 1000
  return JSON.stringify({
    workspace: '/repo/app',
    holder,
    token,
    acquired_at: now,
    heartbeat_at: now,
  })
}

const KEY = 'ihui:workspace_lock:/repo/app'

describe('workspace-lock 跨服务协议兼容', () => {
  beforeEach(() => {
    store.clear()
    vi.clearAllMocks()
  })

  it('写入为 canonical snake_case 格式', async () => {
    const info = await acquireWorkspaceLock('/repo/app', 'api-agent')
    expect(info).not.toBeNull()
    const raw = store.get(KEY)
    expect(raw).toBeDefined()
    const d = JSON.parse(raw as string) as Record<string, unknown>
    expect(d.holder).toBe('api-agent')
    expect(typeof d.acquired_at).toBe('number')
    expect(typeof d.heartbeat_at).toBe('number')
    expect(d.acquiredAt).toBeUndefined()
    expect(d.heartbeatAt).toBeUndefined()
  })

  it('② Python snake_case 格式锁值 → 识别为持有:不删、不抢', async () => {
    const raw = pythonFormatValue('py-agent', 'tok-1')
    store.set(KEY, raw)
    expect(await acquireWorkspaceLock('/repo/app', 'api-agent')).toBeNull()
    expect(store.get(KEY)).toBe(raw) // 原 value 保持,未被删除
    const current = await getWorkspaceLock('/repo/app')
    expect(current).not.toBeNull()
    expect(current?.holder).toBe('py-agent')
    expect(current?.token).toBe('tok-1')
  })

  it('② Python snake_case 格式 + 同 holder 重入 → 原 token 续期', async () => {
    store.set(KEY, pythonFormatValue('api-agent', 'tok-1'))
    const again = await acquireWorkspaceLock('/repo/app', 'api-agent')
    expect(again).not.toBeNull()
    expect(again?.token).toBe('tok-1')
  })

  it('③ token 不匹配 → 拒绝释放/续期,锁保持', async () => {
    const raw = pythonFormatValue('py-agent', 'tok-1')
    store.set(KEY, raw)
    expect(await releaseWorkspaceLock('/repo/app', 'wrong-token')).toBe(false)
    expect(store.get(KEY)).toBe(raw)
    expect(await renewWorkspaceLock('/repo/app', 'wrong-token')).toBe(false)
    expect(store.get(KEY)).toBe(raw)
  })

  it('④ TTL 过期(Redis 自动清除过期 key)→ 可正常抢锁', async () => {
    store.set(KEY, pythonFormatValue('py-agent', 'tok-1'))
    store.delete(KEY) // 模拟 TTL 到期:Redis 侧过期 key 自动消失
    const info = await acquireWorkspaceLock('/repo/app', 'api-agent')
    expect(info).not.toBeNull()
    expect(JSON.parse(store.get(KEY) as string).holder).toBe('api-agent')
  })

  it('未知格式/损坏 value → 视为未知活锁:不删除、不抢锁', async () => {
    store.set(KEY, 'not-json{{')
    expect(await acquireWorkspaceLock('/repo/app', 'api-agent')).toBeNull()
    expect(store.get(KEY)).toBe('not-json{{')
    store.set(KEY, JSON.stringify({ foo: 'bar' }))
    expect(await acquireWorkspaceLock('/repo/app', 'api-agent')).toBeNull()
    expect(store.has(KEY)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
