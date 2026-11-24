// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-Forge 变更请求面板:只断言**状态判据与动作**,文案一律走 key(由 i18n parity 守)。

import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChangeRequestSnapshot } from '@ihui/types'

const h = vi.hoisted(() => ({
  workspace: { path: '/repo', name: 'repo' } as { path: string; name: string } | null,
  entry: undefined as
    | {
        snapshot: ChangeRequestSnapshot | null
        loading: boolean
        error: string | null
        lastFetchedAt: number | null
      }
    | undefined,
  fetch: vi.fn(async () => {}),
  createPr: vi.fn(async () => ({ success: true as const, data: {} })),
}))

const translate = (ns: string) => (key: string, values?: Record<string, unknown>) =>
  values ? `${ns}.${key}(${JSON.stringify(values)})` : `${ns}.${key}`
vi.mock('next-intl', () => ({ useTranslations: (ns: string) => translate(ns) }))

vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: (sel: (s: { activeWorkspace: typeof h.workspace }) => unknown) =>
    sel({ activeWorkspace: h.workspace }),
}))
vi.mock('@/stores/environment-info', () => ({
  useEnvironmentInfoStore: (sel: (s: { openGithubConfig: () => void }) => unknown) =>
    sel({ openGithubConfig: vi.fn() }),
}))
vi.mock('@/stores/change-requests', () => ({
  useChangeRequestsStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ byWorkspace: h.workspace ? { [h.workspace.path]: h.entry } : {}, fetch: h.fetch }),
  startChangeRequestPolling: () => () => {},
}))
vi.mock('@ihui/api-client', () => ({
  createGithubPullRequest: h.createPr,
}))
vi.mock('@/components/common', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const { ChangeRequestPanel, humanizeBranchName } = await import('../change-request-panel')

const snapshot = (over: Partial<ChangeRequestSnapshot> = {}): ChangeRequestSnapshot => ({
  provider: 'github',
  supported: true,
  unsupportedReason: null,
  repo: { owner: 'acme', repo: 'demo' },
  currentBranch: 'feat/demo',
  defaultBranch: 'main',
  credentialsReady: true,
  fetchFailed: false,
  items: [],
  fetchedAt: '2026-11-13T00:00:00.000Z',
  ...over,
})

const item = (over: Record<string, unknown> = {}) => ({
  number: 12,
  title: 'feat: demo',
  url: 'https://github.com/acme/demo/pull/12',
  state: 'open' as const,
  draft: false,
  author: 'alice',
  headBranch: 'feat/demo',
  baseBranch: 'main',
  updatedAt: '2026-11-12T00:00:00Z',
  isCurrentBranch: false,
  checks: null,
  ...over,
})

const q = (container: HTMLElement, sel: string) => container.querySelector(sel)

beforeEach(() => {
  h.workspace = { path: '/repo', name: 'repo' }
  h.entry = { snapshot: snapshot(), loading: false, error: null, lastFetchedAt: Date.now() }
  h.fetch.mockClear()
  h.createPr.mockClear()
})

describe('change-request-panel / 六态', () => {
  it('无工作区 → 中性提示,不渲染列表', () => {
    h.workspace = null
    const { container } = render(<ChangeRequestPanel />)
    expect(q(container, '[data-testid="change-request-state-no-workspace"]')).toBeTruthy()
  })

  it('平台不支持 → unsupported(不谎报空列表)', () => {
    h.entry = {
      snapshot: snapshot({ supported: false, unsupportedReason: 'provider-unsupported' }),
      loading: false,
      error: null,
      lastFetchedAt: Date.now(),
    }
    const { container } = render(<ChangeRequestPanel />)
    expect(q(container, '[data-testid="change-request-state-unsupported"]')).toBeTruthy()
    expect(q(container, '[data-testid="change-request-state-empty"]')).toBeNull()
  })

  it('未连接凭据 → 给「连接 GitHub」动作,不给空态', () => {
    h.entry = {
      snapshot: snapshot({ credentialsReady: false, unsupportedReason: 'credentials-missing' }),
      loading: false,
      error: null,
      lastFetchedAt: Date.now(),
    }
    const { container } = render(<ChangeRequestPanel />)
    expect(q(container, '[data-testid="change-request-state-credentials-missing"]')).toBeTruthy()
    expect(q(container, '[data-testid="change-request-state-empty"]')).toBeNull()
  })

  it('列表失败 → fetch-failed + 重试(与 0 条严格区分)', () => {
    h.entry = {
      snapshot: snapshot({ fetchFailed: true }),
      loading: false,
      error: null,
      lastFetchedAt: Date.now(),
    }
    const { container } = render(<ChangeRequestPanel />)
    expect(q(container, '[data-testid="change-request-state-fetch-failed"]')).toBeTruthy()
  })

  it('0 条 → empty(中性)', () => {
    const { container } = render(<ChangeRequestPanel />)
    expect(q(container, '[data-testid="change-request-state-empty"]')).toBeTruthy()
  })
})

describe('change-request-panel / 列表与创建', () => {
  it('渲染条目、当前分支徽标与 CI 汇总', () => {
    h.entry = {
      snapshot: snapshot({
        items: [
          item({
            number: 7,
            isCurrentBranch: true,
            checks: { summary: 'failing', passed: 1, failed: 1, total: 2 },
          }),
        ],
      }),
      loading: false,
      error: null,
      lastFetchedAt: Date.now(),
    }
    const { container } = render(<ChangeRequestPanel />)
    expect(q(container, '[data-testid="change-request-item-7"]')).toBeTruthy()
    expect(q(container, '[data-testid="change-request-current-7"]')).toBeTruthy()
    expect(q(container, '[data-check-summary="failing"]')).toBeTruthy()
  })

  it('当前分支无 PR + 凭据就绪 → 显示创建;点击按当前分支/默认分支发起', () => {
    const { container } = render(<ChangeRequestPanel />)
    const button = q(container, '[data-testid="change-request-create"]') as HTMLButtonElement
    expect(button).toBeTruthy()
    fireEvent.click(button)
    expect(h.createPr).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'demo',
      title: 'demo',
      head: 'feat/demo',
      base: 'main',
    })
  })

  it('当前分支已有 PR → 不显示创建入口', () => {
    h.entry = {
      snapshot: snapshot({ items: [item({ isCurrentBranch: true })] }),
      loading: false,
      error: null,
      lastFetchedAt: Date.now(),
    }
    const { container } = render(<ChangeRequestPanel />)
    expect(q(container, '[data-testid="change-request-create"]')).toBeNull()
  })
})

describe('change-request-panel / 分支标题', () => {
  it('humanizeBranchName 取末段并把连字符/下划线转空格', () => {
    expect(humanizeBranchName('feat/change-request-panel')).toBe('change request panel')
    expect(humanizeBranchName('fix_bug_123')).toBe('fix bug 123')
    expect(humanizeBranchName('main')).toBe('main')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
