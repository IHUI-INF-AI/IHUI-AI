// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ext_ui 执行器 — 扩展自有界面(sidepanel / popup)的七动词 AI 操控(2026-09-21 立)。
 *
 * 执行环境 = 面板自己的 `document`(chrome-extension:// 页面的真实同源 DOM)。
 * 由 background 收到 `category === 'ext_ui'` 的 AgentActionRequest 后经
 * chrome.runtime.sendMessage 转发到 sidepanel(`entrypoints/sidepanel/ext-ui-listener.ts`
 * 监听),本文件执行后把 DomActionResult 形状的结果沿同一通道回给 background,
 * 由 background 走既有 `/result` 回传(单条 WS、一处回执)。
 *
 * 安全语义与 web 端 `apps/web/src/lib/ui-action-registry.ts` 逐字对齐(模型在三端看到
 * 的行为一致):SENSITIVE_RE / DESTRUCTIVE_RE 判据正则照抄 web,errorCode 统一
 * PERMISSION_DENIED / DESTRUCTIVE_BLOCKED / ROUTE_NOT_ALLOWED / SELECTOR_NOT_FOUND /
 * UNSUPPORTED_ACTION。宁可如实失败,不回"ok 而界面没动"。
 *
 * 实现注意:DOM 访问全部走结构化 duck typing(tagName/getAttribute/…),不用
 * `instanceof HTMLInputElement` 一类平台类型判断 —— 保证 vitest node 环境(自建最小
 * document mock)与真实 sidepanel 行为一致。
 */
import type { AgentActionErrorCode, AgentActionRequest, ExtUiActionType } from '@ihui/types'
import { EXT_UI_ROUTES } from './ext-ui-routes.generated'
import { PENDING_ROUTE_STORAGE_KEY } from '@ihui/shared/constants'

// ===== 与 web 端逐字对齐的安全判据(apps/web/src/lib/ui-action-registry.ts:29-31) =====

const DESTRUCTIVE_RE =
  /注销|删除|清空|提现|转账|退款|支付|确认付款|退号|delete|remove|destroy|withdraw|refund|pay/i
const SENSITIVE_RE = /密码|验证码|password|secret|token|api[-_]?key/i

// ===== 容量上限(describe 元素 60 条上限为 ext_ui 侧板契约,其余与 web 同值) =====

const MAX_ELEMENTS = 60
const MAX_FORMS = 20
const MAX_ROUTES_IN_SNAPSHOT = 40
const MAX_LABEL_CHARS = 40
const MAX_READ_TEXT_CHARS = 4000
const MAX_VALUE_CHARS = 200

const INTERACTIVE_SELECTOR =
  'input:not([type="hidden"]), textarea, select, button, [role="button"], a'
const FIELD_SELECTOR = 'input, textarea, select, button, [role="button"], a'

// ===== 结果形状(与 agent-control.ts 的 DomActionResult 回执一致) =====

export interface ExtUiActionResult {
  ok: boolean
  data?: Record<string, unknown>
  errorCode?: AgentActionErrorCode
  error?: string
}

function fail(errorCode: AgentActionErrorCode, error: string): ExtUiActionResult {
  return { ok: false, errorCode, error }
}

// ===== 最小 DOM 结构类型(vitest node 环境用自建 mock,真实环境为原生对象) =====

interface ExtDomNode {
  tagName?: string
  getAttribute: (name: string) => string | null
  textContent?: string | null
}

interface ExtDomElement extends ExtDomNode {
  value?: unknown
  checked?: boolean
  disabled?: boolean
  type?: string
  options?: ArrayLike<{ value: string; text: string }>
  click?: () => void
  dispatchEvent?: (event: unknown) => boolean
  isConnected?: boolean
  offsetWidth?: number
  offsetHeight?: number
  querySelectorAll?: (selector: string) => ArrayLike<ExtDomElement>
  requestSubmit?: () => void
}

interface ExtDocumentLike {
  title?: string
  body?: { innerText?: string; textContent?: string | null } | null
  querySelectorAll: (selector: string) => ArrayLike<ExtDomElement>
  querySelector?: (selector: string) => ExtDomElement | null
}

function currentDocument(): ExtDocumentLike | null {
  const doc = (globalThis as { document?: unknown }).document
  if (!doc || typeof doc !== 'object') return null
  const d = doc as Partial<ExtDocumentLike>
  if (typeof d.querySelectorAll !== 'function') return null
  return d as ExtDocumentLike
}

function tagOf(el: ExtDomNode): string {
  return (el.tagName ?? '').toUpperCase()
}

function toArray(list: ArrayLike<ExtDomElement> | undefined | null): ExtDomElement[] {
  if (!list) return []
  return Array.from(list) as ExtDomElement[]
}

// ===== 元素 id:同一次会话内稳定(WeakMap 正查 + Map 反查,与 web 同方案) =====

const idByNode = new WeakMap<object, string>()
const nodeById = new Map<string, WeakRef<object>>()
let idSeq = 0

function acquireElementId(el: object, kind: string): string {
  const existing = idByNode.get(el)
  if (existing) return existing
  const id = `el:${kind}#${++idSeq}`
  idByNode.set(el, id)
  nodeById.set(id, new WeakRef(el))
  return id
}

// ===== 元素分类 / 标签 =====

function elementKind(el: ExtDomElement): string {
  const tag = tagOf(el)
  if (tag === 'INPUT') {
    const t = (el.type ?? el.getAttribute('type') ?? '').toLowerCase()
    if (t === 'checkbox' || t === 'radio') return 'checkbox'
    if (t === 'submit' || t === 'button') return 'button'
    if (t === 'file') return 'file'
    return 'input'
  }
  if (tag === 'TEXTAREA') return 'textarea'
  if (tag === 'SELECT') return 'select'
  if (tag === 'A') return 'link'
  return 'button'
}

function trimLabel(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > MAX_LABEL_CHARS ? `${t.slice(0, MAX_LABEL_CHARS)}…` : t
}

function elementLabel(el: ExtDomNode): string {
  const aria = el.getAttribute('aria-label')
  if (aria) return trimLabel(aria)
  const placeholder = el.getAttribute('placeholder')
  if (placeholder) return trimLabel(placeholder)
  const text = trimLabel(el.textContent ?? '')
  if (text) return text
  const name = el.getAttribute('name')
  return name ? trimLabel(name) : ''
}

function isVisibleElement(el: ExtDomElement): boolean {
  if (el.getAttribute('hidden') !== null) return false
  if (el.getAttribute('aria-hidden') === 'true') return false
  const style = el.getAttribute('style') ?? ''
  if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) return false
  // 真实 DOM 有布局尺寸;mock 环境没有(undefined)则不做尺寸过滤
  const { offsetWidth: w, offsetHeight: h } = el
  if (typeof w === 'number' && typeof h === 'number' && (w <= 0 || h <= 0)) return false
  return true
}

