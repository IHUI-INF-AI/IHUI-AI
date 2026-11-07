// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// TeamKnowledge 共享屏注入面锁。
//
// ① 空团队 ⇒ needTeam + 搜索不触发(阴性对照);② 有团队无空间 ⇒ emptySpaces;
// ③ 搜索 ⇒ onSearch;④ 选空间 ⇒ onSelectSpace;⑤ 新建空间空名 ⇒ 不提交(阴性对照);
// ⑥ 新建空间受限可见 ⇒ onCreateSpace 收到 visibility=restricted;
// ⑦ 成员只读 chips;⑧ 默认条目列表(标题/状态/类型·rev/正文);
// ⑨ 类型筛选 ⇒ onSelectKind;⑩ 新建条目空标题 ⇒ 不提交(阴性对照);
// ⑪ 新建条目 ⇒ onCreateItem;⑫ 发布确认取消 ⇒ onSetItemStatus 不调用(阴性对照);
// ⑬ 发布确认通过 ⇒ onSetItemStatus(published);⑭ 归档确认 ⇒ destructive=true;
// ⑮ web 注入 renderMembers/renderItems 覆盖默认区;⑯ 下拉刷新可选挂载;
// ⑰ viewer 无编辑权 ⇒ 新建/发布按钮禁用。

import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TeamKnowledgeScreen,
  type TeamKnowledgeItemView,
  type TeamKnowledgeSpaceView,
} from '../src/features/team-knowledge/TeamKnowledgeScreen'

vi.mock('react-native', () => ({
  View: (p: { children?: unknown }) => createElement('div', null, p.children as never),
  Text: (p: { children?: unknown }) => createElement('span', null, p.children as never),
  ScrollView: (p: { children?: unknown; refreshControl?: unknown }) =>
    createElement('div', null, p.refreshControl as never, p.children as never),
  RefreshControl: (p: { onRefresh?: () => void }) =>
    createElement('button', { 'data-refresh': '', onClick: p.onRefresh }, 'refresh-control'),
  ActivityIndicator: () => createElement('i', { 'data-spinner': '' }),
  TouchableOpacity: (p: { children?: unknown; onPress?: () => void; disabled?: boolean }) =>
    createElement('button', { disabled: p.disabled, onClick: p.onPress }, p.children as never),
  StyleSheet: { create: (o: unknown) => o },
}))

vi.mock('lucide-react-native', () => ({
  Archive: () => createElement('i', { 'data-icon': 'archive' }),
  Plus: () => createElement('i', { 'data-icon': 'plus' }),
  Search: () => createElement('i', { 'data-icon': 'search' }),
  Send: () => createElement('i', { 'data-icon': 'send' }),
}))

vi.mock('../src/components/TextField', () => ({
  TextField: (p: {
    value: string
    onChangeText: (v: string) => void
    placeholder?: string
    editable?: boolean
  }) =>
    createElement('input', {
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
    brand: { cta: '#1677ff', ctaForeground: '#fff', DEFAULT: '#1677ff' },
    danger: { DEFAULT: '#f00' },
  }),
}))

vi.mock('@ihui/design-tokens', () => ({
  rnSpacing: {
    '2xs': 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    '3xl': 32,
  },
  rnType: {
    badge: { size: 10 },
    caption: { size: 11 },
    bodySm: { size: 13 },
    strong: { size: 15 },
  },
  rnRadius: { sm: 6, md: 10, lg: 14 },
}))

const t = ((key: string) => key) as never

const space: TeamKnowledgeSpaceView = {
  id: 's1',
  name: '产品知识',
  myRole: 'editor',
  visibility: 'team',
}

const item: TeamKnowledgeItemView = {
  id: 'i1',
  kind: 'wiki',
  title: '部署手册',
  plainText: '先跑迁移再切流量',
  status: 'draft',
  revision: 3,
  tags: ['部署'],
}

function renderScreen(over: Record<string, unknown> = {}) {
  const props = {
    t,
    colorScheme: 'light' as const,
    teamId: 'team-1',
    onChangeTeamId: vi.fn(),
    spaces: [] as TeamKnowledgeSpaceView[],
    selectedSpaceId: '',
    onSelectSpace: vi.fn(),
    members: [],
    items: [] as TeamKnowledgeItemView[],
    kind: '' as const,
    onSelectKind: vi.fn(),
    loading: false,
    error: null as string | null,
    onSearch: vi.fn(async () => undefined),
    onCreateSpace: vi.fn(async () => undefined),
    onCreateItem: vi.fn(async () => undefined),
    onSetItemStatus: vi.fn(async () => undefined),
    onConfirm: vi.fn(async () => true),
    ...over,
  }
  render(createElement(TeamKnowledgeScreen, props as never))
  return props
}

