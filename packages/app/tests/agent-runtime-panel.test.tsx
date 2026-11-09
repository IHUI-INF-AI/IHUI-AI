// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AgentRuntimePanel 共享层唯一实现的渲染契约(两端真消费):
//  - 文案全部由 props 注入(哨兵值),证明共享层不自取词、端内文案零硬编码;
//  - 阴性对照:面板源码里出现端内文案字面量,或注入面(labels.* / t(`…`))被摘掉 ⇒ 必红;
//  - 零平台 API:源码不得出现存储、导航、Taro/wx 通道。
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentRuntimePanelLabels } from '@ihui/types'

const fixture = vi.hoisted(() => ({
  runtime: null as {
    status: 'idle' | 'running' | 'completed' | 'failed'
    input: string
    setInput: (v: string) => void
    sessionId: string | null
    plan: string | null
    output: string
    error: string | null
    permission: {
      toolName?: string
      dangerLevel?: string
      decision: string
      mode: string
    } | null
    handleSend: () => Promise<void>
    handleStop: () => void
    handleClear: () => void
  } | null,
}))

vi.mock('@ihui/shared', () => ({
  useAgentRuntime: () => fixture.runtime,
  toolDisplayKey: (name: string) => (name === 'bash' ? 'bashDisplay' : null),
  permissionDecisionWord: (decision: string, t: (key: string) => string) => t(decision),
}))

vi.mock('@ihui/shared/chat', () => ({
  permissionTierWordKeys: (_mode: string) => ({ title: 'permissionTier.normal' }),
}))

vi.mock('@ihui/ui-native', () => ({
  Input: (props: { value?: string; placeholder?: string; [k: string]: unknown }) => {
    const { className: _className, style: _style, ...rest } = props
    return createElement('input', rest)
  },
  Loading: () => createElement('div', null, 'loading'),
}))

import { AgentRuntimePanel } from '../src/features/agent-runtime/AgentRuntimePanel'

/** 哨兵文案:共享层若自带任何端内字面量,这些断言就取不到值 */
const LABELS: AgentRuntimePanelLabels = {
  title: 'SENTINEL_TITLE',
  clear: 'SENTINEL_CLEAR',
  plan: 'SENTINEL_PLAN',
  permission: 'SENTINEL_PERMISSION',
  permissionTool: 'SENTINEL_PERMISSION_TOOL',
  permissionLevel: 'SENTINEL_PERMISSION_LEVEL',
  permissionMode: 'SENTINEL_PERMISSION_MODE',
  output: 'SENTINEL_OUTPUT',
  error: 'SENTINEL_ERROR',
  empty: 'SENTINEL_EMPTY',
  placeholder: 'SENTINEL_PLACEHOLDER',
  stop: 'SENTINEL_STOP',
  send: 'SENTINEL_SEND',
}

/** 动态键取词的注入替身:返回值可区分"走了 t 注入"与"写死了文案" */
const t = (key: string) => `T(${key})`

// 守门 theme-prop-wiring:主题驱动组件的渲染点必须显式接线(字面量与漏传同红)
const testColorScheme: 'light' | 'dark' = 'light'

const IDLE = {
  status: 'idle' as const,
  input: '',
  setInput: () => {},
  sessionId: null,
  plan: null,
  output: '',
  error: null,
  permission: null,
  handleSend: async () => {},
  handleStop: () => {},
  handleClear: () => {},
}

const PANEL_SOURCE = readFileSync(
  join(__dirname, '../src/features/agent-runtime/AgentRuntimePanel.tsx'),
  'utf8',
)
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const renderPanel = (runtime = IDLE) => {
  fixture.runtime = runtime
  return render(<AgentRuntimePanel labels={LABELS} t={t} colorScheme={testColorScheme} />)
}

beforeEach(() => {
  fixture.runtime = IDLE
})

afterEach(cleanup)

describe('AgentRuntimePanel 共享层渲染', () => {
  it('空态:标题/清空/空提示/发送/占位符全部来自注入 props', () => {
    renderPanel()
    expect(screen.getByText('SENTINEL_TITLE')).toBeTruthy()
    expect(screen.getByText('SENTINEL_CLEAR')).toBeTruthy()
    expect(screen.getByText('SENTINEL_EMPTY')).toBeTruthy()
    expect(screen.getByText('SENTINEL_SEND')).toBeTruthy()
    expect(screen.getByPlaceholderText('SENTINEL_PLACEHOLDER')).toBeTruthy()
  })

  it('运行态:停止文案 + 审批面板走 t 注入(decision/tool/mode 三键)', () => {
    const { container } = renderPanel({
      ...IDLE,
      status: 'running',
      permission: {
        mode: 'acceptEdits',
        toolName: 'bash',
        dangerLevel: 'write',
        decision: 'allow',
      },
    })
    expect(screen.getByText('SENTINEL_STOP')).toBeTruthy()
    // 审批行由多个文本节点拼成,按容器全文取证(RTL 的 getByText 只匹配单节点)
    const text = container.textContent ?? ''
    // 决策词经 permissionDecisionWord → t('stepDecision.*')
    expect(text).toContain('T(stepDecision.allow)')
    // 工具名经 toolDisplayKey → t('taskStatus.*'),不裸显英文工具码
    expect(text).toContain('T(taskStatus.bashDisplay)')
    // 模式档名经 permissionTierWordKeys(mode).title → t(...)
    expect(text).toContain('T(permissionTier.normal)')
    expect(text).toContain('SENTINEL_PERMISSION_TOOL')
    expect(text).toContain('SENTINEL_PERMISSION_LEVEL')
    expect(text).toContain('SENTINEL_PERMISSION_MODE')
  })

  it('错误态:错误标签与错误正文都渲染', () => {
    renderPanel({ ...IDLE, status: 'failed', error: 'SENTINEL_ERROR_BODY' })
    expect(screen.getByText('SENTINEL_ERROR')).toBeTruthy()
    expect(screen.getByText('SENTINEL_ERROR_BODY')).toBeTruthy()
  })

  it('阴性对照:共享层不得出现任一端文案字面量', () => {
    const code = stripComments(PANEL_SOURCE)
    for (const literal of ['暂无运行记录', '发送', '运行时', '智能体运行', '运行出错']) {
      expect(code).not.toContain(literal)
    }
  })

  it('阴性对照:注入面被摘掉(labels.* / t(`…`))则必红', () => {
    const code = stripComments(PANEL_SOURCE)
    expect(code).toMatch(/labels\.(title|clear|plan|permission|output|error|empty|stop|send)/)
    expect(code).toMatch(/t\(\s*`stepDecision\./)
  })

  it('滚动区高度上限两端同值:走 geometry token,不得写 vh 或单端分支', () => {
    const code = stripComments(PANEL_SOURCE)
    // 阴性对照:上限改成裸数字(40vh / maxHeight: 240)或端内分支,本断言变红
    expect(code).toMatch(/maxHeight:\s*rnGeometry\.runtimePanelScrollMaxHeight/)
    expect(code).not.toMatch(/40vh|maxHeight:\s*\d/)
    expect(code).not.toMatch(/Platform\.(select|OS)|typeof\s+wx\b/)
  })

  it('零平台 API:无存储、无导航、无 Taro/wx 通道', () => {
    const code = stripComments(PANEL_SOURCE)
    expect(code).not.toMatch(/\bTaro\b/)
    expect(code).not.toMatch(/getStorageSync|setStorageSync|AsyncStorage/)
    expect(code).not.toMatch(/navigateTo|redirectTo/)
    expect(code).not.toMatch(/\bwx\./)
  })
})
