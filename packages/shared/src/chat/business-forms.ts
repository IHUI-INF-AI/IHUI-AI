// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D77 对话流业务表单卡(G-106,2026-09-24 立) —— 判定层。
//
// **自证结论(改本文件前先读)**:消息流内业务动作当前只有"纯按钮确认"
// (approval/permission 类),**没有可填写的表单卡**;邮件撰写(收件人/抄送/密送/
// 主题/回复至/正文)与日历创建/更新(开始/结束/出席人)的判定层 + 渲染件全仓为零。
//
// **数据面纪律(同 D72 worktree-card)**:本模块**不取数**。`form_request` /
// `form_response` 事件契约属 D34,后端落库另票;本票由调用方经 `onAction` 注入,
// 卡片自己不 fetch。schema 形状与未来 `form_request` 事件对齐(见下方注释)。
//
// 范式同 D71 turn-status / D69 input-notices:常量 + 纯函数 + 穷尽 switch 零 default
// + assertNever。端内不得再建第二套表单校验/状态判定(校验规则全在判定层,渲染层只显示)。

/** 词包命名空间(web 侧 `useTranslations('ai.pane.businessForms')`) */
export const BUSINESS_FORMS_NAMESPACE = 'ai.pane.businessForms' as const

// ---------------------------------------------------------------------------
// ① 表单种类 + 字段 schema
// ---------------------------------------------------------------------------

/**
 * 业务表单种类(取值即 i18n 键片段;`ai.pane.businessForms.aria.<key>`)。
 * 形状可扩展:新增一类 ⇒ 在 BUSINESS_FORM_FIELDS 补字段集、
 * 在 validateFormValues 的穷尽 switch 补校验分支(漏补则编译失败)。
 */
export const BUSINESS_FORM_KINDS = ['email', 'calendarEvent'] as const
export type BusinessFormKind = (typeof BUSINESS_FORM_KINDS)[number]

/** 字段输入类型(渲染层据此选输入件;text/email/datetime → Input,multiline → textarea,attendees → Input+chips) */
export const FORM_FIELD_TYPES = ['text', 'email', 'datetime', 'multiline', 'attendees'] as const
export type BusinessFormFieldType = (typeof FORM_FIELD_TYPES)[number]

/** 校验失败维度(取值即 i18n 键片段;`ai.pane.businessForms.error.<key>`) */
export const FORM_FIELD_ERRORS = [
  'required',
  'invalidEmail',
  'endBeforeStart',
  'noAttendees',
] as const
export type BusinessFormFieldError = (typeof FORM_FIELD_ERRORS)[number]

export interface BusinessFormField {
  /** 字段键(同时是 values 的键与 i18n 键片段 `fields.<key>`) */
  readonly key: string
  readonly type: BusinessFormFieldType
  readonly required: boolean
  /** 占位文案键(`fields.<key>` 同键复用;留空则渲染层用 label 兼作占位) */
  readonly placeholderKey?: string
}

/**
 * 两类表单的字段集(**唯一真相源**,渲染层按此渲染,不得端内自抄第二份):
 *   · email         —— 收件人/抄送/密送/主题/回复至/正文(前三与回复至可多地址)
 *   · calendarEvent —— 开始/结束/出席人(时间区间 + 多出席人)
 */
export const BUSINESS_FORM_FIELDS: Record<BusinessFormKind, readonly BusinessFormField[]> = {
  email: [
    { key: 'to', type: 'email', required: true },
    { key: 'cc', type: 'email', required: false },
    { key: 'bcc', type: 'email', required: false },
    { key: 'subject', type: 'text', required: true },
    { key: 'replyTo', type: 'email', required: false },
    { key: 'body', type: 'multiline', required: true },
  ],
  calendarEvent: [
    { key: 'start', type: 'datetime', required: true },
    { key: 'end', type: 'datetime', required: true },
    { key: 'attendees', type: 'attendees', required: true },
  ],
}

/** 表单值(attendees 为数组,其余为字符串;与字段 type 对齐) */
export type BusinessFormValue = string | readonly string[]
export type BusinessFormValues = Readonly<Record<string, BusinessFormValue>>

