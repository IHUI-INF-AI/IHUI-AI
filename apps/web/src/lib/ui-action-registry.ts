// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 DOM/window,不适合共享
import type {
  AgentActionErrorCode,
  UiCommandDescriptor,
  UiControlActionType,
  UiElementDescriptor,
  UiFormDescriptor,
  UiRegistrySnapshot,
} from '@ihui/types'

import {
  BUILTIN_COMMANDS,
  COMMAND_LABEL_KEY,
  recordCommandUse,
  type CommandAction,
} from '@/lib/command-registry'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { useModeStore } from '@/stores/mode'
import { useWorkPanelStore } from '@/stores/work-panel'
import { UI_ROUTES } from '@/lib/ui-routes.generated'
import { NAVIGATE_DENY_RE, buildRouteIndex } from '@/lib/ui-route-index'

// AI 下发指令可到达本页执行,破坏性词与敏感字段黑名单是 2026-09-20 立项的安全底线:
// 防 AI 幻觉误删数据/误付款/误泄露凭据,命中一律拒绝而非"尽量执行"。
const DESTRUCTIVE_RE =
  /注销|删除|清空|提现|转账|退款|支付|确认付款|退号|delete|remove|destroy|withdraw|refund|pay/i
const SENSITIVE_RE = /密码|验证码|password|secret|token|api[-_]?key/i

const MAX_ELEMENTS = 80
const MAX_FORMS = 20
const MAX_ROUTE_COMMANDS = 40
const MAX_LABEL_CHARS = 40
const MAX_READ_TEXT_CHARS = 4000
const MAX_VALUE_CHARS = 200

// file 输入现在也采集(kind='file',浏览器禁止脚本填真实路径,但模型必须"看得见上传位");
// contenteditable 富文本与 Monaco 容器同样入表(可填性见 executeUiAction 各分支)。
const CONTENT_EDITABLE_SELECTOR =
  '[contenteditable="true"],[contenteditable=""],[contenteditable="plaintext-only"]'
const MONACO_SELECTOR = '.monaco-editor'
const INTERACTIVE_SELECTOR = `input:not([type="hidden"]), select, textarea, button, a[href], [role="button"], [role="combobox"], ${CONTENT_EDITABLE_SELECTOR}, ${MONACO_SELECTOR}`

export interface UiActionResult {
  ok: boolean
  data?: Record<string, unknown>
  errorCode?: AgentActionErrorCode
  error?: string
}

export interface BuildUiSnapshotOptions {
  /** commandPalette 命名空间的 i18n 解析器(桥接 hook 注入);缺省回落命令 id */
  translate?: (key: string) => string
  /** 全站路由检索词(2026-09-21 立):缺省时 routes 只回"总数+前缀计数摘要",零完整路径 */
  routeQuery?: string
  /** 检索命中上限,默认且封顶 40(MAX_ROUTE_QUERY_RESULTS) */
  routeLimit?: number
}

type NavigateHandler = (href: string) => void

let navigateHandler: NavigateHandler | null = null
let snapshotTranslate: ((key: string) => string) | null = null

export function configureUiControlBridge(deps: {
  navigate: NavigateHandler
  translate?: (key: string) => string
}): void {
  navigateHandler = deps.navigate
  snapshotTranslate = deps.translate ?? null
}

export function resetUiControlBridge(): void {
  navigateHandler = null
  snapshotTranslate = null
}

// describe 多次重建时同节点必须拿到同一 id(AI 先 describe 再 click 的链路依赖该稳定性),
// 正查 WeakMap + 反查 Map<string, WeakRef> 让 id 与会话内节点生命周期绑定且不阻止 GC。
const idByNode = new WeakMap<Element, string>()
const nodeById = new Map<string, WeakRef<HTMLElement>>()
let idSeq = 0

