// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 轮次呈现投影层的**装车证明**(2026-10-29 立)。
 *
 * 立因(本仓 §0.9 铁律):投影层交付时 51 例纯函数单测全绿,却**零生产消费** ——
 * `MessageList` 仍 `renderItems.map`,只有测试在读 `presentationStructureRevision`。
 * 纯函数测试证明不了"有人调用它",正如守门 70/76/81 反复记过的同型:
 * 判据/组件存在 ≠ 有人把它挂进生产路径。
 *
 * 本文件因此**渲染真实的 `MessageList`**,断言四组(前三组成对,缺任一对即假绿):
 *  ① 正向:连续两条助手消息 ⇒ 出现**一个** `thinkingAgent` 容器包住它们;
 *  ② 反向:单条用户消息 / 单条纯答案 ⇒ **不得**凭空造出容器;
 *  ③ 缓存:流式只改最后一条 ⇒ 前缀分组容器的 DOM 节点是**同一个实例**;
 *  ④ 语义位:`isExploring` 为真时容器带 `data-presentation-exploring="true"`,
 *    思考型工具为 false(成对)。
 *
 * 判据不复制(§0.6):工具名/类目一律经生产导出(`turn-presentation` 的纯函数),
 * 本文件只断言 DOM 形态。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import MessageList from '../MessageList'
import { TooltipProvider } from '@/components/feedback'
import type { ChatMessage, ToolCall } from '@/stores/chat'

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

let seq = 0
function tool(toolName: string, status: ToolCall['status'] = 'running'): ToolCall {
  seq += 1
  return { id: `tc-${seq}`, toolName, status, args: {} }
}

function userMsg(id: string, content = 'hi'): ChatMessage {
  return { id, role: 'user', content, createdAt: 1_760_000_000_000 }
}

function assistantMsg(id: string, patch: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    role: 'assistant',
    content: 'ok',
    createdAt: 1_760_000_001_000,
    model: 'test-model',
    ...patch,
  }
}

function renderList(messages: ChatMessage[], isStreaming = false) {
  return render(
    <TooltipProvider>
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        emptyTitle="空"
        emptyHint="空"
        assistantLabel="AI"
      />
    </TooltipProvider>,
  )
}

/** 所有 `thinkingAgent` 容器的 DOM 节点(顺序即渲染顺序)。 */
function containers(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('[data-presentation-row-type="thinkingAgent"]'),
  )
}

beforeEach(() => {
  seq = 0
})

afterEach(() => {
  cleanup()
})

describe('投影层装车证明 · 容器形态(成对)', () => {
  it('连续两条助手消息 ⇒ 一个 thinkingAgent 容器包住两条(而不是两个游离块)', () => {
    const { container } = renderList([
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file')] }),
      assistantMsg('a2', { toolCalls: [tool('grep')] }),
    ])

    const boxes = containers(container)
    expect(boxes, '投影层若未接线,此处恒为 0 —— 这就是本用例的牙').toHaveLength(1)

    const box = boxes[0] as HTMLElement
    expect(box.getAttribute('data-presentation-row-type')).toBe('thinkingAgent')
    expect(box.getAttribute('data-presentation-message-count')).toBe('2')
    // 两条消息都在同一个容器内(不是各挂各的)
    const blockIds = Array.from(box.querySelectorAll('[data-presentation-block]')).map((el) =>
      el.getAttribute('data-presentation-block'),
    )
    expect(blockIds).toEqual(['a1', 'a2'])
    // 每条消息本体(MessageItem 的 data-message-id)确实在容器内部
    for (const id of ['a1', 'a2']) {
      expect(box.querySelector(`[data-message-id="${id}"]`), `${id} 应在容器内`).not.toBeNull()
    }
  })

  it('反向:单条用户消息 ⇒ 不得凭空造出 thinkingAgent 容器', () => {
    const { container } = renderList([userMsg('u1')])
    expect(containers(container)).toHaveLength(0)
    // 游离消息仍带投影行标记(证明投影层在跑,只是不聚合)
    const rows = container.querySelectorAll('[data-presentation-row-type]')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.getAttribute('data-presentation-row-type')).toBe('message')
    expect(container.querySelector('[data-message-id="u1"]')).not.toBeNull()
  })

  it('反向:单条纯答案(无中间过程)⇒ 同样不套容器(避免每条回答多一层空壳)', () => {
    const { container } = renderList([userMsg('u1'), assistantMsg('a1', { content: '直接答案' })])
    expect(containers(container)).toHaveLength(0)
    expect(container.querySelectorAll('[data-presentation-row-type="message"]')).toHaveLength(2)
  })

  it('反向:失败轮(带 error)不被收进容器 —— 重试/交接入口必须留在外面', () => {
    const { container } = renderList([
      userMsg('u1'),
      assistantMsg('a1', { error: true, errorCode: 'E_UNKNOWN', toolCalls: [tool('read_file')] }),
    ])
    expect(containers(container)).toHaveLength(0)
  })
})

