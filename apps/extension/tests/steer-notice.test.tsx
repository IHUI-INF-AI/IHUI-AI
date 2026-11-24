// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D106 Steer(中途引导)交代:extension 端此前对 onSteer 帧 0 消费。
// 锁三件事:① 有 steerNotices 的 assistant 消息渲染出交代条且含引导原文;
// ② 无/空 steerNotices 不渲染(不造空态);③ 词表键五语言直锁正仓非空。
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === 'chat.steerNoticeTitle') return `已引导 ${values?.count} 次`
      return key
    },
    locale: 'zh-CN' as const,
    setLocale: () => {},
  }),
}))

// ui-react 桶文件正被并行会话改(CategoryBar 迁移中间态),测试只解耦取 stub ——
// 被测对象是 MessageContent 自己的 steer 渲染块,不是 ContextInjectionList。
vi.mock('@ihui/ui-react', () => ({
  ContextInjectionList: () => null,
}))

import { MessageContent } from '../entrypoints/sidepanel/components/MessageContent'

const base = { id: 'm1', role: 'assistant' as const, content: '回答正文' }

describe('MessageContent 的 steer 交代条(D106)', () => {
  it('有 steerNotices → 渲染交代条,计数标题与引导原文可见', () => {
    const html = renderToStaticMarkup(
      <MessageContent
        message={{
          ...base,
          steerNotices: [
            { phase: 'injected', text: '先跑测试再改', timestamp: '2026-09-24T08:00:00Z' },
            { phase: 'injected', text: '聚焦 file-version' },
          ],
        }}
      />,
    )
    expect(html).toContain('data-testid="steer-notice"')
    expect(html).toContain('已引导 2 次')
    expect(html).toContain('先跑测试再改')
    expect(html).toContain('聚焦 file-version')
  })

  it('无 / 空 steerNotices → 不渲染交代条(不造空态)', () => {
    const none = renderToStaticMarkup(<MessageContent message={base} />)
    const empty = renderToStaticMarkup(<MessageContent message={{ ...base, steerNotices: [] }} />)
    expect(none).not.toContain('data-testid="steer-notice"')
    expect(empty).not.toContain('data-testid="steer-notice"')
  })

  it('user 消息即使带字段也不渲染(交代只属于 assistant)', () => {
    const html = renderToStaticMarkup(
      <MessageContent
        message={{
          id: 'm2',
          role: 'user',
          content: '问',
          steerNotices: [{ phase: 'injected', text: 'x' }],
        }}
      />,
    )
    expect(html).not.toContain('data-testid="steer-notice"')
  })
})

describe('steer 词表键覆盖(D106 i18n,直锁端词表正仓)', () => {
  const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
  const repoRoot = resolve(__dirname, '../../..')

  it('五种语言都补齐 chat.steerNoticeTitle 且非空(与 web steerNoticeBar.title 同源)', () => {
    for (const locale of LOCALES) {
      const json = JSON.parse(
        readFileSync(resolve(repoRoot, `packages/i18n/messages/extension/${locale}.json`), 'utf-8'),
      ) as { chat: Record<string, string> }
      expect(json.chat?.steerNoticeTitle).toBeTruthy()
      expect(json.chat?.steerNoticeTitle).toContain('{count}')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
