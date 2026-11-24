// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup } from '@testing-library/react'

/**
 * CategoryShell 外观重做回归锁(2026-11-16,用户要求「子功能页好好设计设计美化一下」)
 *
 * 四条判据,各钉一件事:
 *  ① 单 H1 语义不得被美化顺带破坏(e2e docs-slug-404 的单元层前置):
 *     默认容器标题 = 全页唯一 <h1>;contentOwnsH1=true 时容器内必须零 <h1>。
 *  ② 激活态必须走品牌 CTA 同源令牌(bg-cta + text-cta-foreground,AGENTS.md §4),
 *     且父项不得被子路径带高亮(原 isItemActive 口径)。
 *  ③ 图标/标题档位必须来自 workspace-tokens 单一真相源 —— 谁把字面量抄回 JSX,
 *     这一条就地红(测试只 import 源常量比对接线,不复制档位字符串,§0.6)。
 *  ④ 移动端抽屉触发器(mounted 后才渲染,e2e desktop-window-controls-dim 的
 *     aria-label="打开导航菜单" 锁)在单元层先钉住存在性。
 */

// next/link → 真实 <a>,任意 prop 透传(aria-current 要能在 DOM 上判)
vi.mock('next/link', () => ({
  __esModule: true,
  default: (props: {
    children: React.ReactNode
    href?: string
    className?: string
    'aria-current'?: 'page' | boolean
    'data-testid'?: string
    onClick?: React.MouseEventHandler<HTMLAnchorElement>
  }) => (
    <a
      href={props.href}
      className={props.className}
      aria-current={props['aria-current']}
      data-testid={props['data-testid']}
      onClick={props.onClick}
    >
      {props.children}
    </a>
  ),
}))

// pathname 经 globalThis 中转,规避 vi.mock 工厂提升时的初始化顺序问题
vi.mock('next/navigation', () => ({
  usePathname: () => (globalThis as { __shellPath?: string }).__shellPath ?? '/',
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh',
}))

// Radix Sheet 三件套换透传:触发器常挂,抽屉内容关闭态不渲染(与真实行为一致,
// 也让测试里的链接计数只算桌面侧栏一份)。
vi.mock('@ihui/ui-react', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: () => null,
}))

import { CategoryShell, SHELL_TOKENS } from '../CategoryShell'
import { HERO_SURFACE, ICON_BRICK, ICON_GLYPH, PAGE_TITLE, SECTION_DOT } from '../workspace-tokens'

const DummyIcon = ({ className }: { className?: string }) => (
  <i data-testid="icon" className={className} />
)

afterEach(() => {
  cleanup()
  ;(globalThis as { __shellPath?: string }).__shellPath = undefined
})

const navGroups = [
  {
    label: '账户',
    items: [
      { href: '/settings', label: '总览', icon: DummyIcon },
      { href: '/settings/llm', label: '模型', icon: DummyIcon },
    ],
  },
  {
    label: '系统',
    items: [{ href: '/settings/mail', label: '邮件', icon: DummyIcon }],
  },
]

function shell(overrides: Partial<React.ComponentProps<typeof CategoryShell>> = {}) {
  return render(
    <CategoryShell
      title="设置"
      description="站点设置模块"
      icon={DummyIcon}
      navGroups={navGroups}
      {...overrides}
    >
      <div>content</div>
    </CategoryShell>,
  )
}

describe('CategoryShell 外观回归锁', () => {
  it('① 默认容器标题是唯一的 h1;contentOwnsH1=true 时容器零 h1', () => {
    const { container, unmount } = shell()
    const h1 = container.querySelectorAll('h1')
    expect(h1).toHaveLength(1)
    expect(h1[0]?.textContent).toBe('设置')
    unmount()

    const second = shell({ contentOwnsH1: true })
    expect(second.container.querySelector('h1')).toBeNull()
    expect(second.getByText('设置').tagName).toBe('P')
  })

  it('② 激活项走 CTA 令牌;子路径匹配语义保持原口径(精确项 + 父项子树都算激活,旁支不激活)', () => {
    ;(globalThis as { __shellPath?: string }).__shellPath = '/settings/llm'
    const { container } = shell()
    // 按 href 定位,不按文案 —— 页头的「移动端当前项指示」也会渲染激活项文案,
    // getByText 会撞双节点(这是既有行为,测试不与它耦合)。
    const link = (href: string) => container.querySelector(`a[href="${href}"]`) as HTMLAnchorElement
    const exact = link('/settings/llm')
    const parent = link('/settings')
    const sibling = link('/settings/mail')
    expect(exact.className).toContain('bg-cta')
    expect(exact.className).toContain('text-cta-foreground')
    expect(exact.getAttribute('aria-current')).toBe('page')
    // 原 isItemActive 口径:pathname.startsWith(href + '/') 同样命中父项(/settings 的子页在 /settings 下)
    expect(parent.getAttribute('aria-current')).toBe('page')
    expect(sibling.className).not.toContain('bg-cta')
    expect(sibling.getAttribute('aria-current')).toBeNull()
  })

  it('③ 头部图标砖/导航项图标/页标题档位必须来自 workspace-tokens(字面量回潮即红)', () => {
    const { container } = shell()
    // 接线锁:令牌组合必须以共享常量为前缀,而非各自重写一档
    expect(SHELL_TOKENS.headIcon.startsWith(ICON_BRICK)).toBe(true)
    expect(SHELL_TOKENS.itemIcon.startsWith(ICON_GLYPH)).toBe(true)
    expect(SHELL_TOKENS.title).toBe(PAGE_TITLE)
    expect(SHELL_TOKENS.headCard.startsWith(HERO_SURFACE)).toBe(true)
    expect(SHELL_TOKENS.groupDot).toBe(SECTION_DOT)
    // 落盘锁:导航项图标字形渲染出统一 16 档
    const itemIcons = Array.from(container.querySelectorAll('a [data-testid="icon"]'))
    expect(itemIcons.length).toBeGreaterThan(0)
    for (const icon of itemIcons) {
      expect((icon as HTMLElement).className).toBe(SHELL_TOKENS.itemIcon)
    }
  })

  it('④ 客户端挂载后渲染移动端抽屉触发器(aria-label=openNavMenu)', () => {
    const { getByLabelText } = shell()
    // mounted 由 useEffect 翻转,RTL render 已冲刷效果;触发器必须存在
    expect(getByLabelText('openNavMenu').tagName).toBe('BUTTON')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
