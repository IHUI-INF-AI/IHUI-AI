// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回灌腿「写票即时复活」接线锁 + 纯函数级判据测试(2026-11-15 立)。
 *
 * 根因:各平台会话回灌腿按设计只写凭证列、绝不碰健康字段 ⇒ 本机重登产生的新票进了池,
 * 行仍 down + temp_unschedulable=true + 失败计数 ≥3 + lastErrorMessage 带判死码文本,
 * 调度器四档候选看不见它,新票等于白写。本文件钉住五条腿(tr/qoder/client/workbuddy
 * 四腿新装车 + minimax 收归单源由 relay-minimax-session-sync.test.ts 覆盖)在**真的写入
 * 本机新票那一次**把异常行复位到 unknown,判据只认单源
 * `src/services/relay-credential-revival.ts` 的 `healthRevivalPatchOf`。
 *
 * 纯函数级(不连库、不 spawn):直接测每条腿导出的 `buildRevivalSetPatch(row,
 * clientExpiresAt)` —— 它必须真的被 `.set({...})` 展开(见「接线锁」段),不许造没装车的判据。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// 兜底 env:静态 import 链会走 config/crypto 的校验。vi.hoisted 在 import 之前执行。
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:5399/ihui_test'
  process.env.JWT_SECRET ??= 'relay-health-revival-test-jwt-secret-0123456789abcdef'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'relay-health-revival-test-cred-key-0123456789abcd'
  // 纯函数级测试要「零 DB 交互」:src/db/index.ts 见到 DATABASE_APP_URL 会在 import 期
  // 起一个独立池并跑一次 SELECT 1 启动探测。本文件只测 buildRevivalSetPatch 纯函数,
  // 不需要任何连接;置空串(config 的 optional transform 把 '' 归为 undefined)后
  // scopedClient=null,探测不触发,dotenv 也不会覆盖已存在的键。不连库、不写库。
  process.env.DATABASE_APP_URL = ''
})

import {
  healthRevivalPatchOf,
  stripTerminalVerdict,
  TERMINAL_VERDICT_KEY,
} from '../src/services/relay-credential-revival.js'
import { buildRevivalSetPatch as traePatch } from '../scripts/relay-trae-session-sync.js'
import { buildRevivalSetPatch as qoderPatch } from '../scripts/relay-qoder-session-sync.js'
import { buildRevivalSetPatch as clientPatch } from '../scripts/relay-client-session-sync.js'
import { buildRevivalSetPatch as workbuddyPatch } from '../scripts/relay-workbuddy-session-sync.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '../scripts')

const LEGS = [
  { name: 'trae', file: 'relay-trae-session-sync.ts', patch: traePatch },
  { name: 'qoder', file: 'relay-qoder-session-sync.ts', patch: qoderPatch },
  { name: 'client', file: 'relay-client-session-sync.ts', patch: clientPatch },
  { name: 'workbuddy', file: 'relay-workbuddy-session-sync.ts', patch: workbuddyPatch },
] as const

// 相对「此刻」构造,不受系统时钟/时区影响:单源用 new Date() 判过期。
const FUTURE = new Date(Date.now() + 10 * 24 * 3600 * 1000)
const PAST = new Date(Date.now() - 10 * 24 * 3600 * 1000)

/** 判死行面:非 healthy + 被摘除 + 失败计数≥3(根因取证那一形)。多带 uid/credVersion 供「合法改动」用。 */
function abnormalRow(over: Record<string, unknown> = {}) {
  return {
    uid: 'auto:aaaa',
    credVersion: 7,
    healthStatus: 'down',
    refreshFailureCount: 3,
    tempUnschedulable: true,
    ...over,
  }
}
const HEALTHY_CLEAN = {
  healthStatus: 'healthy',
  refreshFailureCount: 0,
  tempUnschedulable: false,
}

const REVIVAL_KEYS = ['healthStatus', 'refreshFailureCount', 'lastErrorMessage', 'tempUnschedulable'] as const

