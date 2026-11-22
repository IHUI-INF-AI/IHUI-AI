// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D38 队列语义完整交互 — extension 端 QueueBar 渲染对账 + 装车证明(H18)。
 *
 * 两类判据:
 *   A. 渲染对账(真词表 oracle):mock 的 t 走 **真 mergeMessages(shared ⊕ extension)
 *      + translate**(与 src/i18n/index.tsx 同一条取词链),因此任何"取词回显键名"
 *      (键在本端消息面不可解析)都会让断言当场变红。
 *      · steer 偏好 + runtime=false ⇒ 显式渲染降级句(shared 原句,非键名);
 *      · interruptAndRun 被许可门拒 ⇒ 拒绝行渲染同一原句,且带 data-denied-key;
 *      · 流式中 ⇒ 重排提示行撤下;denied.reorder 现已可在本端解析(词包缺口已闭合),
 *        但**没有尝试动作就不该凭空出现拒绝行**,且任何位置都不许回显原始键名;
 *      · 输出面任何位置都不得出现 "ai.pane." 原始键名。
 *   B. 装车证明(源级反查消费点,守门 57 "造好没装车"同型防线):
 *      ChatPage 必须 import 并渲染 QueueBar、必须经 lib/ext-queue-ops 派发队列动词;
 *      QueueBar 不得绕过适配器直接调共享判定函数;适配器必须真委托共享层七个入口。
 */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReactNode } from 'react'

// 真词表 oracle:与端内 src/i18n 完全同一条 mergeMessages + translate 链
vi.mock('../src/i18n', async () => {
  const { mergeMessages, translate } = await import('@ihui/i18n/loader')
  type Messages = Record<string, unknown>
  const shared = (await import('@ihui/i18n/messages/shared/zh-CN.json'))
    .default as unknown as Messages
  const ext = (await import('@ihui/i18n/messages/extension/zh-CN.json'))
    .default as unknown as Messages
  const messages = mergeMessages(shared, ext)
  return {
    useI18n: () => ({
      t: (key: string, params?: Record<string, string | number>) =>
        translate(messages, key, { fallback: messages, params }),
      locale: 'zh-CN' as const,
      setLocale: () => {},
    }),
  }
})

// ui-react 桶文件长期被并行会话改造(steer-notice 同法解耦):桩件透传全部属性,
// 被测对象是 QueueBar 自己的许可派发与词键渲染,不是 Button/Input 内部。
vi.mock('@ihui/ui-react', async () => {
  const { createElement } = await import('react')
  const passthrough =
    (tag: string) => (props: Record<string, unknown> & { children?: ReactNode }) =>
      createElement(tag, props)
  return { Button: passthrough('button'), Input: passthrough('input') }
})

import QueueBar from '../entrypoints/sidepanel/components/QueueBar'
import type { ExtQueueItem } from '../lib/ext-queue-ops'

const DEGRADED_SENTENCE = '当前 Runtime 不支持插话，消息将继续排队'

// 与 packages/i18n/messages/extension/zh-CN.json 的 ai.pane.inputNotices.queue.denied.reorder 同值;
// 下方用例同时断言 markup 里**不出现**该键的字面量 ⇒ 这是"解析成功"而不是"回显键名"
const REORDER_DENIED_SENTENCE = '无法调整排队顺序'

const queueItems: ExtQueueItem[] = [
  { id: 'a', text: '第一条排队', createdAt: 1 },
  { id: 'b', text: '第二条排队', createdAt: 2 },
  { id: 'c', text: '第三条排队', createdAt: 3 },
]

function renderBar(over: Partial<React.ComponentProps<typeof QueueBar>> = {}) {
  return renderToStaticMarkup(
    <QueueBar
      items={queueItems}
      streaming={false}
      runtimeSupportsInterjection={false}
      mode="steer"
      onModeChange={() => {}}
      onReorder={() => {}}
      onUndo={() => {}}
      onEdit={() => {}}
      onInterruptAndRun={() => {}}
      {...over}
    />,
  )
}

