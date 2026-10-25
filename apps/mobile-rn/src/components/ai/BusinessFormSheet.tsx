// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 react-native Modal / lucide-react-native / @ihui/rn-app TextField,
// 不适合共享层(与同族 ToolApprovalSheet 同一分层口径)。
//
// D77 对话流业务表单卡 RN 腿。判定层与投影层**一行都不重写**:
//  - 帧→渲染态投影取 `@ihui/shared/chat/form-request-frame` 的 projectFormRequestFrame
//    (与小程序 chat.tsx:1100 同一出口) ⇒ "缺 requestId / 未知 kind / 动作不成对" 三种
//    不该弹卡的情形,端内不可能出现第二套判序;
//  - 字段表、校验、状态机、折叠判据取 `@ihui/shared/chat/business-forms`
//    (web 的 business-form-card.tsx 与小程序 BusinessFormCard.tsx 同一份)。
//
// 三条不可让的行为(票面验收):
//  - 批准:校验通过才上行,失败停在 filling 并把错误挂在具体字段上;
//  - 拒绝:直达终态且不带 values(拒绝零副作用),理由仅 reject 可带;
//  - 上行失败/无会话锚点:显式 failed 态可重试,不得把"没发出去"读成"已处理"。
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CalendarDays, Check, Mail, X } from 'lucide-react-native'
import { postFormResponse } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import {
  BUSINESS_FORM_FIELDS,
  applyFormAction,
  attendeesFoldNeeded,
  formFieldErrorKey,
  formFieldLabelKey,
  formSubmitIntentOf,
  validateFormValues,
  type BusinessFormKind,
  type BusinessFormFieldError,
  type BusinessFormValues,
  type FormStatePhase,
} from '@ihui/shared/chat/business-forms'
import {
  projectFormRequestFrame,
  type BusinessFormFrameEntry,
} from '@ihui/shared/chat/form-request-frame'

/** 线帧形状取投影出口的形参类型:不在端内自立第二份契约名(§22c 单一真相源)。 */
type FormRequestFramePayload = Parameters<typeof projectFormRequestFrame>[0]
import { currentRnTheme, tokens } from '../../theme/active-tokens'
import { useI18n } from '../../i18n'

const REJECT_REASON_MAX = 200
const NS = 'ai.pane.businessForms'

/** postFormResponse 的入参形状:取既有出口的形参类型,不在端内自立第二份契约名。 */
type FormResponsePayload = Parameters<typeof postFormResponse>[1]

interface FormEntry {
  frame: BusinessFormFrameEntry
  phase: FormStatePhase
  values: Record<string, string>
  errors: Record<string, BusinessFormFieldError>
  rejectReason: string
  foldOpen: boolean
}

export interface UseBusinessFormQueueOptions {
  /** 帧未带 messageId 时挂到哪条 assistant 消息(= 本轮流式消息 ID),由宿主给,端内不猜。 */
  fallbackMessageId: () => string
}

export interface UseBusinessFormQueueResult {
  /** 直接挂进 streamChat 的 options.onFormRequest */
  onFormRequest: (event: FormRequestFramePayload) => void
  /** 必须渲染在屏内:待决表单卡 */
  host: ReactNode
}

