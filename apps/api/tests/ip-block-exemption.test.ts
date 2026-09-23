// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'

import { isBlockExemptPath } from '../src/utils/block-exempt-paths.js'
import { IpReputationService } from '../src/services/ip-reputation.js'

/* ----------------------------- 迷你 Redis 替身 ----------------------------- */

interface Entry {
  v: string
  expAt: number
}

function fakeRedis() {
  const store = new Map<string, Entry>()
  const alive = (k: string): Entry | undefined => {
    const e = store.get(k)
    if (!e) return undefined
    if (e.expAt && e.expAt <= Date.now()) {
      store.delete(k)
      return undefined
    }
    return e
  }
  return {
    get: async (k: string) => alive(k)?.v ?? null,
    set: async (k: string, v: string, _mode?: string, sec?: number) => {
      store.set(k, { v, expAt: sec ? Date.now() + sec * 1000 : 0 })
      return 'OK'
    },
    del: async (...keys: string[]) => {
      let n = 0
      for (const k of keys) if (store.delete(k)) n++
      return n
    },
    incr: async (k: string) => {
      const cur = Number(alive(k)?.v ?? '0') + 1
      const existing = store.get(k)
      store.set(k, { v: String(cur), expAt: existing?.expAt ?? 0 })
      return cur
    },
    expire: async (k: string, sec: number) => {
      const e = store.get(k)
      if (!e) return 0
      e.expAt = Date.now() + sec * 1000
      return 1
    },
    ttl: async (k: string) => {
      const e = alive(k)
      if (!e) return -2
      return e.expAt ? Math.round((e.expAt - Date.now()) / 1000) : -1
    },
  }
}

/* ----------------------------- 路径豁免表 ----------------------------- */

describe('isBlockExemptPath', () => {
  it('监控探针豁免 —— 被封时监控要能区分"服务挂了"和"这个 IP 被封了"', () => {
    for (const p of [
      '/api/health',
      '/api/ready',
      '/api/metrics',
      '/metrics',
      '/business-metrics',
    ]) {
      expect(isBlockExemptPath(p)).toBe(true)
    }
  })

  it('自助解封面豁免 —— 否则 429 承诺的人机验证是死路', () => {
    expect(isBlockExemptPath('/api/security/challenge')).toBe(true)
    expect(isBlockExemptPath('/api/security/verify-challenge')).toBe(true)
    // 管理员解封/信誉查询带参数段,必须按前缀命中(它们由 requireAdmin 兜底)
    expect(isBlockExemptPath('/api/security/block-ip/1.2.3.4')).toBe(true)
    expect(isBlockExemptPath('/api/security/ip-reputation/8.8.8.8')).toBe(true)
    // 挑战端点要过 CSRF 校验:拿不到 token 的被封客户端会在第 0 步卡死
    expect(isBlockExemptPath('/api/csrf-token')).toBe(true)
  })

  it('上报端点不豁免 —— 它无认证且能给任意 IP 记坏事件,豁免=给攻击者投毒通道', () => {
    expect(isBlockExemptPath('/api/security/report')).toBe(false)
  })

  it('普通业务路径不豁免', () => {
    expect(isBlockExemptPath('/api/publish/accounts/me')).toBe(false)
    expect(isBlockExemptPath('/api/subagents/active')).toBe(false)
    expect(isBlockExemptPath('')).toBe(false)
  })
})

/* ----------------------------- 封禁来源与自助解除 ----------------------------- */

describe('IpReputationService 封禁来源标注', () => {
  it('blockIp 记录 reason,getBlockInfo 回读并给出剩余秒数', async () => {
    const svc = new IpReputationService(fakeRedis() as unknown as never)
    await svc.blockIp('99.1.1.1', 900, 'rate-limit-block')
    const info = await svc.getBlockInfo('99.1.1.1')
    expect(info?.reason).toBe('rate-limit-block')
    expect(info?.remainingSec).toBeGreaterThan(800)
    expect(info?.remainingSec).toBeLessThanOrEqual(900)
  })

  it('未被封禁返回 null', async () => {
    const svc = new IpReputationService(fakeRedis() as unknown as never)
    expect(await svc.getBlockInfo('99.1.1.2')).toBeNull()
  })

  it('自动封禁可被人机验证解除', async () => {
    const redis = fakeRedis()
    const svc = new IpReputationService(redis as unknown as never)
    for (const reason of ['rate-limit-block', 'scanner-detected', 'high-threat-score']) {
      await svc.blockIp('99.1.1.3', 900, reason)
      expect(await svc.unblockIfAuto('99.1.1.3')).toBe(true)
      expect(await svc.getBlockInfo('99.1.1.3')).toBeNull()
    }
  })

  it('管理员手工封禁不得被人机验证解除 —— 否则 CAPTCHA 成了绕过处置的后门', async () => {
    const svc = new IpReputationService(fakeRedis() as unknown as never)
    await svc.blockIp('99.1.1.4', 3600, 'admin-block')
    expect(await svc.unblockIfAuto('99.1.1.4')).toBe(false)
    expect((await svc.getBlockInfo('99.1.1.4'))?.reason).toBe('admin-block')
  })

  it('未标注来源的封禁按不可解除处理(含改造前写入的裸时间戳旧值)', async () => {
    const redis = fakeRedis()
    const svc = new IpReputationService(redis as unknown as never)
    // 模拟旧格式:值是裸时间戳,无 reason 前缀
    await redis.set('ip:blocked:99.1.1.5', String(Date.now()), 'EX', 600)
    expect((await svc.getBlockInfo('99.1.1.5'))?.reason).toBe('legacy')
    expect(await svc.unblockIfAuto('99.1.1.5')).toBe(false)
  })

  it('Redis 不可用时内存降级同样携带 reason 并遵守同一解除策略', async () => {
    const svc = new IpReputationService(null)
    await svc.blockIp('mem-auto.example', 900, 'rate-limit-block')
    expect(await svc.getBlockInfo('mem-auto.example')).toMatchObject({
      reason: 'rate-limit-block',
    })
    expect(await svc.unblockIfAuto('mem-auto.example')).toBe(true)

    await svc.blockIp('mem-admin.example', 900, 'admin-block')
    expect(await svc.unblockIfAuto('mem-admin.example')).toBe(false)
  })
})

/* ----------------------------- 端到端接线 ----------------------------- */

describe('反自动化钩子的解封闭环', () => {
  it('挑战通过后调用的是 unblockIfAuto(而非无条件 unblockIp)', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../src/routes/security.ts', import.meta.url), 'utf8'),
    )
    expect(src).toContain('unblockIfAuto')
    expect(src).toContain("blockIp(ip, duration, 'admin-block')")
  })

  it('两道封禁钩子共用同一张豁免表,不再各持一份', async () => {
    const fs = await import('node:fs/promises')
    const aa = await fs.readFile(
      new URL('../src/plugins/anti-automation.ts', import.meta.url),
      'utf8',
    )
    const td = await fs.readFile(
      new URL('../src/plugins/threat-detector.ts', import.meta.url),
      'utf8',
    )
    for (const [name, code] of [
      ['anti-automation', aa],
      ['threat-detector', td],
    ] as const) {
      expect(code, `${name} 必须引用共享豁免表`).toContain("from '../utils/block-exempt-paths.js'")
      expect(code, `${name} 必须调用 isBlockExemptPath`).toContain('isBlockExemptPath(path)')
      // 防回潮:本地再抄一份 SKIP_PATHS 会让两端豁免面重新漂移
      expect(code, `${name} 不得再本地维护 SKIP_PATHS`).not.toMatch(/const SKIP_PATHS/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
