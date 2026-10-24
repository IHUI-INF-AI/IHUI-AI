// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D06/D115(G-229)审查卡「一键派发修复」用例(2026-10-25 定档):
// 票面 ③ 要求"可一键派发修复任务(走既有 dispatch_subagent)"⇒ 本卡不复用草稿通道,
// 而是把该条 finding 的预填值交给**既有** DispatchSubagentDialog(其提交即
// POST /api/subagents/dispatch,成功/失败反馈沿用该对话框既有面板与 toast)。
// 覆盖:
// ① 未给 onDispatchFix ⇒ 不渲染按钮(纯展示不擅自派单);
// ② 给了出口 ⇒ 每条一个按钮,点击只调派发、不触发 IDE 跳转;
// ③ 预填值单源:goal = 文件:行 + 问题 + 说明 + 建议,affectedFiles/priority 由该条投影;
// ④ 真 MessageItem:点某条 ⇒ 对话框以**该条**预填值打开,其他 finding 不受影响;
// ⑤ 对话框 onOpenChange(false) ⇒ 关闭即清空,不再渲染。
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset?: {
    goal?: string
    affectedFiles?: readonly string[]
    priority?: string
    constraints?: string
    deliverables?: string
  }
}

const { dialogCalls } = vi.hoisted(() => ({ dialogCalls: [] as DialogProps[] }))

vi.mock('@/components/ai/dispatch-subagent-dialog', async () => {
  const React = await import('react')
  return {
    DispatchSubagentDialog: (props: DialogProps) => {
      dialogCalls.push(props)
      return React.createElement('div', { 'data-testid': 'dispatch-dialog-stub' })
    },
  }
})

import {
  ReviewFindingsCard,
  buildFixDispatchPreset,
  buildFixDispatchPrompt,
  type ReviewFinding,
} from '@/components/chat/message-list/review-findings-card'
import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import { useIDEWorkspace } from '@/stores/ide-workspace'

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0)
const ID = 'a-review'

function finding(overrides: Partial<ReviewFinding> & { findingId: string }): ReviewFinding {
  return {
    type: 'review-finding',
    index: 1,
    total: 1,
    severity: 'P1',
    file: 'src/a.ts',
    line: 42,
    title: '空指针风险',
    detail: 'detail',
    suggestion: '补 null 判断',
    ...overrides,
  }
}

const TARGET = finding({ findingId: 'rf-1' })

beforeEach(() => {
  dialogCalls.length = 0
  useIDEWorkspace.setState({
    openFile: vi.fn(),
    setActiveTopTab: vi.fn(),
    revealAt: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [], reviewFindingsByMessageId: {} })
})

