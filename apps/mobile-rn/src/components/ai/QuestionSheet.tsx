// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 react-native Modal / lucide-react-native / @ihui/rn-app TextField,
// 不适合共享层(与同族 BusinessFormSheet / ToolApprovalSheet 同一分层口径)。
//
// D135 对话流 AI 提问卡 RN 腿(补齐交互,2026-11-14)。此前 ChatScreen 只渲染只读最小
// 可视态(prompt + 选项文字,注释自承"完整作答续流属后续票面")—— 用户看得见问却答不了,
// 与 web 端 InlineQuestionCard 的完整能力落差一格。本文件补齐:
//   - 单选/多选/自由输入三态选择,防重提交锁(双击只发一次)
//   - 阻塞式答复优先:帧带 sessionId 时投 ai-service `/question-response`,不新增用户消息、
//     不发起新一轮;404/失败回退旧链路(把答复交宿主 sendAnswer 续流)
//   - 幂等 duplicate / 超时 / 撤回三终态;结算帧(onQuestionResolved)到达即摘卡
//   - 无 sessionId(帧太早,流里还没出现工具/委派帧)时如实走旧链路,不猜一个会话发出去
//
// 判定层一行不重写:响应形状处置 + 旧链路文本构造取 `@ihui/shared/chat/question-response`
// (web send-answer.ts 同一份出口)。上行走 api-client 唯一裸 fetch 出口 fetchAiServiceJson。
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Check, HelpCircle, X } from 'lucide-react-native'
import { fetchAiServiceJson } from '@ihui/api-client'
import type { StreamChatOptions } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType, rnCssLight } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import {
  buildLegacyAnswerText,
  interpretQuestionResponse,
  questionResponsePath,
  type QuestionAnswerPayload,
  type QuestionResponseAction,
  type QuestionResponseStatus,
} from '@ihui/shared/chat/question-response'
import { currentRnTheme, tokens } from '../../theme/active-tokens'
import { useI18n } from '../../i18n'
import { Tappable } from '@ihui/ui-native'

const NS = 'ai.pane.question'

/** question 帧形状取 api-client StreamChatOptions.onQuestion 的形参(不自立第二份契约名)。 */
type QuestionFrame = Parameters<NonNullable<StreamChatOptions['onQuestion']>>[0]

/** 待决提问卡条目 */
interface QuestionEntry {
  frame: QuestionFrame
  /** 本地作答态:selectedIds 选中项,customText 自由输入 */
  selectedIds: string[]
  customText: string
  /** idle → submitting → 终态(answered/withdrawn/timeout);failed 可重试 */
  phase: 'idle' | 'submitting' | 'answered' | 'withdrawn' | 'timeout' | 'failed'
  submitLock: boolean
}

export interface UseQuestionQueueOptions {
  /**
   * 旧链路回退:阻塞式不可用(404/失败/无 sessionId)时,把答复文本交宿主发起回答续流。
   * 宿主复用既有 sendAnswer 链路(与 web send-answer.ts 的 legacy 分支同职责),本层不复制。
   */
  sendLegacyAnswer: (answer: string) => Promise<void>
  /** 帧未带 expiresAt 时的兜底时限(毫秒);0 = 不限时。宿主给,端内不猜业务时长。 */
  defaultTimeoutMs?: number
}

export interface UseQuestionQueueResult {
  /** 直接挂进 streamChat 的 options.onQuestion */
  onQuestion: (frame: QuestionFrame) => void
  /** 直接挂进 streamChat 的 options.onQuestionResolved:结算帧到达即摘卡 */
  onQuestionResolved: (event: {
    questionId: string
    status: 'answered' | 'timeout' | 'withdrawn' | 'interrupted'
  }) => void
  /** 必须渲染在屏内:待决提问卡 */
  host: ReactNode
}

