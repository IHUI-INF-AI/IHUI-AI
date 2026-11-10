// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// RepoWiki 共享屏注入面锁。
//
// ① 空列表 ⇒ 空态;② 加载中 ⇒ loadingDocs;③ 加载按钮 ⇒ onLoad;
// ④ 仓库名为空不加载(阴性对照) ⑤ 查看 ⇒ onLoadDoc(id) + 正文可见;
// ⑥ 宿主注入 renderDetail(web Markdown)收到正文;⑦ 删除确认取消 ⇒ onDelete 不调用(阴性对照);
// ⑧ 删除确认通过 ⇒ onDelete(id);⑨ 删除失败 ⇒ 错误可见;⑩ 下拉刷新 ⇒ onLoad(阴性对照:详情态不挂刷新)。

import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RepoWikiScreen,
  type RepoWikiDocView,
} from '../src/features/repo-wiki/RepoWikiScreen'

vi.mock('react-native', () => ({
  View: (p: { children?: unknown }) => createElement('div', null, p.children as never),
  Text: (p: { children?: unknown }) => createElement('span', null, p.children as never),
  ScrollView: (p: { children?: unknown; refreshControl?: unknown }) =>
    createElement('div', null, p.refreshControl as never, p.children as never),
  RefreshControl: (p: { onRefresh?: () => void }) =>
    createElement('button', { 'data-refresh': '', onClick: p.onRefresh }, 'refresh-control'),
  TextInput: (p: { children?: unknown }) => createElement('input', null, p.children as never),
  ActivityIndicator: () => createElement('i', { 'data-spinner': '' }),
  TouchableOpacity: (p: { children?: unknown; onPress?: () => void; disabled?: boolean }) =>
    createElement('button', { disabled: p.disabled, onClick: p.onPress }, p.children as never),
  StyleSheet: { create: (o: unknown) => o },
}))

