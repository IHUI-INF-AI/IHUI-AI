// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D179 会话 Issue 绑定流 —— web 组件挂载级测试。
//
// 口径(仓内 compaction-status-bar.test.tsx 同源):不 mock next-intl,挂真的
// NextIntlClientProvider + 真词包 —— 空态文案/按钮文案的断言对象是真实键值,
// 不是测试替身自证(AGENTS §22c「镜像测试只复读实现就是复读机」)。
// api-client 全 mock(不真发请求);组件 import 放 vi.mock 之后。

import { execFileSync } from 'node:child_process'
import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, cleanup, fireEvent, waitFor, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSearchIssues, mockBindIssue, mockUnbindIssue, mockGetConversation } = vi.hoisted(() => ({
  mockSearchIssues: vi.fn(),
  mockBindIssue: vi.fn(),
  mockUnbindIssue: vi.fn(),
  mockGetConversation: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({
  // src/lib/api.ts 在模块顶层无条件调这 5 个 setter(同型见 src/lib/api.test.ts),依赖链
  // IssueBindDialog → @/lib/api 会拉到它。缺任一同名导出 ⇒ 模块求值即抛,整文件收集期红。
  setTokenProvider: vi.fn(),
  setBaseUrl: vi.fn(),
  setStreamBaseUrl: vi.fn(),
  setDeviceFingerprintProvider: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
  searchIssues: mockSearchIssues,
  bindIssue: mockBindIssue,
  unbindIssue: mockUnbindIssue,
  getConversation: mockGetConversation,
}))

import {
  IssueBindDialog,
  LinkedIssueBadge,
  LinkedIssueStrip,
  resolveIssueBinding,
} from '../issue-bind-dialog'

// D179 键经对象空间落进 HEAD blob(共享索引/工作树副本归属他人,不可当取材面);
// 取材面 = 当下 HEAD —— 落地后恒绿;若后来者把语言包写回旧版,这条测试当场翻红。
const messages = JSON.parse(
  execFileSync('git', ['show', 'HEAD:packages/i18n/messages/web/zh-CN.json'], {
    maxBuffer: 512 * 1024 * 1024,
    windowsHide: true,
    // 仓内已知环境故障(2026-09-30 根治):交互会话下 node→git 子进程 stdin 管道 EBUSY,
    // 凡不吃 stdin 的 git 调用一律 stdin='ignore'(与 scripts/git-* 同款修复形态)。
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString('utf8'),
) as Record<string, unknown>
const chatNs = messages.chat as Record<string, unknown>
/** 取 chat 域词包键:noUncheckedIndexedAccess 下索引访问是 string|undefined,
 *  缺键在这里大声炸掉(而不是让断言拿到 undefined 空转)。 */
function packKey(key: string): string {
  const value = chatNs[key]
  if (typeof value !== 'string') throw new Error(`词包缺键 chat.${key}`)
  return value
}

const CONV_ID = 'cccccccc-3333-4333-8333-333333333333'
const BINDING = {
  provider: 'github' as const,
  id: '42',
  title: '登录页样式漂移',
  url: 'https://github.com/org/repo/issues/42',
  boundAt: '2026-09-30T00:00:00.000Z',
}

function renderUi(ui: ReactNode): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="zh-CN" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )
}

const renderDialog = (over: Partial<Parameters<typeof IssueBindDialog>[0]> = {}): void =>
  renderUi(
    <IssueBindDialog
      conversationId={CONV_ID}
      open
      onOpenChange={() => {}}
      binding={null}
      {...over}
    />,
  )

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  // 本仓 vitest globals:false ⇒ RTL 自动 cleanup 不注册,必须手动清(仓内既有注释同因)
  cleanup()
})

describe('resolveIssueBinding(纯函数)', () => {
  it('合法形态解析出绑定;缺 url/未知 provider/非对象一律 null,不抛错', () => {
    expect(resolveIssueBinding({ issueBinding: BINDING })).toEqual(BINDING)
    expect(resolveIssueBinding({ issueBinding: { ...BINDING, url: '' } })).toBeNull()
    expect(resolveIssueBinding({ issueBinding: { ...BINDING, provider: 'jira' } })).toBeNull()
    expect(resolveIssueBinding({ issueBinding: 'x' })).toBeNull()
    expect(resolveIssueBinding(null)).toBeNull()
    expect(resolveIssueBinding(undefined)).toBeNull()
    expect(resolveIssueBinding(42)).toBeNull()
  })

  it('解绑后的 null 值(metadata.issueBinding:null)按未绑定处理', () => {
    expect(resolveIssueBinding({ issueBinding: null })).toBeNull()
  })
})

