// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BusinessFormCard — 小程序端「业务表单卡」(D77 本端落地位,2026-10-17 立)。
 *
 * 对标关系(逐行为抄自 web `apps/web/src/components/ai/business-form-card.tsx` +
 * host `business-form-section.tsx`):
 *  - 字段表/校验/状态机/出席人折叠全部走共享判定层(@ihui/shared/chat/business-forms),
 *    端内零自判(AGENTS §0.6 判据单源);
 *  - 批准:校验通过才进提交,失败停在 filling,onAction 收 approve + values;
 *  - 拒绝:filling → rejected 直达(不经 submitting),onAction 收 reject-only
 *    (`values` 恒为 null);**拒绝理由在卡内收集**(与 web 不同:web 的理由输入在
 *    host 外侧,因为 web 卡是既有资产不能改 props;本端是新卡,理由与卡同生)
 *  - 状态显示 submitting/approved/rejected 三档;failed(上行发不出)由宿主在卡外渲染
 *    (与 web host 同位);按钮禁用由宿主 sending 信号控制(防重复提交)。
 *
 * 平台差异(如实登记,交付报告同步):Taro Input 不支持 `datetime-local`,
 * start/end 两字段降级为文本输入(placeholder 提示格式);校验仍走共享层
 * Date.parse,格式写错照拦。
 *
 * 数据面纪律(同 tool-approval-card):本卡**不取数**。上行(form_response)
 * 由宿主(chat.tsx)经 buildFormResponseEvent + postFormResponse 完成,
 * 卡片只把用户应答经 onAction 交出去。
 */
import { useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import { useTt } from '@/i18n'
import {
  BUSINESS_FORM_FIELDS,
  DEFAULT_SUBMIT_INTENT,
  applyFormAction,
  attendeesFoldNeeded,
  formFieldErrorKey,
  validateFormValues,
  type BusinessFormActionPayload,
  type BusinessFormKind,
  type BusinessFormValue,
  type BusinessFormFieldError,
  type FormStatePhase,
  type FormSubmitIntent,
} from '@ihui/shared/chat/business-forms'
import './BusinessFormCard.css'

/** 拒绝理由最大长度(与 web host 的 REJECT_REASON_MAX 同值) */
const REJECT_REASON_MAX = 200

/** 卡片 → 宿主的应答载荷(reject 时 values 恒 null,reason 仅 reject 可带) */
export type BusinessFormCardAction = BusinessFormActionPayload & { reason?: string }

export interface BusinessFormCardProps {
  /** 表单种类(邮件撰写 / 日历创建·更新) */
  kind: BusinessFormKind
  /** 请求标识(form_response 回传用) */
  requestId?: string
  /** 宿主级:本条目的上行应答在途(按钮禁用,防重复提交) */
  sending?: boolean
  /** 应答出口(数据面在宿主:postFormResponse + 状态标记) */
  onAction?: (payload: BusinessFormCardAction) => void
}

/** 出席人输入串 → 数组(与判定层多地址分隔一致:逗号/分号/空白) */
function splitAttendees(raw: string): string[] {
  return raw
    .split(/[,;，；\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** 输入串值 → 判定层表单值(attendees 拆数组,其余原样) */
function toFormValues(
  kind: BusinessFormKind,
  raw: Readonly<Record<string, string>>,
): Record<string, BusinessFormValue> {
  const values: Record<string, BusinessFormValue> = { ...raw }
  if (kind === 'calendarEvent') {
    values.attendees = splitAttendees(raw.attendees ?? '')
  }
  return values
}

export default function BusinessFormCard({
  kind,
  requestId,
  sending,
  onAction,
}: BusinessFormCardProps) {
  // 取词走 useTt 钩子(不从宿主 prop 收 tt):① 守门 121 按 useTt 绑定名扫发射点,
  //   prop 形态的取词对它不可见 ⇒ 新增键会被判"有译文零生产者";② 卡片自取自足,
  //   宿主只管数据面(postFormResponse)与 sending 信号,少一条 prop 契约。
  const tt = useTt()
  // idle 起步:web 同款"卡片挂载即可填"由 beginFill 在首帧隐式完成(web 用 useState 惰性
  // 初始化 applyFormAction('idle', beginFill) ⇒ 'filling';本端同构,直接 'filling' 起步
  // 但迁移仍走 applyFormAction,状态机唯一入口不破)。
  const [phase, setPhase] = useState<FormStatePhase>('filling')
  const [raw, setRaw] = useState<Readonly<Record<string, string>>>({})
  const [errors, setErrors] = useState<Readonly<Record<string, BusinessFormFieldError>> | null>(
    null,
  )
  const [attendeesExpanded, setAttendeesExpanded] = useState(false)
  const [reason, setReason] = useState('')

  const fields = BUSINESS_FORM_FIELDS[kind]
  const filling = phase === 'filling'
  const disabled = !filling || sending === true

  const setValue = (key: string, value: string): void => {
    setRaw((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev || prev[key] === undefined) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /** 批准侧提交意图:email=save(批准);日历 create=创建 / update=保存(本端 mode 恒 create) */
  const submitIntent: FormSubmitIntent = DEFAULT_SUBMIT_INTENT[kind]

  const handleApprove = (): void => {
    if (disabled) return
    const values = toFormValues(kind, raw)
    const result = validateFormValues(kind, values)
    if (!result.ok) {
      // 校验失败:停在 filling,不进 submitting,onAction 不得被调用。
      setErrors(result.fieldErrors)
      return
    }
    setErrors(null)
    setPhase((p) =>
      applyFormAction(applyFormAction(p, { type: 'submit' }), { type: 'commitSuccess' }),
    )
    onAction?.({ action: 'approve', kind, values })
  }

  const handleReject = (): void => {
    if (disabled) return
    // 拒绝直达终态(不经 submitting),应答 reject-only:values 恒为 null,零副作用。
    setPhase((p) => applyFormAction(p, { type: 'reject' }))
    const trimmed = reason.trim()
    onAction?.({ action: 'reject', kind, values: null, ...(trimmed ? { reason: trimmed } : {}) })
  }

  const attendeesList = kind === 'calendarEvent' ? splitAttendees(raw.attendees ?? '') : []
  const fold = attendeesFoldNeeded(attendeesList.length)
  const visibleAttendees =
    fold.foldNeeded && !attendeesExpanded
      ? attendeesList.slice(0, fold.visibleCount)
      : attendeesList

  const approveLabel =
    kind === 'calendarEvent'
      ? tt(`ai.businessForms.action.${submitIntent}`, submitIntent === 'create' ? '创建' : '保存')
      : tt('ai.businessForms.action.approve', '批准')

  return (
    <View
      className="bfc-card"
      data-form-kind={kind}
      data-form-phase={phase}
      data-form-request-id={requestId}
    >
      <Text className="bfc-kind">
        {kind === 'email'
          ? tt('ai.businessForms.aria.email', '邮件撰写卡')
          : tt('ai.businessForms.aria.calendarEvent', '日历表单卡')}
      </Text>

      {fields.map((field) => {
        const fieldError = errors?.[field.key]
        return (
          <View key={field.key} className="bfc-field" data-form-field={field.key}>
            <Text className="bfc-label">
              {tt(`ai.businessForms.fields.${field.key}`, field.key)}
            </Text>
            {field.type === 'multiline' ? (
              <Textarea
                className="bfc-input bfc-textarea"
                value={raw[field.key] ?? ''}
                placeholder={tt(`ai.businessForms.fields.${field.key}`, field.key)}
                disabled={disabled}
                maxlength={2000}
                onInput={(e) => setValue(field.key, String(e.detail.value ?? ''))}
              />
            ) : (
              <Input
                className="bfc-input"
                value={raw[field.key] ?? ''}
                placeholder={
                  field.type === 'datetime'
                    ? 'YYYY-MM-DD HH:mm'
                    : tt(`ai.businessForms.fields.${field.key}`, field.key)
                }
                disabled={disabled}
                onInput={(e) => setValue(field.key, String(e.detail.value ?? ''))}
              />
            )}
            {fieldError !== undefined ? (
              <Text
                className="bfc-error"
                data-form-error={field.key}
                data-form-error-kind={fieldError}
              >
                {/* formFieldErrorKey 返回 'error.<key>' 形,前缀只接到 businessForms 命名空间一层 */}
                {tt(
                  `ai.businessForms.${formFieldErrorKey(fieldError)}`,
                  fieldError === 'required'
                    ? '请填写必填项'
                    : fieldError === 'invalidEmail'
                      ? '邮箱格式不正确'
                      : fieldError === 'endBeforeStart'
                        ? '结束时间需晚于开始时间'
                        : '请至少添加一位出席人',
                )}
              </Text>
            ) : null}
          </View>
        )
      })}

      {kind === 'calendarEvent' && attendeesList.length > 0 ? (
        <View className="bfc-attendees" data-form-attendees-count={attendeesList.length}>
          {visibleAttendees.map((addr) => (
            <Text key={addr} className="bfc-attendee" data-form-attendee={addr}>
              {addr}
            </Text>
          ))}
          {fold.foldNeeded ? (
            <View
              className="bfc-fold-btn"
              hoverClass="bfc-hover"
              data-attendees-expand={attendeesExpanded ? '' : '1'}
              onClick={() => setAttendeesExpanded((v) => !v)}
            >
              <Text>
                {attendeesExpanded
                  ? tt('ai.businessForms.fold.collapse', '收起出席人')
                  : tt('ai.businessForms.fold.expand', `展开全部 {count} 位出席人`, {
                      count: fold.overflowCount,
                    })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {filling ? (
        <View>
          {/* 拒绝理由:只在仍有待应答请求时给出输入位(终态后不再收集);仅 reject 装载 */}
          <View className="bfc-reason" data-form-reject-reason-field={requestId ?? ''}>
            <Text className="bfc-label">{tt('ai.businessForms.reason', '拒绝理由(可选)')}</Text>
            <Input
              className="bfc-input"
              value={reason}
              placeholder={tt('ai.businessForms.reason', '拒绝理由(可选)')}
              disabled={sending === true}
              maxlength={REJECT_REASON_MAX}
              onInput={(e) => setReason(String(e.detail.value ?? ''))}
            />
          </View>
          <View className="bfc-actions">
            <View
              className="bfc-approve"
              hoverClass="bfc-hover"
              data-action="approve"
              data-form-submit-intent={submitIntent}
              onClick={handleApprove}
            >
              <LineIcon name="check-success" size={28} color="var(--color-cta-foreground)" />
              <Text>
                {sending === true
                  ? tt('ai.businessForms.status.submitting', '提交中…')
                  : approveLabel}
              </Text>
            </View>
            <View
              className="bfc-reject"
              hoverClass="bfc-hover"
              data-action="reject"
              onClick={handleReject}
            >
              <LineIcon name="x-error" size={28} color="var(--color-danger)" />
              <Text>{tt('ai.businessForms.action.reject', '拒绝')}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {phase === 'submitting' ? (
        <Text className="bfc-status" data-form-status="submitting">
          {tt('ai.businessForms.status.submitting', '提交中…')}
        </Text>
      ) : null}
      {phase === 'approved' ? (
        <Text className="bfc-status is-ok" data-form-status="approved">
          {tt('ai.businessForms.status.approved', '已批准')}
        </Text>
      ) : null}
      {phase === 'rejected' ? (
        <Text className="bfc-status" data-form-status="rejected">
          {tt('ai.businessForms.status.rejected', '已拒绝')}
        </Text>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
