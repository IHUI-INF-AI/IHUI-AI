// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 投影层接入后**窗口化坐标系未被改变**的锁(2026-10-29 立)。
 *
 * 这一条是本次装车最重要的兼容性判据(任务要求:窗口化不许破)。它锁的不变量:
 *
 *   `data-window-mounted`(窗口按**消息**计的挂载条数)
 *     === `[data-presentation-block]` 数 + `[data-presentation-row-type="message"]` 数
 *     (即:DOM 里真正的测高块数)。
 *
 * 为什么必须相等:`use-message-list-scroll` 的 `computeCumulative` 按
 * `messages.length` 建 offsets、按 **messageId** 存 `heightMap`、`measureItem` 也只挂在
 * 消息块上。若容器的引入让"测高块 ≠ 消息"(比如把容器本身也当一行来测高,或把 N 条
 * 消息折叠成一个块),offset 链与真实高度就会分叉 —— 表现是滚动条比例失真、可见窗口
 * 漂移,而截图判不出来(必须读 data-* 数值)。
 *
 * 阈值档位(60 / 缓冲 6 / 上限 120)与几何判据本身**一个字都没改**(`windowing.ts` 未触碰),
 * 本条只证明"投影层喂给它的那份坐标系没变"。
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
import type { ChatMessage, ToolCall } from '@/stores/chat'

let seq = 0
function tool(toolName: string): ToolCall {
  seq += 1
  return { id: `tc-w-${seq}`, toolName, status: 'running', args: {} }
}

/** 每轮 = 1 条用户 + 3 条带工具的助手消息(助手会被聚成一个 thinkingAgent 容器)。 */
function buildConversation(turns: number): ChatMessage[] {
  const out: ChatMessage[] = []
  for (let i = 0; i < turns; i += 1) {
    out.push({ id: `u${i}`, role: 'user', content: `q${i}`, createdAt: i * 10 })
    for (let k = 0; k < 3; k += 1) {
      out.push({
        id: `a${i}-${k}`,
        role: 'assistant',
        content: `a${i}-${k}`,
        createdAt: i * 10 + k + 1,
        toolCalls: [tool('read_file')],
      })
    }
  }
  return out
}

function renderList(messages: ChatMessage[]) {
  return render(
    <TooltipProvider>
      <MessageList
        messages={messages}
        isStreaming={false}
        emptyTitle="空"
        emptyHint="空"
        assistantLabel="AI"
      />
    </TooltipProvider>,
  )
}

/** DOM 里真正的测高块数:容器内块 + 游离消息行。 */
function measuredUnits(root: ParentNode): number {
  return (
    root.querySelectorAll('[data-presentation-block]').length +
    root.querySelectorAll('[data-presentation-row-type="message"]').length
  )
}

describe('窗口化坐标系 · 投影接入后不自相矛盾', () => {
  it('未窗口化(<= 60 条):测高块数 == 消息数,且每轮恰好一个容器', () => {
    const messages = buildConversation(10) // 40 条
    const { container } = renderList(messages)
    const panel = container.querySelector('[data-testid="message-list-inline-panel"]')

    expect(panel?.getAttribute('data-window-active')).toBe('false')
    expect(panel?.getAttribute('data-window-total')).toBe('40')
    // 10 轮 × 3 条助手 ⇒ 10 个容器
    expect(container.querySelectorAll('[data-presentation-row-type="thinkingAgent"]')).toHaveLength(
      10,
    )
    // 关键不变量:测高块数 == 消息数(窗口化那一侧的坐标系没被改变)
    expect(measuredUnits(container)).toBe(40)
    expect(panel?.getAttribute('data-window-mounted')).toBe('40')
  })

  it('窗口化(> 60 条):data-window-mounted 仍按消息计,且等于 DOM 测高块数', () => {
    const messages = buildConversation(25) // 100 条 > 阈值 60
    const { container } = renderList(messages)
    const panel = container.querySelector('[data-testid="message-list-inline-panel"]')

    expect(panel?.getAttribute('data-window-active'), '100 条必须真的启用窗口化').toBe('true')
    // 总量按消息计(不是按投影行计 —— 投影行会更少,因为助手被聚合)
    expect(panel?.getAttribute('data-window-total')).toBe('100')

    const mounted = Number(panel?.getAttribute('data-window-mounted'))
    expect(mounted, '窗口化必须真的裁剪(不得挂满 100)').toBeLessThan(100)
    expect(mounted).toBe(measuredUnits(container))
    // 投影行数确实少于消息数(容器真的聚合了),否则"接入投影"这件事没发生
    const presentationRows = container.querySelectorAll('[data-presentation-row]').length
    expect(presentationRows, '投影行应少于消息数(助手被聚合进容器)').toBeLessThan(mounted)
  })

  it('窗口内窗口外都不丢消息:整表消息 id 集合 == 已挂载 + 占位所代表的那批', () => {
    const messages = buildConversation(25)
    const { container } = renderList(messages)
    const panel = container.querySelector('[data-testid="message-list-inline-panel"]')
    const mounted = Number(panel?.getAttribute('data-window-mounted'))
    const start = Number(panel?.getAttribute('data-window-start'))
    const end = Number(panel?.getAttribute('data-window-end'))

    // 窗口区间宽度必须等于挂载条数(否则区间与渲染不同步)
    expect(end - start + 1).toBe(mounted)
    // 挂载的消息块 id 集合必须恰好是 messages[start..end]
    const renderedIds = new Set(
      Array.from(container.querySelectorAll('[data-presentation-block]')).map((el) =>
        el.getAttribute('data-presentation-block'),
      ),
    )
    for (const el of Array.from(
      container.querySelectorAll('[data-presentation-row-type="message"]'),
    )) {
      const id = el.querySelector('[data-message-id]')?.getAttribute('data-message-id')
      if (id) renderedIds.add(id)
    }
    const expected = messages.slice(start, end + 1).map((m) => m.id)
    expect(Array.from(renderedIds).sort()).toEqual(expected.slice().sort())

    // 窗口外由占位高度承担:顶部/底部 padding 至少有一侧 > 0(内容被真的裁剪时才可能)
    const padTop = Number(panel?.getAttribute('data-window-padding-top'))
    const padBottom = Number(panel?.getAttribute('data-window-padding-bottom'))
    expect(padTop + padBottom, '窗口外必须有占位高度顶住滚动条').toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
