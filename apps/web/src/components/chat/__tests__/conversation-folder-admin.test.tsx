// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D165 分组管理面板的文案分派用例。
// 为什么 mock 成 `ns.key` 而不是真翻译:本用例要证的是**"哪一类失败说哪一句话"这张映射表**,
// 而不是词条本身(词条由 i18n parity 门与语言纯度门管)。
// 真翻译会把"401 说成重新登录"这件事变成一次字符串比对 —— 上游词条一改就红、而映射写错却可能不红。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string, values?: Record<string, unknown>) =>
      values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) =>
    sel({ user: { id: 'u1' } }),
}))

const store = vi.hoisted(() => ({ current: null as unknown }))

// 两个 store 都替换成"读同一份手写状态"的 shim:被测对象是**映射与渲染分支**,
// 不是 zustand 自身;真 store 走网络 mock 反而会把要证的失败分支挡在门外。
vi.mock('@/stores/conversation-org-server', () => ({
  useOrgServerStore: Object.assign(
    (sel: (s: Record<string, unknown>) => unknown) => sel(store.current as Record<string, unknown>),
    { getState: () => store.current },
  ),
}))

vi.mock('@/stores/conversation-org', () => ({
  useOrgSyncState: () => {
    const s = store.current as { ready: boolean; loading: boolean; lastError: string | null }
    if (s.ready) return { state: 'synced', reason: null }
    if (s.loading) return { state: 'syncing', reason: null }
    if (s.lastError) return { state: 'failed', reason: s.lastError }
    return { state: 'local-only', reason: null }
  },
}))

import ConversationFolderAdmin from '../conversation-folder-admin'

function setState(over: Record<string, unknown>) {
  store.current = {
    userId: 'u1',
    folders: [],
    membership: {},
    ready: true,
    loading: false,
    lastError: null,
    refresh: vi.fn(),
    reloadFolders: vi.fn(),
    assign: vi.fn(),
    assignMany: vi.fn(),
    renameFolder: vi.fn(),
    togglePinFolder: vi.fn().mockResolvedValue({ ok: true }),
    deleteFolder: vi.fn().mockResolvedValue({ ok: true }),
    ...over,
  }
}

describe('ConversationFolderAdmin', () => {
  beforeEach(() => setState({}))
  // 本仓 web 测试配置未开全局自动 cleanup:同文件内多次 render 会把上一次的 DOM 留在文档里,
  // 于是 getByTestId 命中多个。症状是"用例互相污染",不是组件的重渲染缺陷。
  afterEach(() => cleanup())

  it('A1 未同步时不得渲染出"分组清单为空",而是给待同步提示 —— 两者在数据上同形、在用户心里不同形', () => {
    setState({ ready: false, lastError: null })
    render(<ConversationFolderAdmin />)
    expect(screen.getByTestId('org-admin-notice').textContent).toBe('aiChat.org.adminPending')
    expect(screen.queryByTestId('org-admin')).toBeNull()
  })

  it('A2 同步失败要按 reason 给对应那一句话,并提供重试出口', () => {
    setState({ ready: false, loading: false, lastError: 'unauthorized' })
    render(<ConversationFolderAdmin />)
    expect(screen.getByText('aiChat.org.reasonUnauthorized')).toBeTruthy()
    expect(screen.getByText('aiChat.org.retry')).toBeTruthy()
  })

  it('A3 七类 reason 各有独立词条键(并成一句就等于没分类)', () => {
    const keys = [
      'offline',
      'name-too-long',
      'duplicate-name',
      'not-found',
      'forbidden',
      'unauthorized',
      'server',
      'unknown',
    ]
    for (const r of keys) {
      setState({ ready: false, lastError: r })
      const { unmount } = render(<ConversationFolderAdmin />)
      expect(screen.getByTestId('org-admin-notice').textContent).toContain(
        'aiChat.org.reason' + r.replace(/(^|-)([a-z])/g, (_m, _s, c) => c.toUpperCase()),
      )
      unmount()
    }
  })

  it('A4 三个动作的入口都在,且置顶按钮的 aria 随当前态翻转(写死"置顶"会让已置顶的行看不出下一步)', async () => {
    setState({
      folders: [
        { id: 'g1', name: '工作', pinned: false, pinnedAt: null, conversationCount: 3 },
      ],
    })
    render(<ConversationFolderAdmin />)
    expect(screen.getByTestId('org-admin-pin-g1').getAttribute('aria-label')).toBe('aiChat.org.pinAria')
    expect(screen.getByTestId('org-admin-rename-g1')).toBeTruthy()
    expect(screen.getByTestId('org-admin-delete-g1')).toBeTruthy()
    expect(screen.getByTestId('org-admin-row-g1').textContent).toContain(
      'aiChat.org.folderCount:{"count":3}',
    )
    setState({
      folders: [{ id: 'g1', name: '工作', pinned: true, pinnedAt: '2026-10-01', conversationCount: 3 }],
    })
    cleanup()
    render(<ConversationFolderAdmin />)
    expect(screen.getByTestId('org-admin-pin-g1').getAttribute('aria-label')).toBe('aiChat.org.unpinAria')
  })

  it('A5 点删除失败 ⇒ 只有那一行显示原因,其余行不受影响(全局一条 error 会盖掉别的成功)', async () => {
    const deleteFolder = vi.fn().mockResolvedValue({ ok: false, reason: 'forbidden' })
    setState({
      folders: [
        { id: 'g1', name: '工作', pinned: false, pinnedAt: null, conversationCount: 1 },
        { id: 'g2', name: '生活', pinned: false, pinnedAt: null, conversationCount: 2 },
      ],
      deleteFolder,
    })
    render(<ConversationFolderAdmin />)
    fireEvent.click(screen.getByTestId('org-admin-delete-g1'))
    await waitFor(() => expect(deleteFolder).toHaveBeenCalledWith('u1', 'g1'))
    const errs = await screen.findByTestId('org-admin-errors')
    expect(errs.textContent).toContain('工作')
    expect(errs.textContent).toContain('aiChat.org.reasonForbidden')
    expect(errs.textContent).not.toContain('生活')
  })

  it('A6 重命名提交走 renameFolder;取消与"没改名"都不发请求', async () => {
    const renameFolder = vi.fn().mockResolvedValue({ ok: true })
    setState({
      folders: [{ id: 'g1', name: '工作', pinned: false, pinnedAt: null, conversationCount: 1 }],
      renameFolder,
    })
    render(<ConversationFolderAdmin />)
    fireEvent.click(screen.getByTestId('org-admin-rename-g1'))
    const input = screen.getByTestId('org-admin-rename-input-g1') as HTMLInputElement
    fireEvent.change(input, { target: { value: '新名' } })
    fireEvent.click(screen.getByTestId('org-admin-rename-cancel-g1'))
    expect(renameFolder).not.toHaveBeenCalled()
    // 重新进入编辑态会把输入框重置成当前名 —— 此时直接保存不该发请求(名字没变)。
    fireEvent.click(screen.getByTestId('org-admin-rename-g1'))
    fireEvent.click(screen.getByTestId('org-admin-rename-save-g1'))
    expect(renameFolder).not.toHaveBeenCalled()
    // 保存即收起编辑态,再次改名要重新进入。
    fireEvent.click(screen.getByTestId('org-admin-rename-g1'))
    fireEvent.change(screen.getByTestId('org-admin-rename-input-g1'), { target: { value: '新名' } })
    fireEvent.click(screen.getByTestId('org-admin-rename-save-g1'))
    await waitFor(() => expect(renameFolder).toHaveBeenCalledWith('u1', 'g1', '新名'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