describe('ReviewFindingsCard 一键派发修复(D06/D115)', () => {
  it('未给 onDispatchFix ⇒ 不渲染按钮(纯展示不擅自派单)', () => {
    render(<ReviewFindingsCard findings={[finding({ findingId: 'rf-1' })]} />)
    expect(screen.queryByTestId('review-dispatch-rf-1')).toBeNull()
  })

  it('给了出口 ⇒ 每条一个按钮,点击只调派发、不触发 IDE 跳转', () => {
    const onDispatchFix = vi.fn()
    render(<ReviewFindingsCard findings={[TARGET]} onDispatchFix={onDispatchFix} />)
    const btn = screen.getByTestId('review-dispatch-rf-1')
    expect(btn.getAttribute('aria-label')).toBe('dispatch-fix:src/a.ts:42')
    btn.click()
    expect(onDispatchFix).toHaveBeenCalledTimes(1)
    expect(onDispatchFix).toHaveBeenCalledWith(TARGET)
    expect(useIDEWorkspace.getState().openFile).not.toHaveBeenCalled()
    expect(useIDEWorkspace.getState().revealAt).not.toHaveBeenCalled()
  })

  it('预填正文单源:文件:行 + 问题 + 说明 + 建议', () => {
    expect(buildFixDispatchPrompt(TARGET)).toBe(
      '修复审查发现(P1):src/a.ts:42\n问题:空指针风险\n说明:detail\n修复建议:补 null 判断',
    )
  })

  it('line=0 是整文件级 ⇒ 正文只写文件,不补 :0', () => {
    const whole = finding({ findingId: 'rf-2', line: 0, detail: '', suggestion: '' })
    expect(buildFixDispatchPrompt(whole)).toBe(
      '修复审查发现(P1):src/a.ts\n问题:空指针风险',
    )
  })

  it('派单预填值只投影该条:文件行进 affectedFiles,严重度进 priority', () => {
    expect(buildFixDispatchPreset(TARGET)).toEqual({
      goal: buildFixDispatchPrompt(TARGET),
      affectedFiles: ['src/a.ts'],
      priority: 'urgent',
      constraints: '只修 src/a.ts:42 这一处,不改无关代码,不引入新依赖',
      deliverables: '修复该 finding,并自验(typecheck / lint / 相关用例)通过',
    })
    expect(buildFixDispatchPreset(finding({ findingId: 'x', severity: 'P2' })).priority).toBe('high')
    expect(buildFixDispatchPreset(finding({ findingId: 'y', severity: 'Nit' })).priority).toBe('low')
  })

  it('反斜杠路径归一成正斜杠(S 端与 file-chips 同口径)', () => {
    const win = finding({ findingId: 'rf-w', file: 'src\\win\\a.ts' })
    expect(buildFixDispatchPreset(win).affectedFiles).toEqual(['src/win/a.ts'])
  })
})

describe('MessageItem 派发修复接线(D06/D115)', () => {
  function assistantMsg(): ChatMessage {
    return { id: ID, role: 'assistant', content: '审查完成', createdAt: NOW }
  }

  function renderItem() {
    render(
      <TooltipProvider>
        <MessageItem message={assistantMsg()} isLast isStreaming={false} assistantLabel="AI" />
      </TooltipProvider>,
    )
  }

  it('点某条 finding ⇒ 既有派发对话框以该条预填值打开,其他 finding 不受影响', () => {
    const other = finding({
      findingId: 'rf-2',
      severity: 'P2',
      file: 'src/b.ts',
      line: 7,
      title: '另一条',
    })
    useChatStore.setState({
      messages: [assistantMsg()],
      reviewFindingsByMessageId: { [ID]: [TARGET, other] },
    })
    renderItem()

    // 未点击前不挂对话框(不擅自弹)
    expect(screen.queryByTestId('dispatch-dialog-stub')).toBeNull()

    act(() => screen.getByTestId('review-dispatch-rf-1').click())

    expect(screen.getAllByTestId('dispatch-dialog-stub')).toHaveLength(1)
    const props = dialogCalls[dialogCalls.length - 1]!
    expect(props.open).toBe(true)
    expect(props.preset?.goal).toContain('src/a.ts:42')
    expect(props.preset?.goal).toContain('空指针风险')
    expect(props.preset?.goal).not.toContain('另一条')
    expect(props.preset?.affectedFiles).toEqual(['src/a.ts'])
    expect(props.preset?.priority).toBe('urgent')

    // 另一条 finding 仍在卡片里、按钮未被触发(只作用于被点那一条)
    expect(screen.getByTestId('review-finding-rf-2')).toBeTruthy()
    expect(screen.getByTestId('review-dispatch-rf-2')).toBeTruthy()
    expect(useIDEWorkspace.getState().openFile).not.toHaveBeenCalled()
  })

  it('对话框关闭 ⇒ 清空,不再渲染', () => {
    useChatStore.setState({
      messages: [assistantMsg()],
      reviewFindingsByMessageId: { [ID]: [TARGET] },
    })
    renderItem()
    act(() => screen.getByTestId('review-dispatch-rf-1').click())
    expect(screen.getByTestId('dispatch-dialog-stub')).toBeTruthy()

    act(() => dialogCalls[dialogCalls.length - 1]!.onOpenChange(false))
    expect(screen.queryByTestId('dispatch-dialog-stub')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
