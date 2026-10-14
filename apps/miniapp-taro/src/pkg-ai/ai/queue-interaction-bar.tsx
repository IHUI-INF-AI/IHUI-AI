// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D38 队列语义完整交互 —— 小程序端队列项交互条(G-42;形态对齐 web
 * `components/chat/queue-interaction-bar.tsx` 与 RN `components/ai/QueueInteractionBar.tsx`)。
 *
 * **数据面纪律(同 web/RN)**:本条**不取数、不写队列**。队列项 / 流式态 / 模式全部由调用方
 * (chat.tsx 经 `useSideQueue`)注入;动作一律经 props 回调上抛 —— 与两端同为
 * "只发意图,不做队列状态写操作"(W27 纪律)。
 *
 * **许可门复用 D69/D38,端内不立第二套判定**:
 *   · perms 来自 `queueInteractionPerms`(runtimeSupportsInterjection 恒 false —— 本端
 *     与 RN 同口径:全仓尚无插话能力协商的生产者);
 *   · 四动词先过 `interactionAllowed`,被拒时**显式渲染** D69 那两句成对文案
 *     (`denied.<action>` + `denied.cause.<reason>`),静默禁用 = 把"为什么不行"藏起来;
 *   · steer 偏好遇不支持插话的 Runtime ⇒ `effectiveMode` 给出降级句,必须渲染,不得静默。
 *
 * **平台特有**:小程序无 HTML5 拖拽 ⇒ 重排退化为 ↑/↓ 两个把手(与 RN 同法),
 * 且重排在流式中被许可门锁住(打乱 W27 出队顺序预期);编辑走 Taro `Input` 行内输入。
 *
 * **零占位**:队列空 ⇒ 返回 null(与 McpStatusStrip / TaskStatusBar 同一纪律)。
 */

