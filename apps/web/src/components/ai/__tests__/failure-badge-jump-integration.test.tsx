// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// @vitest-environment jsdom
/**
 * 深化W/Y 组件级集成测试 —— 失败分布徽章点击定位。
 *
 * 与 failure-jump.test.ts(纯决策)的分工:
 *   那份钉"选哪个子代理当 target"的决策;本份钉"真点击徽章 → 真展开批次 → 真滚动到
 *   对应 subagent-task-tree 节点 + 高亮"这条 DOM 链路,以及徽章确实以 button 形态可点。
 *
 * mock 边界:AgentTaskProgressPane() 无 props,数据全靠 hooks/stores。这里只 mock
 * 数据源(useAgentProgress / useAgentRuntime)为含失败子代理的夹具,store 走真实实现
 * 或最简 stub,next-intl 走真实词包(不写中文字面量断言)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'

const { makeT } = await vi.hoisted(async () => {
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
  return { makeT }
})

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => makeT(ns),
}))

import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import type { Subagent, UseAgentProgressReturn } from '@/hooks/use-agent-progress'

// ── 夹具:两个失败子代理,kind/source 各一维 ─────────────────────────────
const FAILED_KIND_SA: Subagent = {
  id: 'sa-kind',
  threadId: 'sa-kind',
  nickname: 'kind',
  handle: '@kind',
  color: 'cyan',
  status: 'failed',
  spawnedAt: '2026-11-17T00:00:00Z',
  failureKind: 'rate_limited',
  failureSource: 'provider',
  failureReason: 'HTTP 429',
} as Subagent

const FAILED_SOURCE_ONLY_SA: Subagent = {
  id: 'sa-source',
  threadId: 'sa-source',
  nickname: 'source',
  handle: '@source',
  color: 'cyan',
  status: 'dead',
  spawnedAt: '2026-11-17T00:00:01Z',
  failureSource: 'network',
  failureReason: 'connection reset',
} as Subagent

const DONE_SA: Subagent = {
  id: 'sa-done',
  threadId: 'sa-done',
  nickname: 'done',
  handle: '@done',
  color: 'green',
  status: 'done',
  spawnedAt: '2026-11-17T00:00:02Z',
} as Subagent

/** 构造 useAgentProgress 返回:只放子代理(徽章渲染只需 subagents + threadId 门控) */
function makeProgressReturn(subagents: Subagent[]): UseAgentProgressReturn {
  return {
    overview: {
      status: 'failed',
      currentNode: null,
      plan: null,
      content: '',
      error: 'boom',
      interruptEvent: null,
      sessionStart: null,
      totalSteps: 0,
      completedSteps: 0,
      inProgressSteps: 0,
      pendingSteps: 0,
      totalSubagents: subagents.length,
      activeSubagents: 0,
      deadSubagents: subagents.length,
      totalTerminals: 0,
      runningTerminals: 0,
      totalChanges: 0,
      historicalDurations: [],
      reconnectAttempt: 0,
    },
    planSteps: [],
    subagents,
    terminals: [],
    tools: [],
    changes: [],
  } as unknown as UseAgentProgressReturn
}

// mock 两个数据 hook;具体夹具在各用例 beforeEach 覆写
const progressMock = vi.fn()
vi.mock('@/hooks/use-agent-progress', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/hooks/use-agent-progress')
  return { ...actual, useAgentProgress: () => progressMock() }
})
vi.mock('@/hooks/use-agent-runtime', () => ({
  // 2026-11-21:mock 补齐 useAgentRuntime 真实契约里的 hookRuns / hookStats / pendingQuestion。
  // 面板在组件体内直接读 hookRuns.length 与 hookStats.total(渲染侧真值守卫尚未覆盖这两处),
  // mock 缺字段就会在渲染期抛 "Cannot read properties of undefined (reading 'length')" ——
  // 这是 mock 与真实 hook 返回形状不一致,不是面板逻辑缺陷,故在此按契约补齐,不改被测组件。
  useAgentRuntime: () => ({
    thinkingContent: '',
    planSteps: [],
    hookRuns: [],
    hookStats: { total: 0, ok: 0, timeout: 0, error: 0, totalDurationMs: 0, slowestMs: 0 },
    sessionEnd: null,
    permissionMode: null,
    terminalDeltas: [],
    agentStatus: null,
    lastMessageSend: null,
    sessionDeliverables: null,
    pendingQuestion: null,
  }),
}))
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, getModelContextCapacity: () => 128000 }
})

import { AgentTaskProgressPane } from '../agent-task-progress-pane'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'
import { useChatStore } from '@/stores/chat'
import { useLoginDialogStore } from '@/stores/login-dialog'

describe('深化W/Y 集成:失败分布徽章点击定位', () => {
  beforeEach(() => {
    cleanup()
    // 打开 pane + 给 threadId;hasActiveExecution 靠 subagents 非空满足
    useAgentProgressPaneStore.setState({ open: true, threadId: 't-1', pinned: true })
    useChatStore.setState({ conversationId: 't-1', messages: [], currentModel: 'gpt-4o' })
    useLoginDialogStore.setState({ isOpen: false })
  })
  afterEach(() => cleanup())

  it('失败模式徽章渲染为 button,点击后展开批次并滚动到首个该类失败子代理', async () => {
    progressMock.mockReturnValue(
      makeProgressReturn([FAILED_KIND_SA, FAILED_SOURCE_ONLY_SA, DONE_SA]),
    )
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy

    render(<AgentTaskProgressPane />)

    const badge = screen.getByTestId('subagent-batch-failure-dist-rate_limited')
    expect(badge.tagName).toBe('BUTTON')

    fireEvent.click(badge)

    // 点击展开批次:批次 body 出现,目标子代理树节点进入 DOM
    await Promise.resolve()
    const target = document.querySelector('[data-testid="subagent-task-tree-sa-kind"]')
    expect(target).not.toBeNull()
    // RAF 回调里触发滚动 —— 手动 flush requestAnimationFrame
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    expect(scrollSpy).toHaveBeenCalled()
    scrollSpy.mockRestore()
  })

  it('失败来源徽章点击定位到首个该来源失败子代理(与模式正交)', async () => {
    progressMock.mockReturnValue(
      makeProgressReturn([FAILED_KIND_SA, FAILED_SOURCE_ONLY_SA, DONE_SA]),
    )
    render(<AgentTaskProgressPane />)

    const badge = screen.getByTestId('subagent-batch-failure-source-dist-network')
    expect(badge.tagName).toBe('BUTTON')
    fireEvent.click(badge)

    await new Promise((r) => requestAnimationFrame(() => r(null)))
    expect(document.querySelector('[data-testid="subagent-task-tree-sa-source"]')).not.toBeNull()
  })

  it('无失败时两个分布块都不渲染(不出空 DOM)', () => {
    progressMock.mockReturnValue(makeProgressReturn([DONE_SA]))
    render(<AgentTaskProgressPane />)
    expect(screen.queryByTestId('subagent-batch-failure-dist')).toBeNull()
    expect(screen.queryByTestId('subagent-batch-failure-source-dist')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
