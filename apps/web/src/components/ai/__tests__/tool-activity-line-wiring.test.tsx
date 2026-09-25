// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D81 ②~⑥ 的**装车证明**(不是组件自身单测):断言渲染宿主 `ToolCallCard` 真的把
// `tool-activity-line.tsx` 的原语渲染了出来 —— 上一轮的失败形态正是"文件在库、零 importer"。
// 取词 mock 与 tool-call-card-activity.test.tsx 同源(读 packages/i18n shared 包),
// 差别只在:②~⑥ 这八个键全是 `{name}` 简单插值,而 @ihui/i18n 的 hasIcuSyntax 只认
// plural/select/selectordinal/number,故 mock 必须自己做简单占位替换,
// 否则断言会退化成"原文里带花括号"这种与真机(next-intl)不一致的假绿。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __toolDisplayKeys } from '@ihui/shared/chat'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ReactNode } from 'react'

vi.mock('next-intl', async () => {
  // 工厂内自取依赖:vi.mock 会被提到 import 之前执行,引用模块作用域绑定会踩 TDZ
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu, hasIcuSyntax: hasIcu } = await import('@ihui/i18n')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../packages/i18n/messages/shared/zh-CN.json',
  )
  const status = (JSON.parse(readFile(pack, 'utf8')) as { taskStatus: Record<string, string> })
    .taskStatus
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        if (ns !== 'taskStatus') return key
        const raw = status[key] ?? key
        if (hasIcu(raw)) return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
        return raw.replace(/\{(\w+)\}/gu, (_m, name: string) => String(values?.[name] ?? ''))
      },
  }
})

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}))

import { ToolCallCard } from '../tool-call-card'

const here = dirname(fileURLToPath(import.meta.url))
const taskStatusPack = (
  JSON.parse(
    readFileSync(join(here, '../../../../../../packages/i18n/messages/shared/zh-CN.json'), 'utf8'),
  ) as { taskStatus: Record<string, string> }
).taskStatus

function msg(key: string): string {
  const value = taskStatusPack[key]
  if (typeof value !== 'string' || value === '') throw new Error(`zh-CN 语言包缺键 ${key}`)
  return value
}

const readToolCode = Object.keys(__toolDisplayKeys).find(
  (code) => __toolDisplayKeys[code] === 'toolReadFile',
)!
const neutralReadName = msg('toolReadFile')

function rowOf(container: HTMLElement, id: string): HTMLElement {
  const row = container.querySelector<HTMLElement>(`[data-testid="tool-call-row-${id}"]`)
  if (!row) throw new Error(`未找到工具行 tool-call-row-${id}`)
  return row
}

const LONG_RESULT = Array.from({ length: 80 }, (_, i) => `line-${i}`).join('\n')

