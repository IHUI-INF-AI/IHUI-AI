// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Patrol 共享屏注入面锁。
//
// ① 空列表 ⇒ 空态;② 新建成功 ⇒ onSave 收到完整 values(默认 custom/DAILY);
// ③ 编辑 ⇒ 回显 + onSave(values, id);④ 原始 rrule 可编辑并进入提交值(RN 旧能力不丢);
// ⑤ 立即巡检 / 暂停恢复 ⇒ 回调入参;⑥ 删除确认取消 ⇒ onDelete 不被调用(阴性对照);
// ⑦ 删除确认通过 ⇒ onDelete 调用;⑧ 历史展开 ⇒ onLoadRuns + 会话深链;
// ⑨ 保存失败 ⇒ 错误可见且只提交一次;⑩ 名称为空 ⇒ 不提交(阴性对照)。

import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PatrolScreen, type PatrolTaskView } from '../src/features/patrol/PatrolScreen'

vi.mock('react-native', () => ({
  View: (p: { children?: unknown }) => createElement('div', null, p.children as never),
  Text: (p: { children?: unknown }) => createElement('span', null, p.children as never),
  ScrollView: (p: { children?: unknown }) => createElement('div', null, p.children as never),
  TextInput: (p: { children?: unknown }) => createElement('input', null, p.children as never),
  ActivityIndicator: () => createElement('i', { 'data-spinner': '' }),
  RefreshControl: () => createElement('i', { 'data-refresh-control': '' }),
  TouchableOpacity: (p: { children?: unknown; onPress?: () => void; disabled?: boolean }) =>
    createElement('button', { disabled: p.disabled, onClick: p.onPress }, p.children as never),
  StyleSheet: { create: (o: unknown) => o },
}))

vi.mock('lucide-react-native', () => ({
  ChevronDown: () => createElement('i', { 'data-icon': 'chevron-down' }),
  ChevronUp: () => createElement('i', { 'data-icon': 'chevron-up' }),
  History: () => createElement('i', { 'data-icon': 'history' }),
  MessageSquare: () => createElement('i', { 'data-icon': 'message' }),
  Pause: () => createElement('i', { 'data-icon': 'pause' }),
  Pencil: () => createElement('i', { 'data-icon': 'pencil' }),
  Play: () => createElement('i', { 'data-icon': 'play' }),
  Plus: () => createElement('i', { 'data-icon': 'plus' }),
  RefreshCw: () => createElement('i', { 'data-icon': 'refresh' }),
  Trash2: () => createElement('i', { 'data-icon': 'trash' }),
  Zap: () => createElement('i', { 'data-icon': 'zap' }),
}))

vi.mock('../src/components/TextField', () => ({
  TextField: (p: {
    value: string
    onChangeText: (v: string) => void
    placeholder?: string
    editable?: boolean
  }) =>
    createElement('input', {
      'data-textfield': '',
      value: p.value,
      placeholder: p.placeholder,
      disabled: p.editable === false,
      onChange: (e: { target: { value: string } }) => p.onChangeText(e.target.value),
    }),
}))

vi.mock('../src/theme/tokens', () => ({
  getTokens: () => ({
    surface: { bg: '#fff', card: '#fff', muted: '#eee' },
    text: { primary: '#111', secondary: '#555', tertiary: '#999' },
    border: { light: '#ddd', medium: '#ccc' },
    brand: { cta: '#1677ff', ctaForeground: '#fff' },
    brandAccent: { deep: '#1677ff', light: '#e6f0ff', foreground: '#1677ff' },
    danger: { DEFAULT: '#f00' },
    success: { DEFAULT: '#0a0' },
  }),
}))

vi.mock('@ihui/design-tokens', () => ({
  rnSpacing: { '2xs': 2, xs: 4, 'xs-loose': 6, sm: 8, 'sm-loose': 10, md: 12, lg: 16, '3xl': 32 },
  rnType: {
    badge: { size: 10 },
    caption: { size: 11 },
    label: { size: 12 },
    bodySm: { size: 13 },
    body: { size: 14 },
    strong: { size: 15 },
    title: { size: 16 },
    heading: { size: 20 },
  },
  rnRadius: { sm: 6, md: 10, lg: 14 },
}))

const t = ((key: string, vars?: Record<string, unknown>) =>
  vars && Object.keys(vars).length > 0 ? `${key}:${JSON.stringify(vars)}` : key) as never

const baseTask: PatrolTaskView = {
  id: 't1',
  name: '生产巡检',
  patrolType: 'ci',
  target: 'main',
  prompt: null,
  rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
  status: 'active',
  nextRunAt: '2026-11-08T01:00:00Z',
  lastResult: null,
}

function renderScreen(over: Record<string, unknown> = {}) {
  const props = {
    t,
    colorScheme: 'light' as const,
    tasks: [] as PatrolTaskView[],
    loading: false,
    error: null,
    onRefresh: vi.fn(async () => undefined),
    onSave: vi.fn(async () => undefined),
    onRunNow: vi.fn(async () => undefined),
    onToggleStatus: vi.fn(async () => undefined),
    onDelete: vi.fn(async () => undefined),
    onLoadRuns: vi.fn(async () => []),
    onOpenConversation: vi.fn(),
    onConfirm: vi.fn(async () => true),
    ...over,
  }
  render(createElement(PatrolScreen, props as never))
  return props
}

afterEach(cleanup)