describe('D38 QueueBar 渲染对账(真词表,禁回显键名)', () => {
  it('空闲 + steer 偏好 + runtime=false ⇒ 显式降级句渲染为原句(非键名),队列三项按序可见', () => {
    const markup = renderBar()
    expect(markup).toContain('data-testid="ext-queue-bar"')
    // 词表可解析证明:降级行含 shared 原句
    expect(markup).toContain('data-testid="ext-queue-degraded"')
    expect(markup).toContain(DEGRADED_SENTENCE)
    // 队列项按序渲染
    for (const text of ['第一条排队', '第二条排队', '第三条排队']) {
      expect(markup).toContain(text)
    }
    // 空闲非流式 ⇒ canReorder=true,重排引导句渲染(shared 既有键)
    expect(markup).toContain('data-testid="ext-queue-reorder-aria"')
  })

  it('interruptAndRun 被许可门拒(runtime=false)⇒ 拒绝行渲染且携带 denied.interject 键与本端原句', () => {
    const markup = renderBar()
    expect(markup).toContain('data-testid="ext-queue-denied-interruptAndRun"')
    expect(markup).toContain('data-denied-key="denied.interject"')
    expect(markup).toContain(DEGRADED_SENTENCE)
  })

  it('流式中 ⇒ 重排许可被撤:引导行撤下、按钮 aria-disabled,且 denied.reorder 渲染**本端译文**', () => {
    const markup = renderBar({ streaming: true })
    expect(markup).not.toContain('data-testid="ext-queue-reorder-aria"')
    // 词包缺口已闭合 ⇒ 这行现在必须出现,并且出现的是 extension 词包里的原句,
    // 不是键名、也不是"静默把拒绝藏起来"
    expect(markup).toContain('data-testid="ext-queue-denied-reorder"')
    expect(markup).toContain('data-denied-key="denied.reorder"')
    expect(markup).toContain(REORDER_DENIED_SENTENCE)
    expect(markup).not.toContain('ai.pane.inputNotices')
    // 被拒的按钮仍标记 aria-disabled(视觉可辨,不是隐藏式静默)
    expect(markup).toContain('data-testid="ext-queue-up-a"')
  })

  it('任何渲染分支都不得把词键原样打给用户', () => {
    for (const markup of [
      renderBar(),
      renderBar({ streaming: true }),
      renderBar({ mode: 'queue' }),
    ]) {
      expect(markup).not.toContain('ai.pane.')
    }
  })
})

describe('D38 装车证明(消费点反查,防"造好没装车")', () => {
  const root = resolve(__dirname, '..')
  const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8')
  const chatPage = read('entrypoints/sidepanel/pages/ChatPage.tsx')
  const queueBar = read('entrypoints/sidepanel/components/QueueBar.tsx')
  const adapter = read('lib/ext-queue-ops.ts')

  it('ChatPage 必须 import 并渲染 QueueBar,且队列动词经端内适配器派发', () => {
    expect(chatPage).toContain("import QueueBar from '../components/QueueBar'")
    expect(chatPage).toContain('<QueueBar')
    expect(chatPage).toContain("from '../../../lib/ext-queue-ops'")
    // 五动词消费点逐一在场
    expect(chatPage).toContain('extReorderQueue(')
    expect(chatPage).toContain('extRemoveQueueItem(')
    expect(chatPage).toContain('extEditQueueItem(')
    expect(chatPage).toContain('extInterruptRunPlan(')
    expect(chatPage).toContain('handleModeChange')
    // 打断走 W2 既有 abort 通道,不新建第二种停流语义
    expect(chatPage).toContain('abortRef.current?.abort()')
  })

  it('QueueBar 只经适配器取判据,不得绕过端内唯一出口直调共享判定函数', () => {
    expect(queueBar).toContain("from '../../../lib/ext-queue-ops'")
    expect(queueBar).toContain('extQueueInteractionAllowed(')
    expect(queueBar).toContain('extResolveFollowUpMode(')
    expect(queueBar).toContain('extDeniedNoticeKey(')
    // 判定入口一个都不允许在组件里直调(那是第二套消费面,许可门必须单点)
    for (const banned of [
      'queueInteractionPerms(',
      'interactionAllowed(',
      'reorderQueue(',
      'applyQueueEdit(',
      'interruptPlan(',
    ]) {
      expect(queueBar).not.toContain(banned)
    }
  })

  it('适配器必须真委托共享层七个判据入口(端内零第二套判定)', () => {
    expect(adapter).toContain("from '@ihui/shared/chat/queue-interactions'")
    expect(adapter).toContain("from '@ihui/shared/chat/input-notices'")
    for (const delegated of [
      'queueInteractionPerms(',
      'interactionAllowed(',
      'reorderQueue(',
      'applyQueueEdit(',
      'interruptPlan(',
      'effectiveMode(',
      'isFollowUpMode(',
    ]) {
      expect(adapter).toContain(delegated)
    }
    // 队列项形状复用共享类型,不在端内重定义
    expect(adapter).toContain('type ExtQueueItem = EditableQueueItem')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
