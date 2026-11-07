// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Groups 共享屏注入面锁。
//
// ① 空列表 ⇒ 空态;② 新建成功 ⇒ onCreate 收到 {name, description}(RN 旧能力只传 name,描述为对齐增项);
// ③ 名称为空 ⇒ 不提交(阴性对照);④ 编辑回显 + onUpdate(id, values);
// ⑤ 删除确认取消 ⇒ onDelete 不被调用(阴性对照);⑥ 删除确认通过 ⇒ onDelete(id);
// ⑦ all/mine 过滤按 ownerId;⑧ 成员面板展开 + onAddMember(id, userId);
// ⑨ 新建失败 ⇒ 错误可见且只提交一次。

import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GroupsScreen, type GroupView } from '../src/features/groups/GroupsScreen'

vi.mock('react-native', () => ({
  View: (p: { children?: unknown }) => createElement('div', null, p.children as never),
  Text: (p: { children?: unknown }) => createElement('span', null, p.children as never),
  ScrollView: (p: { children?: unknown }) => createElement('div', null, p.children as never),
  TextInput: (p: { children?: unknown }) => createElement('input', null, p.children as never),
  ActivityIndicator: () => createElement('i', { 'data-spinner': '' }),
  TouchableOpacity: (p: { children?: unknown; onPress?: () => void; disabled?: boolean }) =>
    createElement('button', { disabled: p.disabled, onClick: p.onPress }, p.children as never),
  StyleSheet: { create: (o: unknown) => o },
  useWindowDimensions: () => ({ width: 375, height: 800, scale: 1, fontScale: 1 }),
}))

