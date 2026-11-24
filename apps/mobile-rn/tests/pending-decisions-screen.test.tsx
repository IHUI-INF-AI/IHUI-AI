// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// E1「我的待决策」收件箱套件(2026-10-30 立)。
// 钉住四件事:① 条目渲染(summary+类型标签+时间,对齐 Web pendingDecisions 区块);
// ② 空态文案;③ 超时未审标记(>30min 纯前端计算,且只标超时条目);
// ④ 深链回源:navigate('Chat', { conversationId: threadId }),无 threadId 不跳。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { PendingDecisionItem } from '@ihui/api-client'

const nav = vi.hoisted(() => ({ goBack: vi.fn(), navigate: vi.fn() }))
const pops = vi.hoisted(() => ({ appAlert: vi.fn() }))
const state = vi.hoisted(() => ({ items: [] as unknown[] }))

vi.mock('@react-navigation/native', () => ({ useNavigation: () => nav }))
vi.mock('../src/components/BottomPops', () => ({ appAlert: pops.appAlert }))
vi.mock('../src/components/NavBar', () => ({
  NavBar: ({ title, onBack }: { title?: string; onBack?: () => void }) =>
    createElement('div', { 'data-role': 'navbar', onClick: onBack }, title),
}))
vi.mock('../src/components/NavChrome', () => ({
  NavChrome: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))
vi.mock('@ihui/api-client', () => ({
  listPendingDecisions: () =>
    Promise.resolve({
      success: true,
      data: { items: state.items, total: state.items.length },
      status: 200,
    }),
}))

import PendingDecisionsScreen, {
  isPendingDecisionOverdue,
  PENDING_DECISION_TIMEOUT_MS,
} from '../src/screens/PendingDecisionsScreen'
import { I18nProvider } from '../src/i18n'

const renderScreen = () =>
  render(createElement(I18nProvider, null, createElement(PendingDecisionsScreen)))

const MIN = 60_000
const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * MIN).toISOString()

const FRESH: PendingDecisionItem = {
  id: 'pd-1',
  threadId: 'thread-1',
  type: 'tool_approval',
  summary: '允许执行 shell 命令:rm -rf build',
  createdAt: iso(5),
}
const OVERDUE: PendingDecisionItem = {
  id: 'pd-2',
  threadId: 'thread-2',
  type: 'permissions',
  summary: '请求文件系统写入权限',
  createdAt: iso(31),
}
const ORPHAN: PendingDecisionItem = {
  id: 'pd-3',
  threadId: null,
  type: 'elicitation',
  summary: '请选择部署环境',
  createdAt: iso(2),
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  state.items = [FRESH, OVERDUE, ORPHAN]
})

describe('isPendingDecisionOverdue 判据', () => {
  it('阈值 30 分钟:29 分不算、31 分算、缺失/无效时间一律不算', () => {
    expect(PENDING_DECISION_TIMEOUT_MS).toBe(30 * MIN)
    const now = Date.now()
    expect(isPendingDecisionOverdue(iso(29), now)).toBe(false)
    expect(isPendingDecisionOverdue(iso(31), now)).toBe(true)
    expect(isPendingDecisionOverdue(null, now)).toBe(false)
    expect(isPendingDecisionOverdue('not-a-date', now)).toBe(false)
  })
})

describe('PendingDecisionsScreen 收件箱', () => {
  it('渲染条目:summary + 类型标签 + 时间', async () => {
    renderScreen()
    expect(await screen.findByText('允许执行 shell 命令:rm -rf build')).toBeTruthy()
    expect(screen.getByText('请求文件系统写入权限')).toBeTruthy()
    expect(screen.getByText('工具审批')).toBeTruthy()
    expect(screen.getByText('权限提升')).toBeTruthy()
    expect(screen.getByText('AI 提问')).toBeTruthy()
  })

  it('超时标记只落在 >30min 的条目上', async () => {
    renderScreen()
    await screen.findByText('请求文件系统写入权限')
    const marks = screen.getAllByText('超时未处理')
    expect(marks.length).toBe(1)
  })

  it('空态文案:无待决策事项', async () => {
    state.items = []
    renderScreen()
    expect(await screen.findByText('暂无待你决策的事项')).toBeTruthy()
  })

  it('点条目深链回源会话(既有基建:Chat + conversationId)', async () => {
    renderScreen()
    fireEvent.click(await screen.findByText('允许执行 shell 命令:rm -rf build'))
    expect(nav.navigate).toHaveBeenCalledWith('Chat', { conversationId: 'thread-1' })
  })

  it('无 threadId 的孤儿决策:不跳转,如实提示', async () => {
    renderScreen()
    fireEvent.click(await screen.findByText('请选择部署环境'))
    expect(nav.navigate).not.toHaveBeenCalled()
    expect(pops.appAlert).toHaveBeenCalledWith('我的待决策', '该决策没有关联的源会话')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