function isDisabledElement(el: ExtDomElement): boolean {
  return el.disabled === true || el.getAttribute('aria-disabled') === 'true'
}

function isWritableKind(kind: string): boolean {
  return kind === 'input' || kind === 'textarea' || kind === 'select'
}

function isPressableKind(kind: string): boolean {
  return kind === 'button' || kind === 'link'
}

/** 敏感字段(密码/验证码/密钥类):describe 不入 elements,fill 一律 PERMISSION_DENIED */
function isSensitiveField(el: ExtDomNode): boolean {
  return (
    SENSITIVE_RE.test(el.getAttribute('type') ?? '') ||
    SENSITIVE_RE.test(el.getAttribute('name') ?? '') ||
    SENSITIVE_RE.test(el.getAttribute('id') ?? '') ||
    SENSITIVE_RE.test(elementLabel(el))
  )
}

function targetText(el: ExtDomNode): string {
  return [elementLabel(el), el.textContent ?? '', el.getAttribute('name') ?? ''].join(' ')
}

function readElementValue(el: ExtDomElement): string | undefined {
  const tag = tagOf(el)
  if (tag === 'INPUT') {
    const t = (el.type ?? el.getAttribute('type') ?? '').toLowerCase()
    if (t === 'checkbox' || t === 'radio') return el.checked ? 'true' : 'false'
    const v = el.value
    return typeof v === 'string' ? v.slice(0, MAX_VALUE_CHARS) : undefined
  }
  if (tag === 'TEXTAREA' || tag === 'SELECT') {
    const v = el.value
    return typeof v === 'string' ? v.slice(0, MAX_VALUE_CHARS) : undefined
  }
  return undefined
}

// ===== describe 快照 =====

function currentPageInfo(): { path: string; title: string; url: string } {
  const loc = (globalThis as { location?: { pathname?: string; href?: string } }).location
  if (!loc) return { path: '', title: '', url: '' }
  return {
    path: loc.pathname ?? '',
    title: currentDocument()?.title ?? '',
    url: loc.href ?? '',
  }
}