function acquireElementId(el: HTMLElement, kind: string): string {
  const existing = idByNode.get(el)
  if (existing) return existing
  const id = `el:${kind}#${++idSeq}`
  idByNode.set(el, id)
  nodeById.set(id, new WeakRef(el))
  return id
}

const formIdByNode = new WeakMap<HTMLFormElement, string>()
const formById = new Map<string, WeakRef<HTMLFormElement>>()
let formSeq = 0

function acquireFormId(form: HTMLFormElement): string {
  const existing = formIdByNode.get(form)
  if (existing) return existing
  const id = `form#${++formSeq}`
  formIdByNode.set(form, id)
  formById.set(id, new WeakRef(form))
  return id
}

function trimLabel(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > MAX_LABEL_CHARS ? `${t.slice(0, MAX_LABEL_CHARS)}…` : t
}

function elementKind(el: HTMLElement): string {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'file') return 'file'
    if (el.type === 'checkbox' || el.type === 'radio') return 'checkbox'
    if (el.type === 'submit' || el.type === 'button') return 'button'
    return 'input'
  }
  if (el instanceof HTMLTextAreaElement) return 'textarea'
  if (el instanceof HTMLSelectElement) return 'select'
  if (el.classList.contains('monaco-editor')) return 'code'
  if (isContentEditableRoot(el)) return 'richtext'
  if (el.tagName === 'A') return 'link'
  if (el.getAttribute('role') === 'combobox') return 'combobox'
  return 'button'
}

function isContentEditableRoot(el: HTMLElement): boolean {
  const attr = el.getAttribute('contenteditable')
  return attr === 'true' || attr === '' || attr === 'plaintext-only'
}

/** Monaco 内嵌 textarea/input、嵌套 contenteditable 都是控件内部实现,只采外层容器 */
function isControlInternal(el: HTMLElement): boolean {
  if (el.parentElement?.closest(CONTENT_EDITABLE_SELECTOR)) return true
  if (!el.classList.contains('monaco-editor') && el.closest(MONACO_SELECTOR)) return true
  return false
}

// ===== Monaco 实例桥(无 @types,全部经 unknown + 结构守卫,零 any)=====
interface MonacoTextModel {
  setValue(value: string): void
  getValue(): string
}

function asMonacoModel(candidate: unknown): MonacoTextModel | null {
  if (typeof candidate !== 'object' || candidate === null) return null
  const shape = candidate as Record<string, unknown>
  if (typeof shape['setValue'] === 'function' && typeof shape['getValue'] === 'function') {
    return candidate as MonacoTextModel
  }
  return null
}

function monacoModelFor(el: HTMLElement): MonacoTextModel | null {
  // 通道①:容器上的 _modelData(monaco 0.x 内部结构,存在即用)
  const byContainer = asMonacoModel(
    (el as unknown as { _modelData?: { model?: unknown } })._modelData?.model,
  )
  if (byContainer) return byContainer
  // 通道②:window.monaco.editor.getEditors() 找包含该容器的编辑器
  const w = el.ownerDocument.defaultView as
    (Window & { monaco?: { editor?: { getEditors?: () => unknown } } }) | null
  const editors = w?.monaco?.editor?.getEditors?.()
  if (!Array.isArray(editors)) return null
  for (const item of editors) {
    if (typeof item !== 'object' || item === null) continue
    const ed = item as Record<string, unknown>
    const container = typeof ed['getContainer'] === 'function' ? ed['getContainer']() : undefined
    if (
      container instanceof Node &&
      (container === el || el.contains(container) || container.contains(el))
    ) {
      const model = typeof ed['getModel'] === 'function' ? ed['getModel']() : null
      const found = asMonacoModel(model)
      if (found) return found
    }
  }
  // 全页仅一个编辑器且拿不到 container 时的保守回落(多编辑器绝不自选,防写错面板)
  if (editors.length === 1) {
    const ed = editors[0]
    if (
      typeof ed === 'object' &&
      ed !== null &&
      typeof (ed as Record<string, unknown>)['getContainer'] !== 'function'
    ) {
      return asMonacoModel(
        typeof (ed as Record<string, unknown>)['getModel'] === 'function'
          ? ((ed as Record<string, unknown>)['getModel'] as () => unknown)()
          : null,
      )
    }
  }
  return null
}

