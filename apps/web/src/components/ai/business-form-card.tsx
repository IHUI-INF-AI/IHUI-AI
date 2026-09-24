// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D77 对话流业务表单卡(G-106) —— 消息流内业务动作的可填表单渲染件。
//
// **数据面纪律(同 D72 worktree-card)**:本卡**不取数**。`form_request` / `form_response`
// 事件契约属 D34、后端落库另票;表单请求形状由 `@ihui/shared/chat/business-forms`
// 派发(`businessFormRequest`),动作经 `onAction` 注入,卡片自己不 fetch。
//
// **拒绝路径零副作用(本票硬约束)**:拒绝走状态机 `filling → rejected` 直达
// (不经 submitting),`onAction` 只收到 reject-only 应答(`values` 恒为 null),
// 不触发任何 create/save 提交。
//
// **复用映射(自证,共享层优先)**:
//   · Input / Label / Button  ← @ihui/ui-react(表单件唯一视觉来源)
//   · 正文多行输入            ← ui-react 无 Textarea 导出(index.ts 全量核对),
//     此处以原生 <textarea> 补位并沿用 Input 同款样式类 —— 唯一端内补位,已在上游
//     自证结论中列明;ui-react 补 Textarea 后应替换。
//   · 校验/状态机/折叠判定     ← 判定层纯函数,端内零自判。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { Button, Input, Label } from '@ihui/ui-react'

import { cn } from '@/lib/utils'
import {
  BUSINESS_FORM_FIELDS,
  applyFormAction,
  attendeesFoldNeeded,
  businessFormRequest,
  formFieldErrorKey,
  formFieldLabelKey,
  validateFormValues,
  DEFAULT_SUBMIT_INTENT,
  type BusinessFormActionPayload,
  type BusinessFormKind,
  type BusinessFormFieldError,
  type BusinessFormValue,
  type FormStatePhase,
  type FormSubmitIntent,
} from '@ihui/shared/chat/business-forms'

