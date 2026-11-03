// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 工具行双时态措辞的**渲染位**证据(D98/D102 B2 段):
// 这里不测措辞引擎(已由 packages/shared 18 例 + 跨引擎夹具看护),测的是
// "工具卡状态 → 界面文本"这一根链:running/success 必须换词,error/cancelled 必须**不**换词。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __toolDisplayKeys } from '@ihui/shared/chat'
import { formatIcu, hasIcuSyntax } from '@ihui/i18n'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ReactNode } from 'react'

import type { AgentToolCall } from '@/hooks/use-agent-progress'

vi.mock('next-intl', async () => {
  // 工厂内自取依赖:vi.mock 会被提到 import 之前执行,引用模块作用域的绑定会踩 TDZ
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu, hasIcuSyntax: hasIcu } = await import('@ihui/i18n')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../../packages/i18n/messages/shared/zh-CN.json',
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

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}))

import { ToolCallItem } from '../tool-calls-section'

const here = dirname(fileURLToPath(import.meta.url))
const taskStatusPack = (
  JSON.parse(
    readFileSync(
      join(here, '../../../../../../../packages/i18n/messages/shared/zh-CN.json'),
      'utf8',
    ),
  ) as { taskStatus: Record<string, string> }
).taskStatus

const readToolCode = Object.keys(__toolDisplayKeys).find(
  (code) => __toolDisplayKeys[code] === 'toolReadFile',
)!
const apiToolCode = Object.keys(__toolDisplayKeys).find(
  (code) => __toolDisplayKeys[code] === 'toolApiCall',
)!

function icu(key: string, state: string): string {
  const raw = taskStatusPack[key] ?? key
  return hasIcuSyntax(raw) ? formatIcu(raw, { state }, { locale: 'zh-CN' }) : raw
}

/** 语言包缺键必须让用例炸掉,而不是拿 undefined 去和界面文本比 */
function msg(key: string): string {
  const value = taskStatusPack[key]
  if (typeof value !== 'string' || value === '') throw new Error(`zh-CN 语言包缺键 ${key}`)
  return value
}

function makeTool(overrides: Partial<AgentToolCall> & { toolName: string }): AgentToolCall {
  return {
    id: `t-${overrides.toolName}-${overrides.status ?? 'running'}`,
    args: {},
    status: 'running',
    startedAt: '2026-09-22T00:00:00.000Z',
    ...overrides,
  }
}

function labelOf(container: HTMLElement, toolName: string): string {
  const el = container.querySelector<HTMLElement>(`[data-tool-name="${toolName}"]`)
  if (!el) throw new Error(`未找到工具行 data-tool-name=${toolName}`)
  return (el.textContent ?? '').trim()
}

describe('工具行活动措辞渲染位(D98/D102 B2)', () => {
  afterEach(() => cleanup())

  it('running 显示进行时,success 显示完成时,两者必须不同', () => {
    const { container: runningBox } = render(
      <ToolCallItem tool={makeTool({ toolName: readToolCode, status: 'running' })} />,
    )
    const { container: successBox } = render(
      <ToolCallItem tool={makeTool({ toolName: readToolCode, status: 'success' })} />,
    )
    const running = labelOf(runningBox, readToolCode)
    const success = labelOf(successBox, readToolCode)
    expect(running).toBe(icu('toolReadFileActivity', 'running'))
    expect(success).toBe(icu('toolReadFileActivity', 'completed'))
    expect(running).not.toBe(success)
    expect(running).not.toBe(msg('toolReadFile'))
    for (const text of [running, success]) {
      expect(text).not.toContain('{state')
      expect(text).not.toContain('select')
    }
  })

  it('error / cancelled 只出功能名,不得声称"已完成"', () => {
    const neutral = labelOf(
      render(<ToolCallItem tool={makeTool({ toolName: readToolCode, status: 'success' })} />)
        .container,
      readToolCode,
    )
    for (const status of ['error', 'cancelled'] as const) {
      const { container } = render(
        <ToolCallItem tool={makeTool({ toolName: readToolCode, status })} />,
      )
      expect(labelOf(container, readToolCode)).toBe(msg('toolReadFile'))
    }
    expect(neutral).not.toBe(msg('toolReadFile'))
  })

  it('长尾工具(无惯用措辞)走通用档:含功能名且带时态', () => {
    const { container: runningBox } = render(
      <ToolCallItem tool={makeTool({ toolName: apiToolCode, status: 'running' })} />,
    )
    const { container: successBox } = render(
      <ToolCallItem tool={makeTool({ toolName: apiToolCode, status: 'success' })} />,
    )
    const neutral = msg('toolApiCall')
    const running = labelOf(runningBox, apiToolCode)
    const success = labelOf(successBox, apiToolCode)
    expect(running).toContain(neutral)
    expect(success).toContain(neutral)
    expect(running).not.toBe(neutral)
    expect(running).not.toBe(success)
    expect(running).toBe(
      formatIcu(
        msg('toolGenericActivity'),
        { state: 'running', name: neutral },
        { locale: 'zh-CN' },
      ),
    )
  })

  it('未登记码名的工具退回原始码名(不编造措辞)', () => {
    const { container } = render(
      <ToolCallItem tool={makeTool({ toolName: 'mcp__x__nope', status: 'running' })} />,
    )
    expect(labelOf(container, 'mcp__x__nope')).toBe('mcp__x__nope')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