afterEach(cleanup)

describe('TeamKnowledgeScreen', () => {
  it('空团队:needTeam 可见,搜索不触发(阴性对照)', async () => {
    const props = renderScreen({ teamId: '' })
    await act(async () => {
      fireEvent.click(screen.getByText('teamKnowledge.searchBtn'))
    })
    expect(props.onSearch).not.toHaveBeenCalled()
    expect(screen.getAllByText('teamKnowledge.needTeam').length).toBeGreaterThan(0)
  })

  it('有团队但无空间:空态文案', () => {
    renderScreen()
    expect(screen.getByText('teamKnowledge.emptySpaces')).toBeTruthy()
  })

  it('搜索:onSearch 被调用', async () => {
    const props = renderScreen()
    await act(async () => {
      fireEvent.click(screen.getByText('teamKnowledge.searchBtn'))
    })
    await waitFor(() => expect(props.onSearch).toHaveBeenCalledTimes(1))
  })

  it('选择空间:onSelectSpace 收到 id', () => {
    const props = renderScreen({ spaces: [space], selectedSpaceId: 's1' })
    fireEvent.click(screen.getByText('产品知识'))
    expect(props.onSelectSpace).toHaveBeenCalledWith('s1')
  })

  it('新建空间空名:保存按钮禁用,不提交(阴性对照)', async () => {
    const props = renderScreen()
    fireEvent.click(screen.getByText('teamKnowledge.newSpaceBtn'))
    const save = screen.getByText('teamKnowledge.saveBtn').closest('button') as HTMLButtonElement
    expect(save.disabled).toBe(true)
    await act(async () => {
      fireEvent.click(save)
    })
    expect(props.onCreateSpace).not.toHaveBeenCalled()
  })

  it('新建空间:受限可见提交 visibility=restricted', async () => {
    const props = renderScreen()
    fireEvent.click(screen.getByText('teamKnowledge.newSpaceBtn'))
    fireEvent.change(screen.getByPlaceholderText('teamKnowledge.spaceNamePlaceholder'), {
      target: { value: '架构决策' },
    })
    fireEvent.click(screen.getByText('teamKnowledge.restricted'))
    await act(async () => {
      fireEvent.click(screen.getByText('teamKnowledge.saveBtn'))
    })
    await waitFor(() =>
      expect(props.onCreateSpace).toHaveBeenCalledWith({
        name: '架构决策',
        visibility: 'restricted',
      }),
    )
  })

  it('成员只读 chips:userId 截断 + 角色标签', () => {
    renderScreen({
      spaces: [space],
      selectedSpaceId: 's1',
      members: [{ userId: 'user-1234-5678', role: 'viewer' }],
    })
    expect(screen.getByText('user-123')).toBeTruthy()
    expect(screen.getByText('teamKnowledge.role.viewer')).toBeTruthy()
  })

  it('默认条目列表:标题 / 状态 / 类型·rev / 正文', () => {
    renderScreen({ spaces: [space], selectedSpaceId: 's1', items: [item] })
    expect(screen.getByText('部署手册')).toBeTruthy()
    expect(screen.getByText('teamKnowledge.status.draft')).toBeTruthy()
    expect(screen.getByText('teamKnowledge.kind.wiki · rev 3')).toBeTruthy()
    expect(screen.getByText('先跑迁移再切流量')).toBeTruthy()
    expect(screen.getByText('部署')).toBeTruthy()
  })

  it('类型筛选:onSelectKind 收到 wiki', () => {
    const props = renderScreen({ spaces: [space], selectedSpaceId: 's1' })
    fireEvent.click(screen.getByText('teamKnowledge.kind.wiki'))
    expect(props.onSelectKind).toHaveBeenCalledWith('wiki')
    expect(screen.getByText('teamKnowledge.kindAll')).toBeTruthy()
  })

  it('新建条目空标题:保存按钮禁用,不提交(阴性对照)', async () => {
    const props = renderScreen({ spaces: [space], selectedSpaceId: 's1' })
    fireEvent.click(screen.getByText('teamKnowledge.newItemBtn'))
    const save = screen.getByText('teamKnowledge.saveBtn').closest('button') as HTMLButtonElement
    expect(save.disabled).toBe(true)
    await act(async () => {
      fireEvent.click(save)
    })
    expect(props.onCreateItem).not.toHaveBeenCalled()
  })

  it('新建条目:onCreateItem 收到标题与正文', async () => {
    const props = renderScreen({ spaces: [space], selectedSpaceId: 's1' })
    fireEvent.click(screen.getByText('teamKnowledge.newItemBtn'))
    fireEvent.change(screen.getByPlaceholderText('teamKnowledge.titlePlaceholder'), {
      target: { value: '灰度发布' },
    })
    fireEvent.change(screen.getByPlaceholderText('teamKnowledge.contentPlaceholder'), {
      target: { value: '先 5% 流量' },
    })
    await act(async () => {
      fireEvent.click(screen.getByText('teamKnowledge.saveBtn'))
    })
    await waitFor(() =>
      expect(props.onCreateItem).toHaveBeenCalledWith({
        title: '灰度发布',
        text: '先 5% 流量',
      }),
    )
  })

  it('发布确认取消:onSetItemStatus 不调用(阴性对照)', async () => {
    const props = renderScreen({
      spaces: [space],
      selectedSpaceId: 's1',
      items: [item],
      onConfirm: vi.fn(async () => false),
    })
    await act(async () => {
      fireEvent.click(screen.getByText('teamKnowledge.publishBtn'))
    })
    expect(props.onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'teamKnowledge.publishBtn', message: '部署手册' }),
    )
    expect(props.onSetItemStatus).not.toHaveBeenCalled()
  })

  it('发布确认通过:onSetItemStatus(published)', async () => {
    const props = renderScreen({ spaces: [space], selectedSpaceId: 's1', items: [item] })
    await act(async () => {
      fireEvent.click(screen.getByText('teamKnowledge.publishBtn'))
    })
    await waitFor(() => expect(props.onSetItemStatus).toHaveBeenCalledWith(item, 'published'))
  })

  it('归档确认:destructive=true 且状态为 archived', async () => {
    const props = renderScreen({ spaces: [space], selectedSpaceId: 's1', items: [item] })
    await act(async () => {
      fireEvent.click(screen.getByText('teamKnowledge.archiveBtn'))
    })
    expect(props.onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ destructive: true }),
    )
    await waitFor(() => expect(props.onSetItemStatus).toHaveBeenCalledWith(item, 'archived'))
  })

  it('web 注入 renderMembers / renderItems 覆盖默认区', () => {
    renderScreen({
      spaces: [space],
      selectedSpaceId: 's1',
      members: [{ userId: 'user-1234-5678', role: 'viewer' }],
      items: [item],
      renderMembers: (id: string) => createElement('div', { 'data-members': id }),
      renderItems: (id: string) => createElement('div', { 'data-items': id }),
    })
    expect(document.querySelector('[data-members="s1"]')).toBeTruthy()
    expect(document.querySelector('[data-items="s1"]')).toBeTruthy()
    expect(screen.queryByText('user-123')).toBeNull()
    expect(screen.queryByText('部署手册')).toBeNull()
  })

  it('下拉刷新:传入 onRefresh 时挂载并可触发;不传则不挂', async () => {
    renderScreen({ spaces: [space], selectedSpaceId: 's1', onRefresh: vi.fn(async () => undefined) })
    const refresh = document.querySelector('[data-refresh]') as HTMLElement
    expect(refresh).toBeTruthy()
    await act(async () => {
      fireEvent.click(refresh)
    })
    cleanup()
    renderScreen({ onRefresh: undefined })
    expect(document.querySelector('[data-refresh]')).toBeNull()
  })

  it('viewer 无编辑权:新建条目与发布/归档禁用', () => {
    renderScreen({
      spaces: [{ ...space, myRole: 'viewer' }],
      selectedSpaceId: 's1',
      items: [item],
    })
    const newItem = screen.getByText('teamKnowledge.newItemBtn').closest('button') as HTMLButtonElement
    const publish = screen.getByText('teamKnowledge.publishBtn').closest('button') as HTMLButtonElement
    const archive = screen.getByText('teamKnowledge.archiveBtn').closest('button') as HTMLButtonElement
    expect(newItem.disabled).toBe(true)
    expect(publish.disabled).toBe(true)
    expect(archive.disabled).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
