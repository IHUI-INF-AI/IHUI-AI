// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:RN 无 DOM,click/fill 只能靠组件挂载时交出 onPress/setValue,故注册表活在端内

import type { AgentActionErrorCode, AppUiElement } from '@ihui/types'

/**
 * RN 端控件注册表(2026-09-21 立)。
 *
 * 为什么需要它:React Native 渲染原生视图,没有 DOM,`click/fill/submit` 无法靠"查询节点"
 * 成立。唯一诚实的做法与语言切换那次是同一套路(见 src/i18n/index.tsx 的
 * registerLocaleSetter / requestLocaleChange):**组件挂载时把自己能做的事交出来** ——
 * Input 交出它会真的 setState 的 setter、可点控件交出 onPress、表单交出 submit;
 * 交不出来的控件宁可标 writable/pressable=false,让调用方拿到如实的失败,
 * 也绝不能"回了 ok 而界面没动"(本项目反复踩过的假成功教训)。
 *
 * id 方案:`fld:<kind>#<序号>`,序号按 kind 单调递增且**永不复用**。
 * - 为什么不用「注册顺序的下标」:组件卸载会让下标整体前移,模型 describe 后紧接着的
 *   fill 就会写到另一个控件上 —— 那是比失败更糟的结果(误改)。
 * - 单调 id 在"两次 describe 之间有新控件挂载/卸载"时保持稳定:老 id 要么仍指向同一
 *   mount 实例,要么已注销 → SELECTOR_NOT_FOUND 式如实失败,绝不漂移到别的控件。
 * - id 由注册表在 register() 时生成并回传给组件,组件存进 ref,重渲染不再重新申领,
 *   所以同一 mount 实例的 id 恒定。
 *
 * 包边界:@ihui/ui-native 是下层包,**不得** import apps/mobile-rn。于是宿主能力挂在
 * globalThis 的一个约定键上,ui-native 用结构化局部类型读取(见 packages/ui-native/src/input.tsx)。
 */

type RnFieldKind = 'input' | 'button' | 'form'

/** 组件交给注册表的一张登记表:全部字段用访问器表达,快照读到的永远是"当下"的值 */
export interface RnFieldSpec {
  kind: RnFieldKind
  /** 可读标签(placeholder / children 文本 / accessibilityLabel) */
  label(): string
  /** 归属分组(当前屏名),由宿主注入的 groupProvider 兜底 */
  group?(): string
  /** 当前值:注册表**不**负责脱敏,组件自己决定给不给(敏感框根本不入表) */
  value?(): string | undefined
  disabled?(): boolean
  /** 约束提示,如 'multiline' / 'maxLength=50' / 'keyboardType=numeric' */
  constraint?(): string
  /** 组件自带的结构性敏感信号(secureTextEntry / visible-password) */
  sensitive?(): boolean
  /** 组件确实持有可用的写入通道(受控输入必须为 false) */
  writable?(): boolean
  write?(text: string): void
  press?(): void
  submit?(): void
}

export interface RnFieldHandle {
  readonly id: string
  /** 幂等:重复调用只摘一次 */
  dispose(): void
}

/**
 * 与端内 RnUiActionResult 同形:注册表结果可被 ui-action-registry 的 handler 原样透传,
 * 不必再包一层适配(也不用在测试里先做联合类型收窄)。
 */
export interface RnFieldOpResult {
  ok: boolean
  data?: Record<string, unknown>
  error?: string
  errorCode?: AgentActionErrorCode
}

/** describe 的 elements 上限:超出记进 suppressed,别静默丢 */
export const RN_FIELD_MAX_ELEMENTS = 60

/**
 * 敏感面永不注册:密码 / 验证码 / token / secret 类输入框连 describe 都不出现。
 * 结构性判据(secureTextEntry / visible-password)由组件自己报,文本判据统一在这里,
 * 免得规则在 ui-native 与端内各写一份而漂移。
 */
const SENSITIVE_TEXT_RE = /密码|验证码|校验码|动态码|password|passwd|secret|令牌|api[-_]?key/i

/**
 * `token` 不能裸判敏感:它是**计量单位**也是**凭据名**两种身份共用一个词。
 * 「Max Tokens」「tokens 上限」这类模型参数被当成凭据吞掉,后果是 AI 对着一个
 * 根本不存在的字段(实测 ModelConfigDialog 因此少 1/4 个可填项),而漏放凭据的代价才是不可逆的。
 * 所以凭据语境的 token 判敏感,计量语境放行 —— 计量语境用词组判据,不靠单字。
 */