function buildRegistrySnapshot(): Record<string, unknown> {
  const doc = currentDocument()
  const page = currentPageInfo()
  if (!doc) {
    return {
      version: 1,
      page,
      forms: [],
      elements: [],
      suppressed: 0,
      routes: [],
      reportedAt: Date.now(),
    }
  }

  const allForms = toArray(doc.querySelectorAll('form')).slice(0, MAX_FORMS)
  let suppressed = 0

  interface Candidate {
    el: ExtDomElement
    kind: string
    order: number
  }
  const candidates: Candidate[] = []
  let order = 0
  for (const el of toArray(doc.querySelectorAll(INTERACTIVE_SELECTOR))) {
    if (!isVisibleElement(el)) continue
    if (isSensitiveField(el)) {
      // 敏感字段不入 elements(测试钉死),只让 AI 知道"被安全策略挡了 N 个"
      suppressed++
      continue
    }
    candidates.push({ el, kind: elementKind(el), order: order++ })
  }
  const selected = candidates.slice(0, MAX_ELEMENTS)
  suppressed += candidates.length - selected.length

  const elements: Record<string, unknown>[] = selected.map(({ el, kind }) => {
    const descriptor: Record<string, unknown> = {
      id: acquireElementId(el, kind),
      kind,
      label: elementLabel(el),
      writable: isWritableKind(kind) && !isDisabledElement(el),
      pressable: isPressableKind(kind),
    }
    const value = readElementValue(el)
    if (value !== undefined) descriptor.value = value
    if (isDisabledElement(el)) descriptor.disabled = true
    return descriptor
  })

  const forms: Record<string, unknown>[] = allForms.map((form) => {
    const fields = toArray(form.querySelectorAll?.(FIELD_SELECTOR))
      .filter((f) => !isSensitiveField(f) && isVisibleElement(f))
      .slice(0, MAX_ELEMENTS)
      .map((f) => {
        const kind = elementKind(f)
        return { id: acquireElementId(f, kind), kind, label: elementLabel(f) }
      })
    return {
      id: `form#${acquireElementId(form, 'form')}`,
      title: elementLabel(form) || 'form',
      action: 'submit' as const,
      fields,
    }
  })

  return {
    version: 1,
    page,
    forms,
    elements,
    suppressed,
    routes: EXT_UI_ROUTES.slice(0, MAX_ROUTES_IN_SNAPSHOT),
    reportedAt: Date.now(),
  }
}

// ===== target 解析(与 web 一致:id → 精确文本 → 子串文本 → CSS 选择器) =====

function collectInteractive(doc: ExtDocumentLike): ExtDomElement[] {
  return toArray(doc.querySelectorAll(INTERACTIVE_SELECTOR)).filter(
    (el) => isVisibleElement(el) && !isSensitiveField(el),
  )
}

function resolveUiTarget(target: string): ExtDomElement | null {
  const doc = currentDocument()
  if (!doc || !target) return null
  const ref = nodeById.get(target)?.deref()
  if (ref && (ref as ExtDomElement).isConnected !== false) return ref as ExtDomElement
  const candidates = collectInteractive(doc)
  const exact = candidates.find((el) => elementLabel(el) === target)
  if (exact) return exact
  const partial = candidates.find((el) => elementLabel(el).includes(target))
  if (partial) return partial
  if (typeof doc.querySelector === 'function') {
    try {
      const bySelector = doc.querySelector(target)
      if (bySelector) return bySelector
    } catch {
      // target 不是合法 CSS 选择器(中文短语常见),视为未命中
    }
  }
  return null
}

// ===== 值写入(真实 DOM 走原型原生 setter;mock 环境直接写实例) =====

function createDomEvent(type: string): unknown {
  const EventCtor = (globalThis as { Event?: typeof Event }).Event
  if (typeof EventCtor === 'function') {
    try {
      return new EventCtor(type, { bubbles: true })
    } catch {
      // fall through to plain object
    }
  }
  return { type, bubbles: true }
}

function dispatchInputEvents(el: ExtDomElement): void {
  el.dispatchEvent?.(createDomEvent('input'))
  el.dispatchEvent?.(createDomEvent('change'))
}