describe('投影层装车证明 · 段级缓存(前缀节点引用不变)', () => {
  it('流式只改最后一条 ⇒ 前缀容器 DOM 节点是同一实例,不整表重建', () => {
    const u1 = userMsg('u1')
    const a1 = assistantMsg('a1', { toolCalls: [tool('read_file')] })
    const u2 = userMsg('u2')
    const a2 = assistantMsg('a2', { toolCalls: [tool('grep')], content: '' })

    const view = renderList([u1, a1, u2, a2], true)
    const before = containers(view.container)
    // 两组:u1 后的 {a1} 与 u2 后的 {a2}
    expect(before).toHaveLength(2)
    const firstContainerBefore = before[0] as HTMLElement
    const firstNodeBefore = firstContainerBefore.querySelector('[data-message-id="a1"]')
    expect(firstNodeBefore).not.toBeNull()

    // 模拟流式 appendToMessage:只替换最后一条消息对象,其余引用不动(store 的真实形态)
    const a2Next: ChatMessage = { ...a2, content: 'ok' }
    view.rerender(
      <TooltipProvider>
        <MessageList
          messages={[u1, a1, u2, a2Next]}
          isStreaming
          emptyTitle="空"
          emptyHint="空"
          assistantLabel="AI"
        />
      </TooltipProvider>,
    )

    const after = containers(view.container)
    expect(after).toHaveLength(2)
    // 关键断言:前缀容器的 DOM 节点与其中的消息节点都是**同一个实例**。
    // 若缓存没生效(每渲染新建 cache / 用 useMemo 依赖 messages 数组),
    // 前缀容器会拿到新 key 之外的同一 key 但整树重挂 —— 这里换成 toBe 比对的是
    // 真实节点身份,节点被 React 重建即失败。
    expect(after[0], '前缀容器不得被重建').toBe(firstContainerBefore)
    expect(after[0]?.querySelector('[data-message-id="a1"]')).toBe(firstNodeBefore)
    // 尾组内容确实前进了一帧(证明这不是"压根没重渲染"的假绿)
    expect(after[1]?.querySelector('[data-message-id="a2"]')?.textContent).toContain('ok')
  })

  it('生产面能读到投影统计:复用行 > 0、重算行 <= 总行(缓存不是摆设)', () => {
    const u1 = userMsg('u1')
    const a1 = assistantMsg('a1', { toolCalls: [tool('read_file')] })
    const u2 = userMsg('u2')
    const a2 = assistantMsg('a2', { toolCalls: [tool('grep')], content: '' })

    const view = renderList([u1, a1, u2, a2], true)
    const panel = () => view.container.querySelector('[data-testid="message-list-inline-panel"]')
    const revisionBefore = Number(panel()?.getAttribute('data-presentation-structure-revision'))
    expect(Number.isFinite(revisionBefore)).toBe(true)

    const a2Next: ChatMessage = { ...a2, content: 'ok' }
    view.rerender(
      <TooltipProvider>
        <MessageList
          messages={[u1, a1, u2, a2Next]}
          isStreaming
          emptyTitle="空"
          emptyHint="空"
          assistantLabel="AI"
        />
      </TooltipProvider>,
    )

    const reused = Number(panel()?.getAttribute('data-presentation-reused-rows'))
    const recomputed = Number(panel()?.getAttribute('data-presentation-recomputed-rows'))
    const revisionAfter = Number(panel()?.getAttribute('data-presentation-structure-revision'))
    // 关键:流式一帧之后,前缀段的行被**复用**了(reused > 0),不是整表重算
    expect(reused, '流式一帧必须复用前缀段(否则这层等于不存在)').toBeGreaterThan(0)
    // 本次只重算最后一段(容器 + 活动组 = 2 行),远小于总行数
    expect(recomputed).toBeGreaterThan(0)
    expect(recomputed).toBeLessThan(reused + recomputed)
    // 结构确实变了 ⇒ 版本号前进
    expect(revisionAfter).toBeGreaterThan(revisionBefore)
  })

  it('原样重渲染(消息数组引用都换、消息对象不换)⇒ 复用全部行、版本号不前进', () => {
    const u1 = userMsg('u1')
    const a1 = assistantMsg('a1', { toolCalls: [tool('read_file')] })
    const view = renderList([u1, a1], false)
    const panel = () => view.container.querySelector('[data-testid="message-list-inline-panel"]')
    const revisionBefore = Number(panel()?.getAttribute('data-presentation-structure-revision'))

    // 新数组引用、同一批消息对象 —— 这正是"store 之外的父级重渲染"那种形态
    view.rerender(
      <TooltipProvider>
        <MessageList
          messages={[u1, a1]}
          isStreaming={false}
          emptyTitle="空"
          emptyHint="空"
          assistantLabel="AI"
        />
      </TooltipProvider>,
    )
    expect(Number(panel()?.getAttribute('data-presentation-structure-revision'))).toBe(revisionBefore)
    // 全部复用、零重算
    expect(Number(panel()?.getAttribute('data-presentation-recomputed-rows'))).toBe(0)
  })
})