/** contenteditable 写入:直写 textContent + 派发 input/change(React 受控/监听方可见)。
 * 刻意不用 execCommand:jsdom/happy-dom 未实现且真浏览器 insertText 依赖选区,行为不可测;
 * 维护独立文档模型的编辑器(ProseMirror/Slate)可能不同步,回执里如实回写后的文本供核对。 */
function fillContentEditable(el: HTMLElement, text: string): void {
  el.focus()
  el.textContent = text
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function sliceValue(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > MAX_VALUE_CHARS ? `${t.slice(0, MAX_VALUE_CHARS)}…` : t
}

function associatedLabel(el: HTMLElement): string | null {
  const doc = el.ownerDocument
  const id = el.getAttribute('id')
  if (id && doc) {
    try {
      const explicit = doc.querySelector(`label[for="${CSS.escape(id)}"]`)
      if (explicit?.textContent) return explicit.textContent
    } catch {
      // CSS.escape 缺环境时忽略 label[for] 通道
    }
  }
  const wrapping = el.closest('label')
  if (wrapping?.textContent) return wrapping.textContent
  return null
}

function elementLabel(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label')
  if (aria) return trimLabel(aria)
  const labelled = associatedLabel(el)
  if (labelled) return trimLabel(labelled)
  if (el instanceof HTMLInputElement) {
    if (el.type === 'submit' || el.type === 'button') {
      const v = el.value.trim()
      if (v) return trimLabel(v)
    }
    if (el.placeholder) return trimLabel(el.placeholder)
  }
  const name = el.getAttribute('name')
  if (name) return trimLabel(name)
  // Monaco 容器的 textContent 是整篇代码,当标签毫无信息量(trimLabel 已截 40 字符,但仍是代码碎片)
  if (el.classList.contains('monaco-editor'))
    return trimLabel(el.getAttribute('aria-label') ?? '代码编辑器')
  return trimLabel(el.textContent ?? '')
}

function isVisibleElement(el: HTMLElement): boolean {
  const cs = el.ownerDocument.defaultView?.getComputedStyle(el)
  if (cs && (cs.visibility === 'hidden' || cs.display === 'none')) return false
  // position:fixed 元素 offsetParent 恒为 null(浏览器规范),不能当隐藏
  if (cs?.position === 'fixed') return true
  return el.offsetParent !== null
}

function isDisabledElement(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled')) return true
  if (el.getAttribute('aria-disabled') === 'true') return true
  return false
}

function isSensitiveField(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement && el.type === 'password') return true
  return (
    SENSITIVE_RE.test(el.getAttribute('name') ?? '') ||
    SENSITIVE_RE.test(el.getAttribute('id') ?? '') ||
    SENSITIVE_RE.test(elementLabel(el))
  )
}

function readElementValue(el: HTMLElement): string | undefined {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') return String(el.checked)
    if (el.type === 'password' || el.type === 'file') return undefined
    return el.value
  }
  if (el instanceof HTMLTextAreaElement) return el.value
  if (el instanceof HTMLSelectElement) return el.selectedOptions[0]?.value ?? ''
  if (el.classList.contains('monaco-editor')) {
    const model = monacoModelFor(el)
    return model ? sliceValue(model.getValue()) : undefined
  }
  if (isContentEditableRoot(el)) return sliceValue(el.textContent ?? '')
  return undefined
}

