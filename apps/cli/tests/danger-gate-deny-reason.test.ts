// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 危险门「拒因」文案必须真取得到词(2026-10-28 立)。
 *
 * 立因是一枚用户可见缺陷:`DENY_REASON_KEY` 曾把五枚拒因写成 `cli.dangerGate.deny*`,
 * 而词包(`packages/i18n/messages/cli/*.json`)里那五枚住在 `cliEntry.dangerGate.*` 下,
 * `cli.dangerGate` 整块不存在 ⇒ `t()` 走「取不到就 return key」那一臂
 * (apps/cli/src/i18n/index.ts:156),五语言下打给用户的"为什么拒 + 怎么放行"全是裸键名。
 * 既有 danger-gate.test.ts 对 `decision.reason` 零断言,所以三路路由全绿也照不出这一格。
 *
 * 两把锁各防一型:行为锁防"代码侧命名空间又漂回去";词包锁防"词包侧把键搬走而代码没跟"。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

import {
  createDangerGate,
  type DangerGateDecision,
} from '../src/tools/danger-gate.js'
import type { Tool } from '../src/tools/index.js'

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
const DENY_KEYS = [
  'cliEntry.dangerGate.denyNoPrompt',
  'cliEntry.dangerGate.denyDeclined',
  'cliEntry.dangerGate.denyEmpty',
  'cliEntry.dangerGate.denyError',
  'cliEntry.dangerGate.denyContract',
]

const tool: Tool = {
  name: 'run_command',
  description: 'deny-reason probe tool',
  parameters: {},
  required: [],
  execute: async () => ({ success: true, output: 'ok' }),
}

const args = { command: 'probe-only-not-executed' }

function recorder(): {
  decisions: DangerGateDecision[]
  onDecision: (d: DangerGateDecision) => void
} {
  const decisions: DangerGateDecision[] = []
  return { decisions, onDecision: (d) => decisions.push(d) }
}

/** 沿点分路径取词;取不到返回 undefined(与生产 t() 的走法同形,不复写判据常量) */
function pick(obj: unknown, key: string): string | undefined {
  let cur: unknown = obj
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

async function denyWith(
  opts: { prompt?: (t: Tool, a: Record<string, unknown>) => Promise<unknown> } = {},
): Promise<DangerGateDecision> {
  const rec = recorder()
  const gate = createDangerGate({
    allowDangerous: false,
    silent: true,
    onDecision: rec.onDecision,
    ...(opts.prompt
      ? { prompt: opts.prompt as unknown as (t: Tool, a: Record<string, unknown>) => Promise<boolean> }
      : {}),
  })
  await gate(tool, args)
  expect(rec.decisions).toHaveLength(1)
  return rec.decisions[0]!
}

describe('拒因:三路拒绝都不得把裸键打给用户', () => {
  it('无人可问(no-prompt)⇒ reason 是一句话,不是键名', async () => {
    const d = await denyWith()
    expect(d.route).toBe('denied')
    expect(d.cause).toBe('no-prompt')
    expect(typeof d.reason).toBe('string')
    expect(d.reason).toBeTruthy()
    expect(d.reason!).not.toContain('cliEntry.')
    expect(d.reason!).not.toContain('cli.dangerGate.')
    expect(d.reason!.length).toBeGreaterThan(8)
  })

  it('人拒绝(prompt-declined)⇒ reason 取到词', async () => {
    const d = await denyWith({ prompt: async () => false })
    expect(d.cause).toBe('prompt-declined')
    expect(d.reason!).toBeTruthy()
    expect(d.reason!).not.toMatch(/^cli(Entry)?\./)
  })

  it('批准通道抛错(prompt-error)⇒ 仍取到词且 fail-closed 不放行', async () => {
    const d = await denyWith({
      prompt: async () => {
        throw new Error('probe prompt failure')
      },
    })
    expect(d.cause).toBe('prompt-error')
    expect(d.reason!).toBeTruthy()
    expect(d.reason!).not.toMatch(/^cli(Entry)?\./)
  })
})

describe('拒因词包:五枚键 × 五语言齐备且非空', () => {
  for (const locale of LOCALES) {
    it(`${locale}:五枚拒因键都在,取到的是非空文案而非键名`, () => {
      const raw = readFileSync(
        new URL(`../../../packages/i18n/messages/cli/${locale}.json`, import.meta.url),
        'utf-8',
      )
      const messages = JSON.parse(raw) as unknown
      for (const key of DENY_KEYS) {
        const text = pick(messages, key)
        expect(text, `${locale} 缺 ${key}`).toBeTypeOf('string')
        expect((text ?? '').trim().length, `${locale} 的 ${key} 是空串`).toBeGreaterThan(4)
      }
    })
  }

  it('反向锁:漂回 cli.dangerGate.* 那一型必须取不到(证明前两把尺有牙)', () => {
    const raw = readFileSync(
      new URL('../../../packages/i18n/messages/cli/zh-CN.json', import.meta.url),
      'utf-8',
    )
    const messages = JSON.parse(raw) as unknown
    expect(pick(messages, 'cli.dangerGate.denyNoPrompt')).toBeUndefined()
  })
})

describe('拒因经生产 t() 解析(与终端实际输出同一条路径)', () => {
  it.each(DENY_KEYS.map((k) => [k]))('%s ⇒ t() 不回落键名', async (key) => {
    const { t } = await import('../src/i18n/index.js')
    const out = t(key as string)
    expect(out).not.toBe(key)
    expect(out.trim().length).toBeGreaterThan(4)
    // ICU 形态不得留语法残迹(缺 params 也要渲染,否则终端里看到的是 {count} 这类原文)
    expect(out).not.toMatch(/\{(count|reason|slots)\}/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
