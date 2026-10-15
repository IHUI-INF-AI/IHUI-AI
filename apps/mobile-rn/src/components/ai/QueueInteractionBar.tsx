// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { ChevronDown, ChevronUp } from 'lucide-react-native'
import {
  QUEUE_OPS_NAMESPACE,
  effectiveMode,
  interactionAllowed,
  interruptPlan,
  type FollowUpMode,
} from '@ihui/shared/chat/queue-interactions'
import {
  INPUT_NOTICES_NAMESPACE,
  deniedCauseNotice,
  deniedNotice,
  queueInteractionPerms,
  type QueueDeniedAction,
  type QueueDenyReason,
} from '@ihui/shared/chat/input-notices'
import { rnRadius } from '@ihui/design-tokens'
import { tokens } from '../../theme/active-tokens'
import { useI18n } from '../../i18n'
import { rpx } from '../../utils/rpx'

/**
 * D38 队列语义完整交互 —— RN 队列项交互条(G-42;web 参照 apps/web 的
 * queue-interaction-bar.tsx,2026-10-14 立最小等价版)。
 *
 * **数据面纪律(同 web)**:本条**不取数**。队列项由调用方(ChatScreen 侧问队列
 * 本地态)注入;动作一律经 props 回调上抛,由调用方写自己的队列状态 —— 本组件
 * 与 web 同为"只发意图,不做队列状态写操作"(W27 纪律)。
 *
 * **许可门复用 D69/D38**:全部交互先过 `@ihui/shared/chat/queue-interactions` 的
 * `interactionAllowed(kind, perms)`(perms 来自 `queueInteractionPerms`),端内
 * 不另立第二套判定。「打断并执行」被许可门拦下时**显式渲染降级句**
 * (queueOps.degraded.runtimeNoInterject,与 D69 denied.interject 同一句判据原文),
 * 不得静默禁用。
 *
 * **插话能力**:RN 端插话能力恒不可用(2026-10-15 下线能力声明协商,原
 * `runtimeSupportsInterjection` prop 已拆除),许可门恒拒(「打断并执行」不可达,
 * 被拒时仍显式渲染降级句,不静默吞),steer 偏好显式降级为 queue。
 *
 * 平台特有:RN 无 hover ⇒ 全部用按压态(Pressable style 函数);web 的拖拽重排
 * 在触屏上退化为 ↑/↓ 按钮重排(同一 reorderQueue 语义,流式中同样被锁)。
 */

/** 队列项展示视图(调用方从本地队列态映射;id/text 与 web QueuedItemView 同形) */
export interface RnQueuedItemView {
  readonly id: string
  readonly text: string
}

export interface QueueInteractionBarProps {
  /** 待渲染的队列项(顺序即当前队列顺序;空 ⇒ 本条不渲染任何内容) */
  items: readonly RnQueuedItemView[]
  /** 是否流式生成中(重排锁定 + interruptPlan.stopFirst 依据) */
  streaming: boolean
  /** 当前队列模式偏好(steer / queue) */
  mode: FollowUpMode
  /** 重排回调(fromIndex → toIndex,先摘后插);被拒时调用方不回调 */
  onReorder?: (fromIndex: number, toIndex: number) => void
  /** 撤回回调;被拒时调用方不回调 */
  onUndo?: (itemId: string) => void
  /** 编辑回调(已 trim);空文本不回调 */
  onEdit?: (itemId: string, text: string) => void
  /** 「打断并执行」回调:上抛 interruptPlan,停流与执行由调用方负责 */
  onInterruptAndRun?: () => void
  /** 模式切换回调(setMode 恒可切) */
  onModeChange?: (mode: FollowUpMode) => void
}

/** 词包键拼接(queueOps 命名空间在 shared 五语言词包,mobile-rn 深合并后可直取) */
const qk = (key: string): string => `${QUEUE_OPS_NAMESPACE}.${key}`

