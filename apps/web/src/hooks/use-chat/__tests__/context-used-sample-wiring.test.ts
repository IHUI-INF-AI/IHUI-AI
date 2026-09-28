// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-404(2026-09-29 立):budget 写点的瞬时 0 投影 + 例外表消费方对账。
// 直接 import 生产模块(§22c:测试内不得复制实现);例外表的生产面对账
// 用源码扫描(照 §4 圆角角色表"新登记必须同笔有消费方"的同一条纪律)。

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import {
  CONTEXT_TRUSTED_ZERO_PHASES,
  type ContextTrustedZeroPhase,
} from '@ihui/shared/utils/context-used-sample'
import type { BudgetEvent } from '@ihui/api-client'
import {
  clearBudgetEvent,
  getBudgetEvent,
  getHeldBudgetFrame,
  noteBudgetTrustedZeroPhase,
  setBudgetEvent,
  subscribeBudgetEvent,
} from '../budget-state'

const trusted: BudgetEvent = { level: 'warning', usedTokens: 60000, limitTokens: 100000 }
const transientZero: BudgetEvent = { level: 'warning', usedTokens: 0, limitTokens: 100000 }
const noUsageFrame: BudgetEvent = { level: 'critical' }

describe('budget-state 写点投影(G-404)', () => {
  beforeEach(() => {
    clearBudgetEvent()
  })

  it('规则①阳性:非例外阶段的瞬时 0 不得覆盖可信采样(整帧丢弃 + 零通知 + held 留痕)', () => {
    setBudgetEvent(trusted)
    let calls = 0
    const unsubscribe = subscribeBudgetEvent(() => calls++)
    setBudgetEvent(transientZero)
    expect(getBudgetEvent()).toBe(trusted) // 条继续挂上一个可信采样
    expect(calls).toBe(0) // held ⇒ 无重渲(不闪 0% 也不闪任何变化)
    expect(getHeldBudgetFrame()).toBe(transientZero) // 诊断口点名"被 held 的那一帧"
    unsubscribe()
  })

  it('规则②例外:/compact 登记后的那一枚 0 必须落 0(不被规则①吞掉),且登记一次性', () => {
    setBudgetEvent(trusted)
    noteBudgetTrustedZeroPhase('compact')
    setBudgetEvent(transientZero)
    expect(getBudgetEvent()).toBe(transientZero) // 真 0 收下
    expect(getHeldBudgetFrame()).toBeNull()
    // 一次性:登记已被上一帧消费,再来的 0 又回到"瞬时噪声"语义
    noteBudgetTrustedZeroPhase('compact')
    setBudgetEvent(trusted) // 非 0 帧同样消费并清空登记
    setBudgetEvent(transientZero)
    expect(getBudgetEvent()).toBe(trusted)
  })

  it('规则③回归对照:usedTokens=undefined 的帧行为与改动前逐字相同(覆盖 + 通知)', () => {
    setBudgetEvent(trusted)
    const seen: Array<BudgetEvent | null> = []
    const unsubscribe = subscribeBudgetEvent(() => seen.push(getBudgetEvent()))
    setBudgetEvent(noUsageFrame)
    expect(getBudgetEvent()).toBe(noUsageFrame) // "未收到"语义原样落点,不被 held
    expect(seen).toEqual([noUsageFrame])
    expect(getHeldBudgetFrame()).toBeNull()
    unsubscribe()
  })

  it('规则④真实序列回放 a:高→0→高 的流,订阅者看到的占用数任何时刻都不得出现 0', () => {
    setBudgetEvent(trusted)
    const observedAfterNotify: Array<number | undefined> = []
    const unsubscribe = subscribeBudgetEvent(() =>
      observedAfterNotify.push(getBudgetEvent()?.usedTokens),
    )
    setBudgetEvent(transientZero) // 被 held ⇒ 不通知
    expect(getBudgetEvent()?.usedTokens).toBe(60000) // 未被订阅的读侧同样看不到 0
    setBudgetEvent({ level: 'warning', usedTokens: 72000, limitTokens: 100000 })
    unsubscribe()
    expect(observedAfterNotify).toEqual([72000]) // 唯一一次通知是"高"—— 0% 闪断不存在
  })

  it('规则④真实序列回放 b:高→0(compact 例外)→后续不再上报 ⇒ 快照必须停在 0', () => {
    setBudgetEvent(trusted)
    noteBudgetTrustedZeroPhase('compact')
    setBudgetEvent(transientZero)
    expect(getBudgetEvent()?.usedTokens).toBe(0)
    // 后续没有任何帧 ⇒ 停在 0(真话必须留下,不得被 held 通道保成旧值)
    expect(getBudgetEvent()?.usedTokens).toBe(0)
  })

  it('clearBudgetEvent 同步清掉一次性登记与 held 留痕(过期例外不得跨轮复活)', () => {
    setBudgetEvent(trusted)
    noteBudgetTrustedZeroPhase('compress')
    clearBudgetEvent()
    setBudgetEvent(trusted)
    setBudgetEvent(transientZero)
    expect(getBudgetEvent()).toBe(trusted) // 登记已被 clear 回收 ⇒ 这枚 0 仍按瞬时噪声处理
    expect(getHeldBudgetFrame()).toBe(transientZero)
  })
})