function setNativeValue(el: ExtDomElement, value: string): void {
  const tag = tagOf(el)
  const g = globalThis as unknown as {
    HTMLInputElement?: { prototype: Record<string, unknown> }
    HTMLTextAreaElement?: { prototype: Record<string, unknown> }
    HTMLSelectElement?: { prototype: Record<string, unknown> }
  }
  let proto: Record<string, unknown> | undefined
  if (tag === 'SELECT') proto = g.HTMLSelectElement?.prototype
  else if (tag === 'TEXTAREA') proto = g.HTMLTextAreaElement?.prototype
  else if (tag === 'INPUT') proto = g.HTMLInputElement?.prototype
  const setter = proto
    ? (Object.getOwnPropertyDescriptor(proto, 'value') as { set?: (v: string) => void } | undefined)
        ?.set
    : undefined
  if (setter) setter.call(el, value)
  else (el as { value?: unknown }).value = value
  // React 受控组件必须派发 input/change 才能收到变更(与 web 端 setNativeValue 一致)
  dispatchInputEvents(el)
}

// ===== navigate 白名单(参数路由支持 :id 通配,与 web routeMatches 同方案) =====

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

export function isAllowedExtUiRoute(rawPath: string): { ok: boolean; path: string } {
  if (typeof rawPath !== 'string' || !rawPath) return { ok: false, path: '' }
  if (/javascript:/i.test(rawPath)) return { ok: false, path: '' }
  const path = rawPath.split('?')[0]?.split('#')[0] ?? ''
  if (!path.startsWith('/')) return { ok: false, path }
  return { ok: EXT_UI_ROUTES.some((route) => routeMatches(route, path)), path }
}

/**
 * navigate 走 sidepanel 现成的 pending route 通道(不自造第三条):
 * 写 chrome.storage.session 的 PENDING_ROUTE_STORAGE_KEY → background 的
 * onStorageChanged 监听广播 `ws.pending_route` runtime 消息 → SidepanelApp
 * 既有监听(SidepanelApp.tsx:156-160)调用 react-router navigate。
 */
async function navigateToRoute(route: string): Promise<void> {
  const g = globalThis as {
    chrome?: { storage?: { session?: { set?: (items: Record<string, string>) => Promise<void> } } }
  }
  const session = g.chrome?.storage?.session
  if (typeof session?.set !== 'function') {
    throw new Error('chrome.storage.session.set unavailable in this context')
  }
  await session.set.call(session, { [PENDING_ROUTE_STORAGE_KEY]: route })
}

// ===== invoke:扩展面板显式登记的命令(当前为空,不伪造) =====

export interface ExtUiCommand {
  id: string
  run: () => void
}

/** 显式命令登记表:sidepanel 面板尚无命令面板类能力,空表 → invoke 一律 UNSUPPORTED_ACTION */
export const EXT_UI_COMMANDS: readonly ExtUiCommand[] = []

// ===== 七动词执行器 =====