export function QueueInteractionBar({
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
  // D38 收口:被拒动作的场景提示(inputNotices.queue.denied.*,shared 五语言词包)。
  // 与 web 同判据:deniedNotice 组合矩阵判不过的组合不渲染(宁缺不臆造)。
  const [deniedHint, setDeniedHint] = useState<{
    action: QueueDeniedAction
    reason: QueueDenyReason
  } | null>(null)

  // 许可门统一走 D69 复用判定。RN 端插话能力恒不可用(2026-10-15 下线能力声明协商),
  // 许可门恒拒(「打断并执行」不可达),端内不判语义。
  const perms = queueInteractionPerms({
    runtimeSupportsInterjection: false,
    streaming,
    hasQueuedMessages: items.length > 0,
  })
  const reorderVerdict = interactionAllowed('reorder', perms)
  const undoVerdict = interactionAllowed('undo', perms)
  const interruptVerdict = interactionAllowed('interruptAndRun', perms)

  // 许可面变化(流式结束/队列清空)即过期的拒因提示随之失效,不残留旧话
  useEffect(() => {
    setDeniedHint(null)
  }, [streaming, items.length])

  // 模式解析:RN 端插话能力恒不可用(2026-10-15 下线能力声明协商),steer 偏好
  // 显式降级为 queue,不得静默降级(web 同)。
  const modeResolution = effectiveMode(mode, /* 插话能力恒不可用 */ false)

  if (items.length === 0) return null

  const startEdit = (itemId: string, currentText: string): void => {
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
      // D38 收口:插话被拒显式说因(RN 端插话能力恒不可用 —— 与降级句同判据,不静默吞)
      setDeniedHint({ action: 'interject', reason: 'runtimeNoInterject' })
      return
    }
    // 队首只读不改:items[0] 由调用方按既有队列顺序传入(W27:选择逻辑不在此)
    const plan = interruptPlan({ streaming, streamingMessageId: null }, items[0] ?? null)
    if (!plan.thenRun) return
    onInterruptAndRun?.()
  }

  /** 拒因提示取词(inputNotices.queue.denied.* 与 denied.cause.*,组合矩阵判不过返回 null 不渲染) */
  const deniedNoticeText = deniedHint ? deniedNotice(deniedHint.action, deniedHint.reason) : null

  return (
    <View
      style={styles.container}
      accessibilityLabel={t(qk('ariaLabel'))}
      testID="queue-interaction-bar"
    >
      {items.map((item, index) => {
        const editing = editingId === item.id
        return (
          <View key={item.id} style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(qk('reorderAria'))}
              accessibilityState={{ disabled: !reorderVerdict.allowed || index === 0 }}
              testID={`queue-op-reorder-up-${index}`}
              style={({ pressed }) => [
                styles.opBtn,
                (pressed || index === 0 || !reorderVerdict.allowed) && styles.opBtnMuted,
              ]}
              onPress={() => {
                if (!reorderVerdict.allowed) {
                  // D38 收口:重排被拒显式说因(流式中锁定;组合矩阵里 reorder 只认
                  // streaming/emptyQueue,渲染位仅在队列非空时存在 ⇒ 实际只会命中 streaming)
                  setDeniedHint({ action: 'reorder', reason: 'streaming' })
                  return
                }
                if (index === 0) return
                onReorder?.(index, index - 1)
              }}
            >
              <ChevronUp size={14} color={tokens.text.secondary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(qk('reorderAria'))}
              accessibilityState={{
                disabled: !reorderVerdict.allowed || index === items.length - 1,
              }}
              testID={`queue-op-reorder-down-${index}`}
              style={({ pressed }) => [
                styles.opBtn,
                (pressed || index === items.length - 1 || !reorderVerdict.allowed) &&
                  styles.opBtnMuted,
              ]}
              onPress={() => {
                if (!reorderVerdict.allowed) {
                  setDeniedHint({ action: 'reorder', reason: 'streaming' })
                  return
                }
                if (index === items.length - 1) return
                onReorder?.(index, index + 1)
              }}
            >
              <ChevronDown size={14} color={tokens.text.secondary} />
            </Pressable>
            {editing ? (
              <>
                <TextInput
                  style={styles.editInput}
                  value={editDraft}
                  onChangeText={setEditDraft}
                  onSubmitEditing={confirmEdit}
                  testID={`queue-op-edit-input-${item.id}`}
                  multiline
                />
                <Pressable
                  accessibilityRole="button"
                  testID={`queue-op-edit-confirm-${item.id}`}
                  style={({ pressed }) => [styles.textBtn, pressed && styles.textBtnPressed]}
                  onPress={confirmEdit}
                >
                  <Text style={styles.textBtnPrimary}>{t(qk('editConfirm'))}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID={`queue-op-edit-cancel-${item.id}`}
                  style={({ pressed }) => [styles.textBtn, pressed && styles.textBtnPressed]}
                  onPress={cancelEdit}
                >
                  <Text style={styles.textBtnSecondary}>{t(qk('editCancel'))}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.itemText} numberOfLines={1}>
                  {item.text}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !undoVerdict.allowed }}
                  testID={`queue-op-undo-${item.id}`}
                  style={({ pressed }) => [styles.textBtn, pressed && styles.textBtnPressed]}
                  onPress={() =>
                    undoVerdict.allowed
                      ? onUndo?.(item.id)
                      : setDeniedHint({ action: 'undo', reason: 'emptyQueue' })
                  }
                >
                  <Text style={styles.textBtnSecondary}>{t(qk('undo'))}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID={`queue-op-edit-${item.id}`}
                  style={({ pressed }) => [styles.textBtn, pressed && styles.textBtnPressed]}
                  onPress={() => startEdit(item.id, item.text)}
                >
                  <Text style={styles.textBtnSecondary}>{t(qk('edit'))}</Text>
                </Pressable>
              </>
            )}
          </View>
        )
      })}

      <View style={styles.footerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !interruptVerdict.allowed }}
          testID="queue-op-interrupt-and-run"
          style={({ pressed }) => [styles.textBtn, pressed && styles.textBtnPressed]}
          onPress={handleInterrupt}
        >
          <Text style={styles.textBtnPrimary}>{t(qk('interruptAndRun'))}</Text>
        </Pressable>
        <Text style={styles.modeLabel}>{t(qk('mode.label'))}</Text>
        {(['steer', 'queue'] as const).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === m }}
            testID={`queue-op-mode-${m}`}
            style={({ pressed }) => [styles.textBtn, pressed && styles.textBtnPressed]}
            onPress={() => onModeChange?.(m)}
          >
            <Text style={mode === m ? styles.modeTextActive : styles.modeText}>
              {t(qk(`mode.${m}`))}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* D38 收口:被拒动作的场景提示(拒绝结论 + 具体原因,两段词包成对,不静默吞) */}
      {deniedHint && deniedNoticeText ? (
        <Text style={styles.degradedNote} testID="queue-denied-notice">
          {`${t(`${INPUT_NOTICES_NAMESPACE}.queue.${deniedNoticeText}`)} · ${t(
            `${INPUT_NOTICES_NAMESPACE}.queue.${deniedCauseNotice(deniedHint.reason)}`,
          )}`}
        </Text>
      ) : null}

      {/* 降级句:steer 偏好遇到不支持插话的 Runtime —— 必须显式渲染,不得静默降级 */}
      {modeResolution.degraded && modeResolution.degradedKey ? (
        <Text style={styles.degradedNote} testID="queue-mode-degraded">
          {t(qk(modeResolution.degradedKey))}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.md,
    padding: rpx(16),
    gap: rpx(10),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
  },
  itemText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    color: tokens.text.primary,
  },
  opBtn: {
    padding: rpx(4),
    borderRadius: rnRadius.sm,
  },
  opBtnMuted: {
    opacity: 0.4,
  },
  editInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    color: tokens.text.primary,
    paddingVertical: rpx(6),
    paddingHorizontal: rpx(12),
    borderRadius: rnRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.inputBg,
  },
  textBtn: {
    paddingVertical: rpx(6),
    paddingHorizontal: rpx(8),
    borderRadius: rnRadius.sm,
  },
  textBtnPressed: {
    backgroundColor: tokens.surface.muted,
    opacity: 0.7,
  },
  textBtnPrimary: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.brand.cta,
  },
  textBtnSecondary: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: rpx(10),
  },
  modeLabel: {
    fontSize: 11,
    color: tokens.text.tertiary,
  },
  modeText: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  modeTextActive: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.text.primary,
  },
  degradedNote: {
    fontSize: 11,
    color: tokens.warning.DEFAULT,
  },
})