function elementConstraint(el: HTMLElement): string | undefined {
  const parts: string[] = []
  if (el instanceof HTMLInputElement && el.type === 'file') {
    // 模型据此知道"这是上传位、收哪些文件、能否多选";真实路径无法由脚本写入
    if (el.accept) parts.push(`accept=${el.accept}`)
    if (el.multiple) parts.push('multiple')
  }
  if (el instanceof HTMLInputElement && el.type === 'number') {
    if (el.min) parts.push(`min=${el.min}`)
    if (el.max) parts.push(`max=${el.max}`)
    if (el.step) parts.push(`step=${el.step}`)
  }
  if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.maxLength > 0)
    parts.push(`maxlength=${el.maxLength}`)
  if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.required)
    parts.push('required')
  return parts.length > 0 ? parts.join(' ') : undefined
}

function collectInteractive(): HTMLElement[] {
  if (typeof document === 'undefined') return []
  return Array.from(document.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)).filter(
    (el) => isVisibleElement(el) && !isSensitiveField(el) && !isControlInternal(el),
  )
}

/**
 * 元素入选 MAX_ELEMENTS 上限时的优先级(数值小者先入选)。
 *
 * 实测应用外壳(侧栏 / 顶栏 / AI 任务面板)常驻 200+ 可交互元素,按 DOM 顺序截断会把
 * 页面真正的表单字段整批挤出去 —— describe 回清单里没有输入框,AI 就无从下手
 * (2026-09-20 真机复现:/wallet/recharge 的"充值数量"落在 80 名之外)。
 * 故表单字段永远优先保留,正文区按钮次之,外壳导航最后。
 */
const SHELL_SELECTOR = 'nav,header,aside,[role="navigation"],[role="complementary"],[role="banner"]'
// richtext/code 与 input/textarea 同级:它们就是页面的"正文输入通道",被挤出即失能
const FIELD_KINDS = new Set([
  'input',
  'textarea',
  'select',
  'combobox',
  'checkbox',
  'richtext',
  'code',
])

function elementPriority(el: HTMLElement, kind: string): number {
  if (FIELD_KINDS.has(kind)) return 0
  // file 归 1(与正文按钮同级):上传位只能"看见"不能代填(浏览器安全策略),
  // 截断时不得挤掉真正可操作的字段,但又比外壳链接更贴近页面主任务
  if (kind === 'file') return 1
  const inShell = !!el.closest(SHELL_SELECTOR)
  if (!inShell && kind === 'button') return 1
  return inShell ? 3 : 2
}

function commandTarget(action: CommandAction): string {
  switch (action.type) {
    case 'navigate':
      return action.href
    case 'ideTab':
      return action.href
    case 'mode':
      return action.mode
    case 'workPanel':
      return 'workPanel'
  }
}

const COMMAND_GROUP_BY_ACTION: Record<CommandAction['type'], string> = {
  navigate: 'navigate',
  mode: 'mode',
  workPanel: 'panel',
  ideTab: 'ide',
}

function buildCommands(): UiCommandDescriptor[] {
  const translate = snapshotTranslate
  const commands: UiCommandDescriptor[] = BUILTIN_COMMANDS.map((cmd) => {
    let label = cmd.id
    const key = COMMAND_LABEL_KEY[cmd.id]
    if (translate && key) {
      try {
        label = translate(key) || label
      } catch {
        // 翻译缺 key 时 next-intl 会 throw,回落 id
      }
    }
    return {
      id: cmd.id,
      label,
      group: COMMAND_GROUP_BY_ACTION[cmd.action.type],
      target: commandTarget(cmd.action),
    }
  })
  // 879 条路由全铺会淹没快照,每组第一条作为"可去页面"示例即可
  const seenGroups = new Set<string>()
  let routeCommandCount = 0
  for (const route of UI_ROUTES) {
    if (routeCommandCount >= MAX_ROUTE_COMMANDS) break
    if (seenGroups.has(route.group)) continue
    if (NAVIGATE_DENY_RE.test(route.path) || route.path.includes(':')) continue
    seenGroups.add(route.group)
    routeCommandCount++
    commands.push({
      id: `route:${route.path}`,
      label: route.path,
      description: `路由分组: ${route.group || 'root'}`,
      group: 'navigate',
      target: route.path,
    })
  }
  return commands
}

