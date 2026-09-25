// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'

/**
 * D17 生态统一入口 — 顶栏那一半的回归测试(2026-09-25)
 *
 * 钉死四件事:
 * 1. 装车:顶栏真的渲染了「生态市场」单入口(不是只写了子组件);
 * 2. 收敛:Plus 九宫格里 5 个并列市场入口已摘掉,菜单项 12 → 7;
 * 3. 老 URL 一律继续可达:弹层内 5 条直达 href 与聚合页 href 逐条断言;
 * 4. 无障碍:trigger 的 aria-label 脱离上下文成立(含入口名 + 直达项名),
 *    且**不得直出键名**(守门 74 口径),开合状态由 aria-expanded 可断言。
 */

// ── Mock:next/link 渲染成真实 a 标签(断言 href 需要,且避免 RSC 边界) ──
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    className,
    role,
    'aria-label': ariaLabel,
    'data-testid': testId,
    onClick,
  }: {
    children: React.ReactNode
    href: string
    className?: string
    role?: string
    'aria-label'?: string
    'data-testid'?: string
    onClick?: React.MouseEventHandler<HTMLAnchorElement>
  }) => (
    <a
      href={href}
      className={className}
      role={role}
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={onClick}
    >
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => null,
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

// ── Mock:next-intl(词包本轮冻结,测试自备已存在键的最小对照表) ──────────
// 表里的键全部来自 packages/i18n/messages/web/zh-CN.json 的**既有**键与既有值,
// 取不到时回传 key 本身 —— 于是"代码引用了不存在的新键"会以直出键名形态被断言抓住。
const { MESSAGES, mockLocale } = vi.hoisted(() => ({
  MESSAGES: {
    nav: {
      ecosystemHub: '生态市场',
      minimize: '最小化',
      maximize: '最大化',
      close: '关闭',
    },
    ecosystem: {
      marketsSection: '能力市场',
      cards: {
        aiSkills: { title: 'AI 技能' },
        mcpStore: { title: 'MCP 商店' },
        capabilityMarket: { title: '能力市场' },
        skillsMarket: { title: 'Skill 市场' },
        connectors: { title: '中文连接器' },
      },
    },
    ide: {
      topBar: {
        plus: '添加视图',
        document: '文档',
        browser: '内置浏览器',
        editor: '编辑器',
        terminal: '终端',
        codeChanges: '代码变更',
        agent: '智能体',
        mcp: 'MCP',
      },
      viewSwitcher: { searchPlaceholder: '搜索', noMatch: '无匹配' },
    },
    common: { back: '返回' },
  } as Record<string, Record<string, unknown>>,
  mockLocale: { value: 'zh-CN' },
}))

vi.mock('next-intl', () => ({
  useLocale: () => mockLocale.value,
  useTranslations: (namespace: string) => {
    const resolve = (key: string): string => {
      const segments = key.split('.')
      let cursor: unknown = MESSAGES[namespace]
      for (const segment of segments) {
        if (typeof cursor !== 'object' || cursor === null) return `${namespace}.${key}`
        cursor = (cursor as Record<string, unknown>)[segment]
      }
      return typeof cursor === 'string' ? cursor : `${namespace}.${key}`
    }
    return resolve
  },
}))

// ── Mock:重依赖(标签栏 / Tauri / 模态压暗观察器),与本票判据无关 ──
vi.mock('../TagsView', () => ({
  TagsView: () => <div data-testid="tags-view" />,
  TagsViewSearchButton: () => <button type="button" data-topbar-search-btn aria-label="搜索" />,
  TagsViewChevronButton: () => null,
}))

vi.mock('@/hooks/use-desktop', () => ({ useDesktop: () => ({ isDesktop: false }) }))

vi.mock('@/lib/tauri-bridge', () => ({
  minimizeWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
  startResize: vi.fn(),
  onMaximizeChange: () => () => {},
  onWindowFocusChange: () => () => {},
  isWindowFocused: () => Promise.resolve(true),
}))

vi.mock('@/lib/modal-overlay-watcher', () => ({
  getModalDimState: () => ({ active: false, color: null }),
  subscribeModalDim: () => () => {},
}))

vi.mock('@/stores/navigation', () => ({ useNavigateWithProgress: () => vi.fn() }))

// Tooltip 只渲染 children(避免 Radix;本票断言的是 aria-label,不是提示气泡)
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { GlobalTopBar } from '../GlobalTopBar'

const MARKET_HREFS = [
  '/ai-skills',
  '/mcp-store',
  '/capability-market',
  '/skills-market',
  '/connectors',
] as const

function trigger(): HTMLElement {
  const el = screen.getByRole('button', { name: /生态市场/ })
  return el as HTMLElement
}

function ecosystemPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="global-topbar-ecosystem-menu"]')
}

function plusPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="global-topbar-plus-menu"]')
}