// ── 例外表消费方对账(照 §4 圆角角色表"新增角色必须同笔有消费方")──────────────────
// 生产面 = apps/web/src(排除 __tests__/ 目录与 *.test.ts/tsx)。判据:
//   · 每个表员都必须有至少一处 `noteBudgetTrustedZeroPhase('<表员>')` 字面量调用点;
//   · 每个字面量调用点都必须落在表内(表外阶段 ⇒ 登记了判据却没人能产生它 = 表与生产分叉)。
// 反向对照由"空扫描必红"承担:扫描命中 0 处时,集合对账必不成立,不得静默通过。
describe('G-404 例外表 × 生产面对账(源码级)', () => {
  const CALL_RE = /noteBudgetTrustedZeroPhase\(\s*['"]([\w-]+)['"]\s*\)/g

  // 派生推迟到用例体内:vitest 4 下 `import.meta.url` 在 describe 收集期不是 file: 形态
  // (实测 collection 期 fileURLToPath 直接抛 "The URL must be of scheme file"),
  // 与 budget-state.test.ts 同一姿势(只在 it 回调里取 URL)。
  const collectProducerCalls = (): Map<string, string[]> => {
    // 本文件在 apps/web/src/hooks/use-chat/__tests__/ ⇒ 上溯三级到 src,再进 apps/web/src
    const webSrc = join(fileURLToPath(import.meta.url), '..', '..', '..', '..') // apps/web/src
    const found = new Map<string, string[]>()
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const abs = join(dir, name)
        const st = statSync(abs)
        if (st.isDirectory()) {
          if (name === '__tests__' || name === 'node_modules' || name === '.next') continue
          walk(abs)
          continue
        }
        if (!/\.(ts|tsx)$/.test(name)) continue
        if (/\.test\.(ts|tsx)$/.test(name)) continue
        // 登记 API 的定义文件本身不算消费方(budget-state 只导出,不自发登记)
        const src = readFileSync(abs, 'utf8')
        for (const m of src.matchAll(CALL_RE)) {
          const phase = m[1] as ContextTrustedZeroPhase
          const list = found.get(phase) ?? []
          list.push(abs.slice(webSrc.length))
          found.set(phase, list)
        }
      }
    }
    walk(webSrc)
    return found
  }

  it('扫描真跑了:至少命中一处生产调用(枚举到 0 ⇒ 判死,不记通过)', () => {
    expect([...collectProducerCalls().values()].flat().length).toBeGreaterThan(0)
  })

  it('每个例外表员都有生产面消费方(新增例外必须同笔接线)', () => {
    const produced = collectProducerCalls()
    for (const phase of CONTEXT_TRUSTED_ZERO_PHASES) {
      expect(produced.get(phase) ?? [], `例外阶段 "${phase}" 在 apps/web 生产面无登记调用点`).not.toHaveLength(0)
    }
  })

  it('生产面登记的每个阶段都在例外表内(表外登记 = 判据与表分叉,直接红)', () => {
    const produced = collectProducerCalls()
    for (const phase of produced.keys()) {
      expect(
        (CONTEXT_TRUSTED_ZERO_PHASES as readonly string[]).includes(phase),
        `生产面登记了表外阶段 "${phase}"(${produced.get(phase)?.join(', ')})`,
      ).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