/**
 * **与未来 D34 `form_request` 事件的映射关系**(本票不取数,契约另票):
 *
 *   form_request  ::= { kind: BusinessFormKind, fields: BusinessFormField[], actions: FormAction[] }
 *   form_response ::= { requestId: string, action: FormAction, values?: BusinessFormValues }
 *
 * 本模块导出的 `BusinessFormRequest` 即 form_request 的本端形状;`actions` 本票恒为
 * `['approve','reject']` 成对(见 FORM_ACTION_PAIRS)。校验在**判定层**完成后,渲染层
 * 只把 `{ok, fieldErrors}` 显示出来 —— 端内不得自写第二套校验规则。
 */
export interface BusinessFormRequest {
  readonly kind: BusinessFormKind
  readonly fields: readonly BusinessFormField[]
  readonly actions: readonly FormAction[]
}

/** 由种类派发 form_request 请求形状(本票调用方注入用;契约事件化属 D34) */
export function businessFormRequest(kind: BusinessFormKind): BusinessFormRequest {
  return { kind, fields: BUSINESS_FORM_FIELDS[kind], actions: [...FORM_ACTION_PAIR] }
}

const KIND_SET: ReadonlySet<string> = new Set<string>(BUSINESS_FORM_KINDS)

export function isBusinessFormKind(value: string): value is BusinessFormKind {
  return KIND_SET.has(value)
}

// ---------------------------------------------------------------------------
// ② 字段校验(纯函数,规则全在判定层)
// ---------------------------------------------------------------------------