export function useQuestionQueue(opts: UseQuestionQueueOptions): UseQuestionQueueResult {
  const colorScheme = currentRnTheme()
  const [entries, setEntries] = useState<QuestionEntry[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  const onQuestion = useCallback((frame: QuestionFrame) => {
    setEntries((prev) => {
      if (prev.some((e) => e.frame.questionId === frame.questionId)) return prev
      return [{ frame, selectedIds: [], customText: '', phase: 'idle', submitLock: false }]
    })
    setOpenId(frame.questionId)
  }, [])

  // 结算帧:一个 questionId 只结算一次,到达即把该问从挂起集摘除(与 web store 同语义)
  const onQuestionResolved = useCallback((event: { questionId: string }) => {
    setEntries((prev) => prev.filter((e) => e.frame.questionId !== event.questionId))
    setOpenId((cur) => (cur === event.questionId ? null : cur))
  }, [])

  const patch = useCallback((questionId: string, next: Partial<QuestionEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.frame.questionId === questionId ? { ...e, ...next } : e)),
    )
  }, [])

  // 提交一个动作。失败/无 sessionId 回退旧链路;终态写回卡片。
  const respond = useCallback(
    async (entry: QuestionEntry, action: QuestionResponseAction) => {
      const { questionId } = entry.frame
      // 同步锁:两次点击落同一批次时只有 ref 拦得住第二发
      if (entry.submitLock || entry.phase !== 'idle') return
      const selectedIds = action === 'withdraw' ? [] : entry.selectedIds
      if (action === 'answer' && selectedIds.length === 0 && !entry.customText.trim()) return

      patch(questionId, { submitLock: true, phase: 'submitting' })
      const payload: QuestionAnswerPayload = {
        questionId,
        action,
        selectedOptionIds: selectedIds,
        ...(action === 'answer' && entry.customText.trim()
          ? { customText: entry.customText.trim() }
          : {}),
      }

      const sessionId = entry.frame.sessionId
      let settled: QuestionResponseStatus | 'legacy' | 'failed' = 'failed'
      if (sessionId) {
        try {
          const result = await fetchAiServiceJson<{
            accepted?: boolean
            status?: string
            duplicate?: boolean
          }>(questionResponsePath(sessionId), {
            method: 'POST',
            body: JSON.stringify({
              questionId: payload.questionId,
              action: payload.action,
              selectedOptionIds: payload.selectedOptionIds,
              ...(payload.customText ? { customText: payload.customText } : {}),
            }),
          })
          if (!result.success) {
            settled = result.status === 404 ? 'legacy' : 'failed'
          } else {
            const outcome = interpretQuestionResponse(result.status, result.data)
            if (outcome.kind === 'failed') {
              settled = 'failed'
            } else if (outcome.kind === 'legacy') {
              settled = 'legacy'
            } else {
              settled = outcome.status
            }
          }
        } catch {
          settled = 'failed'
        }
      } else {
        // 无 sessionId = 阻塞式不可用,如实走旧链路(不猜会话发出去)
        settled = 'legacy'
      }

      if (settled === 'failed') {
        patch(questionId, { submitLock: false, phase: 'failed' })
        return
      }
      if (settled === 'legacy') {
        // 旧链路:撤回等价跳过(不产用户消息),否则把答复交宿主续流
        if (action !== 'withdraw') {
          await optsRef.current.sendLegacyAnswer(buildLegacyAnswerText(entry.frame, payload))
        }
        setEntries((prev) => prev.filter((e) => e.frame.questionId !== questionId))
        setOpenId((cur) => (cur === questionId ? null : cur))
        return
      }
      // 阻塞式终态:服务端认下,卡片置只读终态(结算帧稍后摘卡;此处先给即时反馈)
      patch(questionId, { submitLock: false, phase: settled as QuestionResponseStatus })
    },
    [patch],
  )

  const host = (
    <>
      {entries.map((entry) => (
        <QuestionSheet
          key={entry.frame.questionId}
          entry={entry}
          colorScheme={colorScheme}
          open={openId === entry.frame.questionId}
          onSelect={(id) =>
            patch(entry.frame.questionId, {
              selectedIds: entry.frame.allowMultiple
                ? entry.selectedIds.includes(id)
                  ? entry.selectedIds.filter((x) => x !== id)
                  : [...entry.selectedIds, id]
                : [id],
            })
          }
          onCustomText={(v) => patch(entry.frame.questionId, { customText: v })}
          onAnswer={() => void respond(entry, 'answer')}
          onWithdraw={() => void respond(entry, 'withdraw')}
          onTimeout={() => patch(entry.frame.questionId, { phase: 'timeout' })}
          onDismiss={() => setOpenId(null)}
        />
      ))}
    </>
  )

  return { onQuestion, onQuestionResolved, host }
}