vi.mock('lucide-react-native', () => ({
  ChevronDown: () => createElement('i', { 'data-icon': 'chevron-down' }),
  ChevronUp: () => createElement('i', { 'data-icon': 'chevron-up' }),
  Pencil: () => createElement('i', { 'data-icon': 'pencil' }),
  Plus: () => createElement('i', { 'data-icon': 'plus' }),
  Shield: () => createElement('i', { 'data-icon': 'shield' }),
  Trash2: () => createElement('i', { 'data-icon': 'trash' }),
  UserPlus: () => createElement('i', { 'data-icon': 'user-plus' }),
  Users: () => createElement('i', { 'data-icon': 'users' }),
  UsersRound: () => createElement('i', { 'data-icon': 'users-round' }),
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
  rnSpacing: {
    '2xs': 2,
    xs: 4,
    'xs-loose': 6,
    sm: 8,
    'sm-loose': 10,
    md: 12,
    lg: 16,
    '3xl': 32,
    '5xl': 48,
  },
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

const baseGroup: GroupView = {
  id: 'g1',
  name: '生产组',
  type: 'custom',
  description: '线上环境',
  ownerId: 'u1',
  memberCount: 2,
  createdAt: '2026-11-01T00:00:00Z',
}

function renderScreen(over: Record<string, unknown> = {}) {
  const props = {
    t,
    colorScheme: 'light' as const,
    groups: [] as GroupView[],
    loading: false,
    error: null as string | null,
    currentUserId: 'u1' as string | null,
    formatDate: (iso: string) => iso.slice(0, 10),
    onRefresh: vi.fn(async () => undefined),
    onCreate: vi.fn(async () => undefined),
    onUpdate: vi.fn(async () => undefined),
    onDelete: vi.fn(async () => undefined),
    onAddMember: vi.fn(async () => undefined),
    onConfirm: vi.fn(async () => true),
    ...over,
  }
  render(createElement(GroupsScreen, props as never))
  return props
}

afterEach(cleanup)

describe('GroupsScreen', () => {
  it('空列表渲染空态', () => {
    renderScreen()
    expect(screen.getByText('eduAi.groups.empty')).toBeTruthy()
  })

  it('新建成功:onCreate 收到完整 values(含描述)', async () => {
    const props = renderScreen()
    fireEvent.change(screen.getByPlaceholderText('eduAi.groups.groupName'), {
      target: { value: '新群组' },
    })
    fireEvent.change(screen.getByPlaceholderText('eduAi.groups.description'), {
      target: { value: '说明' },
    })
    await act(async () => {
      fireEvent.click(screen.getAllByText('eduAi.groups.createGroup').at(-1) as HTMLElement)
    })
    await waitFor(() => expect(props.onCreate).toHaveBeenCalledTimes(1))
    expect(props.onCreate).toHaveBeenCalledWith({ name: '新群组', description: '说明' })
  })

  it('名称为空不提交(阴性对照)', async () => {
    const props = renderScreen()
    await act(async () => {
      fireEvent.click(screen.getAllByText('eduAi.groups.createGroup').at(-1) as HTMLElement)
    })
    expect(props.onCreate).not.toHaveBeenCalled()
    const submit = screen
      .getAllByText('eduAi.groups.createGroup')
      .at(-1)
      ?.closest('button') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  it('编辑回显并按 id 提交', async () => {
    const props = renderScreen({ groups: [baseGroup] })
    fireEvent.click(screen.getByText('eduAi.groups.edit'))
    const nameInputs = screen.getAllByPlaceholderText(
      'eduAi.groups.groupName',
    ) as HTMLInputElement[]
    const editName = nameInputs.find((input) => input.value === '生产组') as HTMLInputElement
    expect(editName).toBeTruthy()
    fireEvent.change(editName, { target: { value: '改名后' } })
    await act(async () => {
      fireEvent.click(screen.getByText('eduAi.groups.save'))
    })
    await waitFor(() => expect(props.onUpdate).toHaveBeenCalledTimes(1))
    expect(props.onUpdate).toHaveBeenCalledWith('g1', { name: '改名后', description: '线上环境' })
  })

  it('删除确认取消:onDelete 不被调用(阴性对照)', async () => {
    const props = renderScreen({
      groups: [baseGroup],
      onConfirm: vi.fn(async () => false),
    })
    await act(async () => {
      fireEvent.click(screen.getByText('eduAi.groups.delete'))
    })
    expect(props.onConfirm).toHaveBeenCalledTimes(1)
    expect(props.onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ destructive: true, message: 'eduAi.groups.confirmDelete' }),
    )
    expect(props.onDelete).not.toHaveBeenCalled()
  })

  it('删除确认通过:onDelete 被调用', async () => {
    const props = renderScreen({ groups: [baseGroup] })
    await act(async () => {
      fireEvent.click(screen.getByText('eduAi.groups.delete'))
    })
    await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith('g1'))
  })

  it('mine 过滤只保留 ownerId 匹配的群组', () => {
    renderScreen({
      groups: [baseGroup, { ...baseGroup, id: 'g2', name: '别人组', ownerId: 'u2' }],
    })
    fireEvent.click(screen.getByText('eduAi.groups.title'))
    expect(screen.queryByText('别人组')).toBeNull()
    expect(screen.getByText('生产组')).toBeTruthy()
  })

  it('成员面板展开:onAddMember 收到群组 id 与 userId', async () => {
    const props = renderScreen({ groups: [baseGroup] })
    fireEvent.click(screen.getByText('eduAi.groups.memberList'))
    fireEvent.change(screen.getByPlaceholderText('eduAi.groups.userId'), {
      target: { value: 'u9' },
    })
    await act(async () => {
      fireEvent.click(screen.getByText('eduAi.groups.addMember'))
    })
    await waitFor(() => expect(props.onAddMember).toHaveBeenCalledWith('g1', 'u9'))
  })

  it('新建失败:错误可见且只提交一次', async () => {
    const onCreate = vi.fn(async () => {
      throw new Error('后端 500')
    })
    renderScreen({ onCreate })
    fireEvent.change(screen.getByPlaceholderText('eduAi.groups.groupName'), {
      target: { value: '失败群组' },
    })
    await act(async () => {
      fireEvent.click(screen.getAllByText('eduAi.groups.createGroup').at(-1) as HTMLElement)
    })
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(screen.getByText('后端 500')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
