// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// @vitest-environment jsdom
// 上下文注入交代条(D34 消费端,2026-09-22 第 42 轮)。
// 关键判据是"界面出的是**前端本地化文案**,不是后端中文 collapsed" —— 后端文本无法本地化,
// 直接渲染会让 en/ja/ko 用户看到中文;collapsed 只允许在 kind 不认识时兜底。
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
    '../../../../../../../packages/i18n/messages/web/zh-CN.json',
  )
  const root = JSON.parse(readFile(pack, 'utf8')) as { ai?: { pane?: Record<string, string> } }
  const pane = root.ai?.pane ?? {}
  if (Object.keys(pane).length === 0) throw new Error('web 语言包没有 ai.pane 命名空间')
  return {
    useTranslations:
      () =>
      (key: string, values?: Record<string, string | number>): string => {
        const raw = pane[key]
        if (raw === undefined) return key
        // 与 next-intl / @ihui/i18n loader 同语义:**普通 {arg} 插值始终要做**,
        // 只有 ICU 结构需要引擎解释(此前只在 hasIcu 时插值,漏掉了 plain-arg 情形)
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
  }
})

import { InjectionBar } from '../injection-bar'

const here = dirname(fileURLToPath(import.meta.url))
const panePack = (
  JSON.parse(
    readFileSync(join(here, '../../../../../../../packages/i18n/messages/web/zh-CN.json'), 'utf8'),
  ) as { ai: { pane: Record<string, string> } }
).ai.pane

function tKey(key: string, values?: Record<string, string | number>): string {
  const raw = panePack[key]
  if (typeof raw !== 'string' || raw === '') throw new Error(`web 语言包缺键 ai.pane.${key}`)
  return formatIcu(raw, values ?? {}, { locale: 'zh-CN' })
}

const single = [{ kind: 'workspace_memory', collapsed: '已注入工作区记忆 / AGENTS.md 上下文' }]

describe('InjectionBar 本地化交代(D34 消费端)', () => {
  afterEach(() => cleanup())

  it('单条:显示前端本地化文案,不用后端中文 collapsed', () => {
    const { container } = render(<InjectionBar injections={single} />)
    const text = container.textContent ?? ''
    expect(text).toContain(tKey('injectionKindWorkspace'))
    expect(text).toContain(tKey('injectionTitle', { count: 1 }))
    // 单条不做二次折叠:不该出现"展开其余"控件
    expect(text).not.toContain(tKey('injectionCollapse'))
    // 后端文本比本地化文案长,用它当断言反例才有意义
    expect(text).not.toContain(single[0]?.collapsed ?? '')
  })

  it('带 fullText 才可展开,展开后能看到全文', () => {
    const withFull = [
      {
        kind: 'developer_instructions',
        collapsed: '已应用会话级自定义指令',
        fullText: '这里是注入的自定义指令全文',
      },
    ]
    const { container } = render(<InjectionBar injections={withFull} />)
    const row = container.querySelector<HTMLElement>(
      '[data-testid="injection-row-developer_instructions"]',
    )
    expect(row).not.toBeNull()
    expect(container.textContent ?? '').not.toContain('这里是注入的自定义指令全文')
    fireEvent.click(row as HTMLElement)
    expect(container.textContent ?? '').toContain('这里是注入的自定义指令全文')
  })

  it('无 fullText 时不给展开控件(不制造点了没反应的假按钮)', () => {
    const { container } = render(<InjectionBar injections={single} />)
    const row = container.querySelector<HTMLElement>(
      '[data-testid="injection-row-workspace_memory"]',
    )
    expect(row?.getAttribute('aria-expanded')).toBeNull()
    expect(row?.getAttribute('disabled')).not.toBeNull()
  })

  it('多条:标题计数 + 展开其余 N 项,默认只露第一条', () => {
    const many = [
      { kind: 'developer_instructions', collapsed: 'a' },
      { kind: 'workspace_memory', collapsed: 'b' },
      { kind: 'repo_wiki', collapsed: 'c' },
    ]
    const { container } = render(<InjectionBar injections={many} />)
    const header = container.querySelector<HTMLElement>('[data-testid="injection-bar-header"]')
    const collapsedText = container.textContent ?? ''
    expect(collapsedText).toContain(tKey('injectionTitle', { count: 3 }))
    expect(collapsedText).toContain(tKey('injectionExpand', { count: 2 }))
    expect(collapsedText).toContain(tKey('injectionKindDeveloper'))
    expect(collapsedText).not.toContain(tKey('injectionKindRepoWiki'))
    fireEvent.click(header as HTMLElement)
    const expandedText = container.textContent ?? ''
    expect(expandedText).toContain(tKey('injectionKindRepoWiki'))
    expect(expandedText).toContain(tKey('injectionCollapse'))
  })

  it('auto_context 按段数出措辞(ICU plural 真被消化,不漏语法)', () => {
    const { container } = render(
      <InjectionBar injections={[{ kind: 'auto_context', collapsed: 'x', count: 4 }]} />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain(tKey('injectionKindAutoContext', { count: 4 }))
    expect(text).toContain('4')
    expect(text).not.toContain('{count')
    expect(text).not.toContain('plural')
  })

  it('未知 kind 回退后端 collapsed(而不是回显 i18n 键名)', () => {
    const { container } = render(
      <InjectionBar injections={[{ kind: 'host_skills', collapsed: '已启用主机技能 3 项' }]} />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('已启用主机技能 3 项')
    expect(text).not.toContain('injectionKind')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