describe('GlobalTopBar / 生态市场单入口(D17)', () => {
  beforeEach(() => {
    mockLocale.value = 'zh-CN'
  })

  afterEach(() => {
    cleanup()
  })

  it('装车:顶栏渲染 1 个生态市场入口,初始为闭合态', () => {
    render(<GlobalTopBar />)
    expect(trigger()).toBeTruthy()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger().getAttribute('data-state')).toBe('closed')
    expect(ecosystemPanel()).toBeNull()
  })

  it('点击拉开弹层:开合状态可断言(aria-expanded + data-state + 面板节点)', () => {
    render(<GlobalTopBar />)
    fireEvent.click(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(trigger().getAttribute('data-state')).toBe('open')
    const panel = ecosystemPanel()
    expect(panel).not.toBeNull()
    expect(panel?.getAttribute('role')).toBe('menu')
    // 首项 = 聚合页 + 5 条分组直达 = 6 项
    expect(panel?.querySelectorAll('[role="menuitem"]')).toHaveLength(6)
  })

  it('Esc 关闭(PortalPanel 统一关闭逻辑,不另起第二套实现)', () => {
    render(<GlobalTopBar />)
    fireEvent.click(trigger())
    expect(ecosystemPanel()).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(ecosystemPanel()).toBeNull()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('老 URL 一律继续可达:弹层含 /ecosystem 聚合页与 5 条直达 href', () => {
    render(<GlobalTopBar />)
    fireEvent.click(trigger())
    const panel = ecosystemPanel()
    expect(panel?.querySelector('a[href="/ecosystem"]')).not.toBeNull()
    for (const href of MARKET_HREFS) {
      expect(panel?.querySelector(`a[href="${href}"]`)).not.toBeNull()
    }
    // 直达项文案走既有键 ecosystem.cards.*.title(不得直出键名)
    const labels = Array.from(panel?.querySelectorAll('[role="menuitem"]') ?? []).map(
      (item) => item.textContent ?? '',
    )
    expect(labels.join('|')).toContain('MCP 商店')
    expect(labels.join('|')).toContain('中文连接器')
    expect(labels.join('|')).not.toContain('cards.')
  })

  it('收敛:Plus 九宫格不再有 5 个并列市场入口(12 项 → 7 项)', () => {
    render(<GlobalTopBar />)
    fireEvent.click(screen.getByRole('button', { name: '添加视图' }))
    const panel = plusPanel()
    expect(panel).not.toBeNull()
    expect(panel?.querySelectorAll('[role="menuitem"]')).toHaveLength(7)
    for (const href of MARKET_HREFS) {
      expect(panel?.querySelector(`a[href="${href}"]`)).toBeNull()
    }
    const text = panel?.textContent ?? ''
    expect(text).not.toContain('MCP 商店')
    expect(text).not.toContain('中文连接器')
  })

  it('无障碍:入口 aria-label 脱离上下文成立(入口名 + 5 个直达项名)', () => {
    render(<GlobalTopBar />)
    const label = trigger().getAttribute('aria-label') ?? ''
    expect(label).toContain('生态市场')
    for (const name of ['AI 技能', 'MCP 商店', '能力市场', 'Skill 市场', '中文连接器']) {
      expect(label).toContain(name)
    }
    // 不得直出词包键名(守门 74 口径)
    expect(label).not.toContain('ecosystemHub')
    expect(label).not.toContain('ecosystem.')
  })

  it('侧栏入口与顶栏入口指向同一聚合页(收敛不新增路由)', () => {
    render(<GlobalTopBar />)
    fireEvent.click(trigger())
    const hub = ecosystemPanel()?.querySelector<HTMLAnchorElement>('a[href="/ecosystem"]')
    expect(hub?.getAttribute('href')).toBe('/ecosystem')
    // 顶栏不再有任何指向 5 个市场页的平行入口(弹层收起时)
    cleanup()
    render(<GlobalTopBar />)
    for (const href of MARKET_HREFS) {
      expect(document.querySelector(`header a[href="${href}"], a[href="${href}"]`)).toBeNull()
    }
  })

  it('真实词包对账:本票用到的键在 5 语 messages 里逐条可解析(零新增键)', () => {
    // 上面所有断言用的是 mock 表;这一条直读 packages/i18n/messages/web/*.json,
    // 证明代码引用的键**在真包里存在且五语齐全**(本轮词包冻结,不得为顶栏改动新增键)。
    const messagesRoot = resolve(
      fileURLToPath(import.meta.url),
      '../../../../../../../packages/i18n/messages/web',
    )
    /** 先落到命名空间对象,再按点号路径取叶子字符串;任一层缺失/非字符串 → 空串 */
    const lookup = (messages: Record<string, unknown>, ns: string, key: string): string => {
      let cursor: unknown = messages[ns]
      for (const segment of key.split('.')) {
        if (typeof cursor !== 'object' || cursor === null) return ''
        cursor = (cursor as Record<string, unknown>)[segment]
      }
      return typeof cursor === 'string' ? cursor : ''
    }

    // 本票代码实际用到的取词点(命名空间 + 键),与 GlobalTopBar.tsx 逐字对应
    const usedKeys: ReadonlyArray<{ ns: 'nav' | 'ecosystem'; key: string }> = [
      { ns: 'nav', key: 'ecosystemHub' },
      { ns: 'ecosystem', key: 'marketsSection' },
      ...['aiSkills', 'mcpStore', 'capabilityMarket', 'skillsMarket', 'connectors'].map((key) => ({
        ns: 'ecosystem' as const,
        key: `cards.${key}.title`,
      })),
    ]
    for (const locale of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']) {
      const messages = JSON.parse(
        readFileSync(resolve(messagesRoot, `${locale}.json`), 'utf8'),
      ) as Record<string, unknown>
      for (const { ns, key } of usedKeys) {
        const value = lookup(messages, ns, key)
        expect(value, `${locale} 缺键 ${ns}.${key}`).toBeTruthy()
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
