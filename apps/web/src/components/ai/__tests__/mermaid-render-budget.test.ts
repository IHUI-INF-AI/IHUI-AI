// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * Mermaid 渲染预算单测(纯函数面)。
 *
 * 刻意**不加** `@vitest-environment jsdom`:本文件跑在 node 环境,配下面
 * `withHostileDocument` 那条用例一起,才是"该模块零 DOM 依赖"的运行时证据 ——
 * 光"在 node 下没炸"不够(它可能只是那条分支没被走到)。
 */
import { describe, it, expect } from 'vitest'

import {
  MERMAID_RENDER_BUDGET,
  MERMAID_SKIP_NOTICE_KEYS,
  MERMAID_SKIP_REASONS,
  decideMermaidRender,
  isMermaidContentOverBudget,
  measureMermaidSource,
} from '../mermaid-render-budget'

/** 把 document 换成"任何属性访问即抛"的 Proxy:判据若偷读宿主对象就必炸。 */
function withHostileDocument<T>(fn: () => T): T {
  const key = 'document'
  const real = (globalThis as Record<string, unknown>)[key]
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: new Proxy(
      {},
      {
        get(): never {
          throw new Error('判据读了 DOM:预算必须是纯函数,可见性只能作为入参传入')
        },
      },
    ),
  })
  try {
    return fn()
  } finally {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: real })
  }
}

/** 每行一条「节点声明 + 一条边」:结构 token 数 = 2 × n,行数 = n + 1。 */
function graphWithStatements(n: number): string {
  const lines = ['graph TD']
  for (let i = 0; i < n; i++) lines.push(`  N${i}[n${i}] --> N${i + 1}`)
  return lines.join('\n')
}

/** 短语句行:推行数但不推结构、也尽量不推字符(否则会被字符档抢先命中)。 */
function linesWithoutStructure(n: number): string {
  const lines = ['graph TD']
  for (let i = 0; i < n; i++) lines.push(`  cl${i} solid`)
  return lines.join('\n')
}

describe('measureMermaidSource — 三档量纲', () => {
  it('成文图:节点声明与边都计入结构复杂度', () => {
    const m = measureMermaidSource('graph TD\n  A[Start] --> B{Decision}\n  B -->|yes| C\n')
    // A[..] 与 B{..} = 2 个节点声明;两条 `-->` = 2 条边
    expect(m.structuralComplexity).toBe(4)
    expect(m.lineCount).toBe(3)
    expect(m.sourceChars).toBeGreaterThan(0)
  })

  it('%% 注释行与空行三档全不计(否则"注释多、图很小"会被误降级)', () => {
    const body = 'graph TD\n  A[x] --> B[y]'
    const withComments = [
      `%% ${'注释'.repeat(400)}`,
      '',
      ...body.split('\n'),
      '   ',
      '%% 尾部注释',
    ].join('\n')
    expect(measureMermaidSource(withComments)).toEqual(measureMermaidSource(body))
  })

  it('同一入参重复调用结果逐字相同(全局正则的 lastIndex 不得跨调用带状态)', () => {
    const src = graphWithStatements(20)
    expect(measureMermaidSource(src)).toEqual(measureMermaidSource(src))
    expect(measureMermaidSource(src)).toEqual(measureMermaidSource(src))
  })

  it('病态输入上测量本身必须有界(这把尺子要比它拦下的渲染快几个数量级)', () => {
    // 200 KB 单行、括号永不闭合:标识符长度不封顶时这里退化成 O(n²)。
    // 断言的是"耗时上界"而不只是"不抛"——把判据写回 O(n²) 必须让本用例变红。
    const pathological = `graph TD\n  A[${'x'.repeat(200_000)}\n  B[a] --> C[b]`
    const startedAt = Date.now()
    const m = measureMermaidSource(pathological)
    const elapsedMs = Date.now() - startedAt
    expect(elapsedMs).toBeLessThan(1_000)
    // 同一段仍被正确判退(字符档),且没有把结构档算成 NaN/负数
    expect(m.structuralComplexity).toBeGreaterThan(0)
    expect(Number.isFinite(m.sourceChars)).toBe(true)
    expect(decideMermaidRender({ ...m, pageVisible: true })).toEqual({
      outcome: 'skip',
      reason: 'source-too-large',
    })
  })
})

