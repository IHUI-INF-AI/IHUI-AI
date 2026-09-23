// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:小程序真机是 WXML,无同源 DOM 可枚举,控件定位只能靠端内注册表,不适合共享
import { useEffect, useRef } from 'react'
import type { AgentActionErrorCode, AppUiElement } from '@ihui/types'

/**
 * 小程序端「控件注册表」(2026-09-21 立)。
 *
 * 为什么必须这么绕:web 端 click/fill 靠 querySelector 拿真 DOM;小程序没有可枚举的同源 DOM,
 * 任何"按选择器找节点"的写法在真机上都不成立。唯一可靠的定位符是**组件自己在挂载时交出来的通道**:
 * 输入框交出 setValue、按钮交出 onPress、表单交出 submit —— 与 `src/i18n` 的
 * `registerLocaleSetter`/`requestLocaleChange` 同一套路(挂载注册、卸载摘除、拿不到就如实失败)。
 *
 * 三条硬规矩(违反即"报了成功但界面没动"的假成功,项目已定性为交付事故):
 * 1. 只有组件真的交出了写/触发通道,writable/pressable 才为 true;否则 fill/click 必失败。
 * 2. 敏感输入(密码/验证码/token/secret)**连快照都不出现**;删除/支付/提现/分享/发布类按钮同样不进表。
 * 3. 定位符 id 的序号**全局单调、永不复用**:老 id 只会指向它当初绑定的那个控件(控件已卸载则如实失败),
 *    绝不会被新挂载的另一个控件"继承",因此不存在用旧快照点到错控件的可能。
 */

/** 与 @ihui/types AppUiElement.kind 的取值集合对齐(kind 在协议里是 string,这里收窄便于端内断言) */
export type UiFieldKind =
  'input' | 'textarea' | 'number' | 'select' | 'switch' | 'button' | 'pressable'

/** 组件挂载时交出的字段规格 */
export interface UiFieldSpec {
  kind: UiFieldKind
  /** 给人/模型看的标签(同时也是敏感判定与黑名单判定的依据,必须写真实文案) */
  label: string
  /** 分组:表单 id 或 'page'(缺省) */
  group?: string
  /** 归属表单的稳定 key(与 registerUiForm 的 key 对应),快照里换算成表单的展示 id 填进 group */
  formKey?: string
  placeholder?: string
  /** Taro Input 的 type(text/number/digit/idcard/safe/password),仅用于敏感判定与 constraint */
  inputType?: string
  /** Taro Input 的 password 属性:命中即不注册 */
  password?: boolean
  maxLength?: number
  /** 附加约束说明,原样进快照(如 'options=按月/按年') */
  constraint?: string
  /** describe 时读取当前值(回传前统一脱敏 + 截断) */
  readValue?: () => string | number | boolean | undefined | null
  /** 组件自己的受控写通道(React setState / 父级 onChange);缺省 = writable=false */
  setValue?: (value: string) => void
  /** 组件的触发通道(onPress / onClick / onConfirm);缺省 = pressable=false */
  onPress?: () => unknown
  /** 每次读取时求值:禁用中的控件不进可执行面(仍出现在快照里,disabled=true) */
  isDisabled?: () => boolean
}

/** 表单规格:submit 必须由组件交出(它才知道怎么校验、怎么调接口) */
export interface UiFormSpec {
  /** 稳定 key,供字段用 formKey 挂靠;缺省用 label */
  key?: string
  label: string
  /** 提交通道;缺省 = 该表单只读,submit 时如实失败 */
  onSubmit?: () => unknown
  isDisabled?: () => boolean
  /** 成员字段就绪前的门槛(如"必须同意协议"),文字形式回传给模型 */
  requirement?: string
}

/** 注册表操作结果 —— 结构与 ui-action-registry 的 TaroUiActionResult 同形,可直接回传 */
export interface UiRegistryResult {
  ok: boolean
  data?: Record<string, unknown>
  error?: string
  errorCode?: AgentActionErrorCode
}

const okResult = (data: Record<string, unknown>): UiRegistryResult => ({ ok: true, data })
const failResult = (errorCode: AgentActionErrorCode, error: string): UiRegistryResult => ({
  ok: false,
  errorCode,
  error,
})

