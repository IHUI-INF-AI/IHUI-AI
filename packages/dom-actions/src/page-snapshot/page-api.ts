// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 页内执行体：安装"语义快照 + 活句柄"API 到 document 所属窗口。
 *
 * 为什么写成"可注入函数"而不是普通模块导出：CLI 侧没有 DOM，只能经 CDP
 * `Runtime.callFunctionOn` 把函数体送进页面执行；扩展侧则直接 import 调用。
 * 两条路共用同一份实现，句柄语义才不会两端各漂移一份。
 *
 * 硬约束（改本文件前必读）：
 * 1. `installIhuiPageApi` 的**函数体内不得引用任何模块作用域标识符** —— 注入时取的是
 *    `Function.prototype.toString()`，闭包外的东西到了页面里一律是 undefined。
 *    需要共享的值一律经 `opts` 传入；返回值必须是纯数据（CDP 要序列化它）。
 *    注意打包器注入的辅助符（esbuild keepNames 的 `__name` 等）**也属这一类**：它们声明在模块作用域，
 *    所以注入表达式必须由 `./install-expression.js` 的 `buildPageApiInstallExpression()` 统一装配
 *    （它按实测自带辅助符），宿主不得自己拼 `(${source})(...)`。
 * 2. 预算**按调用传入**，不在安装期固化：否则"第二次要更宽预算"只能重装 API，
 *    而重装会换掉 scope、把上一轮所有句柄打成废票 —— 那是比预算更贵的代价。
 */
import {
  PAGE_API_GLOBAL_KEY,
  PAGE_ATTR_WHITELIST,
  PAGE_HANDLE_PREFIX,
  PAGE_HANDLE_SCOPE_LENGTH,
  PAGE_SNAPSHOT_SCHEMA,
  type PageActionErrorCode,
  type PageActionRaw,
  type PageElementRow,
  type PageSnapshotBudget,
  type PageSnapshotRaw,
} from './contract.js'

/** 页内 API 实例。 */
export interface IhuiPageApi {
  scope: string
  schema: number
  snapshot(budget: PageSnapshotBudget): PageSnapshotRaw
  /** 解析句柄 → 滚动到可见 → 回报**滚动后**的矩形中心（宿主据此派发真实输入） */
  resolve(handle: unknown): PageActionRaw
  act(
    action: string,
    handle: unknown,
    params: Record<string, unknown>,
    budget: PageSnapshotBudget,
  ): PageActionRaw
  pick(x: unknown, y: unknown, budget: PageSnapshotBudget): PageActionRaw
  state(): { handles: number; nextSerial: number }
}

/** 挂在 window 上的记录（宿主按它取回 api，不依赖安装的返回值）。 */
export interface IhuiPageApiHolder {
  schema: number
  scope: string
  api: IhuiPageApi
}

/** 安装摘要：纯数据，可跨 CDP 边界回传。 */
export interface IhuiPageApiInstall {
  installed: boolean
  scope: string
  schema: number
  reused: boolean
}

/** 注入选项：契约值由宿主传入，页内不自抄字面量。 */
export interface IhuiPageApiOptions {
  globalKey: string
  prefix: string
  scope: string
  schema: number
  interactiveSelector: string
  bodySelector: string
  attrWhitelist: string[]
}

/** 扫描面：哪些元素算"可交互"。刻意不含 class/style 之类无语义容器。 */
export const PAGE_INTERACTIVE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'details',
  'iframe',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="searchbox"]',
  '[role="textbox"]',
  '[role="option"]',
  '[onclick]',
  '[contenteditable="true"]',
  '[tabindex]',
].join(',')

/** 正文语义块来源：只收"读起来像文章"的节点，不收与句柄抢配额的控件文本。 */
export const PAGE_BODY_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, figcaption, blockquote, article'

/* eslint-disable no-var */

/**
 * 安装页内 API。同 schema 已装过则复用（句柄表不得清空，否则上一轮句柄全废），
 * 版本不符则替换 —— 替换即宣告旧句柄整批失效，由 scope 不同体现到错误码上。
 */
