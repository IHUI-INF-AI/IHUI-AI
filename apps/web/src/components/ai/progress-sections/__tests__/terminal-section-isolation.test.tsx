// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// G-154 终端隔离交代(web 渲染位,2026-09-22)。竞品把"命令在专用终端实例中运行"写进界面,
// 我方终端卡此前对执行环境零交代;而 os_sandbox.py 的 allow_network 默认 False(H5 三平台验收)
// 是既成事实 —— 交代行必须是"说出真相"而不是营销话术。
// 措辞断言取真实 web 词包(整句相等),防止有人写死中文或删词包键后测试仍绿。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', async () => {
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../../packages/i18n/messages/web/zh-CN.json',
  )
  const root = JSON.parse(readFile(pack, 'utf8')) as Record<string, unknown>
  /** next-intl 语义:命名空间与键都可能是嵌套路径(ai.pane + terminal.isolation) */
  const resolve = (path: string): string | undefined => {
    let cur: unknown = root
    for (const seg of path.split('.')) {
      if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[seg]
      } else {
        return undefined
      }
    }
    return typeof cur === 'string' ? cur : undefined
  }
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        const raw = resolve(`${ns}.${key}`)
        if (raw === undefined) return key
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
  }
})

// CopyButton 走 radix Tooltip(需 TooltipProvider),与被测的交代行无关 → 直接剪掉
vi.mock('../copy-button', () => ({ CopyButton: () => null }))

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (s: { terminalOutputs: Record<string, string> }) => unknown) =>
    selector({ terminalOutputs: {} }),
}))

import { TerminalSection } from '../terminal-section'
import type { TerminalTask } from '@/hooks/use-agent-progress'

const here = dirname(fileURLToPath(import.meta.url))
const terminalPack = (
  JSON.parse(
    readFileSync(join(here, '../../../../../../../packages/i18n/messages/web/zh-CN.json'), 'utf8'),
  ) as { ai?: { pane?: { terminal?: Record<string, string> } } }
).ai?.pane?.terminal

function task(over: Partial<TerminalTask> & { id: string }): TerminalTask {
  return {
    command: 'pnpm build',
    status: 'completed',
    startedAt: '2026-09-22T00:00:00.000Z',
    ...over,
  }
}

afterEach(() => cleanup())

describe('终端隔离交代(G-154 渲染位)', () => {
  it('无运行/无失败时交代行也常显,且整句等于真实词包(不回显键名、不写死文案)', () => {
    const { getByTestId } = render(<TerminalSection terminals={[task({ id: 't-iso' })]} />)
    const tag = getByTestId('terminal-isolation')
    const text = (tag.textContent ?? '').trim()
    const expected = terminalPack?.isolation
    // 缺键即抛:整句相等断言拒绝盲比,也拒绝"回显键名"的假渲染
    if (expected === undefined) throw new Error('词包缺 ai.pane.terminal.isolation 键')
    expect(text).toBe(expected)
    expect(text).not.toContain('terminal.')
  })

  it('运行中与失败计数同排显示时交代行仍在(重构不吞条件徽章)', () => {
    const { getByTestId } = render(
      <TerminalSection
        terminals={[
          task({ id: 't-run', status: 'running' }),
          task({ id: 't-fail', status: 'failed', exitCode: 1 }),
        ]}
      />,
    )
    expect(getByTestId('terminal-isolation').textContent).toBe(terminalPack?.isolation)
    const row = getByTestId('terminal-isolation').parentElement?.textContent ?? ''
    expect(row).toContain('运行中')
    expect(row).toContain('失败')
  })
})