/** 出席人输入串 → 数组(与判定层多地址分隔一致:逗号/分号/空白) */
function splitAttendees(raw: string): string[] {
  return raw
    .split(/[,;，；\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** 输入串值 → 判定层表单值(attendees 拆数组,其余原样) */
function toFormValues(kind: BusinessFormKind, raw: Readonly<Record<string, string>>): Record<string, BusinessFormValue> {
  const values: Record<string, BusinessFormValue> = { ...raw }
  if (kind === 'calendarEvent') {
    values.attendees = splitAttendees(raw.attendees ?? '')
  }
  return values
}

export interface BusinessFormCardProps {
  /** 表单种类(邮件撰写 / 日历创建·更新) */
  kind: BusinessFormKind
  /** 日历形态:create=创建,update=保存(批准侧按钮文案);email 忽略此值 */
  mode?: 'create' | 'update'
  /** 请求标识(form_response 回传用;本票由调用方注入,契约事件化属 D34) */
  requestId?: string
  /** 动作回调。**数据面在调用方**;reject 时收到的应答 `values` 恒为 null(reject-only) */
  onAction?: (payload: BusinessFormActionPayload) => void
  className?: string
  'data-testid'?: string
}

const INPUT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export function BusinessFormCard({
  kind,
  mode = 'create',
  requestId,
  onAction,
  className,
  'data-testid': testId,
}: BusinessFormCardProps) {
  const t = useTranslations('ai.pane.businessForms')

  const [phase, setPhase] = React.useState<FormStatePhase>(() => applyFormAction('idle', { type: 'beginFill' }))
  const [raw, setRaw] = React.useState<Readonly<Record<string, string>>>({})
  const [errors, setErrors] = React.useState<Readonly<Record<string, BusinessFormFieldError>> | null>(null)
  const [attendeesExpanded, setAttendeesExpanded] = React.useState(false)

  const fields = BUSINESS_FORM_FIELDS[kind]
  const filling = phase === 'filling'

  const setValue = (key: string, value: string) => {
    setRaw((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev || !prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /** 批准侧提交意图:email=save(批准);日历 create=创建 / update=保存 */
  const submitIntent: FormSubmitIntent = kind === 'calendarEvent' && mode === 'update' ? 'save' : DEFAULT_SUBMIT_INTENT[kind]

  const handleApprove = () => {
    if (!filling) return
    const values = toFormValues(kind, raw)
    const result = validateFormValues(kind, values)
    if (!result.ok) {
      // 校验失败:停在 filling,不进 submitting,onAction 不得被调用。
      setErrors(result.fieldErrors)
      return
    }
    setErrors(null)
    setPhase((p) => applyFormAction(applyFormAction(p, { type: 'submit' }), { type: 'commitSuccess' }))
    onAction?.({ action: 'approve', kind, values })
  }

  const handleReject = () => {
    if (!filling) return
    // 拒绝直达终态(不经 submitting),应答 reject-only:values 恒为 null,零副作用。
    setPhase((p) => applyFormAction(p, { type: 'reject' }))
    onAction?.({ action: 'reject', kind, values: null })
  }

  const attendeesList = kind === 'calendarEvent' ? splitAttendees(raw.attendees ?? '') : []
  const fold = attendeesFoldNeeded(attendeesList.length)
  const visibleAttendees = fold.foldNeeded && !attendeesExpanded
    ? attendeesList.slice(0, fold.visibleCount)
    : attendeesList

  const approveLabel = kind === 'calendarEvent' ? t(`action.${submitIntent}`) : t('action.approve')

  return (
    <div
      role="group"
      aria-label={t('ariaLabel')}
      className={cn('flex flex-col gap-2 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-form-kind={kind}
      data-form-phase={phase}
      data-form-request-id={requestId}
    >
      <span className="text-xs font-medium text-muted-foreground">{t(`aria.${kind}`)}</span>

      <div className="flex flex-col gap-2">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1" data-form-field={field.key}>
            <Label className="text-xs text-muted-foreground">{t(formFieldLabelKey(kind, field.key))}</Label>
            {field.type === 'multiline' ? (
              <textarea
                className={cn(INPUT_CLASS, 'h-20 py-2')}
                value={raw[field.key] ?? ''}
                placeholder={t(formFieldLabelKey(kind, field.key))}
                disabled={!filling}
                onChange={(e) => setValue(field.key, e.target.value)}
              />
            ) : (
              <Input
                type={field.type === 'datetime' ? 'datetime-local' : field.type === 'email' ? 'email' : 'text'}
                className="h-9"
                value={raw[field.key] ?? ''}
                placeholder={t(formFieldLabelKey(kind, field.key))}
                disabled={!filling}
                onChange={(e) => setValue(field.key, e.target.value)}
              />
            )}
            {errors?.[field.key] !== undefined ? (
              <span
                className="text-[11px] text-destructive"
                data-form-error={field.key}
                data-form-error-kind={errors[field.key]}
              >
                {t(formFieldErrorKey(errors[field.key] as BusinessFormFieldError))}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {kind === 'calendarEvent' && attendeesList.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1" data-form-attendees-count={attendeesList.length}>
          {visibleAttendees.map((addr) => (
            <span
              key={addr}
              className="rounded-sm bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground"
              data-form-attendee={addr}
            >
              {addr}
            </span>
          ))}
          {fold.foldNeeded ? (
            attendeesExpanded ? (
              <button
                type="button"
                className="rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground/70 hover:text-foreground"
                data-attendees-collapse=""
                onClick={() => setAttendeesExpanded(false)}
              >
                {t(fold.collapseKey)}
              </button>
            ) : (
              <button
                type="button"
                className="rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground/70 hover:text-foreground"
                data-attendees-expand=""
                onClick={() => setAttendeesExpanded(true)}
              >
                {t(fold.expandKey, { count: fold.overflowCount })}
              </button>
            )
          ) : null}
        </div>
      ) : null}

      {filling && onAction ? (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="xs"
            onClick={handleApprove}
            data-action="approve"
            data-form-submit-intent={submitIntent}
          >
            {approveLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleReject}
            data-action="reject"
          >
            {t('action.reject')}
          </Button>
        </div>
      ) : null}

      {phase === 'approved' ? (
        <span className="text-[11px] text-emerald-600 dark:text-emerald-500" data-form-status="approved">
          {t('status.approved')}
        </span>
      ) : null}
      {phase === 'rejected' ? (
        <span className="text-[11px] text-muted-foreground" data-form-status="rejected">
          {t('status.rejected')}
        </span>
      ) : null}
      {phase === 'submitting' ? (
        <span className="text-[11px] text-muted-foreground" data-form-status="submitting">
          {t('status.submitting')}
        </span>
      ) : null}
      {phase === 'failed' ? (
        <span className="text-[11px] text-destructive" data-form-status="failed">
          {t('status.failed')}
        </span>
      ) : null}
    </div>
  )
}

/** 供调用方按种类取请求形状(与卡片渲染同源,防端内自抄字段集) */
export { businessFormRequest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
