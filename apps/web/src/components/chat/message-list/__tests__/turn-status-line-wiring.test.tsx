// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D71 十态轮次状态徽章 · **装车证明**(2026-10-29 立)。
 *
 * 环境取默认 happy-dom(与同目录 `presentation-wiring.test.tsx` 同档):`MessageList`
 * 挂载时会调 `scrollIntoView`,jsdom 不带这个方法 ⇒ 全文件在 mount 阶段就炸,
 * 断言根本跑不到(那是环境问题被读成"接线坏了")。
 *
 * 立因(本仓 §0.9「造好没装车」= 没有):`TurnStatusBadge`(组件)建好、
 * 词包五语言齐、单测全绿;它的唯一引用方 `TurnStatusLine` 自己**没有任何生产消费者**。
 * 三层齐备而用户屏幕上零像素 —— 纯函数测试与组件测试都证明不了"有人问它",
 * 所以本文件**渲染真实的 `MessageList`**,从生产入口咬住这条链。
 *
 * 四组断言(前三组成对,任一单边过 = 假绿):
 *  ① 正向:活跃轮次(流式中)⇒ 流尾出现 `[data-testid="turn-status-line"]`,且带状态格;
 *  ② 反向:空闲(无流式、无失败)⇒ 整段不出现(不得画一个"已完成");
 *  ③ 反向:终态直传 ⇒ 不出现(判据 `isActiveTurnState`,不得满屏"已完成");
 *  ④ 优先级:审批待决 > 工具在跑 > 纯生成(投影次序即判据,钉在 DOM 上)。
 *
 * 判据不复制(§0.6):"哪些算活跃"一律问 shared 的 `isActiveTurnState`;
 * 本文件只在"DOM 里有没有"这一层断言,不重抄状态名单。
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MessageList from '../MessageList'
import { shouldShowTurnStatusLine } from '../turn-status-line'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage, type ToolCall } from '@/stores/chat'
import { ACTIVE_TURN_STATES, TERMINAL_TURN_STATES } from '@ihui/shared/chat/turn-status'

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
  const resolveNs = (ns: string): Record<string, unknown> | undefined =>
    ns
      .split('.')
      .reduce<Record<string, unknown> | undefined>(
        (node, part) =>
          node && typeof node === 'object' ? (node[part] as Record<string, unknown>) : undefined,
        root,
      )
  // 真实 next-intl 的 key 支持**点路径**(`t('state.thinking')` 会逐段下钻),mock 必须同形 ——
  // 只认一级子键的话,所有"键本身带点"的取词都会返回键名,测试会误判成"文案没接上"。
  const lookup = (ns: string, key: string): unknown => {
    let node: unknown = resolveNs(ns)
    for (const part of key.split('.')) {
      if (!node || typeof node !== 'object') return undefined
      node = (node as Record<string, unknown>)[part]
    }
    return node
  }
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        const raw = lookup(ns, key)
        if (typeof raw !== 'string' || raw === '') return key
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
    useLocale: () => 'zh-CN',
  }
})

// 审批待决事实源走 useSyncExternalStore(hook 形态),测试里换成可控开关。
// 只覆盖这一个导出、其余保留真品 —— ToolApprovalDialog 与它同模块,别处仍要用。
const approvalState = { pending: false }
vi.mock('@/components/ai/tool-approval-dialog', async () => {
  const actual = await vi.importActual('@/components/ai/tool-approval-dialog')
  return {
    ...(actual as Record<string, unknown>),
    useToolApprovalPending: () => approvalState.pending,
  }
})

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0)

function userMsg(id: string, content = 'hi'): ChatMessage {
  return { id, role: 'user', content, createdAt: NOW }
}

function assistantMsg(id: string, patch: Partial<ChatMessage> = {}): ChatMessage {
  return { id, role: 'assistant', content: '', createdAt: NOW + 1000, model: 'm', ...patch }
}

function runningTool(id = 'tc-1'): ToolCall {
  return { id, toolName: 'read_file', status: 'running', args: {} }
}

function renderList(messages: ChatMessage[], isStreaming: boolean) {
  useChatStore.setState({ messages, isStreaming })
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

/** 流尾徽章节点(生产入口的 DOM 锚点) */
function badge(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-testid="turn-status-line"]')
}

