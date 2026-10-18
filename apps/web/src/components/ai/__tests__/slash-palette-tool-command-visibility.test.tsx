// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom

import * as React from 'react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { SlashCommandPalette } from '@/components/ai/slash-command-palette'
import { useSlashCommands } from '@/hooks/use-slash-commands'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      key,
}))

vi.mock('@ihui/ui-react', () => ({
  IconButton: ({
    children,
    onClick,
    'aria-label': ariaLabel,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    'aria-label'?: string
  }): React.ReactElement => (
    <button type="button" onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
  SearchInput: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
  }): React.ReactElement => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      data-testid="palette-search"
    />
  ),
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }): React.ReactElement => (
    <div>{children}</div>
  ),
}))

// PortalPanel 的定位/portal 属 DOM 基建,不在本票射程;这里只保留"open 才渲染内容"这一契约
vi.mock('@/components/feedback/portal-panel', () => ({
  PortalPanel: ({
    open,
    children,
  }: {
    open?: boolean
    children?: React.ReactNode
  }): React.ReactElement | null => (open ? <div>{children}</div> : null),
}))

/** 五条工具命令(D117 / G-231 对标 Codex) */
const TOOL_COMMANDS = [
  { id: 'diff', label: '/diff', handlerId: 'slashDiff' },
  { id: 'status', label: '/status', handlerId: 'slashStatus' },
  { id: 'model', label: '/model', handlerId: 'slashModel' },
  { id: 'mcp', label: '/mcp', handlerId: 'slashMcp' },
  { id: 'compact', label: '/compact', handlerId: 'slashCompact' },
] as const

type PaletteCommand = React.ComponentProps<typeof SlashCommandPalette>['commands'][number]

function Host({
  commands,
  onSelect,
}: {
  commands: PaletteCommand[]
  onSelect: (id: string) => void
}): React.ReactElement {
  return (
    <SlashCommandPalette commands={commands} onSelect={onSelect} open onOpenChange={() => {}}>
      <span data-testid="palette-anchor" />
    </SlashCommandPalette>
  )
}

/** 真 hook 产物(不伪造命令表):面板可见性必须钉在 message-input 实际喂进去的那份列表上 */
function RealHost({ onSelect }: { onSelect: (id: string) => void }): React.ReactElement {
  const commands = useSlashCommands([], false)
  return <Host commands={commands} onSelect={onSelect} />
}

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC_ROOT = path.resolve(HERE, '../../../')
const REPO_ROOT = path.resolve(HERE, '../../../../../../')

const LOCALES = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW'] as const

// jsdom 没有 scrollIntoView(面板滚动活动项用),补空实现,不让基建缺失冒充功能缺失
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = () => {}
})

describe('SlashCommandPalette 工具命令可见性(D117 发现性格)', () => {
  afterEach(() => cleanup())

  it('happy:真 hook 列表喂进面板 ⇒ 五条工具命令与"工具"分组标题全部上屏', () => {
    render(<RealHost onSelect={() => {}} />)

    expect(screen.getByText('categoryTools')).toBeTruthy()
    for (const { label } of TOOL_COMMANDS) {
      expect(screen.queryByText(label)).toBeTruthy()
    }
  })

  it('阳性对照:摘掉 category==="tools" 那批 ⇒ 五条一起消失(证明断言吃的是渲染而非源码文本)', () => {
    const withTools = useSlashCommandsForTest()
    const withoutTools = withTools.filter((c) => c.category !== 'tools')

    expect(withTools.filter((c) => c.category === 'tools').length).toBe(TOOL_COMMANDS.length)

    render(<Host commands={withoutTools} onSelect={() => {}} />)
    for (const { label } of TOOL_COMMANDS) {
      expect(screen.queryByText(label)).toBeNull()
    }
    expect(screen.queryByText('categoryTools')).toBeNull()
  })

  it('可点:面板项是真按钮,点击交出命令 id(入口可用,不是只渲染一行字)', () => {
    const picked: string[] = []
    render(<RealHost onSelect={(id) => picked.push(id)} />)

    for (const { id, label } of TOOL_COMMANDS) {
      fireEvent.click(screen.getByText(label))
      expect(picked.at(-1)).toBe(id)
    }
    expect(picked).toHaveLength(TOOL_COMMANDS.length)
  })

  it('单一注册表:五条命令 id 全表只出现一次,且都是 action + tools 档(禁第三份命令表回潮)', () => {
    const commands = useSlashCommandsForTest()
    for (const { id } of TOOL_COMMANDS) {
      const hits = commands.filter((c) => c.id === id)
      expect(hits).toHaveLength(1)
      expect(hits[0]?.kind).toBe('action')
      expect(hits[0]?.category).toBe('tools')
    }
  })

  it('装车锁:命令注册表 ↔ 面板入口 ↔ 全局快捷键三层同批在位(§0.9 造好没装车=没有)', () => {
    const registry = fs.readFileSync(path.join(SRC_ROOT, 'lib/command-registry.ts'), 'utf8')
    const messageInput = fs.readFileSync(
      path.join(SRC_ROOT, 'components/chat/message-input.tsx'),
      'utf8',
    )
    const shortcuts = fs.readFileSync(path.join(SRC_ROOT, 'hooks/use-global-shortcuts.ts'), 'utf8')

    for (const { label, handlerId } of TOOL_COMMANDS) {
      expect(registry.includes(`id: '${handlerId}'`)).toBe(true)
      expect(registry.includes(`slash: '${label}'`)).toBe(true)
    }
    expect(messageInput.includes('const slashCommands = useSlashCommands(')).toBe(true)
    expect(messageInput.includes('commands={slashCommands}')).toBe(true)
    expect(messageInput.includes('open={slashOpen}')).toBe(true)
    expect(messageInput.includes("addEventListener('global-shortcut:open-slash'")).toBe(true)
    expect(shortcuts.includes('global-shortcut:open-slash')).toBe(true)

    // 阳性对照:摘掉"面板收到 hook 产物"这一行 ⇒ 本臂必须判不出可见通路
    const unwired = messageInput.replace('commands={slashCommands}', 'commands={[]}')
    expect(unwired.includes('commands={slashCommands}')).toBe(false)
  })

  it('五语言:分组标题与五条描述键在 web 五档全部取得到词(§19 新增状态词同批补齐)', () => {
    for (const locale of LOCALES) {
      const messages = JSON.parse(
        fs.readFileSync(
          path.join(REPO_ROOT, 'packages/i18n/messages/web', `${locale}.json`),
          'utf8',
        ),
      ) as Record<string, Record<string, unknown>>

      const palette = messages['slashPalette'] as Record<string, string> | undefined
      const slashCmd = (messages['chat'] as Record<string, unknown> | undefined)?.['slashCmd'] as
        Record<string, string> | undefined

      expect(palette?.categoryTools ?? '').not.toBe('')
      for (const { id } of TOOL_COMMANDS) {
        expect(slashCmd?.[id] ?? '').not.toBe('')
      }
    }
  })
})

/** 取真 hook 产物的非渲染通路(useSlashCommands 是 hook,只能在组件里调;这里借一次挂载取出) */
function useSlashCommandsForTest(): PaletteCommand[] {
  let captured: PaletteCommand[] = []
  function Probe(): React.ReactElement | null {
    captured = useSlashCommands([], false)
    return null
  }
  render(<Probe />)
  cleanup()
  return captured
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