/** 把 drizzle SQL 表达式的 queryChunks 拼回可断言的文本(不需要 dialect)。 */
function flattenSql(v: unknown): string {
  if (v == null) return ''
  const node = v as { queryChunks?: unknown[]; value?: unknown }
  if (Array.isArray(node.queryChunks)) return node.queryChunks.map(flattenSql).join('')
  if (Array.isArray(node.value)) return node.value.join('')
  return ''
}

describe('同形正例 · 异常行 + 有效新票 ⇒ 复位到 unknown 并清零失败面', () => {
  for (const leg of LEGS) {
    it(`${leg.name}: .set() 形状里带 healthStatus:'unknown' / 失败面清零 / 解摘`, () => {
      const p = leg.patch(abnormalRow(), FUTURE)
      expect(p.healthStatus).toBe('unknown')
      expect(p.refreshFailureCount).toBe(0)
      expect(p.lastErrorMessage).toBeNull()
      expect(p.tempUnschedulable).toBe(false)
    })
  }

  it('四条腿的复活补丁恒等于单源 healthRevivalPatchOf(不许各写一份判据)', () => {
    for (const leg of LEGS) {
      const row = abnormalRow()
      const expected = healthRevivalPatchOf(row, { clientExpiresAt: FUTURE })
      const p = leg.patch(row, FUTURE)
      expect(expected).not.toBeNull()
      expect(p.healthStatus).toBe(expected?.healthStatus)
      expect(p.refreshFailureCount).toBe(expected?.refreshFailureCount)
      expect(p.lastErrorMessage).toBe(expected?.lastErrorMessage)
      expect(p.tempUnschedulable).toBe(expected?.tempUnschedulable)
    }
  })
})

describe('反向牙 ① · 健康行不带复活补丁(不回退健康态,也不替 admin 解摘)', () => {
  for (const leg of LEGS) {
    it(`${leg.name}: healthy 且失败面干净 ⇒ 补丁里没有任何健康字段`, () => {
      const p = leg.patch({ ...HEALTHY_CLEAN, uid: 'u', credVersion: 3 }, FUTURE)
      for (const k of REVIVAL_KEYS) expect(p).not.toHaveProperty(k)
    })
  }
})

describe('反向牙 ② · 客户端票过期时不带复活补丁(死票不复活,不拿它空撞上游)', () => {
  for (const leg of LEGS) {
    it(`${leg.name}: clientExpiresAt 已过期 ⇒ 补丁里没有任何健康字段`, () => {
      const p = leg.patch(abnormalRow(), PAST)
      for (const k of REVIVAL_KEYS) expect(p).not.toHaveProperty(k)
      // 单源对过期票返回 null,本腿不得绕过
      expect(healthRevivalPatchOf(abnormalRow(), { clientExpiresAt: PAST })).toBeNull()
    })
  }
})

describe('清判死留痕 · extraMetadata 绝不整对象覆盖成 {}', () => {
  for (const leg of LEGS) {
    it(`${leg.name}: 原本不写 extra_metadata ⇒ 用 jsonb 原子删键 SQL(coalesce - 'terminalVerdict')`, () => {
      const p = leg.patch(abnormalRow(), FUTURE)
      const meta = p.extraMetadata as unknown
      expect(meta).toBeTruthy()
      expect(meta).not.toEqual({}) // 关键:不是整对象覆盖
      expect(typeof (meta as { toQuery?: unknown }).toQuery).toBe('function') // 是 drizzle SQL 表达式
      const text = flattenSql(meta)
      expect(text).toContain('coalesce')
      expect(text).toContain("'{}'::jsonb")
      expect(text).toContain(TERMINAL_VERDICT_KEY)
      expect(text).toContain('-') // jsonb - text 删键运算符
    })
  }

  const withVerdict = {
    keepAliveForever: true,
    sessionTemplate: { a: 1 },
    cosy: { machine_code: 'mc' },
    [TERMINAL_VERDICT_KEY]: { id: 'v1', credVersion: 3, at: '2026-11-01T00:00:00.000Z' },
  }

  it('qoder 整对象合并路径(有 cosy 档):保留 keepAliveForever / sessionTemplate / cosy,只摘留痕键', () => {
    const meta = qoderPatch(abnormalRow(), FUTURE, withVerdict).extraMetadata as Record<
      string,
      unknown
    >
    expect(meta).not.toEqual({})
    expect(meta).toHaveProperty('keepAliveForever', true)
    expect(meta).toHaveProperty('sessionTemplate', { a: 1 })
    expect(meta).toHaveProperty('cosy', { machine_code: 'mc' })
    expect(meta[TERMINAL_VERDICT_KEY]).toBeUndefined()
  })

  it('qoder 整对象合并路径与单源 stripTerminalVerdict 同形', () => {
    expect(qoderPatch(abnormalRow(), FUTURE, withVerdict).extraMetadata).toEqual(
      stripTerminalVerdict(withVerdict),
    )
  })

  it('override 只含留痕键(摘完会变 {}) ⇒ 退回原子删键 SQL,绝不写 {}', () => {
    const p = qoderPatch(abnormalRow(), FUTURE, { [TERMINAL_VERDICT_KEY]: { id: 'v1' } })
    expect(p.extraMetadata).not.toEqual({})
    expect(typeof (p.extraMetadata as { toQuery?: unknown }).toQuery).toBe('function')
  })
})