describe('PatrolScreen', () => {
  it('空列表渲染空态', () => {
    renderScreen()
    expect(screen.getByText('patrol.empty')).toBeTruthy()
  })

  it('新建成功:onSave 收到默认类型 custom 与默认 rrule', async () => {
    const props = renderScreen()
    fireEvent.click(screen.getByText('patrol.create'))
    fireEvent.change(screen.getByPlaceholderText('patrol.form.namePlaceholder'), {
      target: { value: '新巡检' },
    })
    fireEvent.change(screen.getByPlaceholderText('patrol.form.targetPlaceholder'), {
      target: { value: 'repo' },
    })
    await act(async () => {
      fireEvent.click(screen.getByText('patrol.save'))
    })
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1))
    expect(props.onSave).toHaveBeenCalledWith(
      {
        name: '新巡检',
        patrolType: 'custom',
        target: 'repo',
        prompt: '',
        rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
      },
      undefined,
    )
  })

  it('编辑回显并带 id 提交', async () => {
    const props = renderScreen({ tasks: [baseTask] })
    fireEvent.click(screen.getByText('patrol.action.edit'))
    expect(
      (screen.getByPlaceholderText('patrol.form.namePlaceholder') as HTMLInputElement).value,
    ).toBe('生产巡检')
    fireEvent.change(screen.getByPlaceholderText('patrol.form.namePlaceholder'), {
      target: { value: '改名后' },
    })
    await act(async () => {
      fireEvent.click(screen.getByText('patrol.save'))
    })
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1))
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ name: '改名后' }), 't1')
  })

  it('原始 rrule 可编辑并进入提交值(RN 旧能力保留)', async () => {
    const props = renderScreen()
    fireEvent.click(screen.getByText('patrol.create'))
    fireEvent.change(screen.getByPlaceholderText('patrol.form.namePlaceholder'), {
      target: { value: '周巡' },
    })
    fireEvent.change(screen.getByPlaceholderText('patrol.form.rrulePlaceholder'), {
      target: { value: 'FREQ=WEEKLY;BYDAY=MO,WE;BYHOUR=10;BYMINUTE=0' },
    })
    await act(async () => {
      fireEvent.click(screen.getByText('patrol.save'))
    })
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1))
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ rrule: 'FREQ=WEEKLY;BYDAY=MO,WE;BYHOUR=10;BYMINUTE=0' }),
      undefined,
    )
  })

  it('立即巡检回调入参为任务 id', async () => {
    const props = renderScreen({ tasks: [baseTask] })
    await act(async () => {
      fireEvent.click(screen.getByText('patrol.action.runNow'))
    })
    expect(props.onRunNow).toHaveBeenCalledWith('t1')
  })

  it('暂停/恢复回调入参为 next 状态', async () => {
    const props = renderScreen({ tasks: [baseTask] })
    await act(async () => {
      fireEvent.click(screen.getByText('patrol.action.pause'))
    })
    expect(props.onToggleStatus).toHaveBeenCalledWith('t1', 'paused')
  })

  it('删除确认取消:onDelete 不被调用(阴性对照)', async () => {
    const props = renderScreen({
      tasks: [baseTask],
      onConfirm: vi.fn(async () => false),
    })
    await act(async () => {
      fireEvent.click(screen.getByText('patrol.action.delete'))
    })
    expect(props.onConfirm).toHaveBeenCalledTimes(1)
    expect(props.onDelete).not.toHaveBeenCalled()
  })

  it('删除确认通过:onDelete 被调用', async () => {
    const props = renderScreen({ tasks: [baseTask] })
    await act(async () => {
      fireEvent.click(screen.getByText('patrol.action.delete'))
    })
    expect(props.onDelete).toHaveBeenCalledWith('t1')
  })

  it('历史展开:加载 runs 并可从 issue 行打开会话', async () => {
    const props = renderScreen({
      tasks: [baseTask],
      onLoadRuns: vi.fn(async () => [
        {
          id: 'r1',
          status: 'issue',
          summary: '发现 3 个死链',
          conversationId: 'c2',
          createdAt: '2026-11-07T02:00:00Z',
        },
      ]),
    })
    await act(async () => {
      fireEvent.click(screen.getByText('patrol.action.history'))
    })
    await waitFor(() => expect(props.onLoadRuns).toHaveBeenCalledWith('t1'))
    expect(await screen.findByText('发现 3 个死链')).toBeTruthy()
    fireEvent.click(screen.getByText('patrol.action.openConversation'))
    expect(props.onOpenConversation).toHaveBeenCalledWith('c2')
  })

  it('lastResult 有 conversationId 时可打开会话', () => {
    const props = renderScreen({
      tasks: [
        {
          ...baseTask,
          lastResult: {
            status: 'issue',
            summary: '待修复',
            conversationId: 'c1',
            finishedAt: '2026-11-07T01:00:00Z',
          },
        },
      ],
    })
    fireEvent.click(screen.getByText('patrol.action.openConversation'))
    expect(props.onOpenConversation).toHaveBeenCalledWith('c1')
  })

  it('名称为空不提交(阴性对照)', async () => {
    const props = renderScreen()
    fireEvent.click(screen.getByText('patrol.create'))
    await act(async () => {
      fireEvent.click(screen.getByText('patrol.save'))
    })
    expect(props.onSave).not.toHaveBeenCalled()
    expect(screen.getByText('patrol.form.errName')).toBeTruthy()
  })

  it('保存失败:错误可见且只提交一次', async () => {
    const onSave = vi.fn(async () => {
      throw new Error('后端 500')
    })
    renderScreen({ onSave })
    fireEvent.click(screen.getByText('patrol.create'))
    fireEvent.change(screen.getByPlaceholderText('patrol.form.namePlaceholder'), {
      target: { value: '失败巡检' },
    })
    await act(async () => {
      fireEvent.click(screen.getByText('patrol.save'))
    })
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(screen.getByText('后端 500')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
