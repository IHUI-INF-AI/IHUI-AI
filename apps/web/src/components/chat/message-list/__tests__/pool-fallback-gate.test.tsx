// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 换号交代的**渲染闸**锁(2026-11-26 立,修「用自己的号池却看不到交代」)。
 *
 * 背景:闸曾经写成 `fallbackNotice && currentModelChannel === 'pool'`。但 UI 通路的
 * onModelChange 是单参签名、不带通道,store 的 currentModelChannel 长期停在 'platform',
 * 号池模型靠 isPoolModelId 命中才发出 account_switch 事件 —— 事件到了、闸却判 false,
 * 用户自己的账号被限流换号时反而一个字都看不到。
 *
 * 现在闸只认事件来源(唯一生产者是号池分支),所以本文件**不预置任何 store 通道**
 * (默认就是 'platform'),渲染 MessageList 后必须能看到账号口径文案。这条断言防的就是
 * 有人再把 store 通道加回闸里 —— 那样这条会立刻红。
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next-intl', async () => {
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../../packages/i18n/messages/web/zh-CN.json',
  )
  const root = JSON.parse(readFile(pack, 'utf8')) as Record<string, unknown>
  const resolve = (ns: string): Record<string, unknown> | undefined =>
    ns
      .split('.')
      .reduce<Record<string, unknown> | undefined>(
        (node, part) =>
          node && typeof node === 'object' ? (node[part] as Record<string, unknown>) : undefined,
        root,
      )
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        const raw = resolve(ns)?.[key]
        if (typeof raw !== 'string' || raw === '') return key
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
    useLocale: () => 'zh-CN',
  }
})

import MessageList from '../MessageList'
import { TooltipProvider } from '@/components/feedback'
import type { ChatMessage } from '@/stores/chat'

const messages: ChatMessage[] = [
  { id: 'u1', role: 'user', content: '随便问一句', createdAt: 1 },
  { id: 'a1', role: 'assistant', content: '随便答一句', createdAt: 2 },
]

function renderList(fallbackNotice?: { primaryModel: string; backupModel: string; reason: string }) {
  return render(
    <TooltipProvider>
      <MessageList
        messages={messages}
        isStreaming={false}
        emptyTitle="空"
        emptyHint="空"
        assistantLabel="AI"
        {...(fallbackNotice ? { fallbackNotice, onClearFallbackNotice: () => {} } : {})}
      />
    </TooltipProvider>,
  )
}

describe('号池换号交代 · 渲染闸只认事件来源', () => {
  it('store 通道仍是 platform(默认态),account_switch 事件照样渲染账号口径文案', () => {
    const { container } = renderList({
      primaryModel: '号A',
      backupModel: '号B',
      reason: 'account_switch',
    })
    const text = container.textContent ?? ''
    // 账号口径:说出「备用账号 号B」和「账号 号A 被限流/额度不足」
    expect(text).toContain('本次由备用账号')
    expect(text).toContain('号B')
    expect(text).toContain('号A')
    // 不是模型换腿那句(两条语义不同,不许互相兜)
    expect(text).not.toContain('fallbackNotice')
  })

  it('没有事件就不渲染 —— 平台/auto 通道照旧静默', () => {
    const { container } = renderList()
    expect(container.textContent ?? '').not.toContain('本次由备用账号')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