/* ────────────────────────── 安全面判定 ────────────────────────── */

/**
 * 敏感输入:密码 / 验证码 / 动态码 / token / secret / 各类密钥 / 证书。
 * 判定面 = inputType + password 属性 + label/placeholder 关键词(三者取并,宁严勿松)。
 */
const SENSITIVE_RE =
  /password|passwd|pwd|passcode|secret|api[_\s-]?key|private[_\s-]?key|access[_\s-]?key|credential|密码|验证码|动态码|短信码|校验码|密钥|证书|令牌/i

/**
 * `token` 一词有两种身份:凭据名与**计量单位**。裸判会让「Max Tokens」「tokens 上限」这类
 * 模型参数被当密钥吞掉(AI 侧表现为"这框不存在"),而漏放凭据的代价才是不可逆的 ——
 * 故 token 只在非计量语境下算敏感。与 apps/mobile-rn/src/lib/ui-field-registry.ts 同一口径。
 */
const TOKEN_RE = /token/i
const TOKEN_MEASURE_RE =
  /max[\s_-]*tokens|tokens?\s*(数|量|上限|预算|长度|成本)|上下文(长度|窗口|预算)|每秒|per[\s_-]?second/i

/** 个人信息:仍允许操作(填手机号是正常需求),但 describe 回传的值必须打码 */
const PII_RE =
  /phone|mobile|email|mail|idcard|id[_\s-]?card|passport|手机|电话|邮箱|身份|证件|银行/i

/**
 * 破坏性 / 对外发声控件:一律不进表(比"进表后拒绝执行"更严 —— 模型看不见就不会试)。
 * 与 ui-action-registry 的 invoke 白名单同一套价值判断:不可逆、花钱、对外发声的一律不代客操作。
 */
const DESTRUCTIVE_RE =
  /删除|移除|注销|解约|退款|退货|提现|转账|付款|支付|下单|充值|续费|分享|转发|发布|发送|举报|退出登录|登出|清空|重置|delete|remove|destroy|unsubscribe|refund|withdraw|transfer|pay(?:ment)?|purchase|checkout|recharge|share|publish|post|send|report|logout|sign\s?out/i

export function isSensitiveField(spec: UiFieldSpec): boolean {
  if (spec.password === true) return true
  const haystack = `${spec.inputType ?? ''} ${spec.label} ${spec.placeholder ?? ''}`
  if (SENSITIVE_RE.test(haystack)) return true
  return TOKEN_RE.test(haystack) && !TOKEN_MEASURE_RE.test(haystack)
}

export function isDestructiveControl(spec: UiFieldSpec | UiFormSpec): boolean {
  return DESTRUCTIVE_RE.test(spec.label)
}

/* ────────────────────────── 内部存储 ────────────────────────── */

interface FieldEntry {
  uid: number
  kind: UiFieldKind
  /** 展示 id:首次进快照时分配,之后固定不变(序号全局单调,永不复用) */
  id?: string
  live: () => UiFieldSpec
}

interface FormEntry {
  uid: number
  key: string
  /** 展示 id:'form:<序号>',首次进快照时分配 */
  id?: string
  live: () => UiFormSpec
}

/** 快照里 elements 的上限:页面元素多的列表页也不要把回传撑爆 */
export const MAX_SNAPSHOT_ELEMENTS = 60

const SNAPSHOT_VALUE_MAX = 80

const fields = new Map<number, FieldEntry>()
const forms = new Map<number, FormEntry>()
const fieldIdIndex = new Map<string, number>()
const formIdIndex = new Map<string, number>()

let uidCounter = 0
let fieldSeqCounter = 0
let formSeqCounter = 0
/** 被安全策略(敏感/破坏性)排除的注册请求数:诚实计数,不当"页面就这么点东西" */
let securitySuppressed = 0

const noop = (): void => {}

/**
 * 序号永不复用,所以控件卸载后**保留**它的 id → uid 映射:老 id 再来时能如实回答
 * "该控件已卸载"(而不是含糊成"不存在"),也不可能指到别的控件。映射过长时才清失效项。
 */
