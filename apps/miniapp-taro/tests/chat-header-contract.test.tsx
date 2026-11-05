// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 块 1 ChatHeader 契约测试。
 *
 * 正例：模型段 / 标题 / 右侧动作按固定顺序渲染，缺参零占位。
 * 阴性对照：showClear=false 时清除钮不渲染；折叠卡收起时 body 不渲染。
 * 硬约束：源码零平台 API、零 lucide、零 Animated/PanResponder。
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// @ts-expect-error 深度路径无类型声明:仅测试用,固定 React 19 单实例
vi.mock('react', async () => import('../../../packages/app/node_modules/react'))

import { createElement } from 'react'
// @ts-expect-error 深度路径无类型声明:必须与上方 mock 的 React 19 单实例同源
import { renderToStaticMarkup } from '../../../packages/app/node_modules/react-dom/server'

import {
  ChatHeader,
  ChatCollapsibleCard,
  ChatCompactionBanner,
} from '../../../packages/app/src/features/chat/ChatHeader'

const ZH: Record<string, string> = {
  'ai.history': '历史',
  'ai.clear': '清除',
  'ai.chatMessageItem.thinkingProcess': '思考过程',
  'chatAlert.compaction.title': '上下文已压缩',
  'chatAlert.compaction.message': '压缩后',
}

const t = (key: string, options?: Record<string, string | number>): string => {
  const text = ZH[key] ?? key
  if (!options) return text
  return `${text} ${Object.entries(options)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')}`
}

const SOURCE = resolve(__dirname, '../../../packages/app/src/features/chat/ChatHeader.tsx')
const src = readFileSync(SOURCE, 'utf8')

const navItems = [
  { key: 'agent', label: '智能体A' },
  { key: 'help', label: '?' },
]

describe('ChatHeader 契约', () => {
  it('模型段 / 标题 / 右侧动作按固定顺序渲染', () => {
    const html = renderToStaticMarkup(
      createElement(ChatHeader, {
        t,
        title: '智汇AI',
        modelLabel: '模型',
        modelName: 'DeepSeek',
        navItems,
        agentName: '智能体A',
        onAgentPress: () => {},
        onHelpPress: () => {},
        onHistoryPress: () => {},
        onClearPress: () => {},
        showClear: true,
      }),
    )
    expect(html).toContain('模型:')
    expect(html).toContain('DeepSeek')
    expect(html).toContain('智汇AI')
    const iAgent = html.indexOf('智能体A')
    const iHelp = html.indexOf('?')
    const iHistory = html.indexOf('历史')
    const iClear = html.indexOf('清除')
    expect(iAgent).toBeGreaterThan(-1)
    expect(iHelp).toBeGreaterThan(iAgent)
    expect(iHistory).toBeGreaterThan(iHelp)
    expect(iClear).toBeGreaterThan(iHistory)
  })

  it('阴性对照：showClear=false 时清除钮不渲染', () => {
    const html = renderToStaticMarkup(
      createElement(ChatHeader, {
        t,
        title: '智汇AI',
        onClearPress: () => {},
        showClear: false,
      }),
    )
    expect(html).not.toContain('清除')
    expect(html).not.toContain('模型:')
  })

  it('折叠卡：收起时 body 不渲染，展开时渲染', () => {
    const collapsed = renderToStaticMarkup(
      createElement(ChatCollapsibleCard, {
        t,
        expanded: false,
        onToggle: () => {},
        collapsedLabel: '查看',
        expandedLabel: '收起',
        title: '引导',
        body: createElement('span', null, '卡内正文'),
      }),
    )
    expect(collapsed).toContain('查看引导')
    expect(collapsed).not.toContain('卡内正文')

    const expanded = renderToStaticMarkup(
      createElement(ChatCollapsibleCard, {
        t,
        expanded: true,
        onToggle: () => {},
        collapsedLabel: '查看',
        expandedLabel: '收起',
        title: '引导',
        body: createElement('span', null, '卡内正文'),
      }),
    )
    expect(expanded).toContain('收起引导')
    expect(expanded).toContain('卡内正文')
  })

  it('压缩提示带 before/after/removed 三个读数', () => {
    const html = renderToStaticMarkup(
      createElement(ChatCompactionBanner, { t, before: 12, after: 8, removed: 4 }),
    )
    expect(html).toContain('上下文已压缩')
    expect(html).toContain('before=12')
    expect(html).toContain('after=8')
    expect(html).toContain('removed=4')
  })

  it('源码硬约束：零平台 API / 零 lucide / 零手势原语', () => {
    expect(src).not.toMatch(/\bTaro\b|wx\.|localStorage|sessionStorage|fetch\(/u)
    expect(src).not.toMatch(/lucide-react-native/u)
    expect(src).not.toMatch(/\bAnimated\b|PanResponder/u)
  })
})