beforeEach(() => {
  approvalState.pending = false
  useChatStore.setState({ messages: [], isStreaming: false })
})

afterEach(() => {
  cleanup()
  approvalState.pending = false
  useChatStore.setState({ messages: [], isStreaming: false })
})

describe('D71 徽章装车 · 活跃轮次(正向)', () => {
  it('流式中 ⇒ 流尾出现徽章,状态格为 thinking(不是空壳)', () => {
    const msgs = [userMsg('u1'), assistantMsg('a1')]
    const { container } = renderList(msgs, true)

    const line = badge(container)
    // 断开接线(删掉 MessageList 里的 <TurnStatusLine/>)此处恒为 null —— 本用例的牙
    expect(line, '活跃轮次必须出现轮次状态徽章').not.toBeNull()
    expect(line?.getAttribute('data-turn-active')).toBe('true')
    // 状态格由徽章内层 span 承载;徽章本体带 data-turn-state
    expect(line?.querySelector('[data-turn-state]')?.getAttribute('data-turn-state')).toBe(
      'thinking',
    )
    expect(
      line?.querySelector('[data-turn-state-label]')?.getAttribute('data-turn-state-label'),
    ).toBe('thinking')
    // 文案真的取到了词包(不是一个裸键名)
    expect(line?.textContent ?? '').toContain('思考中')
    expect(line?.textContent ?? '').not.toContain('state.thinking')
  })

  it('最后一条助手消息有 running 工具 + 流式中 ⇒ usingTool', () => {
    const msgs = [userMsg('u1'), assistantMsg('a1', { toolCalls: [runningTool()] })]
    const { container } = renderList(msgs, true)
    expect(
      badge(container)?.querySelector('[data-turn-state]')?.getAttribute('data-turn-state'),
    ).toBe('usingTool')
  })

  it('审批待决优先于"正在流式" ⇒ waitingConfirm(D71 立项时无处可见的那一格)', () => {
    approvalState.pending = true
    const msgs = [userMsg('u1'), assistantMsg('a1', { toolCalls: [runningTool()] })]
    const { container } = renderList(msgs, true)
    const stateEl = badge(container)?.querySelector('[data-turn-state]')
    expect(stateEl?.getAttribute('data-turn-state')).toBe('waitingConfirm')
    // 与"思考中"不同形:warning 色 + waitsUser(球在用户这边)
    expect(stateEl?.getAttribute('data-turn-waits-user')).toBe('true')
    expect(stateEl?.getAttribute('data-turn-tone')).toBe('warning')
  })
})

describe('D71 徽章装车 · 非活跃态不得出现(反向)', () => {
  it('空闲(无流式、无失败、无排队)⇒ 整段不渲染', () => {
    const { container } = renderList([userMsg('u1'), assistantMsg('a1', { content: 'ok' })], false)
    expect(badge(container), '空闲时画徽章 = 把"没在跑"写成状态事实').toBeNull()
  })

  it('历史消息里的失败轮次(非活跃)⇒ 不常驻徽章(否则历史满屏"失败")', () => {
    const { container } = renderList(
      [userMsg('u1'), assistantMsg('a1', { error: true, content: 'boom' })],
      false,
    )
    // 错误语义由既有错误卡承担;轮次徽章不重复宣称
    expect(badge(container)).toBeNull()
  })
})

describe('D71 徽章装车 · 终态门(isActiveTurnState 复用)', () => {
  it('十态逐个过渲染门:活跃态 true、终态 false(判据与 shared 同源)', () => {
    for (const state of ACTIVE_TURN_STATES) {
      expect(shouldShowTurnStatusLine(state), `${state} 应算活跃`).toBe(true)
    }
    for (const state of TERMINAL_TURN_STATES) {
      expect(shouldShowTurnStatusLine(state), `${state} 是终态,不得常驻徽章`).toBe(false)
    }
    expect(shouldShowTurnStatusLine(null)).toBe(false)
    // 反例钉死:门的结论与 shared 的名单必须一致,不得端内另写一张
    expect(ACTIVE_TURN_STATES.length + TERMINAL_TURN_STATES.length).toBe(10)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
