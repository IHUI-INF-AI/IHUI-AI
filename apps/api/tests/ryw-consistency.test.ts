import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RywConsistency, DEFAULT_RYW_CONFIG } from '../src/utils/ryw-consistency.js'

function createMockRedis() {
  const kv: Record<string, string> = {}
  return {
    kv,
    set: vi.fn(async (key: string, val: string) => {
      kv[key] = val
      return 'OK'
    }),
    exists: vi.fn(async (key: string) => (key in kv ? 1 : 0)),
    del: vi.fn(async (key: string) => {
      const had = key in kv
      delete kv[key]
      return had ? 1 : 0
    }),
    pipeline: vi.fn(() => {
      const cmds: Array<{ cmd: string; args: unknown[] }> = []
      return {
        set(key: string, val: string) {
          cmds.push({ cmd: 'set', args: [key, val] })
          return this
        },
        async exec() {
          for (const c of cmds) {
            if (c.cmd === 'set') {
              const [k, v] = c.args as [string, string]
              kv[k] = v
            }
          }
          return cmds.map(() => [null, 'OK'] as [Error | null, unknown])
        },
      }
    }),
  }
}

describe('ryw-consistency — RYW 一致性', () => {
  let redis: ReturnType<typeof createMockRedis>
  let ryw: RywConsistency

  beforeEach(() => {
    redis = createMockRedis()
    ryw = new RywConsistency(redis as never)
  })

  describe('DEFAULT_RYW_CONFIG', () => {
    it('windowSec=2', () => {
      expect(DEFAULT_RYW_CONFIG.windowSec).toBe(2)
    })
    it('maxWindowSec=30', () => {
      expect(DEFAULT_RYW_CONFIG.maxWindowSec).toBe(30)
    })
  })

  describe('markWrite + canReadFollower', () => {
    it('未 markWrite 时可走从库', async () => {
      const r = await ryw.canReadFollower('u1', 'profile')
      expect(r).toBe(true)
    })
    it('markWrite 后窗口内强制走主库', async () => {
      await ryw.markWrite('u1', 'profile')
      const r = await ryw.canReadFollower('u1', 'profile')
      expect(r).toBe(false)
    })
    it('不同 userId 互不影响', async () => {
      await ryw.markWrite('u1', 'profile')
      const r1 = await ryw.canReadFollower('u1', 'profile')
      const r2 = await ryw.canReadFollower('u2', 'profile')
      expect(r1).toBe(false)
      expect(r2).toBe(true)
    })
    it('不同 key 互不影响', async () => {
      await ryw.markWrite('u1', 'profile')
      const r1 = await ryw.canReadFollower('u1', 'profile')
      const r2 = await ryw.canReadFollower('u1', 'settings')
      expect(r1).toBe(false)
      expect(r2).toBe(true)
    })
    it('clear 后可走从库', async () => {
      await ryw.markWrite('u1', 'profile')
      expect(await ryw.canReadFollower('u1', 'profile')).toBe(false)
      await ryw.clear('u1', 'profile')
      expect(await ryw.canReadFollower('u1', 'profile')).toBe(true)
    })
  })

  describe('自定义 windowSec', () => {
    it('传入 windowSec 透传到 set EX 参数', async () => {
      const setSpy = vi.spyOn(redis, 'set')
      await ryw.markWrite('u1', 'profile', { windowSec: 10 })
      // 验证 set 调用第 4 个参数是 10
      expect(setSpy).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'EX', 10)
    })
    it('windowSec 上限为 maxWindowSec', async () => {
      const setSpy = vi.spyOn(redis, 'set')
      await ryw.markWrite('u1', 'profile', { windowSec: 100 })
      expect(setSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'EX',
        30, // maxWindowSec
      )
    })
  })

  describe('region 跨地域', () => {
    it('不同 region 互不影响', async () => {
      await ryw.markWrite('u1', 'profile', { region: 'us-east' })
      const r1 = await ryw.canReadFollower('u1', 'profile', 'us-east')
      const r2 = await ryw.canReadFollower('u1', 'profile', 'eu-west')
      expect(r1).toBe(false)
      expect(r2).toBe(true)
    })
    it('Redis key 包含 region', async () => {
      const setSpy = vi.spyOn(redis, 'set')
      await ryw.markWrite('u1', 'profile', { region: 'us-east' })
      expect(setSpy).toHaveBeenCalledWith(
        'ihui:ryw:us-east:u1:profile',
        expect.any(String),
        'EX',
        expect.any(Number),
      )
    })
    it('无 region 时 Redis key 格式', async () => {
      const setSpy = vi.spyOn(redis, 'set')
      await ryw.markWrite('u1', 'profile')
      expect(setSpy).toHaveBeenCalledWith(
        'ihui:ryw:u1:profile',
        expect.any(String),
        'EX',
        expect.any(Number),
      )
    })
  })

  describe('markWrites 批量', () => {
    it('批量标记多个 key', async () => {
      await ryw.markWrites('u1', ['k1', 'k2', 'k3'])
      expect(await ryw.canReadFollower('u1', 'k1')).toBe(false)
      expect(await ryw.canReadFollower('u1', 'k2')).toBe(false)
      expect(await ryw.canReadFollower('u1', 'k3')).toBe(false)
    })
    it('空数组不调用 pipeline', async () => {
      const spy = vi.spyOn(redis, 'pipeline')
      await ryw.markWrites('u1', [])
      expect(spy).not.toHaveBeenCalled()
    })
    it('批量支持 region', async () => {
      await ryw.markWrites('u1', ['k1'], { region: 'r1' })
      expect(await ryw.canReadFollower('u1', 'k1', 'r1')).toBe(false)
      expect(await ryw.canReadFollower('u1', 'k1', 'r2')).toBe(true)
    })
  })

  describe('stats', () => {
    it('初始为 0', () => {
      const s = ryw.getStats()
      expect(s.forcedMaster).toBe(0)
      expect(s.allowedFollower).toBe(0)
    })
    it('markWrite 后 canReadFollower 累计 forcedMaster', async () => {
      await ryw.markWrite('u1', 'k1')
      await ryw.canReadFollower('u1', 'k1')
      await ryw.canReadFollower('u2', 'k1')
      const s = ryw.getStats()
      expect(s.forcedMaster).toBe(1)
      expect(s.allowedFollower).toBe(1)
    })
    it('返回快照（深拷贝）', () => {
      const s1 = ryw.getStats()
      s1.forcedMaster = 999
      const s2 = ryw.getStats()
      expect(s2.forcedMaster).toBe(0)
    })
  })

  describe('自定义 config', () => {
    it('自定义 windowSec 与 maxWindowSec', async () => {
      const ryw2 = new RywConsistency(redis as never, {
        windowSec: 5,
        maxWindowSec: 10,
      })
      const setSpy = vi.spyOn(redis, 'set')
      await ryw2.markWrite('u1', 'k1')
      expect(setSpy).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'EX', 5)
    })
  })
})