function formTitle(form: HTMLFormElement, id: string): string {
  const legend = form.querySelector('legend')?.textContent
  if (legend?.trim()) return trimLabel(legend)
  const aria = form.getAttribute('aria-label')
  if (aria) return trimLabel(aria)
  const name = form.getAttribute('name')
  if (name) return trimLabel(name)
  return id
}

export function buildUiSnapshot(options: BuildUiSnapshotOptions = {}): UiRegistrySnapshot {
  if (options.translate) snapshotTranslate = options.translate
  const commands = buildCommands()
  const routes = buildRouteIndex(options.routeQuery, options.routeLimit)
  const page =
    typeof document === 'undefined'
      ? { path: '', title: '', url: '' }
      : {
          path: window.location.pathname,
          title: document.title,
          url: window.location.href,
        }
  if (typeof document === 'undefined') {
    return {
      version: 1,
      page,
      commands,
      forms: [],
      elements: [],
      suppressed: 0,
      routes,
      reportedAt: Date.now(),
    }
  }

  const allForms = Array.from(document.querySelectorAll('form'))
  const includedForms = allForms.slice(0, MAX_FORMS)
  const formIds = new Map<HTMLFormElement, string>(includedForms.map((f) => [f, acquireFormId(f)]))
  const fieldsByForm = new Map<string, UiElementDescriptor[]>()
  for (const f of includedForms) fieldsByForm.set(formIds.get(f)!, [])

  const elements: UiElementDescriptor[] = []
  let suppressed = allForms.length - includedForms.length

  // 先全量收集候选,再按优先级择优入表(截断规则见 elementPriority 注释)。
  // 刻意不复用 collectInteractive():它已剔除敏感字段,而快照要把它们计入 suppressed,
  // 让 AI 知道"这里被安全策略挡住了 N 个",而不是静默消失。
  interface Candidate {
    el: HTMLElement
    kind: string
    priority: number
    order: number
  }
  const candidates: Candidate[] = []
  let order = 0
  if (typeof document !== 'undefined') {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR))) {
      if (!isVisibleElement(el)) continue
      if (isControlInternal(el)) continue
      if (isSensitiveField(el)) {
        suppressed++
        continue
      }
      const kind = elementKind(el)
      candidates.push({ el, kind, priority: elementPriority(el, kind), order: order++ })
    }
  }
  const selected = [...candidates]
    .sort((a, b) => a.priority - b.priority || a.order - b.order)
    .slice(0, MAX_ELEMENTS)
    .sort((a, b) => a.order - b.order)
  suppressed += candidates.length - selected.length

  for (const { el, kind } of selected) {
    const owner = el.closest('form')
    const ownerForm = owner ? formIds.get(owner as HTMLFormElement) : undefined
    const descriptor: UiElementDescriptor = {
      id: acquireElementId(el, kind),
      kind,
      label: elementLabel(el),
      group: ownerForm ?? 'page',
    }
    const value = readElementValue(el)
    if (value !== undefined) descriptor.value = value
    const constraint = elementConstraint(el)
    if (constraint) descriptor.constraint = constraint
    if (isDisabledElement(el)) descriptor.disabled = true
    // 2026-09-21:link 补 href(实测模型拿到 link 却读不到指向,只能猜路径)
    if (kind === 'link' && el instanceof HTMLAnchorElement) {
      const href = el.getAttribute('href')
      if (href) descriptor.target = href.length > 120 ? `${href.slice(0, 117)}…` : href
    }
    elements.push(descriptor)
    if (ownerForm) fieldsByForm.get(ownerForm)?.push(descriptor)
  }

  const forms: UiFormDescriptor[] = includedForms.map((f) => {
    const id = formIds.get(f)!
    return {
      id,
      title: formTitle(f, id),
      action: 'submit' as const,
      fields: fieldsByForm.get(id) ?? [],
    }
  })

  return {
    version: 1,
    page,
    commands,
    forms,
    elements,
    suppressed,
    routes,
    reportedAt: Date.now(),
  }
}