describe('投影层装车证明 · isExploring 语义位(成对)', () => {
  it('探索型工具在跑 ⇒ 容器 data-presentation-exploring="true"', () => {
    const { container } = renderList(
      [userMsg('u1'), assistantMsg('a1', { toolCalls: [tool('read_file')] })],
      true,
    )
    const box = containers(container)[0]
    expect(box).toBeTruthy()
    expect(box?.getAttribute('data-presentation-exploring')).toBe('true')
  })

  it('思考型工具在跑 ⇒ 同一属性为 "false"(两态在 DOM 上可判,不是恒真)', () => {
    const { container } = renderList(
      [userMsg('u1'), assistantMsg('a1', { toolCalls: [tool('think')] })],
      true,
    )
    const box = containers(container)[0]
    expect(box).toBeTruthy()
    expect(box?.getAttribute('data-presentation-exploring')).toBe('false')
  })
})

describe('投影层装车证明 · 既有锚点未丢', () => {
  it('窗口化探针与消息锚点仍在(接入投影不得挤掉既有 data-*)', () => {
    const { container } = renderList([
      userMsg('u1'),
      assistantMsg('a1', { toolCalls: [tool('read_file')] }),
    ])
    const panel = container.querySelector('[data-testid="message-list-inline-panel"]')
    expect(panel).not.toBeNull()
    // 窗口化三态探针
    expect(panel?.getAttribute('data-window-active')).toBe('false')
    expect(panel?.getAttribute('data-window-total')).toBe('2')
    expect(panel?.hasAttribute('data-window-start')).toBe(true)
    expect(panel?.hasAttribute('data-window-end')).toBe(true)
    expect(panel?.hasAttribute('data-window-mounted')).toBe(true)
    // 消息级锚点仍在(容器化后不得丢)
    expect(container.querySelectorAll('[data-message-id]').length).toBe(2)
    // 助手消息的中间步骤组锚点仍在(视觉壳没被投影层抢走)
    expect(container.querySelector('[data-testid="message-steps-group-a1"]')).not.toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