function pruneStaleIdIndex(): void {
  if (fieldIdIndex.size + formIdIndex.size < 400) return
  for (const [id, uid] of fieldIdIndex) if (!fields.has(uid)) fieldIdIndex.delete(id)
  for (const [id, uid] of formIdIndex) if (!forms.has(uid)) formIdIndex.delete(id)
}

export function resetUiFieldRegistryForTest(): void {
  fields.clear()
  forms.clear()
  fieldIdIndex.clear()
  formIdIndex.clear()
  uidCounter = 0
  fieldSeqCounter = 0
  formSeqCounter = 0
  securitySuppressed = 0
}

/** 命中安全黑名单的注册请求累计数(describe 里并进 suppressed 一并回传) */
export function getSecuritySuppressedCount(): number {
  return securitySuppressed
}

/* ────────────────────────── 注册 / 摘除 ────────────────────────── */

export function registerUiField(spec: UiFieldSpec | (() => UiFieldSpec)): () => void {
  const live = typeof spec === 'function' ? spec : () => spec
  const current = live()
  if (isSensitiveField(current) || isDestructiveControl(current)) {
    securitySuppressed += 1
    return noop
  }
  const uid = ++uidCounter
  fields.set(uid, { uid, kind: current.kind, live })
  return () => {
    fields.delete(uid)
    pruneStaleIdIndex()
  }
}

export function registerUiForm(spec: UiFormSpec | (() => UiFormSpec)): () => void {
  const live = typeof spec === 'function' ? spec : () => spec
  const current = live()
  if (isDestructiveControl(current)) {
    securitySuppressed += 1
    return noop
  }
  const uid = ++uidCounter
  const key = (current.key ?? current.label).trim() || `form-${uid}`
  forms.set(uid, { uid, key, live })
  return () => {
    forms.delete(uid)
    pruneStaleIdIndex()
  }
}

/**
 * 组件侧钩子:挂载即注册、卸载即摘除。
 *
 * 关键点是 **spec 用 ref 承载**:每次渲染刷新 ref,注册项通过 ref 读最新闭包,
 * 于是 onInput/onClick 换了新 props 也不会读到陈旧值;而注册的稳定性只由
 * (kind + label + group) 决定 —— 同一控件重渲染不会换 id,不会抖出新的可操作面。
 */
export function useUiField(spec: UiFieldSpec | null): void {
  const specRef = useRef(spec)
  specRef.current = spec
  const identity = spec ? `${spec.kind}\u0000${spec.label}\u0000${spec.group ?? ''}` : ''
  useEffect(() => {
    const baseline = specRef.current
    if (!identity || !baseline) return noop
    return registerUiField(() => specRef.current ?? baseline)
  }, [identity])
}

export function useUiForm(spec: UiFormSpec | null): void {
  const specRef = useRef(spec)
  specRef.current = spec
  const identity = spec ? `${spec.key ?? spec.label}` : ''
  useEffect(() => {
    const baseline = specRef.current
    if (!identity || !baseline) return noop
    return registerUiForm(() => specRef.current ?? baseline)
  }, [identity])
}

/* ────────────────────────── 快照 ────────────────────────── */

function maskValue(raw: string, haystack: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''
  if (PII_RE.test(haystack)) return '***'
  return collapsed.length > SNAPSHOT_VALUE_MAX
    ? `${collapsed.slice(0, SNAPSHOT_VALUE_MAX)}…`
    : collapsed
}

function buildConstraint(spec: UiFieldSpec): string | undefined {
  const parts: string[] = []
  if (spec.inputType) parts.push(`type=${spec.inputType}`)
  if (typeof spec.maxLength === 'number') parts.push(`maxLength=${spec.maxLength}`)
  if (spec.constraint) parts.push(spec.constraint)
  return parts.length > 0 ? parts.join(' ') : undefined
}

export interface UiFieldSnapshot {
  elements: AppUiElement[]
  forms: { id: string; label: string; group: string }[]
  /** 因上限被裁掉的控件数(与 elements 一起凑成协议里的 suppressed) */
  limitSuppressed: number
  securitySuppressed: number
  total: number
}

/**
 * 生成"当前屏可操作控件"清单。id 在控件首次进快照时分配并永久绑定(见文件头第 3 条规矩),
 * 因此同一份快照内 id 唯一,且**任何时候**拿旧 id 都只会命中它原来的控件或如实失败。
 */
