// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { reorderSteerQueue, withdrawSteer } from '@ihui/api-client'
import { INPUT_NOTICES_NAMESPACE } from '@ihui/shared/chat/input-notices'
import { QUEUE_OPS_NAMESPACE } from '@ihui/shared/chat/queue-interactions'
import { FoldableSection } from './foldable-section'
import { toast } from '@/components/common'
import { usePaneChatStore } from '@/stores/chat-pane-context'
import type { SteerNotice } from '@/stores/chat'

interface SteerNoticeBarProps {
  /** 本轮流式期间用户注入的中途引导记录(SSE steer 事件回执,tool loop 边界已生效)。 */
  notices: SteerNotice[]
  /** 差距③(2026-10-30 立):撤回三元组之二 —— 本条 assistant 消息 ID(replayKey);
   *  conversationId 由本组件经 usePaneChatStore 自读(与 notices 同一 store 实例寻址,
   *  非根窗格不走全局单例串台)。 */
  messageId?: string
}

/** 单条引导文本的展示截断长度(原文 ≤4000 字符已入 LLM 上下文,徽章侧只做预览) */
const STEER_NOTICE_PREVIEW_LIMIT = 120

/**
 * SteerNoticeBar — 消息级「已引导」提示条(Steer 中途引导可视化,2026-09-19 立)
 *
 * 链路:闪电按钮 → 网关 POST /chat/steer → ai-service 入队(tool loop 边界注入)→
 * SSE steer 事件(phase='injected')回执 → api-client onSteer →
 * send-message appendSteerNotice(messageId, notice) → chat store steerNoticesByMessageId
 * → MessageItem 按 message.id 查 store 渲染本组件。
 *
 * 展示策略(与 MemoryNoticeBar 同款 FoldableSection 形态):
 *  - 折叠头显示「已引导 N 次」计数 + Zap 图标
 *  - 展开显示每条引导文本预览(超长截断),让用户事后可回看本轮引导过什么
 *
 * 差距③(2026-10-30 立):phase='queued' 的乐观条目(闪电入队成功、尚未被 tool loop
 * drain)行尾渲染「撤回」按钮 → withdrawSteer 三元组(conversationId+messageId+queuedAt);
 * 已注入条目(phase 缺省/injected)与历史回放条目不带按钮,呈现与升级前一致。
 * mutateQueue(差距③遗留最后一项,2026-10-30 补):≥2 条 queued 时行尾另渲染
 * 上移/下移按钮 → reorderSteerQueue(本地乐观重排,被拒/异常回滚),injected 不可动。
 *
 * memo:notices 引用稳定时跳过重渲染(appendSteerNotice 均为新数组)。
 */