export function installIhuiPageApi(opts: IhuiPageApiOptions): IhuiPageApiInstall {
  var globalKey = opts.globalKey
  var prefix = opts.prefix
  var scope = opts.scope
  var schema = opts.schema
  var interactiveSelector = opts.interactiveSelector
  var bodySelector = opts.bodySelector
  var attrWhitelist = opts.attrWhitelist

  var holder = globalThis as unknown as Record<string, IhuiPageApiHolder | undefined>
  var existing = holder[globalKey]
  if (existing && existing.schema === schema) {
    return { installed: true, scope: existing.scope, schema, reused: true }
  }

  // 句柄 ↔ 元素。WeakMap 保证同一元素跨多轮快照拿到**同一个**句柄（这就是"句柄稳定"的定义）；
  // WeakRef 保证元素被页面移除后不因我们的登记表而泄漏。
  var handleOf = new WeakMap<Element, string>()
  var refOf = new Map<string, WeakRef<Element>>()
  var nextSerial = 0

  function ensureHandle(el: Element): string {
    var known = handleOf.get(el)
    if (known) return known
    var serial = nextSerial
    nextSerial = nextSerial + 1
    var handle = prefix + ':' + scope + ':' + serial.toString(36)
    handleOf.set(el, handle)
    refOf.set(handle, new WeakRef(el))
    return handle
  }

  function fail(code: PageActionErrorCode, message: string): PageActionRaw {
    return { ok: false, errorCode: code, error: message, dispatched: false }
  }

  function lookup(handle: unknown): { el?: Element; failure?: PageActionRaw } {
    if (typeof handle !== 'string') {
      return { failure: fail('HANDLE_MALFORMED', 'handle 必须是字符串') }
    }
    var parts = handle.split(':')
    if (parts.length !== 3 || parts[0] !== prefix || !parts[1] || !parts[2]) {
      return { failure: fail('HANDLE_MALFORMED', '句柄格式不符 ' + prefix + ':<scope>:<serial>') }
    }
    if (parts[1] !== scope) {
      return { failure: fail('HANDLE_SCOPE_MISMATCH', '页面实例已更换（导航或整树重建），须重拍快照') }
    }
    var ref = refOf.get(handle)
    var el = ref ? ref.deref() : undefined
    if (!el || !el.isConnected) {
      return { failure: fail('HANDLE_STALE', '该句柄指向的元素已被移除') }
    }
    return { el: el }
  }

  function collapse(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
  }

  function bound(value: string, max: number): string {
    if (value.length <= max) return value
    return value.slice(0, Math.max(1, max - 1)) + '…'
  }

  function visible(el: Element): boolean {
    var html = el as HTMLElement
    if (html.hidden) return false
    if ((html.getAttribute('type') || '').toLowerCase() === 'hidden') return false
    var style = window.getComputedStyle(html)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (Number.parseFloat(style.opacity || '1') === 0) return false
    return true
  }

  var ROLE_BY_INPUT_TYPE: Record<string, string> = {
    text: 'textbox',
    search: 'searchbox',
    email: 'textbox',
    tel: 'textbox',
    url: 'textbox',
    password: 'textbox',
    number: 'spinbutton',
    date: 'textbox',
    'datetime-local': 'textbox',
    month: 'textbox',
    week: 'textbox',
    time: 'textbox',
    color: 'textbox',
    file: 'button',
    checkbox: 'checkbox',
    radio: 'radio',
    range: 'slider',
    button: 'button',
    submit: 'button',
    reset: 'button',
    image: 'button',
  }

  function roleOf(el: Element): string {
    var explicit = el.getAttribute('role')
    if (explicit) return collapse(explicit).split(' ')[0] || 'generic'
    var tag = el.tagName.toLowerCase()
    if (tag === 'a' || tag === 'area') return 'link'
    if (tag === 'button' || tag === 'summary') return 'button'
    if (tag === 'select') return el.hasAttribute('multiple') ? 'listbox' : 'combobox'
    if (tag === 'textarea') return 'textbox'
    if (tag === 'input') {
      return ROLE_BY_INPUT_TYPE[(el.getAttribute('type') || 'text').toLowerCase()] || 'textbox'
    }
    if (tag === 'iframe') return 'frame'
    if (tag === 'option') return 'option'
    if (tag === 'details') return 'group'
    if ((el as HTMLElement).isContentEditable) return 'textbox'
    return tag
  }

  function textOf(el: Element): string {
    var html = el as HTMLElement
    var inner = typeof html.innerText === 'string' ? html.innerText : ''
    return collapse(inner.length > 0 ? inner : html.textContent || '')
  }

  /**
   * 可访问名：脱离上下文必须自证成立，故顺序为
   * aria-labelledby → aria-label → label[for]/包裹 label → 控件面值 → placeholder → alt → 自身文本。
   * 刻意不取 title —— 本仓 §4 禁用原生提示窗，页面里的 title 不是给人看的名字。
   */
  function nameOf(el: Element): string {
    var doc = el.ownerDocument || document
    var labelledby = el.getAttribute('aria-labelledby')
    if (labelledby) {
      var parts: string[] = []
      for (var i = 0; i < labelledby.split(/\s+/).length; i++) {
        var id = labelledby.split(/\s+/)[i]
        var node = id ? doc.getElementById(id) : null
        if (node) parts.push(textOf(node))
      }
      var joined = collapse(parts.join(' '))
      if (joined) return joined
    }
    var ariaLabel = el.getAttribute('aria-label')
    if (ariaLabel && collapse(ariaLabel)) return collapse(ariaLabel)
    if (el.id) {
      var escaped = el.id.replace(/["\\]/g, '\\$&')
      var explicit = doc.querySelector('label[for="' + escaped + '"]')
      if (explicit) return textOf(explicit)
    }
    var wrapping = el.closest('label')
    if (wrapping) return textOf(wrapping)
    var tag = el.tagName.toLowerCase()
    if (tag === 'input') {
      var input = el as HTMLInputElement
      var type = (input.getAttribute('type') || 'text').toLowerCase()
      if (type === 'submit' || type === 'button' || type === 'reset') {
        var faceValue = collapse(input.value || '')
        if (faceValue) return faceValue
      }
    }
    var placeholder = el.getAttribute('placeholder')
    if (placeholder && collapse(placeholder)) return collapse(placeholder)
    var alt = el.getAttribute('alt')
    if (alt && collapse(alt)) return collapse(alt)
    var own = textOf(el)
    if (own) return own
    var control = el.closest('a[href],button,[role],input,select,textarea,[onclick]')
    return control && control !== el ? textOf(control) : ''
  }

  function valueOf(el: Element, budget: PageSnapshotBudget): string | undefined {
    var tag = el.tagName.toLowerCase()
    if (tag === 'select') {
      var select = el as HTMLSelectElement
      var option = select.options[select.selectedIndex]
      return option ? collapse(option.text) || option.value : ''
    }
    if (tag === 'textarea' || tag === 'input') {
      var input = el as HTMLInputElement
      if ((input.getAttribute('type') || '').toLowerCase() === 'password') {
        return input.value ? '***' : ''
      }
      return collapse(input.value || '')
    }
    if ((el as HTMLElement).isContentEditable) return bound(textOf(el), budget.labelChars)
    return undefined
  }

  function stateOf(el: Element): { disabled?: boolean; checked?: boolean } {
    var out: { disabled?: boolean; checked?: boolean } = {}
    var field = el as HTMLInputElement
    if (field.disabled === true || el.getAttribute('aria-disabled') === 'true') out.disabled = true
    var role = roleOf(el)
    if (role === 'checkbox' || role === 'radio' || role === 'switch' || el.hasAttribute('aria-checked')) {
      if (typeof field.checked === 'boolean') out.checked = field.checked
      else {
        var ariaChecked = el.getAttribute('aria-checked')
        if (ariaChecked === 'true') out.checked = true
        else if (ariaChecked === 'false') out.checked = false
      }
    }
    return out
  }

  /** 有界属性集：白名单键 + 每值 60 字符 + 每行 attrsChars 总预算，先到先止。 */
  function attrsOf(el: Element, budget: PageSnapshotBudget): Record<string, string> | undefined {
    var out: Record<string, string> = {}
    var used = 0
    var list = el.attributes
    for (var i = 0; i < list.length; i++) {
      var name = list[i]!.name.toLowerCase()
      if (attrWhitelist.indexOf(name) < 0) continue
      var value = list[i]!.value || ''
      if (value.indexOf('javascript:') === 0) value = 'javascript:'
      var clipped = bound(collapse(value), 60)
      if (!clipped) continue
      var cost = name.length + clipped.length + 2
      if (used + cost > budget.attrsChars) break
      out[name] = clipped
      used = used + cost
    }
    return Object.keys(out).length > 0 ? out : undefined
  }

  /**
   * 矩形换算到**顶层窗口视口坐标**：同源 iframe 里的元素若按自身文档坐标派发，
   * 宿主按视口坐标点击必然打偏（iframe 有偏移时 100% 错）。
   */
  function rectOf(el: Element): [number, number, number, number] {
    var box = el.getBoundingClientRect()
    var x = box.left
    var y = box.top
    var view = el.ownerDocument ? el.ownerDocument.defaultView : null
    var guard = 0
    while (view && view !== window && guard < 10) {
      var owner = view.frameElement
      if (!owner) break
      var ownerBox = owner.getBoundingClientRect()
      x = x + ownerBox.left
      y = y + ownerBox.top
      view = owner.ownerDocument ? owner.ownerDocument.defaultView : null
      guard = guard + 1
    }
    return [
      Math.round(x),
      Math.round(y),
      Math.round(Math.max(box.width, 0)),
      Math.round(Math.max(box.height, 0)),
    ]
  }

  function inViewportOf(rect: [number, number, number, number]): boolean {
    return (
      rect[1] + rect[3] > 0 &&
      rect[1] < window.innerHeight &&
      rect[0] + rect[2] > 0 &&
      rect[0] < window.innerWidth
    )
  }

  function depthOf(el: Element): number {
    var depth = 0
    var node: Element | null = el
    while (node && node.parentElement && depth < 40) {
      node = node.parentElement
      depth = depth + 1
    }
    return depth
  }

  var BODY_SKIP_TAGS = ['nav', 'footer', 'aside', 'header', 'form', 'script', 'style', 'noscript']

  function collectRows(
    doc: Document,
    framePath: string,
    rows: PageElementRow[],
    counter: { found: number; cross: number; frames: number },
    budget: PageSnapshotBudget,
  ): void {
    var nodes = Array.prototype.slice.call(doc.querySelectorAll(interactiveSelector)) as Element[]
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]!
      if (el.tagName.toLowerCase() === 'iframe') {
        var childDoc: Document | null = null
        try {
          childDoc = (el as HTMLIFrameElement).contentDocument
        } catch {
          childDoc = null
        }
        if (childDoc) {
          var index = counter.frames
          counter.frames = counter.frames + 1
          collectRows(
            childDoc,
            framePath === '' ? String(index) : framePath + '/' + index,
            rows,
            counter,
            budget,
          )
          continue
        }
        counter.cross = counter.cross + 1
      }
      if (!visible(el)) continue
      counter.found = counter.found + 1
      // 配额吃紧时**只停止出行，不停止计数**：宿主要靠 found/emitted 的差额判断还有多少没看见。
      if (rows.length >= budget.maxRows) continue
      var handle = ensureHandle(el)
      var row: PageElementRow = { handle: handle, role: roleOf(el) }
      var name = bound(nameOf(el), budget.labelChars)
      if (name) row.name = name
      var text = bound(textOf(el), budget.labelChars)
      if (text && text !== name) row.text = text
      var value = valueOf(el, budget)
      if (typeof value === 'string' && value !== '' && value !== name && value !== text) {
        row.value = bound(value, budget.labelChars)
      }
      var state = stateOf(el)
      if (state.disabled) row.disabled = true
      if (typeof state.checked === 'boolean') row.checked = state.checked
      var parentElement = el.parentElement
      var parentHandle = parentElement ? handleOf.get(parentElement) : undefined
      if (parentHandle) row.parent = parentHandle
      if (framePath !== '') row.frame = framePath
      var rect = rectOf(el)
      row.inViewport = inViewportOf(rect)
      row.depth = depthOf(el)
      var attrs = attrsOf(el, budget)
      if (attrs) row.attrs = attrs
      row.rect = rect
      rows.push(row)
    }
  }

  /** 最近的前置标题：让模型知道这段正文在讲什么，而不只是一串字符。 */
  function headingOf(el: Element): string | undefined {
    var node: Element | null = el
    var guard = 0
    while (node && guard < 30) {
      var sibling = node.previousElementSibling
      while (sibling && guard < 30) {
        var tag = sibling.tagName.toLowerCase()
        if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
          return bound(textOf(sibling), 60)
        }
        sibling = sibling.previousElementSibling
        guard = guard + 1
      }
      node = node.parentElement
      guard = guard + 1
    }
    return undefined
  }

  function collectBody(
    doc: Document,
    blocks: PageSnapshotRaw['body'],
    counter: { chars: number; found: number },
    budget: PageSnapshotBudget,
  ): void {
    var nodes = Array.prototype.slice.call(doc.querySelectorAll(bodySelector)) as Element[]
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]!
      var tag = el.tagName.toLowerCase()
      if (BODY_SKIP_TAGS.indexOf(tag) >= 0) continue
      if (!visible(el)) continue
      var text = collapse(el.textContent || '')
      // 短文本（列表项里的按钮标签、单个词）属句柄面，不该占正文预算。
      if (text.length < 12) continue
      // 落在可交互元素内部的文本由那一行负责，不重复占正文。
      if (el.closest(interactiveSelector)) continue
      counter.found = counter.found + text.length
      if (counter.chars >= budget.bodyChars || blocks.length >= budget.maxBodyBlocks) continue
      var room = budget.bodyChars - counter.chars
      var heading = headingOf(el)
      var clipped = bound(text, Math.max(0, room - (heading ? heading.length + 2 : 0)))
      if (!clipped) continue
      counter.chars = counter.chars + clipped.length
      blocks.push(heading ? { text: clipped, heading: heading } : { text: clipped })
    }
  }

  function snapshot(budget: PageSnapshotBudget): PageSnapshotRaw {
    var rows: PageElementRow[] = []
    var blocks: PageSnapshotRaw['body'] = []
    var counter = { found: 0, cross: 0, frames: 0 }
    var bodyCounter = { chars: 0, found: 0 }
    collectRows(document, '', rows, counter, budget)
    collectBody(document, blocks, bodyCounter, budget)
    return {
      schema: schema,
      scope: scope,
      title: collapse(document.title || ''),
      url: typeof location === 'undefined' ? '' : location.href,
      rows: rows,
      body: blocks,
      counts: {
        interactiveFound: counter.found,
        rowsEmitted: rows.length,
        bodyCharsFound: bodyCounter.found,
        bodyCharsEmitted: bodyCounter.chars,
        crossOriginFrames: counter.cross,
      },
    }
  }

  /**
   * 滚动到可见后**重新量一次**矩形：滚动前量到的坐标在滚动完成即失效，
   * 拿旧坐标派发是这一族工具最常见的打偏原因。
   */
  function resolve(handle: unknown): PageActionRaw {
    var found = lookup(handle)
    if (found.failure) return found.failure
    var el = found.el as Element
    el.scrollIntoView({ block: 'center', inline: 'nearest' })
    var rect = rectOf(el)
    if (rect[2] <= 0 || rect[3] <= 0) {
      return fail('HANDLE_NOT_RENDERED', '元素无可点击矩形（可能未展开或在折叠容器内）')
    }
    return {
      ok: true,
      dispatched: false,
      detail: {
        x: rect[0] + rect[2] / 2,
        y: rect[1] + rect[3] / 2,
        w: rect[2],
        h: rect[3],
        inViewport: inViewportOf(rect),
        role: roleOf(el),
        name: nameOf(el),
      },
    }
  }

  function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    var proto =
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    var setter = Object.getOwnPropertyDescriptor(proto, 'value')
    var write = setter ? setter.set : undefined
    if (write) write.call(el, value)
    else el.value = value
  }

  /** 完整指针序列：只发 click 会漏掉一切监听 pointerdown/mousedown 的框架代码。 */
  function pointerSequence(el: Element, x: number, y: number): void {
    var target = document.elementFromPoint(x, y) || el
    var base = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }
    target.dispatchEvent(new MouseEvent('mouseover', base))
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }))
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }))
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }))
  }

  /**
   * 页内动作派发（供 content script 这类"没有浏览器级输入通道"的端使用）。
   * `dispatched` 是宿主判 sideEffect 的唯一依据：为真即 uncertain，绝不自称无副作用。
   */
  function act(
    action: string,
    handle: unknown,
    params: Record<string, unknown>,
    budget: PageSnapshotBudget,
  ): PageActionRaw {
    if (typeof action !== 'string' || action === '') return fail('PARAM_INVALID', '缺少 action')
    var found = lookup(handle)
    if (found.failure) return found.failure
    var el = found.el as HTMLElement
    if (action === 'page_hover') {
      var hoverRect = rectOf(el)
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }))
      el.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          view: window,
          clientX: hoverRect[0] + hoverRect[2] / 2,
          clientY: hoverRect[1] + hoverRect[3] / 2,
        }),
      )
      return { ok: true, dispatched: true }
    }
    if (action === 'page_click') {
      var box = el.getBoundingClientRect()
      pointerSequence(el, box.left + box.width / 2, box.top + box.height / 2)
      return { ok: true, dispatched: true }
    }
    if (action === 'page_select') {
      if (el.tagName.toLowerCase() !== 'select') return fail('TARGET_NOT_SELECTABLE', '目标不是 <select>')
      var wanted = typeof params.value === 'string' ? params.value : ''
      var select = el as HTMLSelectElement
      var matched: HTMLOptionElement | undefined
      for (var i = 0; i < select.options.length; i++) {
        var option = select.options[i]!
        if (option.value === wanted || collapse(option.text) === wanted) {
          matched = option
          break
        }
      }
      if (!matched) return fail('EXECUTION_FAILED', '未找到该选项：' + wanted)
      select.value = matched.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return { ok: true, dispatched: true, detail: { selected: matched.value } }
    }
    if (action === 'page_type' || action === 'page_press_key') {
      var editable =
        el.tagName.toLowerCase() === 'input' ||
        el.tagName.toLowerCase() === 'textarea' ||
        (el as HTMLElement).isContentEditable
      if (!editable) return fail('TARGET_NOT_EDITABLE', '目标不是可输入控件')
      if (typeof el.focus === 'function') el.focus()
      if (action === 'page_press_key') {
        var key = typeof params.key === 'string' ? params.key : ''
        if (!key) return fail('PARAM_INVALID', '缺少 key')
        var keyCode = Number(params.keyCode) || 0
        el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: key, code: key, keyCode: keyCode }))
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: key, code: key, keyCode: keyCode }))
        return { ok: true, dispatched: true, detail: { key: key } }
      }
      var input = el as HTMLInputElement
      if (el.tagName.toLowerCase() === 'input' && (input.type === 'checkbox' || input.type === 'radio')) {
        var next = typeof params.checked === 'boolean' ? params.checked : !input.checked
        input.checked = next
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        return { ok: true, dispatched: true, detail: { checked: input.checked } }
      }
      var field = el as HTMLInputElement | HTMLTextAreaElement
      var text = typeof params.text === 'string' ? params.text : ''
      if (params.clear === true) {
        if ((el as HTMLElement).isContentEditable) el.textContent = ''
        else setNativeValue(field, '')
      }
      if ((el as HTMLElement).isContentEditable) {
        el.textContent = (el.textContent || '') + text
      } else {
        setNativeValue(field, field.value + text)
      }
      field.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
      if (params.submit === true) {
        el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13 }))
        var form = el.closest('form')
        if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      }
      var after = (el as HTMLElement).isContentEditable ? textOf(el) : field.value
      return {
        ok: true,
        dispatched: true,
        detail: { length: text.length, value: bound(collapse(after || ''), budget.labelChars) },
      }
    }
    return fail('PARAM_INVALID', '未知动作：' + action)
  }

  /**
   * 坐标反查兜底动词：句柄体系失效（快照过期、动态列表重排）时，模型仍能凭截图报坐标
   * 拿到**一个新句柄**，而不是退回每轮用选择器重解析。
   */
  function pick(x: unknown, y: unknown, budget: PageSnapshotBudget): PageActionRaw {
    var px = Number(x)
    var py = Number(y)
    if (!Number.isFinite(px) || !Number.isFinite(py)) return fail('PARAM_INVALID', '坐标必须是数字')
    if (px < 0 || py < 0 || px > window.innerWidth || py > window.innerHeight) {
      return fail('COORD_OUT_OF_BOUNDS', '坐标不在视口内')
    }
    var hit = document.elementFromPoint(px, py)
    if (!hit) return fail('NO_ELEMENT_AT_POINT', '该坐标没有元素')
    var control = hit.closest(interactiveSelector)
    if (!control) return fail('NO_ELEMENT_AT_POINT', '该坐标不是可交互元素')
    return {
      ok: true,
      dispatched: false,
      detail: {
        handle: ensureHandle(control),
        role: roleOf(control),
        name: bound(nameOf(control), budget.labelChars),
        rect: rectOf(control),
      },
    }
  }

  function state(): { handles: number; nextSerial: number } {
    return { handles: refOf.size, nextSerial: nextSerial }
  }

  holder[globalKey] = {
    schema: schema,
    scope: scope,
    api: { scope: scope, schema: schema, snapshot: snapshot, resolve: resolve, act: act, pick: pick, state: state },
  }
  return { installed: true, scope: scope, schema: schema, reused: false }
}