const TOKEN_WORD_RE = /token/i
const TOKEN_MEASURE_RE =
  /max[\s_-]*tokens|tokens?\s*(数|量|上限|预算|长度|成本)|上下文(长度|窗口|预算)|每秒|per[\s_-]?second/i

/** 删除 / 注销 / 支付 / 提现类按钮不暴露:一次误触就是不可逆的资金或账号损失,收益为零 */
const DESTRUCTIVE_TEXT_RE =
  /注销|删除|移除|解除|退款|提现|转账|支付|付款|下单|购买|清空|退出登录|logout|sign\s*-?\s*out|delete|remove|refund|withdraw|checkout|\bpurchase\b|\bpay\b/i

export function isSensitiveFieldText(text: string): boolean {
  if (SENSITIVE_TEXT_RE.test(text)) return true
  return TOKEN_WORD_RE.test(text) && !TOKEN_MEASURE_RE.test(text)
}

export function isDestructiveFieldText(text: string): boolean {
  return DESTRUCTIVE_TEXT_RE.test(text)
}

interface RegistryEntry {
  id: string
  spec: RnFieldSpec
}

const entries = new Map<string, RegistryEntry>()
const seqByKind = new Map<RnFieldKind, number>()

let groupProvider: (() => string) | null = null

/** 由 ui-action-registry 注入"当前屏名"作为分组,注册表本身不依赖 react-navigation */
export function setFieldGroupProvider(provider: (() => string) | null): void {
  groupProvider = provider
}

function nextId(kind: RnFieldKind): string {
  const seq = (seqByKind.get(kind) ?? 0) + 1
  seqByKind.set(kind, seq)
  return `fld:${kind}#${seq}`
}

function fail(errorCode: AgentActionErrorCode, error: string): RnFieldOpResult {
  return { ok: false, errorCode, error }
}

function safeLabel(spec: RnFieldSpec): string {
  try {
    return (spec.label() ?? '').trim()
  } catch {
    return ''
  }
}

function groupOf(spec: RnFieldSpec): string | undefined {
  try {
    const own = spec.group?.()
    if (own && own.trim()) return own.trim()
  } catch {
    /* 组件读分组抛错时退回宿主分组,不影响主用途 */
  }
  return groupProvider?.() ?? undefined
}

/** 受控 / 无写入通道 / 无触发通道的判定集中在这里,handler 与 describe 读同一份结论 */
function isWritable(spec: RnFieldSpec): boolean {
  return typeof spec.write === 'function' && spec.writable?.() !== false
}

/**
 * 注册一个控件。返回 null = 被安全策略拒绝(敏感框 / 破坏性按钮),
 * 调用方应当正常继续渲染,只是这个控件对 AI 完全不可见。
 */
function register(spec: RnFieldSpec): RnFieldHandle | null {
  const label = safeLabel(spec)
  if (spec.sensitive?.() || isSensitiveFieldText(label) || isDestructiveFieldText(label)) {
    return null
  }
  const entry: RegistryEntry = { id: nextId(spec.kind), spec }
  entries.set(entry.id, entry)
  let disposed = false
  return {
    id: entry.id,
    dispose: () => {
      if (disposed) return
      disposed = true
      // 按 id 摘除:绝不按"顺序下标"摘,否则前面的控件会集体换位(见文件头 id 方案)
      entries.delete(entry.id)
    },
  }
}

/** describe 用:一次遍历生成快照,后续动作按这份快照里的 id 定位 */
export function snapshotFields(max: number = RN_FIELD_MAX_ELEMENTS): {
  elements: AppUiElement[]
  suppressed: number
} {
  const elements: AppUiElement[] = []
  let suppressed = 0
  for (const { id, spec } of entries.values()) {
    if (elements.length >= max) {
      suppressed += 1
      continue
    }
    let value: string | undefined
    let disabled: boolean | undefined
    let constraint: string | undefined
    try {
      value = spec.value?.()
      disabled = spec.disabled?.()
      constraint = spec.constraint?.()
    } catch {
      disabled = undefined
      constraint = undefined
    }
    const group = groupOf(spec)
    const pressable =
      spec.kind === 'form' ? typeof spec.submit === 'function' : typeof spec.press === 'function'
    const element: AppUiElement = {
      id,
      kind: spec.kind,
      label: safeLabel(spec),
      ...(typeof value === 'string' ? { value } : {}),
      ...(constraint ? { constraint } : {}),
      ...(group ? { group } : {}),
      ...(disabled ? { disabled: true } : {}),
      // input 才谈 writable、button/form 才谈 pressable:另一个字段留空,不给模型假信号
      ...(spec.kind === 'input' ? { writable: isWritable(spec) } : { pressable }),
    }
    elements.push(element)
  }
  return { elements, suppressed }
}

