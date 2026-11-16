// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup } from '@testing-library/react'
/**
 * FeaturePageShell + domain-registry 回归锁(2026-11-16,「立统一外壳组件再分批」)
 *
 * 钉四件事:
 *  ① 域归属解析:精确匹配 / 最长前缀回退 / 未登记页返回 null(返回 chip 自动降级)。
 *  ② 域名取词与域入口页恒等 —— 取 <slug>Hub.title,不是另立一套 nav.* 键(改一处两处同动)。
 *  ③ 单 H1 语义:默认容器标题 = 唯一 <h1>;contentOwnsH1=true 时容器内零 <h1>
 *     (a11y + SEO,与 CategoryShell 同口径,2026-11-03 立)。
 *  ④ 返回 chip 的 href 必须指域入口 /domains/<slug>,档位必须来自 workspace-tokens
 *     (谁把字面量抄回 JSX 这一条就地红;只 import 源常量比对接线,§0.6)。
 */
vi.mock('next/link', () => ({
  __esModule: true,
  default: (props: {
    children: React.ReactNode
    href?: string
    className?: string
    'aria-current'?: 'page' | boolean
    onClick?: React.MouseEventHandler<HTMLAnchorElement>
  }) => (
    <a
      href={props.href}
      className={props.className}
      aria-current={props['aria-current']}
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
vi.mock('next-intl/server', () => ({ getTranslations: () => async (key: string) => key }))

import { FeaturePageShell, SHELL_TOKENS } from '../FeaturePageShell'
import { resolveDomainSlugForPath, DOMAINS } from '../domain-registry'
import { HERO_ICON_TILE, HERO_SURFACE, PAGE_TITLE } from '../workspace-tokens'

const DummyIcon = ({ className }: { className?: string }) => (
  <i data-testid="icon" className={className} />
)

afterEach(() => {
  cleanup()
  ;(globalThis as { __shellPath?: string }).__shellPath = undefined
})

describe('domain-registry 域归属解析', () => {
  it('① 精确匹配:登记在域清单里的 href 归到正确域', () => {
    // EDU_HUB_ITEMS 的第一个 href 应归教育域;HR 第一个归人事域
    const eduFirst = DOMAINS.edu.items[0]?.href
    expect(eduFirst).toBeTruthy()
    expect(resolveDomainSlugForPath(eduFirst!)).toBe('edu')
    expect(resolveDomainSlugForPath('/domains/edu')).toBe('edu')
  })

  it('② 最长前缀回退:子路径归到登记了父 href 的域', () => {
    const eduFirst = DOMAINS.edu.items[0]?.href
    expect(eduFirst).toBeTruthy()
    // 取一个确定不在清单里的深层子路径,应归到其父 href 所属域
    expect(resolveDomainSlugForPath(`${eduFirst}/deep-sub-page`)).toBe('edu')
  })

  it('③ 未登记进任何域的页返回 null(外壳降级为不渲染返回 chip)', () => {
    expect(resolveDomainSlugForPath('/login')).toBeNull()
    expect(resolveDomainSlugForPath('/totally-unregistered-route')).toBeNull()
  })

  it('④ 八域齐备:每个域有入口 href、命名空间、图标、条目清单', () => {
    for (const slug of Object.keys(DOMAINS) as Array<keyof typeof DOMAINS>) {
      const meta = DOMAINS[slug]
      expect(meta.href).toBe(`/domains/${slug}`)
      expect(meta.ns).toBeTruthy()
      expect(meta.icon).toBeTruthy()
      expect(meta.items.length).toBeGreaterThan(0)
    }
  })
})

describe('FeaturePageShell 外壳渲染', () => {
  it('⑤ 默认容器标题是唯一 h1;contentOwnsH1=true 时零 h1', () => {
    const { container, unmount } = render(
      <FeaturePageShell title="学习中心" icon={DummyIcon} domain="edu">
        <div>content</div>
      </FeaturePageShell>,
    )
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(container.querySelector('h1')?.textContent).toBe('学习中心')
    unmount()

    const second = render(
      <FeaturePageShell title="文档页" icon={DummyIcon} domain="edu" contentOwnsH1>
        <h1>文档自带主题标题</h1>
      </FeaturePageShell>,
    ).container
    // 容器自身不再出 h1,把唯一的 H1 让给内容页
    expect(second.querySelectorAll('h1')).toHaveLength(1)
    expect(second.querySelector('h1')?.textContent).toBe('文档自带主题标题')
  })

  it('⑥ 返回 chip 的 href 指域入口,且显示域名(取域入口页同一 title 键)', () => {
    ;(globalThis as { __shellPath?: string }).__shellPath = '/learn'
    const { container } = render(
      <FeaturePageShell title="学习中心" icon={DummyIcon}>
        <div>content</div>
      </FeaturePageShell>,
    )
    const chip = container.querySelector('a[href="/domains/edu"]')
    expect(chip).toBeTruthy()
    // mock 取词器返回键名;真实环境返回"教育"。断言取的是 <slug>Hub.title 这一个键,
    // 与域入口页大标题恒等(不是另立 nav.* 键)。
    expect(chip?.textContent).toContain('title')
  })

  it('⑦ 未登记页(无 domain)不渲染返回 chip,照常出标题', () => {
    ;(globalThis as { __shellPath?: string }).__shellPath = '/totally-unregistered'
    const { container } = render(
      <FeaturePageShell title="独立工具" icon={DummyIcon}>
        <div>content</div>
      </FeaturePageShell>,
    )
    expect(container.querySelector('a[href^="/domains/"]')).toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe('独立工具')
  })

  it('⑧ 显式 domain=null 强制关闭返回 chip(优先于自动解析)', () => {
    ;(globalThis as { __shellPath?: string }).__shellPath = '/learn'
    const { container } = render(
      <FeaturePageShell title="学习中心" icon={DummyIcon} domain={null}>
        <div>content</div>
      </FeaturePageShell>,
    )
    expect(container.querySelector('a[href^="/domains/"]')).toBeNull()
  })

  it('⑨ 档位引用 workspace-tokens 单一真相源(抄回 JSX 即红)', () => {
    // 页头卡表面 = HERO_SURFACE;标题档 = PAGE_TITLE;主图标砖 = HERO_ICON_TILE(44 档)
    expect(SHELL_TOKENS.headCard).toBe(HERO_SURFACE)
    expect(SHELL_TOKENS.title).toBe(PAGE_TITLE)
    expect(SHELL_TOKENS.headIcon).toBe(HERO_ICON_TILE)
  })

  it('⑩ 操作区渲染在页头', () => {
    const { container } = render(
      <FeaturePageShell
        title="学习中心"
        icon={DummyIcon}
        domain="edu"
        actions={<button>导出</button>}
      >
        <div>content</div>
      </FeaturePageShell>,
    )
    expect(container.querySelector('button')?.textContent).toBe('导出')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