export async function executeExtUiAction(
  action: ExtUiActionType,
  params: Record<string, unknown>,
): Promise<ExtUiActionResult> {
  const p = params ?? {}
  switch (action) {
    case 'describe':
      return { ok: true, data: { registry: buildRegistrySnapshot() } }

    case 'navigate': {
      const { ok, path } = isAllowedExtUiRoute(String(p.path ?? ''))
      if (!ok) return fail('ROUTE_NOT_ALLOWED', `目标路由不在站内白名单: ${String(p.path ?? '')}`)
      await navigateToRoute(path)
      return { ok: true, data: { path } }
    }

    case 'click': {
      const el = resolveUiTarget(String(p.target ?? ''))
      if (!el) return fail('SELECTOR_NOT_FOUND', `找不到目标: ${String(p.target ?? '')}`)
      if (isSensitiveField(el)) return fail('PERMISSION_DENIED', '敏感字段不允许 AI 操作')
      if (DESTRUCTIVE_RE.test(targetText(el)))
        return fail('DESTRUCTIVE_BLOCKED', '该操作被识别为破坏性操作,需用户手动执行')
      if (isDisabledElement(el)) return fail('EXECUTION_FAILED', '目标元素已禁用')
      if (typeof el.click !== 'function') return fail('EXECUTION_FAILED', '目标元素不可点击')
      el.click()
      return { ok: true, data: { clicked: elementLabel(el) || tagOf(el).toLowerCase() } }
    }

    case 'fill': {
      const el = resolveUiTarget(String(p.target ?? ''))
      if (!el) return fail('SELECTOR_NOT_FOUND', `找不到目标: ${String(p.target ?? '')}`)
      if (isSensitiveField(el))
        return fail('PERMISSION_DENIED', '密码/验证码/密钥类字段禁止 AI 填写')
      if (isDisabledElement(el)) return fail('EXECUTION_FAILED', '目标元素已禁用')
      const tag = tagOf(el)
      const inputType = (el.type ?? el.getAttribute('type') ?? '').toLowerCase()
      // file:浏览器安全策略禁止脚本写真实路径,如实拒绝(与 web 一致)
      if (tag === 'INPUT' && inputType === 'file') {
        return fail(
          'PERMISSION_DENIED',
          '文件上传位无法由 AI 代填:浏览器禁止脚本写入本地路径。该元素在快照中 kind=file,请引导用户手动选择文件',
        )
      }
      if (tag === 'INPUT' && (inputType === 'checkbox' || inputType === 'radio')) {
        const raw = p.value
        const want = raw === true || raw === 'true' || raw === 1 || raw === '1'
        if (el.checked !== want) el.click?.()
        return { ok: true, data: { filled: elementLabel(el), value: String(want) } }
      }
      if (tag === 'SELECT') {
        const want = String(p.value ?? '')
        const options = Array.from(el.options ?? [])
        const option = options.find((o) => o.value === want) ?? options.find((o) => o.text === want)
        if (!option) return fail('EXECUTION_FAILED', `下拉框无匹配选项: ${want}`)
        setNativeValue(el, option.value)
        return { ok: true, data: { filled: elementLabel(el), value: option.value } }
      }
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        const raw = p.value
        const text = typeof raw === 'boolean' ? String(raw) : String(raw ?? '')
        const prev = typeof el.value === 'string' && p.clear === false ? el.value : ''
        const next = prev + text
        setNativeValue(el, next)
        return { ok: true, data: { filled: elementLabel(el), value: next } }
      }
      return fail('EXECUTION_FAILED', '目标不是可填写控件')
    }

    case 'submit': {
      const doc = currentDocument()
      if (!doc) return fail('EXECUTION_FAILED', '无 DOM 环境')
      const formParam = typeof p.form === 'string' ? p.form : ''
      let form: ExtDomElement | null = null
      const allForms = toArray(doc.querySelectorAll('form')).filter(isVisibleElement)
      if (formParam) {
        const ref = nodeById.get(formParam)?.deref()
        if (ref) form = ref as ExtDomElement
        else {
          const el = resolveUiTarget(formParam)
          form = el ?? null
        }
      } else {
        form = allForms[0] ?? null
      }
      if (!form) return fail('SELECTOR_NOT_FOUND', '页面上没有可提交的表单')
      const formText = [
        elementLabel(form),
        ...toArray(form.querySelectorAll?.('button, [type="submit"]')).map(
          (b) => b.textContent ?? '',
        ),
      ].join(' ')
      if (DESTRUCTIVE_RE.test(formText))
        return fail('DESTRUCTIVE_BLOCKED', '该操作被识别为破坏性操作,需用户手动执行')
      // requestSubmit 才会走 submit 事件(React onSubmit / 校验),裸 submit() 会绕过
      if (typeof form.requestSubmit === 'function') form.requestSubmit()
      else form.dispatchEvent?.(createDomEvent('submit'))
      return { ok: true, data: { submitted: elementLabel(form) || 'form' } }
    }

    case 'read': {
      const doc = currentDocument()
      if (!doc) return fail('EXECUTION_FAILED', '无 DOM 环境')
      const values: Record<string, string> = {}
      for (const el of collectInteractive(doc)) {
        const v = readElementValue(el)
        if (v === undefined) continue
        values[elementLabel(el) || tagOf(el).toLowerCase()] = v
      }
      const rawText = doc.body?.innerText ?? doc.body?.textContent ?? ''
      const text =
        rawText.length > MAX_READ_TEXT_CHARS
          ? `${rawText.slice(0, MAX_READ_TEXT_CHARS)}…[truncated]`
          : rawText
      return { ok: true, data: { page: currentPageInfo(), text, values } }
    }

    case 'invoke': {
      const name = String(p.name ?? '')
      const cmd = EXT_UI_COMMANDS.find((c) => c.id === name)
      if (cmd) {
        cmd.run()
        return { ok: true, data: { invoked: cmd.id } }
      }
      return fail(
        'UNSUPPORTED_ACTION',
        `扩展面板未登记该命令: ${name}(EXT_UI_COMMANDS 为显式登记表,不伪造命令)`,
      )
    }

    default:
      return fail('UNSUPPORTED_ACTION', `不支持的 ext_ui 动作: ${String(action)}`)
  }
}

// ===== AgentActionRequest → DomActionResult 包装(转发层 glue 用) =====

export function isExtUiRequest(req: AgentActionRequest | null | undefined): boolean {
  return req?.category === 'ext_ui'
}

export function extUiActionFromRequest(req: AgentActionRequest): ExtUiActionType {
  return req.action as ExtUiActionType
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
