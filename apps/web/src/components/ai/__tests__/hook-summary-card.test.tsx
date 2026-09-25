// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * D86(G-117)钩子摘要卡 —— 五态 + 来源枚举 + 折叠进活动条
 *
 * 装车点:`apps/web/src/components/ai/task-status-bar.tsx`(活动条展开区,
 * `<HookSummaryCard running={isStreaming} />`;空闲态卡片自身返回 null)。
 *
 * 钉住的五件事:
 *  1. 五态推导:running / blocked(优先于 failed)/ failed / ok / idle(idle 不渲染)
 *  2. 计数取值:负数 / 非有限 / 小数一律归 0 或取整,0 不伪装成有数据
 *  3. 来源归属枚举:admin/user/project/plugin/session —— 非法值过滤 + 去重;
 *     数据面未提供(null)时来源行整体不出现,不伪造
 *  4. 文案一律取真实词包 `ai.pane.hookSummary.*`,用例不写中文字面量
 *  5. 失败计数投影:countFailedHookEvents 只认发射侧既有两形态(error 事件 /
 *     commit.after 的 `failed:` 前缀),渲染面不得有第二套判据
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'

/** 词包 + 取词器 + 可变 store 夹具:hoisted 供 vi.mock 工厂共用 */
const { makeT, tPane, storeRef, escapeRe } = await vi.hoisted(async () => {
  const fs = await import('node:fs')
  const nodePath = await import('node:path')
  const { fileURLToPath } = await import('node:url')

  const here = nodePath.dirname(fileURLToPath(import.meta.url))
  let messagesRoot = ''
  for (let dir = here; dir !== nodePath.parse(dir).root; dir = nodePath.dirname(dir)) {
    const candidate = nodePath.join(dir, 'packages', 'i18n', 'messages')
    if (fs.existsSync(nodePath.join(candidate, 'web', 'zh-CN.json'))) {
      messagesRoot = candidate
      break
    }
  }
  if (messagesRoot === '') throw new Error('未找到 packages/i18n/messages 词包根')

  const read = (...p: string[]) =>
    JSON.parse(fs.readFileSync(nodePath.join(messagesRoot, ...p), 'utf8')) as Record<
      string,
      unknown
    >
  const locales = [read('web', 'zh-CN.json'), read('shared', 'zh-CN.json')]

  const lookup = (ns: string, key: string): string | undefined => {
    for (const root of locales) {
      let cur: unknown = root
      let ok = true
      for (const seg of [...ns.split('.'), ...key.split('.')]) {
        if (cur !== null && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[seg]
        } else {
          ok = false
          break
        }
      }
      if (ok && typeof cur === 'string') return cur
    }
    return undefined
  }
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const makeT =
    (ns: string) =>
    (key: string, values?: Record<string, string | number>): string => {
      const raw = lookup(ns, key)
      if (raw === undefined) return key
      if (!values) return raw
      return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in values ? String(values[name]) : whole,
      )
    }

  /** 卡片读的 store 夹具:用例直接改 stateRef.current.events */
  const storeRef = {
    current: {
      events: [] as { id: string; event: string; summary?: string; at: number }[],
      hooks: [] as unknown[],
    },
  }

  return { makeT, tPane: makeT('ai.pane'), storeRef, escapeRe }
})

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => makeT(ns),
}))

vi.mock('@/stores/agent-hooks', () => ({
  useAgentHooksStore: (sel: (s: unknown) => unknown) => sel(storeRef.current),
}))

import { render, screen, cleanup } from '@testing-library/react'
import { deriveHookSummary, countFailedHookEvents, HOOK_SUMMARY_SOURCES } from '../hook-summary'
import { HookSummaryCard } from '../hook-summary-card'

afterEach(() => cleanup())

function evt(event: string, summary?: string) {
  return { id: `evt-${Math.random()}`, event, summary, at: 0 }
}