describe('ToolCallCard 渲染 D81 ②~⑥ 活动条目原语(装车证明)', () => {
  afterEach(() => cleanup())

  it('④ ActivityCodeBlock:折叠后点「展开全部」,完整内容逐字可达', () => {
    const { container } = render(
      <ToolCallCard
        toolCallId="w-code"
        toolName={readToolCode}
        args={{ path: 'apps/web/package.json' }}
        result={LONG_RESULT}
        status="success"
      />,
    )
    fireEvent.click(rowOf(container, 'w-code'))

    // 宿主沿用了既有 testId(tool-call-result),原语的内部 testId 因此以宿主值为准
    const pre = container.querySelector<HTMLElement>('[data-testid="tool-call-result"]')
    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="tool-call-result-toggle"]',
    )
    expect(pre).not.toBeNull()
    expect(toggle).not.toBeNull()
    // 折叠态:截断且带省略号(不是把内容丢掉——完整内容仍可经按钮抵达)
    expect(pre!.textContent ?? '').not.toBe(LONG_RESULT)
    expect(toggle!.textContent).toBe(msg('showAllLines'))
    expect(toggle!.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle!)
    expect(pre!.textContent).toBe(LONG_RESULT)
    expect(toggle!.textContent).toBe(msg('hideLines'))
    expect(toggle!.getAttribute('aria-expanded')).toBe('true')
  })

  it('⑤ ActivitySourcesButton:引用超过折叠上限时出「来源 (N)」,点后全部可达(此前直接丢弃)', () => {
    const citations = Array.from({ length: 12 }, (_, i) => `来源${i} https://aizhs.top/${i}`)
    const { container } = render(
      <ToolCallCard
        toolCallId="w-src"
        toolName={readToolCode}
        args={{ path: 'apps/web/package.json' }}
        result={{ citations }}
        status="success"
      />,
    )
    fireEvent.click(rowOf(container, 'w-src'))

    const chips = () => container.querySelectorAll('[data-testid="tool-call-citation"]')
    const button = container.querySelector<HTMLElement>('[data-testid="activity-sources"]')
    expect(button).not.toBeNull()
    expect(button!.textContent).toContain(msg('sourcesButton'))
    expect(button!.textContent).toContain(String(citations.length))
    expect(chips().length).toBe(8)

    fireEvent.click(button!)
    expect(chips().length).toBe(citations.length)
  })

  it('⑥ ActivityCanceledLabel:取消态在流里留可辨识条目,且无需展开即可见', () => {
    const { container } = render(
      <ToolCallCard
        toolCallId="w-cancel"
        toolName={readToolCode}
        args={{ path: 'apps/web/package.json' }}
        status="cancelled"
      />,
    )
    const label = container.querySelector<HTMLElement>('[data-testid="activity-canceled"]')
    expect(label).not.toBeNull()
    expect(label!.textContent).toBe(msg('canceledItemLabel').replace('{name}', neutralReadName))
    // 直出键名/占位符残迹即视为失败(守门 74 口径)
    expect(label!.textContent).not.toContain('{name}')
    expect(label!.textContent).not.toContain('canceledItemLabel')
  })

  it('⑤ ActivityConnectorGroupLabel:写类工具判 write / 其余判 read,连接器名落进文案', () => {
    const readCase = render(
      <ToolCallCard
        toolCallId="w-mcp-read"
        toolName={readToolCode}
        args={{ path: 'README.md' }}
        status="success"
        serverSource="mcp"
        serverId="github"
        serverName="GitHub MCP"
      />,
    )
    const readLabel = readCase.container.querySelector<HTMLElement>(
      '[data-testid="activity-connector-group"]',
    )
    expect(readLabel).not.toBeNull()
    expect(readLabel!.getAttribute('data-direction')).toBe('read')
    expect(readLabel!.textContent).toContain('GitHub MCP')
    cleanup()

    const writeCase = render(
      <ToolCallCard
        toolCallId="w-mcp-write"
        toolName="write_file"
        args={{ path: 'README.md', content: 'x' }}
        status="success"
        serverSource="mcp"
        serverId="filesystem"
        serverName="Filesystem MCP"
      />,
    )
    const writeLabel = writeCase.container.querySelector<HTMLElement>(
      '[data-testid="activity-connector-group"]',
    )
    expect(writeLabel).not.toBeNull()
    expect(writeLabel!.getAttribute('data-direction')).toBe('write')
    expect(writeLabel!.textContent).toContain('Filesystem MCP')
  })

  it('结构反向证明:宿主必须从 ./tool-activity-line 取件(拦"造好没装车"回潮)', () => {
    const host = readFileSync(join(here, '..', 'tool-call-card.tsx'), 'utf8')
    expect(host).toMatch(/from '\.\/tool-activity-line'/)
    expect(host).toMatch(/ActivityCodeBlock|ActivityCanceledLabel|ActivityConnectorGroupLabel/)
  })

  it('②③ 已判定为冗余并删除:原语面与宿主面都不得回升(回归锁)', () => {
    // 判据来源不是"我觉得重复",而是 d81-redundancy-probe.test.tsx 在同一条渲染链上
    // 量到了耗时文本与查询词 —— 现役已显示的信息不允许再起第二套呈现。
    const primitives = readFileSync(join(here, '..', 'tool-activity-line.tsx'), 'utf8')
    const host = readFileSync(join(here, '..', 'tool-call-card.tsx'), 'utf8')
    // 判据只看代码面:本文件头注会逐字引用被删原语的写法作说明,
    // 不剥注释就会把"解释为什么删"判成"又写回来了"(首跑即由此误红一次)。
    const stripComments = (s: string): string =>
      s.replace(/^\s*\/\/.*$/gmu, '').replace(/^\s*\*.*$/gmu, '')
    const primitivesCode = stripComments(primitives)
    const hostCode = stripComments(host)
    for (const src of [primitivesCode, hostCode]) {
      expect(src).not.toMatch(/ActivityDuration/u)
      expect(src).not.toMatch(/ActivitySearchQuery/u)
    }
    // 活动条上的耗时只有格式化器 formatDuration 一个真相,组件内不得再算一遍
    expect(primitivesCode).not.toMatch(/\/\s*1000\)\.toFixed/u)
    // 方向档位一律取共享层 ConnectorDirection,端内不得自写字面量联合
    expect(primitives).toMatch(/direction:\s*ConnectorDirection/u)
    expect(primitivesCode).not.toMatch(/direction:\s*'read'\s*\|\s*'write'/u)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