export function snapshotUiFields(): UiFieldSnapshot {
  for (const form of forms.values()) {
    if (!form.id) form.id = `form:${++formSeqCounter}`
    formIdIndex.set(form.id, form.uid)
  }
  const formIdByKey = new Map<string, string>()
  for (const form of forms.values()) if (form.id) formIdByKey.set(form.key, form.id)

  const elements: AppUiElement[] = []
  let limitSuppressed = 0
  for (const entry of fields.values()) {
    if (!entry.id) entry.id = `fld:${entry.kind}#${++fieldSeqCounter}`
    fieldIdIndex.set(entry.id, entry.uid)
    if (elements.length >= MAX_SNAPSHOT_ELEMENTS) {
      limitSuppressed += 1
      continue
    }
    const spec = entry.live()
    const group = (spec.formKey ? formIdByKey.get(spec.formKey) : undefined) ?? spec.group ?? 'page'
    const haystack = `${spec.label} ${spec.placeholder ?? ''}`
    const element: AppUiElement = {
      id: entry.id,
      kind: entry.kind,
      label: spec.label,
      group,
      disabled: spec.isDisabled?.() === true,
      writable: typeof spec.setValue === 'function',
      pressable: typeof spec.onPress === 'function',
    }
    if (spec.readValue) element.value = maskValue(String(spec.readValue() ?? ''), haystack)
    const constraint = buildConstraint(spec)
    if (constraint) element.constraint = constraint
    elements.push(element)
  }

  // 只把"真能提交"的表单登记为可调用面(group='form'):交出 onSubmit 的表单才有意义,
  // 否则等于给模型一个必然失败的入口(与 ui-action-registry 的 invoke 白名单同一判断)。
  const formDescriptors = [...forms.values()]
    .map((form) => ({ form, spec: form.live() }))
    .filter(({ form, spec }) => !!form.id && typeof spec.onSubmit === 'function')
    .map(({ form, spec }) => ({ id: form.id ?? '', label: spec.label, group: 'form' }))

  return {
    elements,
    forms: formDescriptors,
    limitSuppressed,
    securitySuppressed,
    total: elements.length + limitSuppressed,
  }
}

/* ────────────────────────── 定位 ────────────────────────── */

function unknownTarget(id: string, kindNoun: string, live: Map<number, unknown>): UiRegistryResult {
  const uid = (kindNoun === '表单' ? formIdIndex : fieldIdIndex).get(id)
  const existed = uid !== undefined && !live.has(uid)
  return failResult(
    'UNSUPPORTED_ACTION',
    existed
      ? `${kindNoun} ${id || '(空)'} 对应的控件已从界面卸载(不代点、不代填)。请先 describe 拿最新 id。`
      : `${kindNoun} id ${id || '(空)'} 不在当前快照里:可能是页面已切换、该控件属于不开放程序化操作的敏感/高危面,或 id 拼错。请先 describe。`,
  )
}

function resolveField(id: string): { entry: FieldEntry } | UiRegistryResult {
  const uid = fieldIdIndex.get(id)
  const entry = uid === undefined ? undefined : fields.get(uid)
  if (!entry) return unknownTarget(id, '控件', fields)
  return { entry }
}

function resolveForm(id: string): { entry: FormEntry } | UiRegistryResult {
  const uid = formIdIndex.get(id)
  const entry = uid === undefined ? undefined : forms.get(uid)
  if (!entry) return unknownTarget(id, '表单', forms)
  return { entry }
}

/* ────────────────────────── 三个动作 ────────────────────────── */

function coerceValue(raw: unknown): string | null {
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  if (typeof raw === 'boolean') return String(raw)
  return null
}