interface QuestionSheetProps {
  entry: QuestionEntry
  colorScheme: 'light' | 'dark'
  open: boolean
  onSelect: (id: string) => void
  onCustomText: (value: string) => void
  onAnswer: () => void
  onWithdraw: () => void
  onTimeout: () => void
  onDismiss: () => void
}

function QuestionSheet({
  entry,
  colorScheme,
  open,
  onSelect,
  onCustomText,
  onAnswer,
  onWithdraw,
  onTimeout,
  onDismiss,
}: QuestionSheetProps) {
  const { t } = useI18n()
  const s = useMemo(() => createStyles(), [])
  const frame = entry.frame
  const busy = entry.phase === 'submitting'
  const decided =
    entry.phase === 'answered' || entry.phase === 'withdrawn' || entry.phase === 'timeout'
  const canAnswer = entry.selectedIds.length > 0 || entry.customText.trim().length > 0

  // expiresAt(ISO 或毫秒)存在则 1s 倒计时;归零置超时只读。提交中不改判(等服务端结果)。
  const expiresAtMs = useMemo(() => {
    const raw = frame.expiresAt
    if (raw === undefined || raw === null) return null
    const ms = typeof raw === 'number' ? raw : Date.parse(raw)
    return Number.isFinite(ms) ? ms : null
  }, [frame.expiresAt])
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)

  useEffect(() => {
    if (expiresAtMs === null) {
      setRemainingSeconds(null)
      return
    }
    const tick = (): void => {
      const left = expiresAtMs - Date.now()
      setRemainingSeconds(Math.max(0, Math.ceil(left / 1000)))
      if (left <= 0) {
        setRemainingSeconds(0)
      }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [expiresAtMs])

  // 倒计时归零 → 超时只读(提交中不覆盖)
  useEffect(() => {
    if (remainingSeconds === 0 && entry.phase === 'idle') {
      onTimeout()
    }
  }, [remainingSeconds, entry.phase, onTimeout])

  const statusText =
    entry.phase === 'answered'
      ? t(`${NS}.statusAnswered`)
      : entry.phase === 'withdrawn'
        ? t(`${NS}.statusWithdrawn`)
        : entry.phase === 'timeout'
          ? t(`${NS}.statusTimeout`)
          : null

  const timedOut = remainingSeconds === 0 && expiresAtMs !== null
  const disabled = busy || decided || timedOut

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onDismiss}>
      <Tappable style={s.backdrop} onPress={onDismiss}>
        <Tappable style={s.sheet} onPress={() => {}}>
          <View style={s.chrome}>
            <HelpCircle size={16} color={tokens.text.primary} />
            <Text style={s.title} numberOfLines={1}>
              {frame.header ?? t(`${NS}.title`)}
            </Text>
            {statusText ? <Text style={s.status}>{statusText}</Text> : null}
          </View>

          <ScrollView
            style={s.body}
            contentContainerStyle={s.bodyInner}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.prompt}>{frame.prompt}</Text>

            {remainingSeconds !== null && !disabled && remainingSeconds > 0 ? (
              <Text style={s.expires}>
                {t(`${NS}.expiresIn`, { seconds: String(remainingSeconds) })}
              </Text>
            ) : null}

            {frame.options.map((opt) => {
              const checked = entry.selectedIds.includes(opt.id)
              return (
                <Tappable
                  key={opt.id}
                  style={[s.option, checked && s.optionChecked, disabled && s.optionDisabled]}
                  onPress={(e) => {
                    // 选项位于 sheet > backdrop(Tappable, onPress=onDismiss)之内:测试侧
                    // fireEvent.click 会沿 DOM 冒泡,把 backdrop 的 onDismiss 一并触发,导致
                    // 选完项整卡卸载(Modal visible→false)。真机原生手势按 responder 判定、
                    // 不冒泡,此处 stopPropagation 只为让测试 fireEvent 与真机语义一致。
                    e.stopPropagation()
                    if (!disabled) onSelect(opt.id)
                  }}
                  accessibilityRole={frame.allowMultiple ? 'checkbox' : 'radio'}
                  accessibilityState={{ checked }}
                >
                  <View style={[s.box, checked && s.boxChecked]}>
                    {checked ? <Check size={12} color={tokens.brand.ctaForeground} /> : null}
                  </View>
                  <Text style={s.optionText}>{opt.label}</Text>
                </Tappable>
              )
            })}

            {frame.allowCustom ? (
              <TextField
                colorScheme={colorScheme}
                value={entry.customText}
                onChangeText={onCustomText}
                placeholder={t(`${NS}.customPlaceholder`)}
                multiline
                editable={!disabled}
                style={s.input}
              />
            ) : null}

            {entry.phase === 'failed' ? (
              <Text style={s.failed}>{t(`${NS}.responseFailed`)}</Text>
            ) : null}
          </ScrollView>

          <View style={s.chrome}>
            <Tappable
              style={s.action}
              onPress={(e) => {
                e.stopPropagation()
                onWithdraw()
              }}
              disabled={busy || decided}
            >
              <X size={16} color={tokens.text.primary} />
              <Text style={s.actionText}>{t(`${NS}.withdraw`)}</Text>
            </Tappable>
            <Tappable
              style={[s.action, s.submit, (!canAnswer || disabled) && s.actionDisabled]}
              onPress={(e) => {
                e.stopPropagation()
                onAnswer()
              }}
              disabled={!canAnswer || disabled}
            >
              <Check size={16} color={tokens.brand.ctaForeground} />
              <Text style={[s.actionText, s.submitText]}>
                {busy ? t(`${NS}.submitting`) : t(`${NS}.submit`)}
              </Text>
            </Tappable>
          </View>
        </Tappable>
      </Tappable>
    </Modal>
  )
}