/* eslint-enable no-var */

/**
 * 注入用的函数字符串（CLI 经 CDP `Runtime.callFunctionOn` 的 functionDeclaration 传入）。
 * 取 `.toString()` 而非手抄第二份实现：两端一旦分叉，症状是"扩展好的、CLI 坏的"，最难查。
 *
 * ⚠️ 这条路子有一条固有约束：**注入源必须自足**。函数体里不得闭包模块作用域的任何东西
 * （常量、工具函数、导入名一律不行，共享值只能经 `opts` 传），否则到了页面里就是 undefined；
 * 而打包器还会往源文本里注入自己的辅助符（esbuild keepNames 的 `__name` 等），那些名字同样住在模块作用域。
 * 因此**宿主侧不得直接把本函数的返回值拼进表达式**，必须走
 * `buildPageApiInstallExpression()`（见 `./install-expression.js`）—— 它按当次源码实测把所需辅助符
 * 一并带进包裹作用域，并且是 CLI 与扩展共用的唯一装配点。
 */
export function pageApiInstallerSource(): string {
  return installIhuiPageApi.toString()
}

/** 宿主侧统一装配注入参数（契约值只在这里喂给页内）。 */
export function buildPageApiOptions(scope: string): IhuiPageApiOptions {
  return {
    globalKey: PAGE_API_GLOBAL_KEY,
    prefix: PAGE_HANDLE_PREFIX,
    scope: scope,
    schema: PAGE_SNAPSHOT_SCHEMA,
    interactiveSelector: PAGE_INTERACTIVE_SELECTOR,
    bodySelector: PAGE_BODY_SELECTOR,
    attrWhitelist: PAGE_ATTR_WHITELIST.slice(),
  }
}

/** scope nonce：够短以便随行展示，够长以避免同页两次安装相撞。 */
export function newPageScope(): string {
  const pool = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < PAGE_HANDLE_SCOPE_LENGTH; i++) {
    out += pool[Math.floor(Math.random() * pool.length)]
  }
  return out
}

/** 页内取回已安装的 API（宿主端用，不参与注入）。 */
export function getIhuiPageApi(): IhuiPageApiHolder | null {
  if (typeof document === 'undefined') return null
  const holder = globalThis as unknown as Record<string, IhuiPageApiHolder | undefined>
  const existing = holder[PAGE_API_GLOBAL_KEY]
  if (!existing || existing.schema !== PAGE_SNAPSHOT_SCHEMA) return null
  return existing
}

/**
 * 主动作废页内 API（页面切语言/整树重建后端上调，或测试隔离用）。
 * 旧句柄随之整批判 HANDLE_SCOPE_MISMATCH —— 这是设计意图，不是副作用。
 */
export function disposeIhuiPageApi(): void {
  if (typeof document === 'undefined') return
  const holder = globalThis as unknown as Record<string, IhuiPageApiHolder | undefined>
  delete holder[PAGE_API_GLOBAL_KEY]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