describe('IssueBindDialog — 空态三态与竞品文案', () => {
  it('未发起搜索:标题「绑定 Issue」+ 空态「还没有可以绑定的 Issue」(竞品 noIssues)', () => {
    renderDialog()
    expect(screen.getByText(packKey('bindIssue'))).toBeTruthy()
    expect(screen.getByText(packKey('noIssues'))).toBeTruthy()
  })

  it('provider 未配置:显示「该来源尚未配置 MCP Server」(searchIssues 返回 configured:false)', async () => {
    mockSearchIssues.mockResolvedValue({
      success: true,
      data: { provider: 'github', serverName: null, configured: false, error: null, items: [] },
    })
    renderDialog()
    // handleSearch 对空 query 直接 return:必须先填搜索词再点搜索(下两例同因)
    fireEvent.change(screen.getByTestId('issue-search-input'), { target: { value: 'login' } })
    fireEvent.click(screen.getByTestId('issue-search-submit'))
    await waitFor(() => expect(screen.getByText(packKey('issueNotConfigured'))).toBeTruthy())
  })

  it('搜索无匹配:显示「没有匹配的 Issue」(竞品 noMatchingIssues)', async () => {
    mockSearchIssues.mockResolvedValue({
      success: true,
      data: { provider: 'github', serverName: 'mcp:github', configured: true, error: null, items: [] },
    })
    renderDialog()
    fireEvent.change(screen.getByTestId('issue-search-input'), { target: { value: 'login' } })
    fireEvent.click(screen.getByTestId('issue-search-submit'))
    await waitFor(() => expect(screen.getByText(packKey('noMatchingIssues'))).toBeTruthy())
  })

  it('有结果:渲染条目,点击条目调 bindIssue 并带完整 issue 元数据', async () => {
    mockSearchIssues.mockResolvedValue({
      success: true,
      data: {
        provider: 'github',
        serverName: 'mcp:github',
        configured: true,
        error: null,
        items: [{ id: '42', title: '登录页样式漂移', url: BINDING.url, provider: 'github' }],
      },
    })
    mockBindIssue.mockResolvedValue({ success: true, data: { issueBinding: BINDING } })
    renderDialog()
    fireEvent.change(screen.getByTestId('issue-search-input'), { target: { value: '登录' } })
    fireEvent.click(screen.getByTestId('issue-search-submit'))
    await waitFor(() => expect(screen.getByTestId('issue-search-item-42')).toBeTruthy())
    fireEvent.click(screen.getByTestId('issue-search-item-42'))
    await waitFor(() => expect(mockBindIssue).toHaveBeenCalledTimes(1))
    expect(mockBindIssue).toHaveBeenCalledWith(
      CONV_ID,
      expect.objectContaining({ provider: 'github', id: '42', url: BINDING.url }),
    )
  })
})

describe('IssueBindDialog — 已绑定展示与解绑(竞品 unbindIssue「改为独立任务」)', () => {
  it('传入 binding:展示当前绑定 + 「改为独立任务」按钮,点击调 unbindIssue', async () => {
    mockUnbindIssue.mockResolvedValue({ success: true, data: { unbound: true } })
    renderDialog({ binding: BINDING })
    expect(screen.getByTestId('issue-bind-current').textContent).toContain(BINDING.title)
    const unbind = screen.getByTestId('issue-unbind-action')
    expect(unbind.textContent).toContain(packKey('unbindIssue'))
    fireEvent.click(unbind)
    await waitFor(() => expect(mockUnbindIssue).toHaveBeenCalledWith(CONV_ID))
  })

  it('解绑后绑定区就地消失(不等列表失效回填)', async () => {
    mockUnbindIssue.mockResolvedValue({ success: true, data: { unbound: true } })
    renderDialog({ binding: BINDING })
    fireEvent.click(screen.getByTestId('issue-unbind-action'))
    await waitFor(() => expect(screen.queryByTestId('issue-bind-current')).toBeNull())
  })
})

describe('LinkedIssueBadge / LinkedIssueStrip — 关联 Issue 展示(竞品 highlights.linkedIssue)', () => {
  it('徽章渲染绑定标题(非交互 chip)', () => {
    renderUi(<LinkedIssueBadge binding={BINDING} />)
    const badge = screen.getByTestId('conversation-linked-issue')
    expect(badge.textContent).toContain(BINDING.title)
  })

  it('监控条:跳转挂载为 <a href=url>,带「关联 Issue」标签;未绑定不渲染', async () => {
    mockGetConversation.mockResolvedValue({
      success: true,
      data: { conversation: { id: CONV_ID, metadata: { issueBinding: BINDING } } },
    })
    renderUi(<LinkedIssueStrip conversationId={CONV_ID} />)
    await waitFor(() => expect(screen.getByTestId('task-monitor-linked-issue')).toBeTruthy())
    const link = screen
      .getByTestId('task-monitor-linked-issue')
      .querySelector('a[href="' + BINDING.url + '"]')
    expect(link).not.toBeNull()
    expect(screen.getByText(packKey('issueBinding'))).toBeTruthy()
  })

  it('监控条:未绑定(metadata 无 issueBinding)整条不渲染', async () => {
    // stripQueryClient 是模块级单例:上一例同 queryKey 的绑定已在缓存,必须换会话 ID
    // 才是真·未取数,否则测的是缓存污染(实测上一例数据泄漏进本例致假红)。
    const otherConvId = 'dddddddd-4444-4444-8444-444444444444'
    mockGetConversation.mockResolvedValue({
      success: true,
      data: { conversation: { id: otherConvId, metadata: { workspacePath: '/repo' } } },
    })
    renderUi(<LinkedIssueStrip conversationId={otherConvId} />)
    await waitFor(() => expect(mockGetConversation).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('task-monitor-linked-issue')).toBeNull()
  })
})

describe('词包自检(D179 键五语言 parity 由 check-i18n-keys 守,此处锚定 zh-CN 本体)', () => {
  it('竞品六串在 zh-CN chat 域落地', () => {
    expect(packKey('issueBinding')).toBe('关联 Issue')
    expect(packKey('bindIssue')).toBe('绑定 Issue')
    expect(packKey('searchIssues')).toBe('搜索 Issue 标识、标题或项目')
    expect(packKey('unbindIssue')).toBe('改为独立任务')
    expect(packKey('noIssues')).toBe('还没有可以绑定的 Issue')
    expect(packKey('noMatchingIssues')).toBe('没有匹配的 Issue')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
