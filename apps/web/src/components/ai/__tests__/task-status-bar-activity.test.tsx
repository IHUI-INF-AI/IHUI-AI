// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// @vitest-environment jsdom
// 任务状态条的活动措辞(D98/D102 B2):该条只在流式期间出现 → 标题必须是进行时,
// 且未登记工具不得只把英文码名当标题(动态名允许出现在通用句式的参数位)。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { formatIcu, hasIcuSyntax } from '@ihui/i18n'
import { __toolDisplayKeys } from '@ihui/shared/chat'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  chat: { conversationId: 1, isStreaming: true, messages: [] as unknown[] },
  agent: {
    isStreaming: true,
    planSteps: [] as unknown[],
    changes: [] as unknown[],
    overview: { status: 'running' },
    currentTask: { kind: 'tool', toolName: 'read_file', label: '' },
  },
}))

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (s: typeof harness.chat) => unknown) => selector(harness.chat),
}))

vi.mock('@/hooks/use-agent-progress', () => ({
  useAgentProgress: () => harness.agent,
}))

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
  const taskStatus = (JSON.parse(readFile(pack, 'utf8')) as { taskStatus: Record<string, string> })
    .taskStatus
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        if (ns !== 'taskStatus') return key
        const raw = taskStatus[key] ?? key
        return hasIcu(raw) ? renderIcu(raw, values ?? {}, { locale: 'zh-CN' }) : raw
      },
  }
})

import { TaskStatusBar } from '../task-status-bar'

const here = dirname(fileURLToPath(import.meta.url))
const taskStatusPack = (
  JSON.parse(
    readFileSync(join(here, '../../../../../../packages/i18n/messages/shared/zh-CN.json'), 'utf8'),
  ) as { taskStatus: Record<string, string> }
).taskStatus

const readToolCode = Object.keys(__toolDisplayKeys).find(
  (code) => __toolDisplayKeys[code] === 'toolReadFile',
)!
const apiToolCode = Object.keys(__toolDisplayKeys).find(
  (code) => __toolDisplayKeys[code] === 'toolApiCall',
)!

/** 语言包缺键必须让用例炸掉,而不是拿 undefined 去和界面文本比 */
function msg(key: string): string {
  const value = taskStatusPack[key]
  if (typeof value !== 'string' || value === '') throw new Error(`zh-CN 语言包缺键 ${key}`)
  return value
}

function renderKey(key: string, values: Record<string, string | number>): string {
  const raw = msg(key)
  return hasIcuSyntax(raw) ? formatIcu(raw, values, { locale: 'zh-CN' }) : raw
}

function setTool(toolName: string): void {
  harness.agent.currentTask = { kind: 'tool', toolName, label: '' }
}

function barText(): string {
  return render(<TaskStatusBar />).container.textContent ?? ''
}

describe('任务状态条进行时措辞(D98/D102 B2)', () => {
  afterEach(() => cleanup())

  it('惯用档工具 → 进行时标题,界面不含英文码名', () => {
    setTool(readToolCode)
    const text = barText()
    expect(text).toContain(renderKey('toolReadFileActivity', { state: 'running' }))
    expect(text).not.toContain(readToolCode)
    // 进行时与完成时必须二选一,状态条不得出现"已 X"
    expect(text).not.toContain(renderKey('toolReadFileActivity', { state: 'completed' }))
  })

  it('长尾工具 → 通用档进行时(含本地化功能名)', () => {
    setTool(apiToolCode)
    const text = barText()
    expect(text).toContain(
      renderKey('toolGenericActivity', { state: 'running', name: msg('toolApiCall') }),
    )
    expect(text).not.toContain(apiToolCode)
  })

  it('未登记动态名 → 走通用句式,码名只出现在参数位', () => {
    const dynamic = 'mcp__demo__nope'
    setTool(dynamic)
    const text = barText()
    expect(text).toContain(renderKey('activityTool', { tool: dynamic }))
  })

  it('非工具 kind 不受本次改动影响(规划态仍是规划文案)', () => {
    harness.agent.currentTask = { kind: 'planning', toolName: '', label: '' }
    const text = barText()
    expect(text).toContain(msg('activityPlanning'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