/**
 * 定位符解析:先按 id 精确命中,再按可见标签兜底(模型常写「保存」而不是 'fld:button#3')。
 * 标签命中多条时**不猜**,把候选回给它,让它改用 id。
 */
interface LocateResult {
  entry: RegistryEntry | null
  /** 标签命中多条时的候选 id:不猜,交回调用方点名 */
  ambiguous: string[]
}

function locate(target: string): LocateResult {
  const trimmed = target.trim()
  const direct = entries.get(trimmed)
  if (direct) return { entry: direct, ambiguous: [] }
  if (!trimmed) return { entry: null, ambiguous: [] }
  const lower = trimmed.toLowerCase()
  const matched = [...entries.values()].filter(
    ({ spec }) => safeLabel(spec).toLowerCase() === lower,
  )
  const only = matched.length === 1 ? matched[0] : undefined
  if (only) return { entry: only, ambiguous: [] }
  return { entry: null, ambiguous: matched.map((m) => m.id) }
}

function notFound(target: string): RnFieldOpResult {
  const shown = target.trim() || '(空)'
  return fail(
    'SELECTOR_NOT_FOUND',
    `控件定位符不存在或未在本页注册:${shown}。id 仅在最近一次 describe 的快照内有效;` +
      `请重新 describe 取 id(当前已注册 ${entries.size} 个控件)`,
  )
}

function filled(target: string, ids: string[]): RnFieldOpResult {
  return fail(
    'SELECTOR_NOT_FOUND',
    `定位符「${target}」命中 ${ids.length} 个控件,无法确定是哪一个:${ids.join(', ')}。请改用其中唯一的 id`,
  )
}

type TargetResolution = { entry: RegistryEntry } | { failure: RnFieldOpResult }

function resolveTarget(target: string): TargetResolution {
  const hit = locate(target)
  if (hit.entry) return { entry: hit.entry }
  if (hit.ambiguous.length > 1) return { failure: filled(target, hit.ambiguous) }
  return { failure: notFound(target) }
}

/** 填写:只调用组件自己交出来的 setter;没有 setter 就是没有,不编一个"成功" */
export function setValueOnField(target: string, raw: unknown): RnFieldOpResult {
  const resolved = resolveTarget(target)
  if ('failure' in resolved) return resolved.failure
  const { entry } = resolved
  const { spec } = entry
  if (spec.kind !== 'input') {
    return fail('UNSUPPORTED_ACTION', `${entry.id} 是 ${spec.kind},不是输入框,该控件未开放写入通道`)
  }
  if (!isWritable(spec)) {
    return fail(
      'UNSUPPORTED_ACTION',
      `「${safeLabel(spec) || entry.id}」未开放写入通道:它是受控输入且调用方没交出 onChangeText` +
        `,注册表没有合法写入 path。不假装成功`,
    )
  }
  if (spec.disabled?.()) {
    return fail('EXECUTION_FAILED', `「${safeLabel(spec) || entry.id}」当前不可编辑(disabled)`)
  }
  const next = typeof raw === 'string' ? raw : String(raw ?? '')
  try {
    spec.write?.(next)
  } catch (err) {
    return fail('EXECUTION_FAILED', `写入 ${entry.id} 失败:${describeOpError(err)}`)
  }
  let after: string | undefined
  try {
    after = spec.value?.()
  } catch {
    after = undefined
  }
  const valuePending = typeof after === 'string' && after !== next
  return {
    ok: true,
    data: {
      id: entry.id,
      kind: spec.kind,
      label: safeLabel(spec),
      valueWritten: next,
      ...(typeof after === 'string' ? { valueAfter: after } : {}),
      // 受控框的值要等父组件 state 回流才变,当场读回必然是旧值 —— 不说明会被模型当成失败重填
      ...(valuePending
        ? {
            note: '写入已提交。该输入框的值由父组件持有,需父组件回流后才会变化;请 read 确认而不是重填。',
          }
        : {}),
    },
  }
}

/** 点击:组件没交 onPress 就如实失败,不去"模拟"一个谁也看不见的事件 */
export function pressField(target: string): RnFieldOpResult {
  const resolved = resolveTarget(target)
  if ('failure' in resolved) return resolved.failure
  const { entry } = resolved
  const { spec } = entry
  if (typeof spec.press !== 'function') {
    return fail(
      'UNSUPPORTED_ACTION',
      `「${safeLabel(spec) || entry.id}」未开放触发通道:调用方没有给它 onPress,注册表无 handler 可调`,
    )
  }
  if (spec.disabled?.()) {
    return fail('EXECUTION_FAILED', `「${safeLabel(spec) || entry.id}」当前处于禁用状态,点击无效`)
  }
  try {
    spec.press()
  } catch (err) {
    return fail('EXECUTION_FAILED', `触发 ${entry.id} 失败:${describeOpError(err)}`)
  }
  return {
    ok: true,
    data: { id: entry.id, kind: spec.kind, label: safeLabel(spec), pressed: true },
  }
}