// ===== target 解析 =====

/** 解析顺序(与 ai-service web_ui_* 工具约定一致):id → 精确文本 → 子串文本 → CSS 选择器 */
export function resolveUiTarget(target: string): HTMLElement | null {
  if (typeof document === 'undefined' || !target) return null
  const ref = nodeById.get(target)?.deref()
  if (ref && ref.isConnected) return ref
  const candidates = collectInteractive()
  const exact = candidates.find((el) => elementLabel(el) === target)
  if (exact) return exact
  const partial = candidates.find((el) => elementLabel(el).includes(target))
  if (partial) return partial
  try {
    const bySelector = document.querySelector(target)
    if (bySelector instanceof HTMLElement) return bySelector
  } catch {
    // target 不是合法 CSS 选择器(中文短语常见),视为未命中
  }
  return null
}

function targetText(el: HTMLElement): string {
  return [elementLabel(el), el.textContent ?? '', el.getAttribute('name') ?? ''].join(' ')
}

function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
  // React 受控组件劫持了实例上的 value setter,必须走原型原生 setter 再派发事件,
  // 否则 react-hook-form / 受控 state 收不到变更(与任务契约一致)
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, value)
  else el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

// ===== navigate 白名单 =====

const paramRouteCache = new Map<string, RegExp>()

function routeMatches(pattern: string, path: string): boolean {
  if (!pattern.includes(':')) return pattern === path
  let re = paramRouteCache.get(pattern)
  if (!re) {
    const src = `^${pattern
      .split('/')
      .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('/')}$`
    re = new RegExp(src)
    paramRouteCache.set(pattern, re)
  }
  return re.test(path)
}

export function isAllowedNavigatePath(rawPath: string): { ok: boolean; path: string } {
  if (typeof rawPath !== 'string' || !rawPath) return { ok: false, path: '' }
  if (/javascript:/i.test(rawPath)) return { ok: false, path: '' }
  const path = rawPath.split('?')[0]?.split('#')[0] ?? ''
  if (!path.startsWith('/')) return { ok: false, path }
  // 登录/SSO/API 路径涉及凭据流转,永不允许 AI 代为跳转
  if (NAVIGATE_DENY_RE.test(path)) return { ok: false, path }
  const ok = UI_ROUTES.some((route) => routeMatches(route.path, path))
  return { ok, path }
}

function goTo(path: string): void {
  if (navigateHandler) navigateHandler(path)
  else if (typeof window !== 'undefined') window.location.assign(path)
}

// ===== 执行器 =====

function fail(errorCode: AgentActionErrorCode, error: string): UiActionResult {
  return { ok: false, errorCode, error }
}

