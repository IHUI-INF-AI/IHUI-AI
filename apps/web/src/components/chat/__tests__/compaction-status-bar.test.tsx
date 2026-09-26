// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CompactionStatusBar — 截断披露必须与「实际省略量」配对(机制吸收 A10B-7,2026-09-26 立)
 *
 * 立因:同一块里两个相邻披露口宽严不同形 ——
 *   `:128` 的"已截断"提示只看 `trigger === 'truncated'` 一个标志位,
 *   `:133` 的归档入口却看 `removedCount > 0`。
 * 而 `trigger === 'truncated'` **不蕴含**真有历史被折叠:`tryTruncateFallback()` 把
 * removedCount 取成"除最后一个配对组之外被折进摘要的条数"
 * (packages/context-compaction/src/index.ts:463),只剩一个组时它就是 0
 * ⇒ 界面会念出"已截断…(省略 0 条)"这种自相矛盾的话。
 *
 * 本文件不 mock `next-intl`,而是挂**真的 NextIntlClientProvider + 真词包**
 * —— 否则"文案里的数字 === 真实计数""不带千分位"这两条只是在复读测试自己的替身
 * (AGENTS §22c:"镜像测试若只复读实现,它就只是复读机")。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ReactNode } from 'react'

import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useChatStore, type CompactionStatus } from '@/stores/chat'
import { CompactionStatusBar } from '../compaction-status-bar'

// 归档弹层的两个远端调用与渲染无关(本票不碰它),桩掉避免真发请求
vi.mock('@ihui/api-client', () => ({
  listCompactionArchives: vi.fn(async () => ({ success: false, data: {} })),
  getCompactionArchive: vi.fn(async () => ({ success: false, data: {} })),
}))
// Modal / Tooltip 会拉进 portal 与 Radix 运行时,与本判据无关 → 轻量替身
vi.mock('@/components/feedback/Modal', () => ({
  Modal: ({ children }: { children?: ReactNode }) => <div data-stub="modal">{children}</div>,
}))
vi.mock('@/components/feedback/Tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <span data-stub="tooltip">{children}</span>,
}))

const here = dirname(fileURLToPath(import.meta.url))
// __tests__ → chat → components → src → web(apps/web) → packages/i18n/messages/web
const MESSAGES_FILE = join(here, '../../../../../../packages/i18n/messages/web/zh-CN.json')

type Messages = Record<string, unknown>
const messages = JSON.parse(readFileSync(MESSAGES_FILE, 'utf8')) as Messages

/** 真词包里这条披露的本体(带 ICU `{count}` 占位)。 */
const truncatedTemplate =
  (((messages.chat as Messages).compaction as Messages).truncatedNotice as string) ?? ''

/** A10B-8:同一命名空间里"只报事实、不报条数"的那一句(无 `{count}` 占位)。
 *  刻意从真词包取而不是在测试里抄一份字面量 —— 抄一份就成了"测试替身自证"。 */
const truncatedNoCountTemplate =
  (((messages.chat as Messages).compaction as Messages).truncatedNoticeNoCount as string) ?? ''

/** 把真词包模板按"裸数字"口径填成期望文案 —— 即组件实际应当渲染出的那一串。 */
const expectedNotice = (count: number): string =>
  truncatedTemplate.replace('{count}', String(count))

const status = (
  over: Partial<Extract<CompactionStatus, { phase: 'done' }>> = {},
): CompactionStatus => ({
  phase: 'done',
  tokensBefore: 100,
  tokensAfter: 50,
  removedCount: 3,
  ...over,
})

const renderBar = () =>
  render(
    <NextIntlClientProvider locale="zh-CN" messages={messages}>
      <CompactionStatusBar />
    </NextIntlClientProvider>,
  )

beforeEach(() => {
  // conversationId 一律置空:把"归档入口"这个同判据的兄弟节点从断言面上摘出去,
  // 这样 textContent 里出现的截断-related 文本只可能来自被审的那一句披露。
  useChatStore.setState({ compactionStatus: status(), conversationId: null })
})

afterEach(() => {
  vi.clearAllMocks()
  useChatStore.setState({ compactionStatus: null, conversationId: null })
})