describe('decideMermaidRender — 结论联合与判序', () => {
  it('仓内真实成文图远在预算内:判 render', () => {
    // 实测:本仓最大的成文图 785 字符 / 31 行 / 23 结构 token
    expect(
      decideMermaidRender({ ...measureMermaidSource(graphWithStatements(20)), pageVisible: true }),
    ).toEqual({ outcome: 'render' })
  })

  it('字符超预算 ⇒ source-too-large', () => {
    const src = `graph TD\n  A[${'y'.repeat(MERMAID_RENDER_BUDGET.maxSourceChars + 50)}]\n  A --> B`
    const m = measureMermaidSource(src)
    expect(m.structuralComplexity).toBeLessThan(MERMAID_RENDER_BUDGET.maxStructuralComplexity)
    expect(decideMermaidRender({ ...m, pageVisible: true })).toEqual({
      outcome: 'skip',
      reason: 'source-too-large',
    })
  })

  it('行数超预算而字符/结构均未超 ⇒ line-count-too-large(三档各自可独立命中)', () => {
    const m = measureMermaidSource(linesWithoutStructure(MERMAID_RENDER_BUDGET.maxLines + 1))
    // 先自证夹具确实只超行这一档 —— 否则本用例测的不是它以为在测的那条分支
    expect(m.lineCount).toBeGreaterThan(MERMAID_RENDER_BUDGET.maxLines)
    expect(m.sourceChars).toBeLessThan(MERMAID_RENDER_BUDGET.maxSourceChars)
    expect(m.structuralComplexity).toBeLessThan(MERMAID_RENDER_BUDGET.maxStructuralComplexity)
    expect(decideMermaidRender({ ...m, pageVisible: true })).toEqual({
      outcome: 'skip',
      reason: 'line-count-too-large',
    })
  })

  it('结构超预算 ⇒ structural-complexity-too-large', () => {
    const m = measureMermaidSource(
      graphWithStatements(MERMAID_RENDER_BUDGET.maxStructuralComplexity / 2 + 5),
    )
    expect(m.structuralComplexity).toBeGreaterThan(MERMAID_RENDER_BUDGET.maxStructuralComplexity)
    expect(m.sourceChars).toBeLessThan(MERMAID_RENDER_BUDGET.maxSourceChars)
    expect(m.lineCount).toBeLessThan(MERMAID_RENDER_BUDGET.maxLines)
    expect(decideMermaidRender({ ...m, pageVisible: true })).toEqual({
      outcome: 'skip',
      reason: 'structural-complexity-too-large',
    })
  })

  it('页面不可见 ⇒ page-hidden 且优先于内容档(后台不该做无观众的工作)', () => {
    const overChars = { sourceChars: 999_999, lineCount: 2, structuralComplexity: 2 }
    expect(decideMermaidRender({ ...overChars, pageVisible: false })).toEqual({
      outcome: 'skip',
      reason: 'page-hidden',
    })
    // 反向对照:同一份内容,可见时报的是内容档,不是 page-hidden
    expect(decideMermaidRender({ ...overChars, pageVisible: true })).toEqual({
      outcome: 'skip',
      reason: 'source-too-large',
    })
  })

  it('三维同时超限只报判序上的第一档(结论确定,单测才钉得住)', () => {
    const m = measureMermaidSource(graphWithStatements(MERMAID_RENDER_BUDGET.maxStructuralComplexity * 3))
    expect(m.sourceChars).toBeGreaterThan(MERMAID_RENDER_BUDGET.maxSourceChars)
    expect(m.lineCount).toBeGreaterThan(MERMAID_RENDER_BUDGET.maxLines)
    expect(m.structuralComplexity).toBeGreaterThan(MERMAID_RENDER_BUDGET.maxStructuralComplexity)
    expect(decideMermaidRender({ ...m, pageVisible: true })).toEqual({
      outcome: 'skip',
      reason: 'source-too-large',
    })
  })

  it('边界取 `>` 而非 `>=`:恰好等于上限仍渲染', () => {
    const at = {
      sourceChars: MERMAID_RENDER_BUDGET.maxSourceChars,
      lineCount: MERMAID_RENDER_BUDGET.maxLines,
      structuralComplexity: MERMAID_RENDER_BUDGET.maxStructuralComplexity,
      pageVisible: true,
    }
    expect(decideMermaidRender(at)).toEqual({ outcome: 'render' })
    expect(
      decideMermaidRender({ ...at, structuralComplexity: at.structuralComplexity + 1 }),
    ).toEqual({ outcome: 'skip', reason: 'structural-complexity-too-large' })
  })

  it('空源码判 render(不误伤"围栏刚打开还没吐字"的流式中间态)', () => {
    expect(decideMermaidRender({ ...measureMermaidSource(''), pageVisible: true })).toEqual({
      outcome: 'render',
    })
  })
})

describe('结论闭合性与提示词键', () => {
  it('每个内容档 reason 都有非空提示键(漏一档 = 用户看到 undefined)', () => {
    const contentReasons = MERMAID_SKIP_REASONS.filter((r) => r !== 'page-hidden')
    expect(contentReasons.length).toBe(3)
    for (const reason of contentReasons) {
      expect(typeof MERMAID_SKIP_NOTICE_KEYS[reason]).toBe('string')
      expect(MERMAID_SKIP_NOTICE_KEYS[reason].length).toBeGreaterThan(0)
    }
  })

  it('page-hidden 刻意**不配**提示键:它是调度延迟,写成"已降级"是对用户撒谎', () => {
    expect(MERMAID_SKIP_NOTICE_KEYS).not.toHaveProperty('mermaidSkipPageHidden')
    expect(Object.keys(MERMAID_SKIP_NOTICE_KEYS)).toHaveLength(MERMAID_SKIP_REASONS.length - 1)
  })

  it('isMermaidContentOverBudget 只对内容档为真(后台页不该被降级成源码)', () => {
    expect(isMermaidContentOverBudget('page-hidden')).toBe(false)
    for (const reason of MERMAID_SKIP_REASONS) {
      if (reason === 'page-hidden') continue
      expect(isMermaidContentOverBudget(reason)).toBe(true)
    }
  })
})

describe('纯函数纪律', () => {
  it('判据在"碰 DOM 即抛"的环境里照常工作 —— 可见性只能从入参进来', () => {
    withHostileDocument(() => {
      const m = measureMermaidSource('graph TD\n  A[x] --> B[y]')
      expect(decideMermaidRender({ ...m, pageVisible: true })).toEqual({ outcome: 'render' })
      expect(decideMermaidRender({ ...m, pageVisible: false })).toEqual({
        outcome: 'skip',
        reason: 'page-hidden',
      })
    })
  })

  it('同一输入恒得同一结论(无隐藏状态、无时钟、无随机)', () => {
    const input = {
      ...measureMermaidSource(graphWithStatements(500)),
      pageVisible: true as const,
    }
    const first = decideMermaidRender(input)
    for (let i = 0; i < 5; i++) expect(decideMermaidRender(input)).toEqual(first)
  })
})