/** fill:只走组件交出的受控写通道,绝不写 storage、绝不"改属性"糊弄 */
export function setFieldValue(id: string, raw: unknown): UiRegistryResult {
  const target = id.trim()
  const resolved = resolveField(target)
  if ('ok' in resolved) return resolved
  const spec = resolved.entry.live()
  if (typeof spec.setValue !== 'function') {
    return failResult(
      'UNSUPPORTED_ACTION',
      `控件「${spec.label}」(${target})未开放写入通道:它的值握在业务页里、组件没有交出 setValue(writable=false)。请引导用户手动输入。`,
    )
  }
  if (spec.isDisabled?.() === true) {
    return failResult('UNSUPPORTED_ACTION', `控件「${spec.label}」当前为禁用态,不代填`)
  }
  const value = coerceValue(raw)
  if (value === null) {
    return failResult('UNSUPPORTED_ACTION', 'fill 的 value 仅支持字符串/数字/布尔')
  }
  try {
    spec.setValue(value)
  } catch (err) {
    return failResult('EXECUTION_FAILED', `控件「${spec.label}」写入失败:${describeError(err)}`)
  }
  const after = spec.readValue ? maskValue(String(spec.readValue() ?? ''), spec.label) : ''
  return okResult({
    filled: target,
    label: spec.label,
    kind: resolved.entry.kind,
    // 组件是受控的:回读到的值才是真值。回读与入参不一致时如实带上 both,让模型知道有校验/截断
    valueAfter: after,
    applied: after === value || !spec.readValue,
  })
}

/** click:只触发组件交出的 onPress;开关/选择类控件的"点一下"就是它的 setValue 语义 */
export async function pressField(id: string): Promise<UiRegistryResult> {
  const target = id.trim()
  const resolved = resolveField(target)
  if ('ok' in resolved) return resolved
  const spec = resolved.entry.live()
  if (typeof spec.onPress !== 'function') {
    return failResult(
      'UNSUPPORTED_ACTION',
      `控件「${spec.label}」(${target})未开放触发通道:组件没有交出 onPress(pressable=false),小程序端没有可代点的 DOM。请把操作交回用户。`,
    )
  }
  if (spec.isDisabled?.() === true) {
    return failResult('UNSUPPORTED_ACTION', `控件「${spec.label}」当前为禁用态,不代点`)
  }
  try {
    await spec.onPress()
  } catch (err) {
    return failResult('EXECUTION_FAILED', `控件「${spec.label}」触发失败:${describeError(err)}`)
  }
  return okResult({ pressed: target, label: spec.label, kind: resolved.entry.kind })
}

/** submit:form 省略时只在"恰好一个表单"时才代提交,否则如实要求传 id */
export async function submitForm(rawId: unknown): Promise<UiRegistryResult> {
  const requested = typeof rawId === 'string' ? rawId.trim() : ''
  if (!requested) {
    if (forms.size !== 1) {
      const ids = [...forms.values()].map((form) => form.id ?? form.key)
      return failResult(
        'UNSUPPORTED_ACTION',
        forms.size === 0
          ? '当前界面没有可提交表单(组件未交出 submit 通道)。'
          : `当前界面有 ${forms.size} 个表单,submit 必须显式指定 form:可用 ${ids.join(', ')}`,
      )
    }
    const only = [...forms.values()][0]
    if (!only) return failResult('UNSUPPORTED_ACTION', '表单注册表状态异常,请重新 describe')
    return submitEntry(only)
  }
  const resolved = resolveForm(requested)
  if ('ok' in resolved) return resolved
  return submitEntry(resolved.entry)
}

async function submitEntry(entry: FormEntry): Promise<UiRegistryResult> {
  const spec = entry.live()
  if (typeof spec.onSubmit !== 'function') {
    return failResult(
      'UNSUPPORTED_ACTION',
      `表单「${spec.label}」(${entry.id ?? entry.key})未开放 submit 通道,组件没有交出提交函数,不代为提交。`,
    )
  }
  if (spec.isDisabled?.() === true) {
    return failResult('UNSUPPORTED_ACTION', `表单「${spec.label}」当前为禁用态,不代提交`)
  }
  try {
    await spec.onSubmit()
  } catch (err) {
    return failResult('EXECUTION_FAILED', `表单「${spec.label}」提交失败:${describeError(err)}`)
  }
  return okResult({ submitted: entry.id ?? entry.key, label: spec.label })
}

function describeError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { errMsg?: unknown; message?: unknown }
    if (typeof e.errMsg === 'string' && e.errMsg) return e.errMsg
    if (typeof e.message === 'string' && e.message) return e.message
  }
  return typeof err === 'string' ? err : '未知错误'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
