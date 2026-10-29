// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-28 V3 #71 装载 —— 对话流尾部的轮次状态徽章。
//
// D71 的徽章组件早在 HEAD 里(`@/components/ai/turn-status-badge`),词包五语言也齐
// (`ai.pane.turnStatus` 的 title/state/aria/hint/action 五组),**唯独没有任何地方渲染它**
// —— 于是"等待确认"与"后台执行中"两格仍然无处可见,而它的单测一路绿(只证明函数会给答案,
// 不证明有人问它)。本文件就是那"一次挂载 + 一个事实源"。
//
// **判定纪律**:十态的语义与配色一律由 `@ihui/shared/chat/turn-status` 决定,这里只做
// "从既有 store 事实投影出一格"的映射,**不新增任何状态存储**;投影函数 `deriveTurnState`
// 是纯函数,正反用例见 `__tests__/turn-status-line.test.tsx`。
//
// 刻意**不传 `onAction`**:徽章的 stop/retry/resume 三个动作位在本页已有权威控件
// (输入区的停止钮、错误条的重试),在消息流里再放一份就是第二个控制面 —— 两处按钮
// 触同一动作时,谁先被点、谁被禁用又没人看守。缺动作位不影响状态可见性这件事。

'use client'

import * as React from 'react'

import { TurnStatusBadge } from '@/components/ai/turn-status-badge'
import { useToolApprovalPending } from '@/components/ai/tool-approval-dialog'
import { usePaneChatStore } from '@/stores/chat-pane-context'
import { isActiveTurnState, type TurnState } from '@ihui/shared/chat/turn-status'

/** 投影输入:全部是 store 里已经存在的事实,本模块不引入任何新状态。 */
export interface TurnFacts {
  /** 主对话流正在收帧 */
  streaming: boolean
  /** 最后一条 assistant 消息上仍有 status==='running' 的工具调用 */
  runningTool: boolean
  /** 有一条高危工具审批正等待用户决策(唯一事实源见 tool-approval-dialog) */
  awaitingApproval: boolean
  /** 本轮之外还在排队的侧问条数 */
  queuedSideQuestions: number
  /** 最后一条 assistant 消息带 error */
  lastAssistantErrored: boolean
}

/**
 * 事实 → 十态的一格投影。**优先级即判据**:
 * 等人决策 > 工具在跑 > 纯生成 > 还在排队 > 上一轮失败。
 *
 * 拿不到任何"本轮"事实时返回 null(渲染层整段不出现)—— 不得在空闲时画一个
 * "已完成":那是把"这轮没在流里留痕"写成"轮次结束"这一格的新事实,而它并不存在。
 */
export function deriveTurnState(f: TurnFacts): TurnState | null {
  if (f.awaitingApproval) return 'waitingConfirm'
  if (f.streaming && f.runningTool) return 'usingTool'
  if (f.streaming) return 'thinking'
  if (f.queuedSideQuestions > 0) return 'queued'
  if (f.lastAssistantErrored) return 'failed'
  return null
}

/**
 * 渲染门:**只对活跃轮次显示**。判据复用 `@ihui/shared/chat/turn-status` 的
 * `isActiveTurnState`(§0.6 单一真相源),端内不另写一张"哪些算活跃"的名单。
 *
 * 两条独立理由,缺一条都不行:
 *   · `null` —— 没有本轮事实(见 `deriveTurnState` 注释),无从渲染;
 *   · 终态(completed / failed / stopped) —— 历史消息里每轮都会挂一枚徽章,
 *     满屏"已完成"会把状态位变成装饰,真正要看的活跃态反而被淹没。
 *
 * 宿主若直传 `stateOverride`(未来 store 落 `turnState` 字段的形态),同一道门照判 ——
 * 数据面给出终态时同样不渲染。
 */
export function shouldShowTurnStatusLine(state: TurnState | null): state is TurnState {
  return state !== null && isActiveTurnState(state)
}

export interface TurnStatusLineProps {
  /**
   * 轮次状态直传位。**当前生产侧恒不传**:store 里没有轮次状态字段
   * (`turnState` / `turnStatus`),只有 `isStreaming` + 消息上的工具态/错误态,
   * 故走 `deriveTurnState` 投影。等数据层落了字段,宿主传它即可,本组件无需再改。
   */
  stateOverride?: TurnState | null
  /** 徽章附加类名(透传给 `TurnStatusBadge`) */
  className?: string
}

/** 从 store 读出 TurnFacts(每个选择器都返回基元 ⇒ 不产生新的对象引用,不触发多余重渲染)。 */
function useTurnFacts(): TurnFacts {
  // 票60 步序四:窗格寻址。根窗格无 Provider ⇒ 单例;非根窗格读各自实例。
  const chatStore = usePaneChatStore()
  const streaming = chatStore((s) => s.isStreaming)
  const runningTool = chatStore((s) => {
    for (let i = s.messages.length - 1; i >= 0; i--) {
      const m = s.messages[i]
      if (!m || m.role !== 'assistant') continue
      return (m.toolCalls ?? []).some((tc) => tc.status === 'running')
    }
    return false
  })
  const lastAssistantErrored = chatStore((s) => {
    for (let i = s.messages.length - 1; i >= 0; i--) {
      const m = s.messages[i]
      if (!m || m.role !== 'assistant') continue
      return Boolean(m.error)
    }
    return false
  })
  const queuedSideQuestions = chatStore((s) => {
    const cid = s.conversationId
    if (!cid) return 0
    return s.sideQueueByConversation[cid]?.length ?? 0
  })
  const awaitingApproval = useToolApprovalPending()
  return { streaming, runningTool, awaitingApproval, queuedSideQuestions, lastAssistantErrored }
}

export function TurnStatusLine({
  stateOverride,
  className,
}: TurnStatusLineProps): React.JSX.Element | null {
  const facts = useTurnFacts()
  // `undefined` = 宿主没给(当前生产形态,走投影);`null` = 宿主明确说"本轮无状态"。
  const projected = stateOverride === undefined ? deriveTurnState(facts) : stateOverride
  if (!shouldShowTurnStatusLine(projected)) return null
  return (
    <div className="px-1 py-0.5" data-testid="turn-status-line" data-turn-active="true">
      <TurnStatusBadge state={projected} className={className} />
    </div>
  )
}

export default TurnStatusLine
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
