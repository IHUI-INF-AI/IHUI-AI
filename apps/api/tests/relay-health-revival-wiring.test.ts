// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top */

/**
 * relay 凭证复活「单一判据 + 接线」测试。
 *
 * 口径(2026-11-19 按当次实测重写:原版 import 的四腿 `buildRevivalSetPatch` 从未入库):
 * 1. 判据唯一实现 = `apps/api/src/services/relay-credential-revival.ts` 的 `healthRevivalPatchOf`
 *    (异常行 ⇒ 复位到 unknown 并清零失败面;健康行 / 客户端票过期 ⇒ null)。
 * 2. 四条回灌腿(`apps/api/scripts/relay-*-session-sync.ts`)的 `.set({...})` 块**不得**各自
 *    写 healthStatus / refreshFailureCount / tempUnschedulable / lastErrorMessage —— 它们的头注
 *    明写「绝不碰健康面」,复活由单源在巡检/解摘腿上做。
 * 3. `extra_metadata` 摘留痕键只走 `stripTerminalVerdict` / jsonb 原子删键,绝不整对象覆盖成 `{}`。
 */
import fs from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  healthRevivalPatchOf,
  stripTerminalVerdict,
  TERMINAL_VERDICT_KEY,
} from '../src/services/relay-credential-revival.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '../scripts')

const FUTURE = new Date(Date.now() + 10 * 24 * 3600 * 1000)
const PAST = new Date(Date.now() - 10 * 24 * 3600 * 1000)

const REVIVAL_KEYS = [
  'healthStatus',
  'refreshFailureCount',
  'lastErrorMessage',
  'tempUnschedulable',
] as const

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

/** 提取源码里所有 `.set({ ... })` 块(大括号配平)。 */
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

const LEGS = [
  'relay-trae-session-sync.ts',
  'relay-qoder-session-sync.ts',
  'relay-client-session-sync.ts',
  'relay-workbuddy-session-sync.ts',
] as const

describe('单源 healthRevivalPatchOf · 正例', () => {
  it('异常行 + 有效新票 ⇒ 复位到 unknown 并清零失败面', () => {
    const p = healthRevivalPatchOf(abnormalRow(), { clientExpiresAt: FUTURE })
    expect(p).not.toBeNull()
    expect(p?.healthStatus).toBe('unknown')
    expect(p?.refreshFailureCount).toBe(0)
    expect(p?.lastErrorMessage).toBeNull()
    expect(p?.tempUnschedulable).toBe(false)
  })

  it('失败计数换值(3 → 9)仍是异常行,结论不变', () => {
    const p = healthRevivalPatchOf(abnormalRow({ refreshFailureCount: 9 }), {
      clientExpiresAt: FUTURE,
    })
    expect(p?.healthStatus).toBe('unknown')
  })
})

describe('单源 healthRevivalPatchOf · 反向牙', () => {
  it('健康行且失败面干净 ⇒ null(不产生无意义写)', () => {
    expect(
      healthRevivalPatchOf(
        { ...HEALTHY_CLEAN, uid: 'u', credVersion: 3 },
        { clientExpiresAt: FUTURE },
      ),
    ).toBeNull()
  })

  it('客户端票已过期 ⇒ null(死票不复活)', () => {
    expect(healthRevivalPatchOf(abnormalRow(), { clientExpiresAt: PAST })).toBeNull()
  })
})

describe('单源唯一实现(§0.6 禁第二份判据)', () => {
  it('单源模块里只有一处 healthRevivalPatchOf 定义', () => {
    const src = fs.readFileSync(
      resolve(HERE, '../src/services/relay-credential-revival.ts'),
      'utf8',
    )
    expect(src).toContain('export function healthRevivalPatchOf')
    const defs = src.match(/function healthRevivalPatchOf/g) ?? []
    expect(defs.length).toBe(1)
  })
})

describe('接线锁 · 四腿不各自实现健康面判据', () => {
  for (const file of LEGS) {
    it(`${file}: .set 块里不写健康面字段`, () => {
      const src = fs.readFileSync(resolve(SCRIPTS_DIR, file), 'utf8')
      for (const block of setBlocks(src)) {
        for (const k of REVIVAL_KEYS) expect(block).not.toContain(k)
      }
    })

    it(`${file}: 不自己定义复活补丁`, () => {
      const src = fs.readFileSync(resolve(SCRIPTS_DIR, file), 'utf8')
      expect(src).not.toContain('function buildRevivalSetPatch')
      expect(src).not.toContain('function healthRevivalPatchOf')
    })
  }
})

describe('摘留痕键 · 绝不整对象覆盖成 {}', () => {
  it('stripTerminalVerdict 只摘留痕键,保留其它键', () => {
    const withVerdict = {
      keepAliveForever: true,
      sessionTemplate: { a: 1 },
      cosy: { machine_code: 'mc' },
      [TERMINAL_VERDICT_KEY]: { id: 'v1', credVersion: 3, at: '2026-11-01T00:00:00.000Z' },
    }
    const out = stripTerminalVerdict(withVerdict)
    expect(out).toHaveProperty('keepAliveForever', true)
    expect(out).toHaveProperty('sessionTemplate', { a: 1 })
    expect(out).toHaveProperty('cosy', { machine_code: 'mc' })
    expect(out[TERMINAL_VERDICT_KEY]).toBeUndefined()
  })

  it('入参形状取不到 ⇒ 返回空对象而不是抛', () => {
    expect(stripTerminalVerdict(null)).toEqual({})
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