export const SteerNoticeBar = React.memo(function SteerNoticeBar({
  notices,
  messageId,
}: SteerNoticeBarProps) {
  const t = useTranslations('chat')
  const tq = useTranslations(QUEUE_OPS_NAMESPACE)
  const tn = useTranslations(INPUT_NOTICES_NAMESPACE)
  // 差距③ mutateQueue(2026-10-30):上移/下移 aria-label 复用仓内既有键
  // (playground.moveUp/moveDown,文案即「上移/下移」)——不动 packages/i18n。
  const tp = useTranslations('playground')
  const chatStore = usePaneChatStore()
  const conversationId = chatStore((s) => s.conversationId)

  /** 差距③(2026-10-30 立):撤回排队中的引导 —— 走 api-client withdrawSteer,
   *  信封解包三档:withdrawn⇒本地移除+文本回填草稿;already_injected⇒就地提升
   *  injected + 提示(已进 LLM 上下文,不硬撤、不回填);not_found⇒静默移除(不回填,
   *  服务端从未有此条,不冒充"撤回了输入")。失败/异常⇒toast 报拒因。 */
  const handleWithdraw = React.useCallback(
    async (queuedAt: string, text: string) => {
      if (!messageId || !conversationId) return
      try {
        const result = await withdrawSteer({ conversationId, messageId, queuedAt })
        if (!result.success) {
          toast.warning(tn('queue.denied.undo'))
          return
        }
        if (result.data?.status === 'already_injected') {
          chatStore.getState().markSteerInjected(messageId, queuedAt)
          toast.info(t('steerNoticeBar.title', { count: 1 }))
          return
        }
        // withdrawn / not_found:服务端队列已无此项 ⇒ 本地排队条目移除
        chatStore.getState().removeSteerNotice(messageId, queuedAt)
        // 差距③(2026-10-30):撤回成功 ⇒ 该条文本回填输入框草稿(Qoder withdraw→draft
        // 语义,用户输入不丢)。走 chat store 既有 draftInput 通道(MessageInput 挂载态
        // effect 消费后 clearDraftInput),不新建状态;not_found 不回填。
        if (result.data?.status === 'withdrawn' && text) {
          chatStore.setState({ draftInput: text })
        }
      } catch {
        toast.warning(tn('queue.denied.undo'))
      }
    },
    [messageId, conversationId, chatStore, t, tn],
  )

  /** 差距③ mutateQueue(2026-10-30 立):重排排队中的引导 —— 与相邻 queued 条目交换,
   *  本地先乐观重排(reorderSteerNotices),reorderSteerQueue 被拒/异常⇒以旧 order 回滚
   *  + toast 报拒因(复用既有键 queue.denied.reorder)。成功时若上游回报 orderApplied
   *  (竞态豁免掉已 drain 条目后的实际生效序)且与本地排队集合对齐,则以其为准。 */
  const handleMove = React.useCallback(
    async (queuedAt: string, delta: -1 | 1) => {
      if (!messageId || !conversationId) return
      const order = (chatStore.getState().steerNoticesByMessageId[messageId] ?? [])
        .filter((n) => n.phase === 'queued' && n.queuedAt)
        .map((n) => n.queuedAt as string)
      const idx = order.indexOf(queuedAt)
      const to = idx + delta
      if (idx < 0 || to < 0 || to >= order.length) return
      const nextOrder = order.slice()
      const tmp = nextOrder[idx] as string
      nextOrder[idx] = nextOrder[to] as string
      nextOrder[to] = tmp
      chatStore.getState().reorderSteerNotices(messageId, nextOrder)
      try {
        const result = await reorderSteerQueue({ conversationId, messageId, order: nextOrder })
        if (!result.success) {
          chatStore.getState().reorderSteerNotices(messageId, order)
          toast.warning(tn('queue.denied.reorder'))
          return
        }
        if (result.data?.orderApplied) {
          chatStore.getState().reorderSteerNotices(messageId, result.data.orderApplied)
        }
      } catch {
        chatStore.getState().reorderSteerNotices(messageId, order)
        toast.warning(tn('queue.denied.reorder'))
      }
    },
    [messageId, conversationId, chatStore, tn],
  )

  if (notices.length === 0) return null

  /** queued 条目的 queuedAt 序列(重排只在未注入条目之间发生) */
  const queuedAts = notices
    .filter((n) => n.phase === 'queued' && n.queuedAt)
    .map((n) => n.queuedAt as string)

  return (
    <FoldableSection
      title={t('steerNoticeBar.title', { count: notices.length })}
      icon={Zap}
      count={notices.length}
      data-testid="steer-notice-bar"
    >
      <div className="flex flex-col gap-0.5 py-0.5">
        {notices.slice(0, 3).map((n, i) => (
          <span
            key={i}
            className="flex items-baseline gap-1.5 text-[11px] leading-relaxed text-muted-foreground"
            data-testid={`steer-notice-item-${i}`}
          >
            <span className="min-w-0 flex-1">
              {n.text.length > STEER_NOTICE_PREVIEW_LIMIT
                ? `${n.text.slice(0, STEER_NOTICE_PREVIEW_LIMIT)}…`
                : n.text}
            </span>
            {n.phase === 'queued' &&
              n.queuedAt &&
              messageId &&
              conversationId &&
              queuedAts.length > 1 && (
                <span className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => void handleMove(n.queuedAt as string, -1)}
                    disabled={queuedAts.indexOf(n.queuedAt) <= 0}
                    aria-label={tp('moveUp')}
                    className="p-0.5 text-amber-600 hover:underline disabled:opacity-40"
                    data-testid={`steer-notice-moveup-${i}`}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMove(n.queuedAt as string, 1)}
                    disabled={queuedAts.indexOf(n.queuedAt) >= queuedAts.length - 1}
                    aria-label={tp('moveDown')}
                    className="p-0.5 text-amber-600 hover:underline disabled:opacity-40"
                    data-testid={`steer-notice-movedown-${i}`}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </span>
              )}
            {n.phase === 'queued' && n.queuedAt && messageId && conversationId && (
              <button
                type="button"
                onClick={() => void handleWithdraw(n.queuedAt!, n.text)}
                className="shrink-0 text-[10px] text-amber-600 hover:underline"
                data-testid={`steer-notice-withdraw-${i}`}
              >
                {tq('undo')}
              </button>
            )}
          </span>
        ))}
        {notices.length > 3 && (
          <span className="text-[10px] text-muted-foreground/70" data-testid="steer-notice-more">
            {t('steerNoticeBar.moreItems', { count: notices.length - 3 })}
          </span>
        )}
      </div>
    </FoldableSection>
  )
})

export default SteerNoticeBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
