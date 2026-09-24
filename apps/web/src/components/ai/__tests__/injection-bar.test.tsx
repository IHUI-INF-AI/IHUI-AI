// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D37 上下文装配聚合条测试(2026-09-24 立)。
// 形态参照 handoff-package-card.test.tsx(vi.mock next-intl)与
// progress-sections/__tests__/injection-bar.test.tsx(真实 zh-CN 词包 + formatIcu 取词)。
// 关键判据:聚合条计数正确 / 七源(按既有注册表实际枚举 4 kind)逐源本地化标签 /
// 折叠默认态(默认收起,点击展开)/ 来源分组 / 五语言词包 parity。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatIcu } from '@ihui/i18n'

vi.mock('next-intl', async () => {
  // 工厂内自取依赖:vi.mock 会被提到 import 之前执行,引用模块作用域绑定会踩 TDZ
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../packages/i18n/messages/web/zh-CN.json',
  )
  const root = JSON.parse(readFile(pack, 'utf8')) as Record<string, unknown>
  const resolve = (ns: string): Record<string, unknown> | undefined =>
    ns
      .split('.')
      .reduce<Record<string, unknown> | undefined>(
        (node, part) =>
          node && typeof node === 'object' ? (node[part] as Record<string, unknown>) : undefined,
        root,
      )
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        const node = resolve(ns)
        const raw = node?.[key]
        if (typeof raw !== 'string' || raw === '') return key
        // 与 next-intl / @ihui/i18n loader 同语义:普通 {arg} 插值 + ICU 都交给 formatIcu
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
  }
})

import { ContextAssemblyBar, resolveAssemblyInitialOpen } from '../injection-bar'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const zhCN = JSON.parse(readFileSync(join(MESSAGES_ROOT, 'zh-CN.json'), 'utf8')) as {
  chat: Record<string, string>
  ai: { pane: Record<string, string> }
}

/** chat namespace 取词(新增键断言用) */
function tChat(key: string, values?: Record<string, string | number>): string {
  const raw = zhCN.chat[key]
  if (typeof raw !== 'string' || raw === '') throw new Error(`web 语言包缺键 chat.${key}`)
  return formatIcu(raw, values ?? {}, { locale: 'zh-CN' })
}

/** ai.pane 取词(kind 既有键断言用) */
function tPane(key: string, values?: Record<string, string | number>): string {
  const raw = zhCN.ai.pane[key]
  if (typeof raw !== 'string' || raw === '') throw new Error(`web 语言包缺键 ai.pane.${key}`)
  return formatIcu(raw, values ?? {}, { locale: 'zh-CN' })
}

function openPanel(container: HTMLElement): string {
  const toggle = container.querySelector<HTMLElement>('[data-testid="context-assembly-toggle"]')
  expect(toggle).not.toBeNull()
  fireEvent.click(toggle as HTMLElement)
  return container.textContent ?? ''
}

afterEach(() => cleanup())

describe('D37 聚合条默认态与计数', () => {
  it('默认收起:面板不在 DOM,aria-expanded=false;点击展开,面板出现', () => {
    const { container } = render(
      <ContextAssemblyBar
        injections={[{ kind: 'workspace_memory', collapsed: '已注入工作区记忆 / AGENTS.md' }]}
      />,
    )
    expect(container.querySelector('[data-testid="context-assembly-panel"]')).toBeNull()
    const toggle = container.querySelector('[data-testid="context-assembly-toggle"]') as HTMLElement
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(container.querySelector('[data-testid="context-assembly-panel"]')).not.toBeNull()
    expect(
      (container.querySelector('[data-testid="context-assembly-toggle"]') as HTMLElement).getAttribute(
        'aria-expanded',
      ),
    ).toBe('true')
  })

  it('计数徽章:单项 1、多项 3,聚合文案取 chat 词表键', () => {
    const one = render(
      <ContextAssemblyBar injections={[{ kind: 'repo_wiki', collapsed: 'x' }]} />,
    )
    expect(
      one.container.querySelector('[data-testid="context-assembly-count"]')?.textContent,
    ).toBe('1')
    expect(one.container.textContent ?? '').toContain(tChat('injectionAssemblyBadge', { count: 1 }))
    cleanup()

    const many = render(
      <ContextAssemblyBar
        injections={[
          { kind: 'developer_instructions', collapsed: 'a' },
          { kind: 'workspace_memory', collapsed: 'b' },
          { kind: 'repo_wiki', collapsed: 'c' },
        ]}
      />,
    )
    expect(
      many.container.querySelector('[data-testid="context-assembly-count"]')?.textContent,
    ).toBe('3')
    expect(many.container.textContent ?? '').toContain(tChat('injectionAssemblyBadge', { count: 3 }))
  })

  it('injections 为空 ⇒ 不渲染(不造假条)', () => {
    const { container } = render(<ContextAssemblyBar injections={[]} />)
    expect(container.querySelector('[data-testid="context-assembly-bar"]')).toBeNull()
  })
})