/** 邮箱地址格式(单个地址;足够严但不追求 RFC 全量 —— 判据是"明显写错要拦") */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 把多地址输入(逗号/分号/空白分隔)拆成单地址列表 */
function splitAddresses(raw: string): string[] {
  return raw
    .split(/[,;，；\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function isEmailList(raw: string): boolean {
  const list = splitAddresses(raw)
  return list.length > 0 && list.every((addr) => EMAIL_RE.test(addr))
}

export interface FormValidationResult {
  readonly ok: boolean
  /** 字段键 → 错误维度;仅当 !ok 时非空 */
  readonly fieldErrors: Readonly<Record<string, BusinessFormFieldError>>
}

/**
 * 表单值校验(**唯一**校验入口;渲染层只显示,不得自判)。
 *
 * 规则(判据原文):
 *   · email 卡         —— 必填:收件人/主题/正文;收件人/抄送/密送/回复至须为合法邮箱格式
 *   · calendarEvent 卡 —— 开始 < 结束;出席人至少一人
 */
export function validateFormValues(kind: BusinessFormKind, values: BusinessFormValues): FormValidationResult {
  const fieldErrors: Record<string, BusinessFormFieldError> = {}
  const text = (key: string): string => (typeof values[key] === 'string' ? (values[key] as string) : '')
  const list = (key: string): readonly string[] => (Array.isArray(values[key]) ? (values[key] as readonly string[]) : [])

  switch (kind) {
    case 'email': {
      for (const field of BUSINESS_FORM_FIELDS.email) {
        const raw = text(field.key)
        if (field.required && raw.trim().length === 0) {
          fieldErrors[field.key] = 'required'
          continue
        }
        if (raw.trim().length > 0 && field.type === 'email' && !isEmailList(raw)) {
          fieldErrors[field.key] = 'invalidEmail'
        }
      }
      return finishValidation(fieldErrors)
    }
    case 'calendarEvent': {
      const startRaw = text('start')
      const endRaw = text('end')
      if (startRaw.trim().length === 0) fieldErrors.start = 'required'
      if (endRaw.trim().length === 0) fieldErrors.end = 'required'
      if (startRaw.length > 0 && endRaw.length > 0) {
        const startMs = Date.parse(startRaw)
        const endMs = Date.parse(endRaw)
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs <= startMs) {
          fieldErrors.end = 'endBeforeStart'
        }
      }
      if (list('attendees').length === 0) fieldErrors.attendees = 'noAttendees'
      return finishValidation(fieldErrors)
    }
  }
  return assertNeverKind(kind)
}

/** 校验结果统一出口(ok = 无任何字段错误) */
function finishValidation(fieldErrors: Record<string, BusinessFormFieldError>): FormValidationResult {
  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors }
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverKind(kind: never): never {
  throw new Error(`unhandled business form kind: ${String(kind)}`)
}

/** 校验错误 → i18n 键(`ai.pane.businessForms.error.<key>`) */
export function formFieldErrorKey(err: BusinessFormFieldError): string {
  return `error.${err}`
}

/** 字段 → i18n 键(`ai.pane.businessForms.fields.<key>`;label 与占位同键复用) */
export function formFieldLabelKey(_kind: BusinessFormKind, fieldKey: string): string {
  return `fields.${fieldKey}`
}

// ---------------------------------------------------------------------------
// ③ 动作成对语义(本票硬约束:approve/reject 成对,拒绝路径零副作用)
// ---------------------------------------------------------------------------

export const FORM_ACTIONS = ['approve', 'reject'] as const
export type FormAction = (typeof FORM_ACTIONS)[number]

/** 成对表:approve ↔ reject 一一对应;新增动作必须先补对,否则类型不通 */
export const FORM_ACTION_PAIRS: Readonly<Record<FormAction, FormAction>> = {
  approve: 'reject',
  reject: 'approve',
}

/** 本票成对动作固定二元组(form_request.actions 的取值) */
export const FORM_ACTION_PAIR: readonly [FormAction, FormAction] = ['approve', 'reject']

export function formActionLabelKey(action: FormAction): string {
  return `action.${action}`
}

/** 拒绝侧提交动作的意图类型(判据原文:「拒绝路径不得触发任何提交动作」) */
export const FORM_SUBMIT_INTENTS = ['create', 'save'] as const
export type FormSubmitIntent = (typeof FORM_SUBMIT_INTENTS)[number]

/** 提交动作 → i18n 键(`action.create` = 创建,`action.save` = 保存) */
export function formSubmitIntentKey(intent: FormSubmitIntent): string {
  return `action.${intent}`
}

/** 各类表单批准侧对应的提交意图(email=save;calendarEvent 由调用方按 create/update 传) */
export const DEFAULT_SUBMIT_INTENT: Record<BusinessFormKind, FormSubmitIntent> = {
  email: 'save',
  calendarEvent: 'create',
}

export interface FormSideEffectContext {
  /** 用户按下的动作 */
  readonly action: FormAction
  /** 拒绝路径上是否调用了任何提交动作(approve 侧为 true 属正常) */
  readonly submitInvoked: boolean
}

/**
 * **拒绝路径零副作用判据**(本票硬约束,须有专门负例):
 * `action === 'reject'` 时 `submitInvoked` 必须为 false —— 拒绝只回一个 reject-only
 * 应答(form_response.action='reject',**不带 values**),不触发任何 create/save 提交。
 * approve 侧不受此约束。
 */
export function rejectNoSideEffect(ctx: FormSideEffectContext): boolean {
  return ctx.action !== 'reject' || !ctx.submitInvoked
}

/**
 * 卡片动作回调应答形状:reject 时 `values` 恒为 null(reject-only),
 * 渲染层不得在 reject 路径上附带表单值 —— 这是"拒绝不产生副作用"在数据形状上的落点。
 */
export interface BusinessFormActionPayload {
  readonly action: FormAction
  readonly kind: BusinessFormKind
  /** 仅 approve 携带;reject 恒为 null(负例判据) */
  readonly values: BusinessFormValues | null
}

// ---------------------------------------------------------------------------
// ④ 表单状态机(idle/filling/submitting/approved/rejected/failed)
// ---------------------------------------------------------------------------

export const FORM_STATE_PHASES = ['idle', 'filling', 'submitting', 'approved', 'rejected', 'failed'] as const
export type FormStatePhase = (typeof FORM_STATE_PHASES)[number]

export type FormStateEvent =
  | { readonly type: 'beginFill' }
  | { readonly type: 'submit' }
  | { readonly type: 'reject' }
  | { readonly type: 'commitSuccess' }
  | { readonly type: 'commitFailure' }
  | { readonly type: 'reset' }

/**
 * 表单状态机(**唯一**迁移入口,switch 穷尽六相、零 default):
 *   · idle        → beginFill → filling
 *   · filling     → submit → submitting(批准侧提交);**reject → rejected 直达
 *                 (不经 submitting —— 拒绝没有任何提交可等待,即"拒绝零副作用")**
 *   · submitting  → commitSuccess → approved | commitFailure → failed
 *   · failed      → beginFill → filling(可重填重试)
 *   · approved / rejected → 仅 reset → idle(终态,不得再迁移)
 */
export function applyFormAction(phase: FormStatePhase, event: FormStateEvent): FormStatePhase {
  switch (phase) {
    case 'idle':
      switch (event.type) {
        case 'beginFill':
          return 'filling'
        case 'reset':
          return 'idle'
        case 'submit':
        case 'reject':
        case 'commitSuccess':
        case 'commitFailure':
          return phase
      }
      return assertNeverEvent(event)
    case 'filling':
      switch (event.type) {
        case 'submit':
          return 'submitting'
        case 'reject':
          // 拒绝直达终态:不经 submitting(没有提交动作),零副作用的形态落点。
          return 'rejected'
        case 'beginFill':
        case 'commitSuccess':
        case 'commitFailure':
          return phase
        case 'reset':
          return 'idle'
      }
      return assertNeverEvent(event)
    case 'submitting':
      switch (event.type) {
        case 'commitSuccess':
          return 'approved'
        case 'commitFailure':
          return 'failed'
        case 'beginFill':
        case 'submit':
        case 'reject':
          return phase
        case 'reset':
          return 'idle'
      }
      return assertNeverEvent(event)
    case 'approved':
    case 'rejected':
    case 'failed':
      switch (event.type) {
        case 'beginFill':
          // failed 可重填;approved/rejected 为终态,只回 idle 再来。
          return phase === 'failed' ? 'filling' : phase
        case 'reset':
          return 'idle'
        case 'submit':
        case 'reject':
        case 'commitSuccess':
        case 'commitFailure':
          return phase
      }
      return assertNeverEvent(event)
  }
  return assertNeverPhase(phase)
}

function assertNeverEvent(event: never): never {
  throw new Error(`unhandled form state event: ${JSON.stringify(event)}`)
}

function assertNeverPhase(phase: never): never {
  throw new Error(`unhandled form state phase: ${String(phase)}`)
}

// ---------------------------------------------------------------------------
// ⑤ 日历折叠判定(时间区间照常显示;多出席人超阈值折叠 + 展开计数)
// ---------------------------------------------------------------------------

/** 出席人折叠阈值:超过此数折叠,只显示前 threshold 个 + 展开计数 */
export const ATTENDEES_FOLD_THRESHOLD = 3

export interface AttendeesFoldView {
  /** 是否需要折叠(超过阈值才折;不多不少恰好阈值不折) */
  readonly foldNeeded: boolean
  /** 折叠态下可见的出席人数(不折叠时等于全部) */
  readonly visibleCount: number
  /** 被折叠隐藏的出席人数(不折叠时为 0) */
  readonly overflowCount: number
  /** 展开计数文案键(`fold.expand`,渲染层附带 {count}=overflowCount) */
  readonly expandKey: string
  /** 收起文案键(`fold.collapse`) */
  readonly collapseKey: string
}

/** 多出席人折叠判定(纯函数;渲染层只按 view 渲染,不得自算阈值) */
export function attendeesFoldNeeded(count: number): AttendeesFoldView {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  const foldNeeded = safeCount > ATTENDEES_FOLD_THRESHOLD
  return {
    foldNeeded,
    visibleCount: foldNeeded ? ATTENDEES_FOLD_THRESHOLD : safeCount,
    overflowCount: foldNeeded ? safeCount - ATTENDEES_FOLD_THRESHOLD : 0,
    expandKey: 'fold.expand',
    collapseKey: 'fold.collapse',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