export function useBusinessFormQueue(
  opts: UseBusinessFormQueueOptions,
): UseBusinessFormQueueResult {
  const colorScheme = currentRnTheme()
  const [entries, setEntries] = useState<FormEntry[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  /** 上行发不出去的请求集:必须显式挂着,不得静默当"已处理"。 */
  const [sendFailed, setSendFailed] = useState<Record<string, boolean>>({})

  const onFormRequest = useCallback(
    (event: FormRequestFramePayload) => {
      // 投影返回 null 的三种情形(缺锚点/未知 kind/动作不成对)一律不弹卡 —— 与小程序同一判序。
      const frame = projectFormRequestFrame(event, opts.fallbackMessageId())
      if (!frame) return
      setEntries((prev) =>
        prev.some((e) => e.frame.requestId === frame.requestId)
          ? prev
          : [
              {
                frame,
                phase: 'filling',
                values: Object.fromEntries(event.fields.map((f) => [f.key, ''])),
                errors: {},
                rejectReason: '',
                foldOpen: false,
              },
            ],
      )
      setOpenId(frame.requestId)
    },
    [opts],
  )

  const patch = (requestId: string, next: Partial<FormEntry>) => {
    setEntries((prev) => prev.map((e) => (e.frame.requestId === requestId ? { ...e, ...next } : e)))
  }

  const markFailed = (requestId: string) => setSendFailed((p) => ({ ...p, [requestId]: true }))

  const approve = useCallback(
    async (requestId: string) => {
      const entry = entries.find((e) => e.frame.requestId === requestId)
      if (!entry) return
      const kind = entry.frame.kind
      const raw: BusinessFormValues = { ...entry.values }
      const result = validateFormValues(kind, raw)
      if (!result.ok) {
        patch(requestId, { errors: result.fieldErrors })
        return
      }
      patch(requestId, { errors: {}, phase: applyFormAction(entry.phase, { type: 'submit' }) })
      // 应答通道锚点只能来自帧本身(sessionId 缺省即不发:造一个会把应答打到别人会话上)。
      const sessionId = entry.frame.sessionId
      if (!sessionId) {
        patch(requestId, { phase: 'failed' })
        markFailed(requestId)
        return
      }
      const body: FormResponsePayload = { requestId, kind, action: 'approve', values: raw }
      try {
        await postFormResponse(sessionId, body)
        setEntries((prev) =>
          prev.map((e) =>
            e.frame.requestId === requestId
              ? { ...e, phase: applyFormAction(e.phase, { type: 'commitSuccess' }) }
              : e,
          ),
        )
      } catch {
        patch(requestId, { phase: 'failed' })
        markFailed(requestId)
      }
    },
    [entries],
  )

  const reject = useCallback(
    async (requestId: string) => {
      const entry = entries.find((e) => e.frame.requestId === requestId)
      if (!entry) return
      const trimmed = entry.rejectReason.trim()
      // 拒绝先落终态(不经 submitting),body 不带 values ⇒ 拒绝零副作用。
      setEntries((prev) =>
        prev.map((e) =>
          e.frame.requestId === requestId
            ? { ...e, phase: applyFormAction(e.phase, { type: 'reject' }) }
            : e,
        ),
      )
      const sessionId = entry.frame.sessionId
      if (!sessionId) {
        markFailed(requestId)
        return
      }
      const body: FormResponsePayload = {
        requestId,
        kind: entry.frame.kind,
        action: 'reject',
        ...(trimmed ? { rejectReason: trimmed } : {}),
      }
      try {
        await postFormResponse(sessionId, body)
      } catch {
        markFailed(requestId)
      }
    },
    [entries],
  )

  const host = (
    <>
      {entries.map((entry) => (
        <FormPanel
          key={entry.frame.requestId}
          entry={entry}
          colorScheme={colorScheme}
          open={openId === entry.frame.requestId}
          sendFailed={sendFailed[entry.frame.requestId] === true}
          onClose={() => setOpenId(null)}
          onReopen={() => setOpenId(entry.frame.requestId)}
          onValue={(key, v) =>
            patch(entry.frame.requestId, { values: { ...entry.values, [key]: v } })
          }
          onRejectReason={(v) => patch(entry.frame.requestId, { rejectReason: v })}
          onFold={() => patch(entry.frame.requestId, { foldOpen: !entry.foldOpen })}
          onApprove={() => void approve(entry.frame.requestId)}
          onReject={() => void reject(entry.frame.requestId)}
        />
      ))}
    </>
  )

  return { onFormRequest, host }
}

interface FormPanelProps {
  entry: FormEntry
  colorScheme: 'light' | 'dark'
  open: boolean
  sendFailed: boolean
  onClose: () => void
  onReopen: () => void
  onValue: (key: string, value: string) => void
  onRejectReason: (value: string) => void
  onFold: () => void
  onApprove: () => void
  onReject: () => void
}

function FormPanel({
  entry,
  colorScheme,
  open,
  sendFailed,
  onClose,
  onReopen,
  onValue,
  onRejectReason,
  onFold,
  onApprove,
  onReject,
}: FormPanelProps) {
  const { t } = useI18n()
  const s = useMemo(() => createStyles(), [])
  const kind: BusinessFormKind = entry.frame.kind
  const fields = BUSINESS_FORM_FIELDS[kind]
  const intent = formSubmitIntentOf(kind, entry.frame.mode)
  const busy = entry.phase === 'submitting'
  const decided = entry.phase === 'approved' || entry.phase === 'rejected'
  const attendees = (entry.values.attendees ?? '')
    .split(/[,;，；\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  const fold = attendeesFoldNeeded(attendees.length)
  const shownAttendees =
    fold.foldNeeded && !entry.foldOpen ? attendees.slice(0, fold.visibleCount) : attendees
  // 词表只给终态/在飞态四个档(filling/idle 是"正在填",不是状态徽标)⇒ 无键就不渲,不硬造中文。
  const statusText =
    entry.phase === 'submitting' ||
    entry.phase === 'approved' ||
    entry.phase === 'rejected' ||
    entry.phase === 'failed'
      ? t(`${NS}.status.${entry.phase}`)
      : null

  return (
    <View style={s.chipWrap}>
      {/* 收起 ≠ 决策:被拒/收起后仍留重新打开的入口(与同族 ToolApprovalSheet 同语义) */}
      <Pressable style={s.chip} onPress={onReopen}>
        {kind === 'calendarEvent' ? (
          <CalendarDays size={16} color={tokens.text.primary} />
        ) : (
          <Mail size={16} color={tokens.text.primary} />
        )}
        <Text style={s.chipText} numberOfLines={1}>
          {t(`${NS}.aria.${kind}`)}
        </Text>
        {statusText ? <Text style={s.chipStatus}>{statusText}</Text> : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={s.backdrop} onPress={onClose}>
          <View style={s.sheet}>
            <View style={s.chrome}>
              <Text style={s.title}>{t(`${NS}.aria.${kind}`)}</Text>
              {statusText ? <Text style={s.chipStatus}>{statusText}</Text> : null}
            </View>

            <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
              {fields.map((f) => {
                const err = entry.errors[f.key]
                return (
                  <View key={f.key} style={s.field}>
                    <Text style={s.label}>
                      {t(`${NS}.${formFieldLabelKey(kind, f.key)}`)}
                      {f.required ? <Text style={s.required}> *</Text> : null}
                    </Text>
                    <TextField
                      colorScheme={colorScheme}
                      value={entry.values[f.key] ?? ''}
                      onChangeText={(v: string) => onValue(f.key, v)}
                      multiline={f.type === 'multiline'}
                      style={s.input}
                    />
                    {err ? (
                      <Text style={s.error}>{t(`${NS}.${formFieldErrorKey(err)}`)}</Text>
                    ) : null}
                    {f.type === 'attendees' && attendees.length > 0 ? (
                      <View style={s.attendeeWrap}>
                        {shownAttendees.map((a, i) => (
                          <Text key={`${a}-${i}`} style={s.attendee}>
                            {a}
                          </Text>
                        ))}
                        {fold.foldNeeded ? (
                          <Pressable onPress={onFold} hitSlop={4}>
                            <Text style={s.fold}>
                              {entry.foldOpen
                                ? t(`${NS}.${fold.collapseKey}`)
                                : t(`${NS}.${fold.expandKey}`, { count: fold.overflowCount })}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                )
              })}
              {!decided ? (
                <TextField
                  colorScheme={colorScheme}
                  value={entry.rejectReason}
                  onChangeText={(v: string) => onRejectReason(v.slice(0, REJECT_REASON_MAX))}
                  multiline
                  style={s.input}
                />
              ) : null}
              {sendFailed ? <Text style={s.failed}>{t(`${NS}.status.failed`)}</Text> : null}
            </ScrollView>

            <View style={s.chrome}>
              <Pressable style={[s.action, s.reject]} onPress={onReject} disabled={busy || decided}>
                <X size={16} color={tokens.text.primary} />
                <Text style={s.actionText}>{t(`${NS}.action.reject`)}</Text>
              </Pressable>
              <Pressable
                style={[s.action, s.approve, (busy || decided) && s.actionDisabled]}
                onPress={onApprove}
                disabled={busy || decided}
              >
                {!busy ? <Check size={16} color={tokens.brand.ctaForeground} /> : null}
                <Text style={[s.actionText, s.approveText]}>{t(`${NS}.action.${intent}`)}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

function createStyles() {
  return StyleSheet.create({
    chipWrap: { marginBottom: rnSpacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.muted,
    },
    chipText: { flex: 1, fontSize: 13, color: tokens.text.primary },
    chipStatus: { fontSize: rnType.caption.size, color: tokens.text.secondary },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    // 门 217:sheet 是 bounded 容器 ⇒ 内部唯一弹性块是 body(ScrollView),固定 chrome 显式 flexShrink:0。
    sheet: {
      maxHeight: '78%',
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
    body: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
    bodyInner: { gap: 10, paddingVertical: rnSpacing.sm },
    field: { gap: rnSpacing.xs },
    label: { fontSize: rnType.label.size, color: tokens.text.secondary },
    required: { color: tokens.danger.DEFAULT },
    input: {
      minHeight: 40,
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      backgroundColor: tokens.surface.inputBg,
      fontSize: rnType.body.size,
      color: tokens.text.primary,
    },
    error: { fontSize: rnType.caption.size, color: tokens.danger.DEFAULT },
    failed: { fontSize: rnType.label.size, color: tokens.danger.DEFAULT },
    attendeeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: rnSpacing.xs },
    attendee: {
      fontSize: rnType.caption.size,
      color: tokens.text.medium,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.card,
    },
    fold: { fontSize: rnType.caption.size, color: tokens.text.secondary },
    action: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      backgroundColor: tokens.surface.card,
    },
    reject: {},
    approve: { backgroundColor: tokens.brand.cta, borderColor: tokens.brand.cta },
    actionDisabled: { opacity: 0.5 },
    actionText: { fontSize: 13, color: tokens.text.primary },
    approveText: { color: tokens.brand.ctaForeground },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