describe('合法改动仍绿 · uid / 版本号 / 失败计数换成别的值,结论不变', () => {
  it('同形正例:换 uid/credVersion 仍带完整复位补丁', () => {
    for (const leg of LEGS) {
      const a = leg.patch(abnormalRow({ uid: 'auto:aaaa', credVersion: 1 }), FUTURE)
      const b = leg.patch(abnormalRow({ uid: 'auto:zzzz', credVersion: 999 }), FUTURE)
      expect(b.healthStatus).toBe('unknown')
      expect(b.refreshFailureCount).toBe(0)
      expect(b.lastErrorMessage).toBeNull()
      expect(b.tempUnschedulable).toBe(false)
      expect(b.healthStatus).toBe(a.healthStatus)
      expect(flattenSql(b.extraMetadata)).toBe(flattenSql(a.extraMetadata))
    }
  })

  it('反向牙仍成立:换 uid/credVersion 后健康行仍不带复活补丁', () => {
    for (const leg of LEGS) {
      const p = leg.patch({ ...HEALTHY_CLEAN, uid: 'auto:zzzz', credVersion: 999 }, FUTURE)
      for (const k of REVIVAL_KEYS) expect(p).not.toHaveProperty(k)
    }
  })

  it('失败计数换值(3 → 9)仍是异常行,结论不变', () => {
    for (const leg of LEGS) {
      expect(leg.patch(abnormalRow({ refreshFailureCount: 9 }), FUTURE).healthStatus).toBe('unknown')
    }
  })
})

/** 提取源码里所有 `.set({ ... })` 块(大括号配平),用于「判据真被装车」的接线锁。 */
function setBlocks(src: string): string[] {
  const out: string[] = []
  const re = /\.set\(\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    let depth = 1
    let j = m.index + m[0].length
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') depth--
      j++
    }
    out.push(src.slice(m.index, j))
  }
  return out
}

describe('接线锁 · buildRevivalSetPatch 真被 .set() 使用(不许造没装车的判据)', () => {
  for (const leg of LEGS) {
    it(`${leg.name}: 有且仅有一个 .set({...}) 块展开 ...buildRevivalSetPatch(`, () => {
      const src = readFileSync(resolve(SCRIPTS_DIR, leg.file), 'utf8')
      expect(src).toContain('export function buildRevivalSetPatch')
      const wired = setBlocks(src).filter((b) => b.includes('...buildRevivalSetPatch('))
      expect(wired.length).toBe(1)
      // 三条写 token 的腿:装车块必须同时是 credVersion 前进那一块(不是 skip 分支)
      if (leg.name !== 'workbuddy') {
        expect(wired[0]).toContain('credVersion: sql`')
      } else {
        expect(wired[0]).toContain('secretsEnc:')
        // 只禁「写 credVersion 列」(注释里如实说明不带版本前进是允许的)
        expect(wired[0]).not.toMatch(/credVersion\s*:/)
      }
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
