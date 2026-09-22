// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// D34 注入交代帧跨端(第 43 轮):extension 必须把帧字段渲染成**本地化文案**。
// 四端此前对消息级交代帧(citations / steer / injection)一律 0 命中,本用例填 D106 的 extension 格。
// 沿用本端既有约定:react-dom/server 静态渲染(extension 未装 @testing-library)。
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

const injections = [
  { kind: 'workspace_memory', collapsed: '已注入工作区记忆 / AGENTS.md 上下文' },
  { kind: 'auto_context', collapsed: '已自动检索并注入 4 段代码上下文', count: 4 },
]

function renderMessage(extra: Record<string, unknown>): string {
  const message = {
    id: 'm1',
    role: 'assistant',
    content: '回答正文',
    ...extra,
  } as unknown as ComponentProps<typeof MessageContent>['message']
  return renderToStaticMarkup(<MessageContent message={message} />)
}

describe('extension 消费 injection_applied(D106)', () => {
  it('单条 workspace_memory:出本地化文案,不出后端中文', () => {
    const html = renderMessage({ injections: [injections[0]] })
    expect(html).toContain(t('chat.injectionKindWorkspace'))
    expect(html).toContain(t('chat.injectionTitle', { count: 1 }))
    // 后端 collapsed 比本地化文案多" 上下文"三字,拿它做反例才有区分度
    expect(html).not.toContain('已注入工作区记忆 / AGENTS.md 上下文')
    expect(html).not.toContain('{count')
  })

  it('auto_context 段数走 ICU plural(不漏语法也不漏项)', () => {
    const html = renderMessage({ injections: [injections[1]] })
    expect(html).toContain(t('chat.injectionKindAutoContext', { count: 4 }))
    expect(html).not.toContain('{count')
  })

  it('多条:默认只露第一条,其余靠"展开其余 N 项"', () => {
    const html = renderMessage({ injections })
    expect(html).toContain(t('chat.injectionTitle', { count: 2 }))
    expect(html).toContain(t('chat.injectionExpand', { count: 1 }))
    expect(html).toContain(t('chat.injectionKindWorkspace'))
    expect(html).not.toContain(t('chat.injectionKindAutoContext', { count: 4 }))
  })

  it('没有 injections 时不渲染交代条', () => {
    expect(renderMessage({})).not.toContain('injection-bar')
  })
})

describe('G-165① 消息级权限档交代行(extension)', () => {
  it('有盖章值时出档名与后果(真实词包本地化文案,非键名)', () => {
    const html = renderMessage({ metadata: { permissionMode: 'plan' } })
    expect(html).toContain('message-permission-tier')
    expect(html).toContain(lookup('permissionTier.mode.plan.title')!)
    expect(html).toContain(lookup('permissionTier.mode.plan.desc')!)
  })

  it('未知盖章值显示 unknown 键文案,绝不显示成 default(授权误导防线)', () => {
    const html = renderMessage({ metadata: { permissionMode: 'yolo' } })
    expect(html).toContain(lookup('permissionTier.mode.unknown.title')!)
    expect(html).not.toContain(lookup('permissionTier.mode.default.title')!)
  })

  it('无盖章(老消息/未绑定工作区)不渲染,不编造 default', () => {
    expect(renderMessage({})).not.toContain('message-permission-tier')
  })
})
