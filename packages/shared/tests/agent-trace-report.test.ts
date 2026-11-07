// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { buildAgentTraceReport } from '../src/reports/agent-trace-report'
import type { AgentTrace, AgentTraceStep } from '../src/reports/agent-trace-types'
import {
  computeAgentTraceKpi,
  evaluateAgentTraceFindings,
  isMeasuredDuration,
  normalizeAgentTraceStep,
} from '../src/reports/trace-metrics'
import { TRACE_FINDING_DEFAULTS } from '../src/reports/agent-trace-types'
import { AGENT_REPORT_COPY_KEYS } from '../src/reports/report-copy'

const steps = (...s: Array<[string, AgentTraceStep['status'], number | null]>): AgentTraceStep[] =>
  s.map(([toolName, status, durationMs]) => ({ toolName, status, durationMs }))

const trace = (toolCalls: AgentTraceStep[], extra: Partial<AgentTrace> = {}): AgentTrace => ({
  title: 'demo',
  toolCalls,
  exportedAt: '2026-11-05T00:00:00.000Z',
  locale: 'en',
  ...extra,
})

describe('KPI 读数:量不到一律 null,不用 0 冒充"没有"', () => {
  it('① 分桶计数按状态词表逐档落位', () => {
    const k = computeAgentTraceKpi(
      steps(
        ['a', 'success', 10],
        ['b', 'error', null],
        ['c', 'cancelled', 5],
        ['d', 'running', undefined],
      ),
    )
    expect(k.stepCount).toBe(4)
    expect(k.successCount).toBe(1)
    expect(k.errorCount).toBe(1)
    expect(k.cancelledCount).toBe(1)
    expect(k.runningCount).toBe(1)
    expect(k.measuredStepCount).toBe(2)
    expect(k.unmeasuredStepCount).toBe(2)
    expect(k.measuredTotalMs).toBe(15)
  })

  it('② 全缺测时占比与最慢步都是 null(不用 0% 冒充"没有瓶颈")', () => {
    const k = computeAgentTraceKpi(steps(['a', 'success', null]))
    expect(k.slowestMs).toBeNull()
    expect(k.slowestShare).toBeNull()
    expect(k.measuredTotalMs).toBe(0)
  })

  it('③ 脏值不入测:负数/NaN/Infinity 都归缺测档', () => {
    expect(isMeasuredDuration(-1)).toBe(false)
    expect(isMeasuredDuration(Number.NaN)).toBe(false)
    expect(isMeasuredDuration(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isMeasuredDuration(0)).toBe(true)
    const k = computeAgentTraceKpi(
      steps(['a', 'success', -5], ['b', 'success', Number.NaN], ['c', 'success', 7]),
    )
    expect(k.measuredStepCount).toBe(1)
    expect(k.unmeasuredStepCount).toBe(2)
  })

  it('④ 外部 JSON 归一化:状态不认识就返回 null,不猜成 running', () => {
    expect(normalizeAgentTraceStep({ toolName: 'x', status: 'succeed' })).toBeNull()
    expect(normalizeAgentTraceStep({ toolName: '', status: 'success' })).toBeNull()
    expect(normalizeAgentTraceStep('nope')).toBeNull()
    expect(normalizeAgentTraceStep({ toolName: 'x', status: 'success', durationMs: 3 })).toEqual({
      toolName: 'x',
      status: 'success',
      durationMs: 3,
    })
  })
})

describe('findings 判据:阈值可注入,触发与不触发成对', () => {
  it('⑤ 有失败步 ⇒ failuresPresent(high);无失败 ⇒ 不触发(反向对照)', () => {
    const hit = evaluateAgentTraceFindings(computeAgentTraceKpi(steps(['a', 'error', 1])))
    expect(hit.map((f) => f.id)).toContain('failuresPresent')
    const miss = evaluateAgentTraceFindings(computeAgentTraceKpi(steps(['a', 'success', 1])))
    expect(miss.map((f) => f.id)).not.toContain('failuresPresent')
  })

  it('⑥ 单步轨迹不判"最慢步独占"(恒等于 100%,判它是噪声)', () => {
    const ids = evaluateAgentTraceFindings(computeAgentTraceKpi(steps(['a', 'success', 900]))).map(
      (f) => f.id,
    )
    expect(ids).not.toContain('slowestStepDominant')
  })

  it('⑦ 多步且最慢步超阈 ⇒ 触发,并附带数字明细(不靠译文承载事实)', () => {
    const f = evaluateAgentTraceFindings(
      computeAgentTraceKpi(steps(['a', 'success', 90], ['b', 'success', 10])),
    ).find((x) => x.id === 'slowestStepDominant')
    expect(f).toBeDefined()
    expect(f?.params.sharePercent).toBe(90)
    expect(f?.params.toolName).toBe('a')
  })

  it('⑧ 阈值 0 档 = 关判据;注入坏值(非有限数)回落默认,不静默变形', () => {
    expect(
      evaluateAgentTraceFindings(computeAgentTraceKpi(steps(['a', 'error', 1])), {
        failedStepCountToFlag: 0,
      }).map((f) => f.id),
    ).not.toContain('failuresPresent')
    // 缺测档同理:阈值 0 关掉后,全缺测的轨迹也不该再报缺测
    expect(
      evaluateAgentTraceFindings(computeAgentTraceKpi(steps(['a', 'success', null])), {
        unmeasuredStepCountToFlag: 0,
      }).map((f) => f.id),
    ).not.toContain('unmeasuredSteps')
    const resolved = evaluateAgentTraceFindings(
      computeAgentTraceKpi(steps(['a', 'error', 1])),
      // @ts-expect-error 故意传坏值:判据必须不因传错参而变形
      { failedStepCountToFlag: Number.NaN },
    )
    expect(resolved.map((f) => f.id)).toContain('failuresPresent')
  })

  it('⑨ 空轨迹 ⇒ 只出 emptyTrace(没有步就没有"缺测的步",不牵连)', () => {
    const ids = evaluateAgentTraceFindings(computeAgentTraceKpi([]), {
      emptyTraceStepCount: TRACE_FINDING_DEFAULTS.emptyTraceStepCount,
    }).map((f) => f.id)
    expect(ids).toEqual(['emptyTrace'])
  })

  it('⑩ 总耗时超预算线 ⇒ 触发;线以下不触发', () => {
    const over = evaluateAgentTraceFindings(
      computeAgentTraceKpi(steps(['a', 'success', 200_000])),
      {
        measuredTotalMsToFlag: 120_000,
      },
    ).map((f) => f.id)
    expect(over).toContain('measuredTotalOverBudget')
    const under = evaluateAgentTraceFindings(computeAgentTraceKpi(steps(['a', 'success', 100])), {
      measuredTotalMsToFlag: 120_000,
    }).map((f) => f.id)
    expect(under).not.toContain('measuredTotalOverBudget')
  })
})

describe('自包含文档:零外链、转义、深浅色与打印版式(超越对侧的四条轴)', () => {
  it('⑪ 产物内不得出现任何外部 script/link 资源(对侧两份报告同维为 0,我们必须一直是 0)', () => {
    const { html } = buildAgentTraceReport({
      trace: trace(steps(['a', 'success', 12], ['b', 'error', null])),
    })
    expect(html).not.toMatch(/<script[^>]+\bsrc=/i)
    expect(html).not.toMatch(/<link[^>]+\bhref=(?!["']#)/i)
    expect(html).not.toMatch(/https?:\/\/[^"'\s]*\.(js|css)/i)
  })

  it('⑫ 深浅色与打印版式都在位(对侧现读 hasDark=false / hasPrintStyle=false)', () => {
    const { html } = buildAgentTraceReport({ trace: trace(steps(['a', 'success', 1])) })
    expect(html).toContain('prefers-color-scheme')
    expect(html).toContain('@media print')
  })

  it('⑬ 注入阳性对照:工具名里的脚本标签必须被转义成文本', () => {
    const evil = '</main><script>alert(1)</script>'
    const { html } = buildAgentTraceReport({
      trace: trace(steps([evil, 'success', 5]), { title: `<img src=x onerror=alert(2)>` }),
    })
    expect(html).not.toContain('<script>alert(1)')
    expect(html).not.toContain('<img src=x onerror=alert(2)>')
    expect(html).toContain('&lt;script&gt;alert(1)')
  })

  it('⑭ 取词欠账必须点名而不是遮丑:未定义的键以键名回显并进 missingCopyKeys', () => {
    const sparse = (key: string): string | undefined =>
      key === AGENT_REPORT_COPY_KEYS.kpiTitle ? 'X' : undefined
    const r = buildAgentTraceReport({
      trace: trace(steps(['a', 'success', 1])),
      translate: (key: string, params?: Record<string, string | number>) => {
        const v = sparse(key)
        if (v !== undefined) return v
        if (!params) return key
        return key
      },
    })
    expect(r.missingCopyKeys.length).toBeGreaterThan(0)
    expect(r.html).toContain('agentReport.')
  })

  it('⑮ 报告不写死语言:同一份数据在 ko 下取韩语正文,en 下取英语正文', () => {
    const t = trace(steps(['a', 'success', 1]), { locale: 'ko' })
    const ko = buildAgentTraceReport({
      trace: t,
      translate: (key: string) => (key === AGENT_REPORT_COPY_KEYS.kpiTitle ? '주요 수치' : key),
    })
    expect(ko.html).toContain('주요 수치')
    expect(ko.html).toContain('lang="ko"')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