import { useEffect, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import { useI18n } from '@/i18n'
import {
  INPUT_NOTICES_NAMESPACE,
  deniedCauseNotice,
  deniedNotice,
  queueInteractionPerms,
  type QueueDeniedAction,
  type QueueDenyReason,
} from '@ihui/shared/chat/input-notices'
import {
  QUEUE_OPS_NAMESPACE,
  effectiveMode,
  interactionAllowed,
  interruptPlan,
  type FollowUpMode,
} from '@ihui/shared/chat/queue-interactions'

/** 词包键拼接(queueOps 命名空间在 shared 五语言词包,深合并后可直取) */
const qk = (key: string): string => `${QUEUE_OPS_NAMESPACE}.${key}`
/** D69 拒绝文案本体住在 inputNotices 命名空间(2026-09-24 单点消费收口,不得在 queueOps 留副本) */
const nk = (key: string): string => `${INPUT_NOTICES_NAMESPACE}.queue.${key}`

/** 队列项展示视图(调用方从宿主队列态映射;与 web QueuedItemView / RN RnQueuedItemView 同形) */
export interface MiniQueuedItemView {
  readonly id: string
  readonly text: string
}

export interface QueueInteractionBarProps {
  /** 待渲染的队列项(顺序即当前队列顺序;空 ⇒ 本条不渲染任何内容) */
  items: readonly MiniQueuedItemView[]
  /** 是否流式生成中(重排锁定 + interruptPlan.stopFirst 依据) */
  streaming: boolean
  /** 当前队列模式偏好(steer / queue) */
  mode: FollowUpMode
  /** 重排回调(fromIndex → toIndex);被拒时调用方不回调 */
  onReorder?: (fromIndex: number, toIndex: number) => void
  /** 撤回回调;被拒时调用方不回调 */
  onUndo?: (itemId: string) => void
  /** 编辑回调(已 trim);被拒/空文本不回调 */
  onEdit?: (itemId: string, text: string) => void
  /** 「打断并执行」回调:上抛 interruptPlan 结论,停流与执行由调用方负责 */
  onInterruptAndRun?: (plan: { readonly stopFirst: boolean; readonly thenRun: string | null }) => void
  /** 模式切换回调(setMode 恒可切) */
  onModeChange?: (mode: FollowUpMode) => void
}

export default function QueueInteractionBar({
  items,
  streaming,
  mode,
  onReorder,
  onUndo,
  onEdit,
  onInterruptAndRun,
  onModeChange,
}: QueueInteractionBarProps) {
  const { t } = useI18n()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  // 被拒动作的场景提示(D69 组合矩阵判不过的组合不渲染 —— 宁缺不臆造)
  const [deniedHint, setDeniedHint] = useState<{
    action: QueueDeniedAction
    reason: QueueDenyReason
  } | null>(null)

  // 许可门:本端与 RN 同口径(无插话能力协商的生产者 ⇒ 恒 false)
  const perms = queueInteractionPerms({
    runtimeSupportsInterjection: false,
    streaming,
    hasQueuedMessages: items.length > 0,
  })
  const reorderVerdict = interactionAllowed('reorder', perms)
  const undoVerdict = interactionAllowed('undo', perms)
  const editVerdict = interactionAllowed('edit', perms)
  const interruptVerdict = interactionAllowed('interruptAndRun', perms)

  // 许可面变化(流结束/队列清空)后,旧拒因提示立即失效,不残留上一句
  useEffect(() => {
    setDeniedHint(null)
  }, [streaming, items.length])

  const modeResolution = effectiveMode(mode, false)

  if (items.length === 0) return null

  const startEdit = (itemId: string, currentText: string): void => {
    if (!editVerdict.allowed) {
      setDeniedHint({ action: 'undo', reason: 'emptyQueue' })
      return
    }
    setEditingId(itemId)
    setEditDraft(currentText)
  }

  const confirmEdit = (): void => {
    if (editingId === null) return
    const text = editDraft.trim()
    setEditingId(null)
    setEditDraft('')
    if (!text) return
    onEdit?.(editingId, text)
  }

  const cancelEdit = (): void => {
    setEditingId(null)
    setEditDraft('')
  }

  const handleInterrupt = (): void => {
    if (!interruptVerdict.allowed) {
      setDeniedHint({ action: 'interject', reason: 'runtimeNoInterject' })
      return
    }
    // 队首只读不改:items[0] 由调用方按既有队列顺序传入(W27:选择逻辑不在此)
    const plan = interruptPlan({ streaming, streamingMessageId: null }, items[0] ?? null)
    if (!plan.thenRun) return
    onInterruptAndRun?.({ stopFirst: plan.stopFirst, thenRun: plan.thenRun })
  }

  const deniedNoticeText = deniedHint ? deniedNotice(deniedHint.action, deniedHint.reason) : null

  return (
    <View
      data-testid="queue-interaction-bar"
      className="mx-[20rpx] mt-[8rpx] rounded-md bg-muted px-[16rpx] py-[8rpx]"
    >
      {items.map((item, index) => {
        const editing = editingId === item.id
        return (
          <View
            key={item.id}
            data-testid="queue-item"
            data-item-id={item.id}
            className="flex flex-row items-center py-[4rpx]"
          >
            {/* 重排把手:小程序无 HTML5 拖拽 ⇒ 退化为 ↑/↓(与 RN 同法);命中区包在 View 上 */}
            <View
              data-testid={`queue-op-reorder-up-${index}`}
              className="mr-[8rpx] flex flex-row items-center"
              onClick={() => {
                if (!reorderVerdict.allowed) {
                  setDeniedHint({ action: 'reorder', reason: 'streaming' })
                  return
                }
                if (index === 0) return
                onReorder?.(index, index - 1)
              }}
            >
              <LineIcon name="chevron-up" size={28} color="var(--color-muted-foreground)" />
            </View>
            <View
              data-testid={`queue-op-reorder-down-${index}`}
              className="mr-[8rpx] flex flex-row items-center"
              onClick={() => {
                if (!reorderVerdict.allowed) {
                  setDeniedHint({ action: 'reorder', reason: 'streaming' })
                  return
                }
                if (index === items.length - 1) return
                onReorder?.(index, index + 1)
              }}
            >
              <LineIcon name="chevron-down" size={28} color="var(--color-muted-foreground)" />
            </View>
            {editing ? (
              <>
                <Input
                  className="min-w-0 flex-1 rounded-sm bg-card px-[8rpx] py-[4rpx] text-[length:22rpx] text-foreground"
                  value={editDraft}
                  data-testid={`queue-op-edit-input-${item.id}`}
                  onInput={(e) => setEditDraft(e.detail.value)}
                />
                <Text
                  data-testid={`queue-op-edit-confirm-${item.id}`}
                  className="ml-[12rpx] text-[length:22rpx] text-primary"
                  onClick={confirmEdit}
                >
                  {t(qk('editConfirm'))}
                </Text>
                <Text
                  data-testid={`queue-op-edit-cancel-${item.id}`}
                  className="ml-[12rpx] text-[length:22rpx] text-muted-foreground"
                  onClick={cancelEdit}
                >
                  {t(qk('editCancel'))}
                </Text>
              </>
            ) : (
              <>
                <Text
                  data-testid="queue-item-text"
                  className="min-w-0 flex-1 text-[length:22rpx] text-foreground"
                >
                  {item.text}
                </Text>
                <Text
                  data-testid={`queue-op-undo-${item.id}`}
                  className="ml-[12rpx] text-[length:22rpx] text-muted-foreground"
                  onClick={() => {
                    if (!undoVerdict.allowed) {
                      setDeniedHint({ action: 'undo', reason: 'emptyQueue' })
                      return
                    }
                    onUndo?.(item.id)
                  }}
                >
                  {t(qk('undo'))}
                </Text>
                <Text
                  data-testid={`queue-op-edit-${item.id}`}
                  className="ml-[12rpx] text-[length:22rpx] text-muted-foreground"
                  onClick={() => startEdit(item.id, item.text)}
                >
                  {t(qk('edit'))}
                </Text>
              </>
            )}
          </View>
        )
      })}

      <View className="mt-[4rpx] flex flex-row items-center">
        <Text
          data-testid="queue-op-interrupt-and-run"
          className="text-[length:22rpx] text-primary"
          onClick={handleInterrupt}
        >
          {t(qk('interruptAndRun'))}
        </Text>
        <Text className="ml-[16rpx] text-[length:20rpx] text-muted-foreground">
          {t(qk('mode.label'))}
        </Text>
        {(['steer', 'queue'] as const).map((m) => (
          <Text
            key={m}
            data-testid={`queue-op-mode-${m}`}
            data-mode={m}
            className={`ml-[12rpx] text-[length:22rpx] ${mode === m ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
            onClick={() => onModeChange?.(m)}
          >
            {t(qk(`mode.${m}`))}
          </Text>
        ))}
      </View>

      {/* 被拒动作显式说"不能做什么" + "为什么不能"(两段各自独立渲染,不合成一句) */}
      {deniedHint && deniedNoticeText ? (
        <Text
          data-testid="queue-denied-notice"
          data-denied-key={deniedNoticeText}
          className="mt-[4rpx] block text-[length:20rpx] text-muted-foreground"
        >
          {`${t(nk(deniedNoticeText))} · ${t(nk(deniedCauseNotice(deniedHint.reason)))}`}
        </Text>
      ) : null}

      {/* 降级句:steer 偏好遇到不支持插话的 Runtime —— 必须显式渲染,不得静默降级 */}
      {modeResolution.degraded && modeResolution.degradedKey ? (
        <Text
          data-testid="queue-mode-degraded"
          data-mode-degraded={modeResolution.degradedKey}
          className="mt-[4rpx] block text-[length:20rpx] text-warning"
        >
          {t(qk(modeResolution.degradedKey))}
        </Text>
      ) : null}
    </View>
  )
}