export async function executeUiAction(
  action: UiControlActionType,
  params: Record<string, unknown>,
): Promise<UiActionResult> {
  if (typeof document === 'undefined') return fail('EXECUTION_FAILED', '无 DOM 环境')
  const p = params ?? {}
  switch (action) {
    case 'describe': {
      // 2026-09-21:query/limit 透传给路由检索(不带 query 时 routes 只有计数摘要,零完整路径)
      const routeQuery = typeof p.query === 'string' && p.query.trim() ? p.query.trim() : undefined
      const routeLimit =
        typeof p.limit === 'number' && Number.isFinite(p.limit) ? p.limit : undefined
      return { ok: true, data: { registry: buildUiSnapshot({ routeQuery, routeLimit }) } }
    }

    case 'navigate': {
      const { ok, path } = isAllowedNavigatePath(String(p.path ?? ''))
      if (!ok) return fail('ROUTE_NOT_ALLOWED', `目标路由不在站内白名单: ${String(p.path ?? '')}`)
      goTo(path)
      return { ok: true, data: { path } }
    }

    case 'click': {
      const el = resolveUiTarget(String(p.target ?? ''))
      if (!el) return fail('SELECTOR_NOT_FOUND', `找不到目标: ${String(p.target ?? '')}`)
      if (isSensitiveField(el)) return fail('PERMISSION_DENIED', '敏感字段不允许 AI 操作')
      if (DESTRUCTIVE_RE.test(targetText(el)))
        return fail('DESTRUCTIVE_BLOCKED', '该操作被识别为破坏性操作,需用户手动执行')
      if (isDisabledElement(el)) return fail('EXECUTION_FAILED', '目标元素已禁用')
      el.click()
      return { ok: true, data: { clicked: elementLabel(el) || el.tagName.toLowerCase() } }
    }

    case 'fill': {
      const el = resolveUiTarget(String(p.target ?? ''))
      if (!el) return fail('SELECTOR_NOT_FOUND', `找不到目标: ${String(p.target ?? '')}`)
      if (isSensitiveField(el))
        return fail('PERMISSION_DENIED', '密码/验证码/密钥类字段禁止 AI 填写')
      if (isDisabledElement(el)) return fail('EXECUTION_FAILED', '目标元素已禁用')
      const raw = p.value
      // file:浏览器安全策略禁止脚本写真实路径,DataTransfer 通道又要求"AI 凭空造文件内容"
      // (属另一项待确认的新能力)。协议中亦无"引用页面既有 File 对象"的机制,故一律如实拒绝。
      if (el instanceof HTMLInputElement && el.type === 'file') {
        return fail(
          'PERMISSION_DENIED',
          '文件上传位无法由 AI 代填:浏览器禁止脚本写入本地路径,当前协议也不支持引用页面上已有的 File 对象。' +
            '该元素在快照中 kind=file(constraint 含 accept/multiple),请引导用户手动选择文件',
        )
      }
      if (el.classList.contains('monaco-editor')) {
        const model = monacoModelFor(el)
        if (!model) {
          return fail(
            'UNSUPPORTED_ACTION',
            '检测到 Monaco 代码编辑器容器,但 window.monaco.editor.getEditors 与容器 _modelData 均取不到 editor 实例,' +
              '暂不支持 AI 写入代码(快照中 kind=code 供感知)',
          )
        }
        const codeText = String(raw ?? '')
        model.setValue(p.clear === false ? model.getValue() + codeText : codeText)
        return {
          ok: true,
          data: { filled: elementLabel(el), kind: 'code', chars: codeText.length },
        }
      }
      if (isContentEditableRoot(el)) {
        const richText = typeof raw === 'boolean' ? String(raw) : String(raw ?? '')
        const next = p.clear === false && el.textContent ? el.textContent + richText : richText
        fillContentEditable(el, next)
        return {
          ok: true,
          data: {
            filled: elementLabel(el),
            kind: 'richtext',
            value: next.slice(0, MAX_VALUE_CHARS),
          },
        }
      }
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        const want = raw === true || raw === 'true' || raw === 1 || raw === '1'
        if (el.checked !== want) el.click()
        return { ok: true, data: { filled: elementLabel(el), value: String(want) } }
      }
      if (el instanceof HTMLSelectElement) {
        const want = String(raw ?? '')
        const byValue = Array.from(el.options).find((o) => o.value === want)
        const byText = Array.from(el.options).find((o) => o.text === want)
        const option = byValue ?? byText
        if (!option) return fail('EXECUTION_FAILED', `下拉框无匹配选项: ${want}`)
        setNativeValue(el, option.value)
        return { ok: true, data: { filled: elementLabel(el), value: option.value } }
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const text = typeof raw === 'boolean' ? String(raw) : String(raw ?? '')
        const next = p.clear === false && el.value ? el.value + text : text
        setNativeValue(el, next)
        return { ok: true, data: { filled: elementLabel(el), value: next } }
      }
      return fail('EXECUTION_FAILED', '目标不是可填写控件')
    }

    case 'submit': {
      const formParam = typeof p.form === 'string' ? p.form : ''
      let form: HTMLFormElement | null = null
      if (formParam) {
        const byId = formById.get(formParam)?.deref()
        if (byId && byId.isConnected) form = byId
        else {
          const el = resolveUiTarget(formParam)
          form =
            (el?.closest('form') as HTMLFormElement | null) ??
            (el instanceof HTMLFormElement ? el : null)
        }
      } else {
        form =
          Array.from(document.querySelectorAll('form')).find((f) => isVisibleElement(f)) ?? null
      }
      if (!form) {
        const submitBtn = collectInteractive().find(
          (el) => el instanceof HTMLInputElement && el.type === 'submit',
        )
        if (!submitBtn) return fail('SELECTOR_NOT_FOUND', '页面上没有可提交的表单')
        if (DESTRUCTIVE_RE.test(targetText(submitBtn)))
          return fail('DESTRUCTIVE_BLOCKED', '该操作被识别为破坏性操作,需用户手动执行')
        submitBtn.click()
        return { ok: true, data: { submitted: elementLabel(submitBtn) } }
      }
      const formText = `${formTitle(form, '')} ${Array.from(
        form.querySelectorAll('button,[type="submit"]'),
      )
        .map((b) => b.textContent ?? '')
        .join(' ')}`
      if (DESTRUCTIVE_RE.test(formText))
        return fail('DESTRUCTIVE_BLOCKED', '该操作被识别为破坏性操作,需用户手动执行')
      // requestSubmit 才会走 submit 事件(React onSubmit / 校验),裸 form.submit() 会绕过
      if (typeof form.requestSubmit === 'function') form.requestSubmit()
      else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      return { ok: true, data: { submitted: formTitle(form, acquireFormId(form)) } }
    }

    case 'read': {
      const values: Record<string, string> = {}
      for (const el of collectInteractive()) {
        const v = readElementValue(el)
        if (v === undefined) continue
        values[elementLabel(el) || el.tagName.toLowerCase()] = v
      }
      const rawText = document.body?.innerText ?? document.body?.textContent ?? ''
      const text =
        rawText.length > MAX_READ_TEXT_CHARS
          ? `${rawText.slice(0, MAX_READ_TEXT_CHARS)}…[truncated]`
          : rawText
      return {
        ok: true,
        data: {
          page: {
            path: window.location.pathname,
            title: document.title,
            url: window.location.href,
          },
          text,
          values,
        },
      }
    }

    case 'invoke': {
      const name = String(p.name ?? '')
      const cmd = BUILTIN_COMMANDS.find((c) => c.id === name)
      if (cmd) {
        recordCommandUse(cmd.id)
        switch (cmd.action.type) {
          case 'navigate':
            goTo(cmd.action.href)
            break
          case 'ideTab':
            useIDEWorkspace.getState().setActiveTopTab(cmd.action.tab)
            goTo(cmd.action.href)
            break
          case 'workPanel':
            useWorkPanelStore.getState().toggle()
            break
          case 'mode':
            useModeStore.getState().setMode(cmd.action.mode)
            break
        }
        return { ok: true, data: { invoked: cmd.id } }
      }
      const route = isAllowedNavigatePath(name)
      if (route.ok) {
        goTo(route.path)
        return { ok: true, data: { invoked: route.path } }
      }
      return fail('SELECTOR_NOT_FOUND', `命令不存在且不是合法站内路由: ${name}`)
    }

    default:
      return fail('UNSUPPORTED_ACTION', `不支持的 UI 动作: ${String(action)}`)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
