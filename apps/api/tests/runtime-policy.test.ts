// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_RUNTIME_POLICY,
  MAX_POLL_INTERVAL_MS,
  RuntimePolicyWatcher,
  loadRuntimePolicy,
  parseRuntimePolicy,
  toAuditLogParams,
  type RuntimePolicy,
  type RuntimePolicyAuditEvent,
} from '../src/config/runtime-policy.js'

function validPolicy(): RuntimePolicy {
  return {
    probe: { enabled: true, intervalMs: 500 },
    timeout: { commandMs: 12_000, approvalMs: 30_000 },
    background_limit: { maxTasks: 4, maxPerSession: 2 },
    audit: {
      changedBy: 'alice',
      reason: '收紧后台并发',
      changedAt: '2026-11-26T10:00:00+08:00',
    },
  }
}

describe('RP-9 runtime-policy 校验（非法字段整份拒绝）', () => {
  it('合法策略解析成功且同内容摘要稳定', () => {
    const content = JSON.stringify(validPolicy())
    const first = parseRuntimePolicy(content)
    const second = parseRuntimePolicy(content)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(first.policy).toEqual(validPolicy())
      expect(first.hash).toBe(second.hash)
      expect(first.hash).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('顶层未知字段导致整份拒绝，不返回半份策略', () => {
    const result = parseRuntimePolicy(JSON.stringify({ ...validPolicy(), extra_flag: true }))
    expect(result).toMatchObject({ ok: false, code: 'SCHEMA_REJECTED' })
    expect(result.ok || result.reasons.join(' ')).toContain('extra_flag')
  })

  it('嵌套未知字段同样整份拒绝', () => {
    const policy = validPolicy()
    const result = parseRuntimePolicy(
      JSON.stringify({ ...policy, probe: { ...policy.probe, surprise: 1 } }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.join(' ')).toContain('probe.surprise')
  })

  it('字段类型错误与越界值分别拒绝', () => {
    const badType = { ...validPolicy(), timeout: { commandMs: '12000', approvalMs: 30_000 } }
    const badRange = {
      ...validPolicy(),
      background_limit: { maxTasks: 0, maxPerSession: 999 },
    }
    expect(parseRuntimePolicy(JSON.stringify(badType))).toMatchObject({
      ok: false,
      code: 'SCHEMA_REJECTED',
    })
    expect(parseRuntimePolicy(JSON.stringify(badRange))).toMatchObject({
      ok: false,
      code: 'SCHEMA_REJECTED',
    })
  })

  it('空内容与坏 JSON 档位分明', () => {
    expect(parseRuntimePolicy('  \n')).toMatchObject({ ok: false, code: 'EMPTY_CONTENT' })
    expect(parseRuntimePolicy('{oops')).toMatchObject({ ok: false, code: 'MALFORMED_JSON' })
  })

  it('审计元数据缺 who 或 why 一律拒绝', () => {
    const noWho = validPolicy()
    noWho.audit = { reason: 'x', changedAt: '2026-11-26T10:00:00+08:00' } as never
    const noWhy = validPolicy()
    noWhy.audit = { changedBy: 'bob', changedAt: '2026-11-26T10:00:00+08:00' } as never
    expect(parseRuntimePolicy(JSON.stringify(noWho))).toMatchObject({ ok: false })
    expect(parseRuntimePolicy(JSON.stringify(noWhy))).toMatchObject({ ok: false })
  })

  it('内置默认策略是 fail-safe 方向', () => {
    expect(DEFAULT_RUNTIME_POLICY.probe.enabled).toBe(false)
    expect(DEFAULT_RUNTIME_POLICY.background_limit.maxTasks).toBeLessThanOrEqual(8)
    expect(DEFAULT_RUNTIME_POLICY.timeout.commandMs).toBeGreaterThan(0)
  })
})

describe('RP-9 runtime-policy 热加载与变更审计', () => {
  let dir: string
  let filePath: string

  async function writePolicy(value: unknown): Promise<void> {
    const tmp = `${filePath}.tmp`
    await writeFile(tmp, JSON.stringify(value), 'utf8')
    await rename(tmp, filePath)
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ihui-rp9-'))
    filePath = join(dir, 'runtime-policy.json')
    await writePolicy(validPolicy())
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('apply 事件带齐 who/when/why，策略值真正换入', async () => {
    const events: RuntimePolicyAuditEvent[] = []
    const watcher = new RuntimePolicyWatcher({ filePath, auditSink: (e) => events.push(e) })
    const first = await watcher.start()
    try {
      expect(first?.kind).toBe('applied')
      expect(first?.who).toBe('alice')
      expect(first?.when).toBe('2026-11-26T10:00:00+08:00')
      expect(first?.why).toBe('收紧后台并发')
      expect(watcher.policy).toEqual(validPolicy())
    } finally {
      watcher.stop()
    }
  })

  it('相同内容重复刷新不重复打点', async () => {
    const events: RuntimePolicyAuditEvent[] = []
    const watcher = new RuntimePolicyWatcher({ filePath, auditSink: (e) => events.push(e) })
    await watcher.start()
    try {
      expect(await watcher.refresh()).toBeNull()
      expect(events).toHaveLength(1)
    } finally {
      watcher.stop()
    }
  })

  it('非法变更整份拒绝：保留上一份有效策略且不通知消费方', async () => {
    const events: RuntimePolicyAuditEvent[] = []
    let applied = 0
    const watcher = new RuntimePolicyWatcher({ filePath, auditSink: (e) => events.push(e) })
    watcher.subscribe(() => {
      applied += 1
    })
    await watcher.start()
    try {
      const before = watcher.policy
      await writePolicy({ ...validPolicy(), timeout: { commandMs: -1, approvalMs: 30_000 } })
      const rejected = await watcher.refresh()
      expect(rejected?.kind).toBe('rejected')
      expect(rejected?.nextHash).toBeNull()
      expect(rejected?.why).toContain('SCHEMA_REJECTED')
      expect(rejected?.who).toBe('system')
      expect(watcher.policy).toEqual(before)
      expect(applied).toBe(1)
    } finally {
      watcher.stop()
    }
  })

  it('修复文件后可继续热加载，previousHash 指向上一份有效档', async () => {
    const events: RuntimePolicyAuditEvent[] = []
    const watcher = new RuntimePolicyWatcher({ filePath, auditSink: (e) => events.push(e) })
    await watcher.start()
    try {
      await writePolicy({ ...validPolicy(), background_limit: { maxTasks: 999, maxPerSession: 1 } })
      await watcher.refresh()
      const fixed = validPolicy()
      fixed.timeout.commandMs = 9000
      fixed.audit.reason = '修正超时'
      await writePolicy(fixed)
      const applied = await watcher.refresh()
      expect(applied?.kind).toBe('applied')
      expect(applied?.previousHash).toBe(events[0]?.nextHash)
      expect(watcher.policy.timeout.commandMs).toBe(9000)
      expect(events.filter((e) => e.kind === 'rejected')).toHaveLength(1)
    } finally {
      watcher.stop()
    }
  })

  it('半截 JSON（并发写入中间态）不污染生效档', async () => {
    const watcher = new RuntimePolicyWatcher({ filePath })
    await watcher.start()
    try {
      await writeFile(filePath, '{"probe":', 'utf8')
      const event = await watcher.refresh()
      expect(event?.kind).toBe('rejected')
      expect(watcher.policy).toEqual(validPolicy())
      await writePolicy({ ...validPolicy(), probe: { enabled: false, intervalMs: 700 } })
      await watcher.refresh()
      expect(watcher.policy.probe.intervalMs).toBe(700)
    } finally {
      watcher.stop()
    }
  })

  it('轮询模式下策略变更 5 秒内生效', async () => {
    const watcher = new RuntimePolicyWatcher({ filePath, pollIntervalMs: 1000 })
    await watcher.start()
    try {
      const target = { ...validPolicy(), background_limit: { maxTasks: 6, maxPerSession: 3 } }
      const started = Date.now()
      await writePolicy(target)
      while (watcher.policy.background_limit.maxTasks !== 6 && Date.now() - started < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      expect(watcher.policy.background_limit.maxTasks).toBe(6)
      expect(Date.now() - started).toBeLessThan(5000)
    } finally {
      watcher.stop()
    }
  })

  it('注入的超大轮询间隔被截断，保证不超过 4 秒', () => {
    const watcher = new RuntimePolicyWatcher({ filePath, pollIntervalMs: 60_000 })
    watcher.stop()
    expect(watcher.pollIntervalMs).toBe(MAX_POLL_INTERVAL_MS)
  })

  it('审计 sink 与订阅者抛错不影响策略生效', async () => {
    const seen: string[] = []
    const watcher = new RuntimePolicyWatcher({
      filePath,
      auditSink: () => {
        throw new Error('audit db down')
      },
    })
    watcher.subscribe(() => {
      throw new Error('consumer down')
    })
    watcher.subscribe(() => {
      seen.push('ok')
    })
    try {
      const event = await watcher.start()
      expect(event?.kind).toBe('applied')
      expect(seen).toEqual(['ok'])
      expect(watcher.policy).toEqual(validPolicy())
    } finally {
      watcher.stop()
    }
  })

  it('toAuditLogParams 只带审计三元组与摘要，不写策略原文', async () => {
    const watcher = new RuntimePolicyWatcher({ filePath })
    const event = await watcher.start()
    watcher.stop()
    expect(event).not.toBeNull()
    const params = toAuditLogParams(event!)
    expect(params.action).toBe('runtime_policy.applied')
    expect(params.result).toBe('success')
    expect(params.resourceType).toBe('runtime_policy')
    expect(params.metadata).toMatchObject({ who: 'alice', why: '收紧后台并发' })
    expect(JSON.stringify(params)).not.toContain('"probe"')
    expect(JSON.stringify(params)).not.toContain('12000')
  })

  it('loadRuntimePolicy 对缺失文件返回 FILE_UNAVAILABLE', async () => {
    const result = await loadRuntimePolicy(join(dir, 'missing.json'))
    expect(result).toMatchObject({ ok: false, code: 'FILE_UNAVAILABLE' })
  })
})