vi.mock('lucide-react-native', () => ({
  Eye: () => createElement('i', { 'data-icon': 'eye' }),
  RefreshCw: () => createElement('i', { 'data-icon': 'refresh' }),
  Trash2: () => createElement('i', { 'data-icon': 'trash' }),
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

const baseDoc: RepoWikiDocView = {
  id: 'd1',
  title: '仓库总览',
  kind: 'overview',
  modulePath: 'packages/app',
  model: 'gpt-4o-mini',
  fileCount: 12,
  generatedAt: '2026-11-01T00:00:00Z',
}

function renderScreen(over: Record<string, unknown> = {}) {
  const props = {
    t,
    colorScheme: 'light' as const,
    repoName: '',
    onChangeRepoName: vi.fn(),
    docs: [] as RepoWikiDocView[],
    loading: false,
    error: null as string | null,
    formatDate: (iso: string) => iso.slice(0, 10),
    onLoad: vi.fn(async () => undefined),
    onLoadDoc: vi.fn(async () => '# 正文'),
    onDelete: vi.fn(async () => undefined),
    onConfirm: vi.fn(async () => true),
    ...over,
  }
  render(createElement(RepoWikiScreen, props as never))
  return props
}

afterEach(cleanup)

describe('RepoWikiScreen', () => {
  it('空列表渲染空态', () => {
    renderScreen()
    expect(screen.getByText('repoWiki.emptyList')).toBeTruthy()
  })

  it('加载中且无数据时显示 loadingDocs', () => {
    renderScreen({ loading: true })
    expect(screen.getByText('repoWiki.loadingDocs')).toBeTruthy()
  })

  it('输入仓库名后加载:onLoad 被调用', async () => {
    const props = renderScreen({ repoName: 'ihui' })
    await act(async () => {
      fireEvent.click(screen.getByText('repoWiki.searchBtn'))
    })
    await waitFor(() => expect(props.onLoad).toHaveBeenCalledTimes(1))
  })

  it('仓库名为空不加载(阴性对照)', async () => {
    const props = renderScreen()
    await act(async () => {
      fireEvent.click(screen.getByText('repoWiki.searchBtn'))
    })
    expect(props.onLoad).not.toHaveBeenCalled()
    expect(screen.getByText('repoWiki.needRepoName')).toBeTruthy()
  })

  it('查看文档:onLoadDoc 收到 id,正文可见', async () => {
    const props = renderScreen({ docs: [baseDoc], repoName: 'ihui' })
    await act(async () => {
      fireEvent.click(screen.getByText('repoWiki.view'))
    })
    await waitFor(() => expect(props.onLoadDoc).toHaveBeenCalledWith('d1'))
    expect(await screen.findByText('# 正文')).toBeTruthy()
  })

  it('宿主注入 renderDetail 时由宿主渲染正文(web Markdown 路径)', async () => {
    const seen: string[] = []
    renderScreen({
      docs: [baseDoc],
      repoName: 'ihui',
      renderDetail: (content: string) => {
        seen.push(content)
        return createElement('article', { 'data-detail': '' }, content)
      },
    })
    await act(async () => {
      fireEvent.click(screen.getByText('repoWiki.view'))
    })
    await waitFor(() => expect(seen).toEqual(['# 正文']))
    expect(document.querySelector('[data-detail]')).toBeTruthy()
  })

  it('列表行同时展示 modulePath / 生成时间 / 文件数与 model', () => {
    renderScreen({ docs: [baseDoc], repoName: 'ihui' })
    expect(screen.getByText('packages/app')).toBeTruthy()
    expect(
      screen.getByText(
        'repoWiki.generatedAt:{"time":"2026-11-01"} · repoWiki.fileCount:{"count":12} · gpt-4o-mini',
      ),
    ).toBeTruthy()
  })

  it('删除确认取消:onDelete 不被调用(阴性对照)', async () => {
    const props = renderScreen({
      docs: [baseDoc],
      repoName: 'ihui',
      onConfirm: vi.fn(async () => false),
    })
    await act(async () => {
      fireEvent.click(screen.getByText('repoWiki.delete'))
    })
    expect(props.onConfirm).toHaveBeenCalledTimes(1)
    expect(props.onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ destructive: true, message: '仓库总览' }),
    )
    expect(props.onDelete).not.toHaveBeenCalled()
  })

  it('删除确认通过:onDelete 被调用', async () => {
    const props = renderScreen({ docs: [baseDoc], repoName: 'ihui' })
    await act(async () => {
      fireEvent.click(screen.getByText('repoWiki.delete'))
    })
    await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith('d1'))
  })

  it('删除失败:错误可见', async () => {
    const onDelete = vi.fn(async () => {
      throw new Error('后端 500')
    })
    renderScreen({ docs: [baseDoc], repoName: 'ihui', onDelete })
    await act(async () => {
      fireEvent.click(screen.getByText('repoWiki.delete'))
    })
    await waitFor(() => expect(screen.getByText('后端 500')).toBeTruthy())
  })

  it('详情态返回列表', async () => {
    renderScreen({ docs: [baseDoc], repoName: 'ihui' })
    await act(async () => {
      fireEvent.click(screen.getByText('repoWiki.view'))
    })
    await waitFor(() => expect(screen.getByText('repoWiki.backToList')).toBeTruthy())
    await act(async () => {
      fireEvent.click(screen.getByText('repoWiki.backToList'))
    })
    expect(screen.getByText('repoWiki.listTitle')).toBeTruthy()
  })

  it('下拉刷新触发 onLoad;详情态不挂刷新', async () => {
    const props = renderScreen({ docs: [baseDoc], repoName: 'ihui' })
    const refresh = document.querySelector('[data-refresh]') as HTMLElement
    await act(async () => {
      fireEvent.click(refresh)
    })
    await waitFor(() => expect(props.onLoad).toHaveBeenCalledTimes(1))
    await act(async () => {
      fireEvent.click(screen.getByText('repoWiki.view'))
    })
    await waitFor(() => expect(screen.getByText('repoWiki.backToList')).toBeTruthy())
    expect(document.querySelector('[data-refresh]')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