describe('D37 七源逐源渲染(以既有注册表实际枚举 4 kind 为准 + 未知兜底)', () => {
  // llm.py injection_frames 四发射点与 packages/ui-react INJECTION_KIND_KEYS 一一对应;
  // 任务口径"以既有注册表实际枚举为准",host_skills 代表未知 kind 走 collapsed 兜底。
  const cases: Array<{ kind: string; collapsed: string; count?: number; expected: string }> = [
    { kind: 'developer_instructions', collapsed: 'a', expected: tPane('injectionKindDeveloper') },
    { kind: 'workspace_memory', collapsed: 'b', expected: tPane('injectionKindWorkspace') },
    { kind: 'repo_wiki', collapsed: 'c', expected: tPane('injectionKindRepoWiki') },
    {
      kind: 'auto_context',
      collapsed: 'd',
      count: 4,
      expected: tPane('injectionKindAutoContext', { count: 4 }),
    },
    { kind: 'host_skills', collapsed: '已启用主机技能 3 项', expected: '已启用主机技能 3 项' },
  ]

  for (const c of cases) {
    it(`kind=${c.kind}:计数 1 + 展开见本地化标签(未知 kind 落 collapsed 兜底)`, () => {
      const { container } = render(
        <ContextAssemblyBar injections={[{ kind: c.kind, collapsed: c.collapsed, count: c.count }]} />,
      )
      expect(
        container.querySelector('[data-testid="context-assembly-count"]')?.textContent,
      ).toBe('1')
      const text = openPanel(container)
      expect(text).toContain(c.expected)
    })
  }
})

describe('D37 装配查看器:fullText 与来源分组', () => {
  it('fullText 二级展开:面板展开后再点该行,才见注入全文', () => {
    const { container } = render(
      <ContextAssemblyBar
        injections={[
          {
            kind: 'developer_instructions',
            collapsed: 'a',
            fullText: '注入的自定义指令全文内容',
          },
        ]}
      />,
    )
    openPanel(container)
    expect(container.textContent ?? '').not.toContain('注入的自定义指令全文内容')
    const row = container.querySelector('[data-testid="assembly-injection-row-developer_instructions"]') as HTMLElement
    expect(row.getAttribute('disabled')).toBeNull()
    fireEvent.click(row)
    expect(container.textContent ?? '').toContain('注入的自定义指令全文内容')
  })

  it('无 fullText ⇒ 行不可展开(不制造点了没反应的假按钮)', () => {
    const { container } = render(
      <ContextAssemblyBar injections={[{ kind: 'repo_wiki', collapsed: 'x' }]} />,
    )
    openPanel(container)
    const row = container.querySelector('[data-testid="assembly-injection-row-repo_wiki"]') as HTMLElement
    expect(row.getAttribute('aria-expanded')).toBeNull()
    expect(row.getAttribute('disabled')).not.toBeNull()
  })

  it('来源分组:citations / steerNotices / retryNotice 展开后一并交代', () => {
    const { container } = render(
      <ContextAssemblyBar
        injections={[{ kind: 'workspace_memory', collapsed: 'x' }]}
        citations={[
          { source: 'kb', label: '产品手册' },
          { source: 'kb', label: 'FAQ' },
        ]}
        steerNotices={[{ phase: 'injected', text: '用中文回答' }]}
        retryNotice={{ attempt: 2, maxRetries: 3, retryInMs: 1500 }}
      />,
    )
    const text = openPanel(container)
    expect(container.querySelector('[data-testid="context-assembly-sources"]')).not.toBeNull()
    expect(text).toContain(tChat('injectionAssemblySourcesTitle'))
    expect(text).toContain(tChat('injectionAssemblySourceCitations', { count: 2 }))
    expect(text).toContain(tChat('injectionAssemblySourceSteer', { count: 1 }))
    expect(text).toContain(tChat('injectionAssemblyRetry', { attempt: 2, max: 3 }))
  })

  it('无旁路信息 ⇒ 不渲染来源分组', () => {
    const { container } = render(
      <ContextAssemblyBar injections={[{ kind: 'workspace_memory', collapsed: 'x' }]} />,
    )
    openPanel(container)
    expect(container.querySelector('[data-testid="context-assembly-sources"]')).toBeNull()
  })
})

