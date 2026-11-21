// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「模型终端屏面」只读视图(2026-11-21 立)的形状锁。
 *
 * 钉的是**产品立场**,不是文案措辞:
 *  - 没有会话 id / 没有终端 / 取不到屏面 —— 三种状态必须**分得开**,不许互相冒充;
 *  - 屏面按行渲染(空白要保留),光标那一行有可视标记;
 *  - OSC 8 链接 **文字与目标并列**且**不生成可点元素**(显示文字可与真实目标不同,是钓鱼面)。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ReactNode } from 'react'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AgentTerminalFace as FacePayload } from '@ihui/api-client'

import { AgentTerminalFace } from '../agent-terminal-face'

vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string, values?: Record<string, unknown>) =>
      values ? `${ns}.${key}(${JSON.stringify(values)})` : `${ns}.${key}`,
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}))

const hookState = vi.hoisted(() => ({
  current: {
    terminals: [] as Array<Record<string, unknown>>,
    activeId: null as string | null,
    face: null as FacePayload | null,
    loading: false,
    error: null as string | null,
    refresh: () => undefined,
    select: () => undefined,
  },
}))

vi.mock('@/hooks/use-agent-terminal-face', () => ({
  useAgentTerminalFace: () => hookState.current,
}))

function setState(patch: Partial<typeof hookState.current>) {
  hookState.current = { ...hookState.current, ...patch }
  return hookState.current
}

const TERM = {
  terminal_id: 't1',
  command: 'bash -i',
  cwd: '/w',
  cols: 20,
  rows: 4,
  running: true,
  exit_code: null,
  backend: 'pty',
}

function faceOf(over: Partial<FacePayload> = {}): FacePayload {
  return {
    terminal_id: 't1',
    cols: 20,
    rows: 4,
    row: 2,
    col: 3,
    pending_wrap: false,
    visible: true,
    alt_screen: false,
    line: 'b',
    screen: ['a', 'b', '', ''],
    screen_lines: 4,
    dropped_chunks: 0,
    prompt: {
      at_prompt: true,
      prompt_state: 'input',
      shell_integration: true,
      command_count: 1,
      last_command_exit: null,
      cwd: '/w',
      cwd_source: 'reported',
      running: true,
      alt_screen: false,
    },
    links_ok: true,
    links: [],
    link_count: 0,
    link_total: 0,
    link_truncated: false,
    running: true,
    exit_code: null,
    title: '',
    bell_count: 0,
    ...over,
  }
}

describe('AgentTerminalFace / 三态不互相冒充', () => {
  it('没有 ai-service 会话 id ⇒ 如实说明(不画空屏)', () => {
    const { container } = render(<AgentTerminalFace sessionId={null} />)
    expect(container.textContent).toContain('aiChat.agentTerminal.noSession')
    expect(container.querySelector('pre')).toBeNull()
  })

  it('有会话但没开终端 ⇒ empty', () => {
    setState({ terminals: [], face: null, error: null })
    const { container } = render(<AgentTerminalFace sessionId="s1" />)
    expect(container.textContent).toContain('aiChat.agentTerminal.empty')
  })

  it('取不到 ⇒ 显示原因(不写成"没有终端")', () => {
    setState({
      terminals: [TERM],
      face: null,
      error: 'HTTP 500: boom',
    })
    const { container } = render(<AgentTerminalFace sessionId="s1" />)
    expect(container.textContent).toContain('aiChat.agentTerminal.failed')
    expect(container.textContent).toContain('HTTP 500: boom')
    expect(container.textContent).not.toContain('aiChat.agentTerminal.empty')
  })
})

describe('AgentTerminalFace / 屏面渲染', () => {
  it('按行渲染且空白行不被吞掉;光标行有标记,屏面用 pre 保留空白', () => {
    setState({ terminals: [TERM], face: faceOf(), error: null })
    const { container } = render(<AgentTerminalFace sessionId="s1" />)
    const rows = container.querySelectorAll('pre > div')
    expect(rows.length).toBe(4)
    // 第 3/4 行是空行:必须仍占一行(渲染成单个空格),不能渲染 0 个节点
    expect(rows[3]?.textContent).toBe(' ')
    // 光标在 2 行(1 起) ⇒ 索引 1 那行带标记背景
    expect(rows[1]?.className).toContain('bg-accent')
    expect(rows[0]?.className).not.toContain('bg-accent')
    expect(container.textContent).toContain('aiChat.agentTerminal.cursor')
  })

  it('OSC 8 链接:文字与目标并列,且不生成任何可点元素', () => {
    setState({
      terminals: [TERM],
      face: faceOf({
        links: [{ url: 'https://evil.example/x', text: 'https://bank.example', line_no: 2, scheme: 'https' }],
        link_count: 1,
        link_total: 1,
      }),
      error: null,
    })
    const { container } = render(<AgentTerminalFace sessionId="s1" />)
    const html = container.innerHTML
    expect(html).toContain('https://bank.example')
    expect(html).toContain('https://evil.example/x')
    // 硬约束:一个 <a> 都不许有(钓鱼面靠"人核对文字 vs 目标",不靠点击)
    expect(container.querySelectorAll('a')).toHaveLength(0)
    expect(html).not.toContain('href=')
  })

  it('没有 shell 集成时说明"判断不了",不冒充"在提示符上"', () => {
    setState({
      terminals: [TERM],
      face: faceOf({
        prompt: {
          at_prompt: false,
          prompt_state: 'unknown',
          shell_integration: false,
          command_count: 0,
          last_command_exit: null,
          cwd: '/w',
          cwd_source: 'session',
          running: true,
          alt_screen: false,
        },
      }),
      error: null,
    })
    const { container } = render(<AgentTerminalFace sessionId="s1" />)
    expect(container.textContent).toContain('aiChat.agentTerminal.noIntegration')
  })
})

describe('词包覆盖', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const ROOT = join(here, '../../../../../../packages/i18n/messages/web')
  const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
  const KEYS = [
    'altScreen',
    'cursor',
    'empty',
    'exited',
    'failed',
    'links',
    'noIntegration',
    'noSession',
    'refresh',
    'running',
    'title',
  ]

  it('新增 11 + 停靠栏 2 个键在 5 种语言里都存在', () => {
    for (const locale of LOCALES) {
      const raw = readFileSync(join(ROOT, `${locale}.json`), 'utf8')
      const msgs = JSON.parse(raw) as {
        aiChat: { agentTerminal: Record<string, string>; terminalDock: Record<string, string> }
      }
      for (const key of KEYS) {
        expect(msgs.aiChat.agentTerminal[key], `${locale}.${key}`).toBeTypeOf('string')
      }
      expect(msgs.aiChat.terminalDock.backToIde).toBeTypeOf('string')
      expect(msgs.aiChat.terminalDock.showAgentFace).toBeTypeOf('string')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
