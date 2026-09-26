// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// V3 #69:budget 帧落点(模块级外部 store)的判据测试。
// 直接 import 生产模块(§22c:测试内不得复制实现)。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it } from 'vitest'

import {
  budgetBarPercent,
  clearBudgetEvent,
  getBudgetEvent,
  setBudgetEvent,
  subscribeBudgetEvent,
} from '../budget-state'
import type { BudgetEvent } from '@ihui/api-client'

const warning: BudgetEvent = { level: 'warning', percent: 85.3, usedTokens: 85300, limitTokens: 100000 }
const critical: BudgetEvent = { level: 'critical', percent: 98.4 }

describe('budget-state(V3 #69 唯一落点)', () => {
  beforeEach(() => {
    clearBudgetEvent()
  })

  it('初始与清空后快照为 null(未收到帧 ⇒ 进度条不渲染)', () => {
    expect(getBudgetEvent()).toBeNull()
  })

  it('setBudgetEvent 覆盖快照并通知订阅者', () => {
    const seen: Array<BudgetEvent | null> = []
    const unsubscribe = subscribeBudgetEvent(() => seen.push(getBudgetEvent()))
    setBudgetEvent(warning)
    setBudgetEvent(critical)
    expect(getBudgetEvent()).toBe(critical)
    expect(seen).toEqual([warning, critical])
    unsubscribe()
    setBudgetEvent(warning)
    // 退订后不再收到回调,但快照仍更新(最后一次 set 的是 warning)
    expect(seen).toHaveLength(2)
    expect(getBudgetEvent()).toBe(warning)
  })

  it('clearBudgetEvent:有帧才通知,无帧时零通知(不做无谓重渲)', () => {
    expect(getBudgetEvent()).toBeNull()
    let calls = 0
    const unsubscribe = subscribeBudgetEvent(() => calls++)
    clearBudgetEvent()
    expect(calls).toBe(0)
    setBudgetEvent(warning)
    clearBudgetEvent()
    expect(calls).toBe(2) // set + clear 各一次
    expect(getBudgetEvent()).toBeNull()
    unsubscribe()
  })

  describe('budgetBarPercent', () => {
    it('帧带 percent ⇒ 逐值采用(与档位判定同源,不重算)', () => {
      expect(budgetBarPercent(warning)).toBe(85.3)
    })
    it('缺 percent ⇒ 由 used/limit 同式回算(向下取整到 0.1)', () => {
      expect(budgetBarPercent({ level: 'warning', usedTokens: 85300, limitTokens: 100000 })).toBe(85.3)
    })
    it('percent 越界钳到 0..100(竞态下不画超宽条)', () => {
      expect(budgetBarPercent({ level: 'critical', percent: 140 })).toBe(100)
      expect(budgetBarPercent({ level: 'warning', percent: -3 })).toBe(0)
    })
    it('既无 percent 也无可算比值 ⇒ 0(条不假装有任何进度)', () => {
      expect(budgetBarPercent({ level: 'warning' })).toBe(0)
      expect(budgetBarPercent({ level: 'warning', usedTokens: 5, limitTokens: 0 })).toBe(0)
    })
  })
})

// 装车证明:帧→态→条三段各自落在不同文件里,任何一段被摘线都不会让上面的单测变红。
describe('V3 #69 接线存续性(源码级)', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

  it('写点在 streamChat 之前回收上一轮快照(否则切会话挂着旧百分比)', () => {
    const src = read('../send-message.ts')
    const body = src.replace(/^\s*import[^\n]*$/gm, '')
    expect(body).toContain('clearBudgetEvent()')
    expect(body).toContain('setBudgetEvent(')
  })

  it('条组件走 useSyncExternalStore 订阅(只读快照不重算第二份数)', () => {
    expect(read('../../../components/chat/context-budget-bar.tsx')).toContain('useSyncExternalStore(')
  })

  it('进度条真挂在输入框组件上,不是建好无人 import', () => {
    expect(read('../../../components/chat/message-input.tsx')).toContain('<ContextBudgetBar')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