describe('CompactionStatusBar / 截断披露与实际省略量配对(A10B-7)', () => {
  it('词包自检:这条披露确实带 {count} 占位(不带则下面所有断言都是空转)', () => {
    expect(truncatedTemplate).toContain('{count}')
  })

  it('trigger=truncated 且省略量为 0 → 不渲染"已截断"披露', () => {
    useChatStore.setState({
      compactionStatus: status({ trigger: 'truncated', removedCount: 0 }),
    })
    const { container } = renderBar()
    const text = container.textContent ?? ''
    // 整句(含 0)一个字都不该出现
    expect(text).not.toContain(expectedNotice(0))
    expect(text).not.toContain('省略 0')
  })

  it('省略量为 0 时摘要行也不念"压缩 0 条历史为摘要"(同文件第二处同类披露一并对齐)', () => {
    useChatStore.setState({
      compactionStatus: status({ trigger: 'truncated', removedCount: 0 }),
    })
    const { container } = renderBar()
    expect(container.textContent ?? '').not.toContain('压缩 0 条')
    // tokens 摘要本身照常显示(不能把整行一起关掉)
    expect(container.textContent ?? '').toContain('100')
    expect(container.textContent ?? '').toContain('50')
  })

  it('省略量 > 0 → 渲染,且文案里的数字 === 真实计数', () => {
    useChatStore.setState({
      compactionStatus: status({ trigger: 'truncated', removedCount: 7 }),
    })
    const { container } = renderBar()
    const text = container.textContent ?? ''
    expect(text).toContain(expectedNotice(7))
    // 摘要行与披露口同数(同一个 omittedCount,不是两处各算一份)
    expect(text).toContain('压缩 7 条历史为摘要')
  })

  it('四位省略量:渲染为裸数字,不出现千分位分隔符(与摘要行同格式)', () => {
    useChatStore.setState({
      compactionStatus: status({ trigger: 'truncated', removedCount: 1234 }),
    })
    const { container } = renderBar()
    const text = container.textContent ?? ''
    expect(text).toContain(expectedNotice(1234))
    // 整行不得出现任何分组数字(1,234 / 1,234,567 形态)
    expect(/\d{1,3}(,\d{3})+/.test(text)).toBe(false)
  })

  it('trigger 非 truncated → 即使省略量 > 0 也不出这句截断披露(不得把摘要压缩说成截断)', () => {
    useChatStore.setState({ compactionStatus: status({ trigger: 'ratio', removedCount: 5 }) })
    const { container } = renderBar()
    expect(container.textContent ?? '').not.toContain(expectedNotice(5))
  })

  it('compactionStatus 整体缺席 → 不渲染也不抛(数据缺席 ≠ 显示 0)', () => {
    useChatStore.setState({ compactionStatus: null })
    expect(() => renderBar()).not.toThrow()
  })

  it('归档入口与截断披露同判据:省略量为 0 时两者都不出现', () => {
    useChatStore.setState({
      compactionStatus: status({ trigger: 'truncated', removedCount: 0 }),
      conversationId: 'conv-1',
    })
    const { container } = renderBar()
    const text = container.textContent ?? ''
    expect(text).not.toContain(expectedNotice(0))
    // 「查看已压缩的 N 条原始消息」这一入口同样必须随计数为 0 而消失
    expect(text).not.toMatch(/查看已压缩的\s*0\s*条/)
  })

  it('省略量 > 0 且有会话:归档入口照常出现(判据收窄不等于把入口一起摘掉)', () => {
    useChatStore.setState({
      compactionStatus: status({ trigger: 'truncated', removedCount: 4 }),
      conversationId: 'conv-1',
    })
    const { container } = renderBar()
    const text = container.textContent ?? ''
    expect(text).toContain('查看已压缩的 4 条原始消息')
    expect(text).toContain(expectedNotice(4))
  })

  // ==================== A10B-8(2026-09-26):截断量成为独立事实 ====================
  // 立因:A10B-7 把"省略量为 0"当成"什么都没发生",于是整句不显示 —— 从说谎退成沉默。
  // 真相是"这一轮确实切过内容,只是没整条移出历史",该事实现由帧上的 `truncatedCount` 携带。

  it('词包自检:无条数那一句在位且不带 {count} 占位(带占位却又不填就是半成品)', () => {
    expect(truncatedNoCountTemplate.length).toBeGreaterThan(0)
    expect(truncatedNoCountTemplate).not.toContain('{count}')
  })

  it('截断但省略量为 0、帧报 truncatedCount=1 → 必须报"已截断"(沉默即缺陷),且不出现任何条数', () => {
    useChatStore.setState({
      compactionStatus: status({ trigger: 'truncated', removedCount: 0, truncatedCount: 1 }),
    })
    const { container } = renderBar()
    const text = container.textContent ?? ''
    expect(text).toContain(truncatedNoCountTemplate)
    // 报事实 ≠ 编数:既不能出现"省略 0",也不能出现"省略 1"(1 是截断量,不是省略量)
    expect(text).not.toMatch(/省略\s*\d/)
    expect(text).not.toContain(expectedNotice(0))
    expect(text).not.toContain(expectedNotice(1))
    // tokens 摘要行照常显示(整行不得被一起关掉)
    expect(text).toContain('100')
    expect(text).toContain('50')
  })

  it('截断且省略量为 5 → 报数那一句,数取 removedCount 而非 truncatedCount(两维不得混用)', () => {
    useChatStore.setState({
      compactionStatus: status({ trigger: 'truncated', removedCount: 5, truncatedCount: 1 }),
    })
    const { container } = renderBar()
    const text = container.textContent ?? ''
    expect(text).toContain(expectedNotice(5))
    // ⚠️ 无条数那句在词包里有且仅是有条数那句的**前缀**(去掉括号就是它),
    // 所以 `not.toContain(前缀)` 结构上不可能成立 —— 那样写会把一条正确的实现判成失败。
    // 判"只出一句"只能用出现次数:两个分支同时渲染时前缀会出现两次。
    expect(text.split(truncatedNoCountTemplate).length - 1).toBe(1)
    // 而报的数必须是省略量 5,不是截断量 1
    expect(text).not.toContain(expectedNotice(1))
  })

  it('生产者明说 truncatedCount=0(本轮确实没切内容)→ 截断句不得出现', () => {
    useChatStore.setState({
      compactionStatus: status({ trigger: 'truncated', removedCount: 0, truncatedCount: 0 }),
    })
    const { container } = renderBar()
    const text = container.textContent ?? ''
    expect(text).not.toContain(truncatedNoCountTemplate)
    expect(text).not.toMatch(/省略\s*\d/)
  })

  it('旧帧未带该字段(undefined)→ 按标志位兜底报"已截断"(向后兼容:不崩、也不因缺字段而沉默)', () => {
    useChatStore.setState({
      compactionStatus: status({ trigger: 'truncated', removedCount: 0 }),
    })
    const { container } = renderBar()
    expect(container.textContent ?? '').toContain(truncatedNoCountTemplate)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