describe('D37 fold-policy 联动(纯函数)', () => {
  it("'expanded' 偏好全程可见 ⇒ 初始展开;'auto'/'collapsed' ⇒ 默认收起", () => {
    expect(resolveAssemblyInitialOpen('expanded')).toBe(true)
    expect(resolveAssemblyInitialOpen('auto')).toBe(false)
    expect(resolveAssemblyInitialOpen('collapsed')).toBe(false)
  })
})

describe('D37 词包覆盖(读真实词包,不 mock)', () => {
  const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
  const NEW_KEYS = [
    'injectionAssemblyBadge',
    'injectionAssemblySourcesTitle',
    'injectionAssemblySourceCitations',
    'injectionAssemblySourceSteer',
    'injectionAssemblyRetry',
  ] as const

  const readChat = (locale: string): Record<string, unknown> => {
    const parsed = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
      chat?: Record<string, unknown>
    }
    if (!parsed.chat) throw new Error(`missing chat namespace in ${locale}.json`)
    return parsed.chat
  }

  it('五语言 chat namespace 均含 5 个新键且非空', () => {
    for (const locale of LOCALES) {
      const chat = readChat(locale)
      for (const key of NEW_KEYS) {
        const value = chat[key]
        expect(typeof value === 'string' && (value as string).trim().length > 0, `${locale} ${key}`).toBe(true)
      }
    }
  })

  it('插值占位符五语言一致', () => {
    for (const locale of LOCALES) {
      const chat = readChat(locale) as Record<string, string>
      expect(chat.injectionAssemblyBadge, locale).toContain('{count}')
      expect(chat.injectionAssemblySourceCitations, locale).toContain('{count}')
      expect(chat.injectionAssemblySourceSteer, locale).toContain('{count}')
      expect(chat.injectionAssemblyRetry, locale).toContain('{attempt}')
      expect(chat.injectionAssemblyRetry, locale).toContain('{max}')
    }
  })

  it('ja / ko 不得残留简体中文词;zh-TW 走繁体正字', () => {
    const simplified = ['轮', '项', '条', '导', '网', '试', '来源']
    for (const locale of ['ja', 'ko'] as const) {
      const chat = readChat(locale)
      for (const key of NEW_KEYS) {
        for (const word of simplified) {
          expect(String(chat[key]), `${locale} ${key} 残留「${word}」`).not.toContain(word)
        }
      }
    }
    const zhTW = readChat('zh-TW') as Record<string, string>
    expect(zhTW.injectionAssemblyBadge).toBe('本輪上下文 {count} 項')
    expect(zhTW.injectionAssemblySourcesTitle).toBe('本輪上下文來源')
  })
})

// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