/** 提交表单:没有表单注册过就直说,不退化成"随便点一个按钮" */
export function submitForm(form?: string): RnFieldOpResult {
  const forms = [...entries.values()].filter(({ spec }) => spec.kind === 'form')
  const target = (form ?? '').trim()
  if (!target) {
    if (forms.length === 0) {
      return fail(
        'UNSUPPORTED_ACTION',
        '当前页面没有注册任何表单:业务组件需把 onSubmit 交给注册表才能 submit',
      )
    }
    if (forms.length > 1) {
      return filled(
        '(未指定表单)',
        forms.map((f) => `${f.id}(${safeLabel(f.spec) || '未命名'})`),
      )
    }
    return forms[0]
      ? runSubmit(forms[0])
      : fail('UNSUPPORTED_ACTION', '表单注册表已变动,请重新 describe 后再提交')
  }
  const located = locate(target)
  const hit = forms.find((f) => f.id === target) ?? located.entry
  if (!hit) return notFound(target)
  if (hit.spec.kind !== 'form') {
    return fail(
      'UNSUPPORTED_ACTION',
      `「${safeLabel(hit.spec) || hit.id}」是 ${hit.spec.kind},不是表单,未开放提交通道`,
    )
  }
  return runSubmit(hit)
}

function runSubmit(entry: RegistryEntry): RnFieldOpResult {
  const { spec } = entry
  if (typeof spec.submit !== 'function') {
    return fail('UNSUPPORTED_ACTION', `表单「${safeLabel(spec) || entry.id}」未开放提交通道`)
  }
  if (spec.disabled?.()) {
    return fail('EXECUTION_FAILED', `表单「${safeLabel(spec) || entry.id}」当前不可提交(disabled)`)
  }
  try {
    spec.submit()
  } catch (err) {
    return fail('EXECUTION_FAILED', `提交 ${entry.id} 失败:${describeOpError(err)}`)
  }
  return { ok: true, data: { id: entry.id, kind: 'form', label: safeLabel(spec), submitted: true } }
}

function describeOpError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return '未知错误'
}

/** 只读:当前值,供 read 动作回显(未注册时返回 undefined 而不是空串,避免与真空值混淆) */
export function readFieldValue(target: string): string | undefined {
  const hit = locate(target)
  if (!hit.entry) return undefined
  try {
    return hit.entry.spec.value?.()
  } catch {
    return undefined
  }
}

export interface RnUiFieldHost {
  register(spec: RnFieldSpec): RnFieldHandle | null
}

/**
 * 跨包挂载点:约定键 + 显式属性名的局部类型。
 * 用 globalThis 而不是 import,是为了不让下层包 @ihui/ui-native 反向依赖 app。
 * ui-native 侧镜像同一个字面量(见 packages/ui-native/src/input.tsx 注释)。
 */
export const RN_FIELD_HOST_GLOBAL_KEY = '__IHUI_RN_UI_FIELD_REGISTRY__'

interface GlobalWithFieldHost {
  __IHUI_RN_UI_FIELD_REGISTRY__?: RnUiFieldHost
}

const host: RnUiFieldHost = { register }

;(globalThis as GlobalWithFieldHost)[RN_FIELD_HOST_GLOBAL_KEY] = host

/** 端内自检 / 测试用:宿主是否已就位(ui-native 那条腿走 globalThis,不经此处) */
export function getRnFieldHost(): RnUiFieldHost | null {
  return (globalThis as GlobalWithFieldHost)[RN_FIELD_HOST_GLOBAL_KEY] ?? null
}

/** 供 ui-native 之外的手工注册(测试 / 未来业务屏交出 onSubmit 时走这里) */
export function registerRnField(spec: RnFieldSpec): RnFieldHandle | null {
  return register(spec)
}

export function countRegisteredFields(): number {
  return entries.size
}

/** 测试专用:整体复位控件表与序号,避免用例间 id 互相可见。
 * groupProvider 属"宿主接线"(ui-action-registry 模块加载时注入一次),不随表复位,
 * 否则单测里 reset 之后 describe 就再也拿不到分组了。 */
export function resetRnFieldRegistry(): void {
  entries.clear()
  seqByKind.clear()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