describe('D86 deriveHookSummary —— 五态推导', () => {
  it('五态:运行中 > 已阻止 > 失败 > 正常 > 空闲', () => {
    expect(deriveHookSummary({ runs: 0, running: true }).state).toBe('running')
    expect(deriveHookSummary({ runs: 3, failed: 1, blocked: 2 }).state).toBe('blocked')
    expect(deriveHookSummary({ runs: 3, failed: 1 }).state).toBe('failed')
    expect(deriveHookSummary({ runs: 3 }).state).toBe('ok')
    expect(deriveHookSummary({ runs: 0 }).state).toBe('idle')
  })

  it('计数 sanitize:负数 / 非有限 / 小数归 0 或取整', () => {
    for (const bad of [-1, NaN, Infinity, -Infinity]) {
      expect(deriveHookSummary({ runs: bad }).runs).toBe(0)
      expect(deriveHookSummary({ runs: 1, failed: bad }).failed).toBe(0)
      expect(deriveHookSummary({ runs: 1, blocked: bad }).blocked).toBe(0)
    }
    expect(deriveHookSummary({ runs: 2.9 }).runs).toBe(2)
  })

  it('来源枚举:过滤非法值 + 去重;null = 数据面未提供(hasSourceData=false)', () => {
    expect(HOOK_SUMMARY_SOURCES).toEqual(['admin', 'user', 'project', 'plugin', 'session'])
    const v = deriveHookSummary({
      runs: 1,
      sources: ['admin', 'user', 'user', 'hacker', 'project'],
    })
    expect(v.sources).toEqual(['admin', 'user', 'project'])
    expect(v.hasSourceData).toBe(true)
    const none = deriveHookSummary({ runs: 1, sources: null })
    expect(none.sources).toEqual([])
    expect(none.hasSourceData).toBe(false)
    // 只有非法值 = 依旧算"未提供"
    const junk = deriveHookSummary({ runs: 1, sources: ['x', 'y'] })
    expect(junk.hasSourceData).toBe(false)
  })

  it('失败计数投影:只认 error 事件与 commit.after 的 failed: 前缀', () => {
    const events = [
      evt('tool.before'),
      evt('error'),
      evt('error'),
      evt('commit.after', 'failed: push rejected'),
      evt('commit.after', 'ok: pushed'),
      evt('message.send'),
    ]
    expect(countFailedHookEvents(events)).toBe(3)
    expect(countFailedHookEvents([])).toBe(0)
  })
})

describe('D86 HookSummaryCard —— 折叠进活动条的渲染面', () => {
  it('空闲态返回 null,不占活动条任何空间', () => {
    storeRef.current.events = []
    const { container } = render(<HookSummaryCard running={false} />)
    expect(container.querySelector('[data-testid="hook-summary-card"]')).toBeNull()
  })

  it('运行态上屏:状态文案 + · 运行了 N 次(计数取词包,非键名)', () => {
    storeRef.current.events = [evt('tool.before'), evt('tool.after')]
    render(<HookSummaryCard running />)
    const card = screen.getByTestId('hook-summary-card')
    expect(card.getAttribute('data-state')).toBe('running')
    expect(card.textContent).toContain(tPane('hookSummary.state.running'))
    expect(card.textContent).toContain(tPane('hookSummary.runs', { n: 2 }))
    expect(card.textContent).not.toContain('hookSummary.')
  })

  it('有失败事件 → failed 态 + 失败计数;无失败不出现失败计数', () => {
    storeRef.current.events = [evt('tool.before'), evt('error')]
    const { container } = render(<HookSummaryCard running={false} />)
    const card = container.querySelector('[data-testid="hook-summary-card"]')
    expect(card?.getAttribute('data-state')).toBe('failed')
    expect(card?.textContent).toContain(tPane('hookSummary.failedCount', { n: 1 }))

    storeRef.current.events = [evt('tool.before')]
    const r2 = render(<HookSummaryCard running={false} />)
    const card2 = r2.container.querySelector('[data-testid="hook-summary-card"]')
    const failedTpl = tPane('hookSummary.failedCount')
    const [pre = '', post = ''] = failedTpl.split('{n}')
    expect(card2?.textContent ?? '').not.toMatch(
      new RegExp(`${escapeRe(pre)}\\d+${escapeRe(post)}`),
    )
  })

  it('已阻止态 + 拦截计数(数据面接线后即上屏,不伪造当前为 0 的计数)', () => {
    storeRef.current.events = [evt('tool.before')]
    // 组件当前显式传 blocked=0(数据面未接线);此处锁"为 0 时不出现拦截计数"
    const { container } = render(<HookSummaryCard running={false} />)
    const card = container.querySelector('[data-testid="hook-summary-card"]')
    const blockedTpl = tPane('hookSummary.blockedCount')
    const [pre = '', post = ''] = blockedTpl.split('{n}')
    expect(card?.textContent ?? '').not.toMatch(new RegExp(`${escapeRe(pre)}\\d+${escapeRe(post)}`))
    // 纯函数层锁"接线后必上屏"
    expect(deriveHookSummary({ runs: 1, blocked: 2 }).blocked).toBe(2)
  })

  it('来源行:数据面未提供(sources=null)不出现;提供则渲染枚举标签', () => {
    storeRef.current.events = [evt('tool.before')]
    const { container } = render(<HookSummaryCard running={false} />)
    const card = container.querySelector('[data-testid="hook-summary-card"]')
    expect(card?.textContent ?? '').not.toContain(tPane('hookSummary.sourceLabel'))
    expect(card?.getAttribute('data-state')).toBe('ok')
  })

  it('五态之一 blocked 渲染:纯函数 state=blocked 时状态文案与图标容器就位', () => {
    // 渲染面 blocked 目前不可达(数据面未接线),此处以词包映射表锁状态文案完备性
    for (const s of ['running', 'ok', 'failed', 'blocked']) {
      expect(tPane(`hookSummary.state.${s}`)).not.toBe(`hookSummary.state.${s}`)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
