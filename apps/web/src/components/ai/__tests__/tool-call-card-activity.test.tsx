// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 对话气泡内工具行的双时态措辞(D98/D102 主战场,2026-09-22 第 41 轮):
// 这一行此前只有图标承载状态(状态文字仅进 aria-label),对"看着界面读"的用户等于没有状态。
// 措辞引擎本身不在这里测(共享层 18 例 + 跨引擎夹具已看护),这里测**渲染位接线**。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { formatIcu, hasIcuSyntax } from '@ihui/i18n'
import { __toolDisplayKeys } from '@ihui/shared/chat'
import { cleanup, render } from '@testing-library/react'
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
        return hasIcu(raw) ? renderIcu(raw, values ?? {}, { locale: 'zh-CN' }) : raw
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

const readToolCode = Object.keys(__toolDisplayKeys).find(
  (code) => __toolDisplayKeys[code] === 'toolReadFile',
)!

function msg(key: string): string {
  const value = taskStatusPack[key]
  if (typeof value !== 'string' || value === '') throw new Error(`zh-CN 语言包缺键 ${key}`)
  return value
}

function renderKey(key: string, values: Record<string, string | number>): string {
  const raw = msg(key)
  return hasIcuSyntax(raw) ? formatIcu(raw, values, { locale: 'zh-CN' }) : raw
}

function rowText(container: HTMLElement, id: string): string {
  const row = container.querySelector<HTMLElement>(`[data-testid="tool-call-row-${id}"]`)
  if (!row) throw new Error(`未找到工具行 tool-call-row-${id}`)
  return (row.textContent ?? '').trim()
}

function renderCard(status: 'running' | 'success' | 'error' | 'cancelled', id: string) {
  return render(
    <ToolCallCard
      toolCallId={id}
      toolName={readToolCode}
      args={{ path: 'apps/web/package.json' }}
      status={status}
    />,
  )
}

describe('对话气泡工具行双时态措辞(D98/D102)', () => {
  afterEach(() => cleanup())

  it('running 与 success 必须换词,且都不残留 ICU 语法', () => {
    const { container: runningBox } = renderCard('running', 'c-run')
    const { container: successBox } = renderCard('success', 'c-ok')
    const running = rowText(runningBox, 'c-run')
    const success = rowText(successBox, 'c-ok')
    expect(running).toContain(renderKey('toolReadFileActivity', { state: 'running' }))
    expect(success).toContain(renderKey('toolReadFileActivity', { state: 'completed' }))
    expect(running).not.toBe(success)
    for (const text of [running, success]) {
      expect(text).not.toContain('{state')
      expect(text).not.toContain('read_file')
    }
  })

  it('error / cancelled 只出功能名,不得声称已完成', () => {
    const neutral = msg('toolReadFile')
    for (const [status, id] of [
      ['error', 'c-err'],
      ['cancelled', 'c-cancel'],
    ] as const) {
      const { container } = renderCard(status, id)
      const text = rowText(container, id)
      expect(text).toContain(neutral)
      expect(text).not.toContain(renderKey('toolReadFileActivity', { state: 'completed' }))
    }
  })

  it('状态仍同时进 aria-label(无障碍口径未被措辞取代)', () => {
    const { container } = renderCard('running', 'c-aria')
    const row = container.querySelector<HTMLElement>('[data-testid="tool-call-row-c-aria"]')
    const aria = row?.getAttribute('aria-label') ?? ''
    expect(aria).toContain(renderKey('toolReadFileActivity', { state: 'running' }))
    expect(aria).toContain(msg('statusRunning'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
