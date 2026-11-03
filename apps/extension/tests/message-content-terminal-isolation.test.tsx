// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom

// G-154 残余收口(第 60 轮):extension 终端卡必须交代执行环境,且**一条消息只交代一次** ——
// web 是把标签挂在折叠区头部,extension 没有折叠区,若逐块渲染会把同一事实重复 N 遍。
// 沿用本端既有约定:react-dom/server 静态渲染 + 读真实词包做断言(防止写死中文 / 删键后仍绿)。
import { readFileSync } from 'node:fs'
import type { ComponentProps } from 'react'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { formatIcu } from '@ihui/i18n'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const root = JSON.parse(
  readFileSync(join(here, '../../../packages/i18n/messages/extension/zh-CN.json'), 'utf8'),
) as Record<string, unknown>

function lookup(key: string): string | undefined {
  let cur: unknown = root
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

const t = (key: string, values?: Record<string, string | number>): string => {
  const raw = lookup(key)
  if (raw === undefined) return key
  return formatIcu(raw, values ?? {}, { locale: 'zh-CN' })
}

vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) => t(key, values),
    locale: 'zh-CN',
    setLocale: () => {},
  }),
}))

const { MessageContent } = await import('../entrypoints/sidepanel/components/MessageContent')

const tasks = [
  { id: 't1', command: 'pnpm test', status: 'completed', exitCode: 0, output: 'ok' },
  { id: 't2', command: 'pnpm build', status: 'failed', exitCode: 1, output: 'boom' },
]

function render(extra: Record<string, unknown>): string {
  const message = {
    id: 'm1',
    role: 'assistant',
    content: '回答正文',
    ...extra,
  } as unknown as ComponentProps<typeof MessageContent>['message']
  return renderToStaticMarkup(<MessageContent message={message} />)
}

describe('extension 终端隔离交代(G-154)', () => {
  it('两个终端块只出一句交代,措辞等于词包整句', () => {
    const html = render({ terminalTasks: tasks })
    const isolation = t('chat.terminalIsolation')
    expect(isolation).not.toBe('chat.terminalIsolation')
    expect(html.match(/data-testid="terminal-isolation"/g) ?? []).toHaveLength(1)
    expect(html).toContain(isolation)
    // 两个命令本体都还在:交代行不是把第二块一起吞掉换来的
    expect(html).toContain('pnpm test')
    expect(html).toContain('pnpm build')
  })

  it('无终端块时不得凭空出现交代行', () => {
    expect(render({})).not.toContain('data-testid="terminal-isolation"')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