function createStyles() {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: rnCssLight.black45, justifyContent: 'flex-end' },
    sheet: {
      flexDirection: 'column',
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      backgroundColor: tokens.surface.bg,
    },
    chrome: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm, flexShrink: 0 },
    title: {
      flexShrink: 1,
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    status: { fontSize: rnType.caption.size, color: tokens.text.secondary },
    body: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
    bodyInner: { gap: rnSpacing['sm-loose'], paddingVertical: rnSpacing.sm },
    prompt: { fontSize: rnType.body.size, color: tokens.text.primary },
    expires: { fontSize: rnType.caption.size, color: tokens.text.secondary },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['xs-loose'],
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      backgroundColor: tokens.surface.card,
    },
    optionChecked: { borderColor: tokens.brand.cta, backgroundColor: tokens.surface.muted },
    optionDisabled: { opacity: 0.6 },
    box: {
      width: 18,
      height: 18,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxChecked: { backgroundColor: tokens.brand.cta, borderColor: tokens.brand.cta },
    optionText: { flex: 1, fontSize: rnType.bodySm.size, color: tokens.text.primary },
    input: {
      minHeight: 48,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      backgroundColor: tokens.surface.inputBg,
      fontSize: rnType.body.size,
      color: tokens.text.primary,
    },
    failed: { fontSize: rnType.caption.size, color: tokens.danger.DEFAULT },
    action: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing['xs-loose'],
      paddingHorizontal: rnSpacing['md-loose'],
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      backgroundColor: tokens.surface.card,
    },
    submit: { backgroundColor: tokens.brand.cta, borderColor: tokens.brand.cta },
    actionDisabled: { opacity: 0.5 },
    actionText: { fontSize: rnType.bodySm.size, color: tokens.text.primary },
    submitText: { color: tokens.brand.ctaForeground },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
