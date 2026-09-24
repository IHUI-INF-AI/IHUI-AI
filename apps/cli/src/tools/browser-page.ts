// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 页面语义快照与句柄动作 —— CLI 侧 adapter（CDP）。
 *
 * 为什么单独一个文件而不是往 browser.ts 里加：browser.ts 的那套动词按 **CSS 选择器**
 * 每轮重新解析，本文件那套按**页内活句柄**解析；两套语义混在一个 switch 里，
 * 失败时无法回答"到底是没匹配上，还是引用过期了"。
 *
 * 本端只负责三件事：
 * 1. 把共享包里的页内安装函数注入页面（页面导航后 scope 变化 ⇒ 旧句柄整批作废）；
 * 2. 解析句柄拿到**滚动后**的矩形中心，用 `Input.dispatchMouseEvent` / `Input.insertText`
 *    派发浏览器级真实输入（不是 evaluate 伪造事件）；
 * 3. 把结果标上副作用确定性，供模型决定要不要重试。
 * 快照的采集/预算/字段顺序全在 @ihui/dom-actions，端内不复制第二份规则。
 */
import {
  PAGE_API_GLOBAL_KEY,
  buildPageApiInstallExpression,
  buildPageApiOptions,
  buildSnapshotResult,
  clampPageSnapshotBudget,
  installIhuiPageApi,
  newPageScope,
  outcomeOf,
  snapshotOutcomeOf,
  type IhuiPageApiInstall,
  type PageActionErrorCode,
  type PageSnapshotBudget,
  type PageSnapshotRaw,
} from '@ihui/dom-actions'
import { KEY_MAP, getBrowserSession, type CdpSession } from './browser.js'
import type { Tool } from './index.js'

/**
 * 页内采集上限：页面按它一次采齐，宿主再按本次请求的预算裁。
 * 这样"下一轮要更宽配额"不必重装页内脚本 —— 重装会换 scope，等于把上一轮的句柄全打成废票。
 */
const COLLECT_CEILING: PageSnapshotBudget = {
  maxRows: 300,
  maxRowChars: 600,
  bodyChars: 20000,
  maxBodyBlocks: 200,
  attrsChars: 300,
  labelChars: 300,
}

/** 每条 CDP 会话记录的当前页内 scope（页面一导航就对不上，即触发重装）。 */
const installedScopes = new WeakMap<CdpSession, string>()

interface PageCallFailure {
  __pageError: string
  message?: string
}

function ok(output: string, data?: Record<string, unknown>): { success: true; output: string; data?: Record<string, unknown> } {
  return { success: true, output, ...(data ? { data } : {}) }
}

function fail(
  errorCode: PageActionErrorCode | 'CDP_FAILED',
  message: string,
  extra?: Record<string, unknown>,
): { success: false; output: string; error: string; errorType: string; data: Record<string, unknown> } {
  return {
    success: false,
    // 错误码与原因进 output：模型只看 output，看不到就不认识这个码。
    // `dispatched:false` 与 `sideEffect:'none'` 必须同时给出 —— 这个码族存在的唯一理由，
    // 就是让模型知道"这次没派发任何事件，可以安全重试"。
    output: JSON.stringify({ errorCode, error: message, dispatched: false, sideEffect: 'none', ...extra }),
    error: message,
    errorType: errorCode,
    data: { errorCode, dispatched: false, sideEffect: 'none' as const },
  }
}

/**
 * 调页内 API 的某个方法（参数走 JSON 往返）。
 *
 * 为什么用 `Runtime.evaluate` 的 IIFE 而不是 `Runtime.callFunctionOn`：后者必须带
 * objectId 或 executionContextId 才落得准上下文，而我们只有"这个页面的默认上下文"这一件事
 * 能确定；evaluate 恒作用于当前 target 的默认上下文，少一个会打偏的参数。
 */
async function callPageApi<T>(
  session: CdpSession,
  method: 'snapshot' | 'resolve' | 'act' | 'pick' | 'state',
  args: unknown[],
): Promise<T | PageCallFailure> {
  const expression =
    '(function(){' +
    ` var holder = this[${JSON.stringify(PAGE_API_GLOBAL_KEY)}];` +
    ' if (!holder) return { __pageError: "PAGE_API_UNAVAILABLE", message: "page api not installed" };' +
    ` var args = ${JSON.stringify(JSON.stringify(args))};` +
    ' return holder.api.' + method + '.apply(holder.api, JSON.parse(args));' +
    '})()'
  const res = await session.send<{ result: { value?: T | PageCallFailure }; exceptionDetails?: unknown }>(
    'Runtime.evaluate',
    { expression, returnByValue: true },
    30_000,
  )
  if (res.exceptionDetails) {
    return { __pageError: 'EXECUTION_FAILED', message: JSON.stringify(res.exceptionDetails).slice(0, 300) }
  }
  const value = res.result.value
  if (value === undefined) return { __pageError: 'PAGE_API_UNAVAILABLE', message: 'page api returned nothing' }
  return value
}

function isPageCallFailure(value: unknown): value is PageCallFailure {
  return typeof value === 'object' && value !== null && '__pageError' in value
}

/** 读页内当前 scope（无则 null）。导航后 window 被换，这里必然读不到旧值。 */
async function readInstalledScope(session: CdpSession): Promise<string | null> {
  type ScopeResult = { result: { value?: string | null } }
  const res = await session.send<ScopeResult>(
    'Runtime.evaluate',
    {
      expression: `(function(){var h=this[${JSON.stringify(PAGE_API_GLOBAL_KEY)}];return h?h.scope:null})()`,
      returnByValue: true,
    },
    15_000,
  )
  return typeof res.result.value === 'string' ? res.result.value : null
}

/**
 * 确保页内 API 就位并返回**页内实际生效**的 scope。
 *
 * 为什么不复用宿主自己生成的 nonce：安装函数遇到同版本实例会复用旧的（句柄表不能清空），
 * 于是宿主以为的 scope 与页面里的 scope 可能不同。认页面的那个 —— 否则每一轮句柄都被误判成跨页失效。
 */
async function ensurePageApi(session: CdpSession): Promise<{ scope: string; reinstalled: boolean }> {
  const expected = installedScopes.get(session)
  const current = await readInstalledScope(session)
  if (expected && current === expected) return { scope: current, reinstalled: false }
  const scope = newPageScope()
  const opts = buildPageApiOptions(scope)
  // 注入表达式只在共享包 `buildPageApiInstallExpression` 里装配一次（CLI 与扩展共用同一份）：
  // 端内若自己拼 `(${source})(${json})`，就得自己记得带打包器辅助符 —— 那是"扩展能用、CLI 打偏"的成因。
  const expression = buildPageApiInstallExpression(opts)
  type InstallResult = { result: { value?: IhuiPageApiInstall }; exceptionDetails?: unknown }
  const res = await session.send<InstallResult>(
    'Runtime.evaluate',
    {
      expression,
      returnByValue: true,
    },
    30_000,
  )
  if (res.exceptionDetails || !res.result.value) {
    throw new Error(`page snapshot installer failed: ${JSON.stringify(res.exceptionDetails ?? res.result).slice(0, 300)}`)
  }
  // 页面里若已有同版本实例，安装返回的是**它的** scope；宿主必须改记这个，
  // 否则下一轮拿自己那份 nonce 去解句柄，会把全部句柄判成跨页失效。
  installedScopes.set(session, res.result.value.scope)
  return { scope: res.result.value.scope, reinstalled: true }
}

/** 快照预算入参（模型可传，超上限由共享包 clamp，不报错）。 */
function budgetOf(args: Record<string, unknown>): Partial<Record<keyof PageSnapshotBudget, unknown>> {
  return {
    maxRows: args.max_elements,
    bodyChars: args.max_body_chars,
    maxRowChars: args.max_row_chars,
  }
}

/** 句柄解析 + 真实鼠标点击：CLI 这一侧的动作一律走浏览器级输入事件。 */
async function clickAtHandle(
  session: CdpSession,
  handle: string,
): Promise<{ ok: true; x: number; y: number } | { ok: false; errorCode: PageActionErrorCode; message: string }> {
  const resolved = await callPageApi<Record<string, unknown>>(session, 'resolve', [handle])
  if (isPageCallFailure(resolved)) return { ok: false, errorCode: 'EXECUTION_FAILED', message: resolved.message ?? resolved.__pageError }
  if (resolved.ok !== true) {
    return {
      ok: false,
      errorCode: (typeof resolved.errorCode === 'string' ? resolved.errorCode : 'HANDLE_STALE') as PageActionErrorCode,
      message: typeof resolved.error === 'string' ? resolved.error : 'handle unavailable',
    }
  }
  const detail = (resolved.detail ?? {}) as Record<string, unknown>
  const x = Number(detail.x)
  const y = Number(detail.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { ok: false, errorCode: 'HANDLE_NOT_RENDERED', message: 'no rect centre after scroll' }
  }
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
  return { ok: true, x, y }
}

/**
 * 动作结果的统一出口：把确定性标记交给模型。
 * `none` 只出现在"事件根本没派发"的分支 —— 那才是可以安全重试的。
 */
function actionOutput(
  label: string,
  dispatched: boolean,
  detail?: Record<string, unknown>,
): { text: string; data: Record<string, unknown> } {
  const outcome = outcomeOf({ ok: true, dispatched })
  const data = { ...outcome, ...(detail ? { detail } : {}) }
  return {
    text: `${label} · sideEffect=${outcome.sideEffect} · ${outcome.sideEffectReason}`,
    data: data as unknown as Record<string, unknown>,
  }
}

const browserPageSnapshot: Tool = {
  name: 'browser_page_snapshot',
  description:
    'Take a semantic snapshot of the current page: an actionable-element table (live handles + role + accessible name + value + disabled/checked + viewport flag + parent/iframe path + bounded attrs) plus separately budgeted body text. Handles stay valid across turns until the page navigates.',
  parameters: {
    max_elements: { type: 'number', description: 'Handle quota (default 80, max 300). Independent of body budget.' },
    max_body_chars: { type: 'number', description: 'Body text budget (default 4000). Never consumes handle quota.' },
    max_row_chars: { type: 'number', description: 'Per-row serialization cap (default 200)' },
  },
  required: [],
  dangerLevel: 'read',
  async execute(args) {
    try {
      const { session } = await getBrowserSession()
      await ensurePageApi(session)
      const raw = await callPageApi<PageSnapshotRaw>(session, 'snapshot', [COLLECT_CEILING])
      if (isPageCallFailure(raw)) return fail(raw.__pageError as PageActionErrorCode, raw.message ?? 'snapshot failed')
      const outcome = snapshotOutcomeOf(raw)
      if (!outcome.ok || !outcome.raw) return fail(outcome.errorCode ?? 'EXECUTION_FAILED', outcome.error ?? 'snapshot failed')
      const { result, text } = buildSnapshotResult(outcome.raw, budgetOf(args))
      return ok(text, {
        scope: outcome.raw.scope,
        counts: outcome.raw.counts,
        // 句柄清单取**交付后**的行：页内按采集上限多抓的那些本轮没交出去，
        // 把它们也报给调用方，等于给出一批文本里根本不存在的句柄。
        handles: result.rows.map((row) => row.handle),
      })
    } catch (err) {
      return fail('CDP_FAILED', err instanceof Error ? err.message : String(err))
    }
  },
}

const browserPageClick: Tool = {
  name: 'browser_page_click',
  description:
    'Click a page element by its handle from browser_page_snapshot. The handle is resolved to a live element, scrolled into view, and the click is dispatched at the actual rect centre via CDP Input.dispatchMouseEvent (real browser input, not a synthetic DOM event).',
  parameters: { handle: { type: 'string', description: 'Handle like el:<scope>:<serial>' } },
  required: ['handle'],
  dangerLevel: 'write',
  async execute(args) {
    const handle = typeof args.handle === 'string' ? args.handle : ''
    if (!handle) return fail('PARAM_INVALID', 'handle is required')
    try {
      const { session } = await getBrowserSession()
      await ensurePageApi(session)
      const clicked = await clickAtHandle(session, handle)
      if (!clicked.ok) {
        return fail(clicked.errorCode, clicked.message, { handle, retryable: clicked.errorCode !== 'HANDLE_SCOPE_MISMATCH' })
      }
      const out = actionOutput(`clicked ${handle}`, true, { x: clicked.x, y: clicked.y })
      return ok(out.text, out.data)
    } catch (err) {
      return fail('CDP_FAILED', err instanceof Error ? err.message : String(err))
    }
  },
}

const browserPageType: Tool = {
  name: 'browser_page_type',
  description:
    'Type into a field by handle. Focuses with a real click, optionally clears the field, then inserts text through CDP Input.insertText (so frameworks see genuine input events). Set submit to press Enter afterwards.',
  parameters: {
    handle: { type: 'string', description: 'Target handle' },
    text: { type: 'string', description: 'Text to insert' },
    clear: { type: 'boolean', description: 'Select-all + delete before typing' },
    submit: { type: 'boolean', description: 'Press Enter after typing' },
  },
  required: ['handle', 'text'],
  dangerLevel: 'write',
  async execute(args) {
    const handle = typeof args.handle === 'string' ? args.handle : ''
    const text = typeof args.text === 'string' ? args.text : ''
    if (!handle) return fail('PARAM_INVALID', 'handle is required')
    try {
      const { session } = await getBrowserSession()
      await ensurePageApi(session)
      const focused = await clickAtHandle(session, handle)
      if (!focused.ok) {
        return fail(focused.errorCode, focused.message, { handle })
      }
      if (args.clear === true) {
        await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 })
        await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 })
        await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
        await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
      }
      await session.send('Input.insertText', { text })
      if (args.submit === true) {
        const enter = KEY_MAP['Enter']
      if (!enter) return fail('PARAM_INVALID', 'Enter key mapping missing')
        await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: enter.code, windowsVirtualKeyCode: enter.vk })
        await session.send('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', code: enter.code, windowsVirtualKeyCode: enter.vk, text: enter.text ?? '\r' })
        await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: enter.code, windowsVirtualKeyCode: enter.vk })
      }
      const out = actionOutput(`typed ${text.length} chars into ${handle}`, true)
      return ok(out.text, out.data)
    } catch (err) {
      return fail('CDP_FAILED', err instanceof Error ? err.message : String(err))
    }
  },
}

const browserPagePressKey: Tool = {
  name: 'browser_page_press_key',
  description:
    'Press one supported key (Enter/Tab/Escape/Backspace/…) on the element behind a handle. The element is focused by a real click first.',
  parameters: {
    handle: { type: 'string', description: 'Target handle' },
    key: { type: 'string', description: 'Key name from the supported list' },
  },
  required: ['handle', 'key'],
  dangerLevel: 'write',
  async execute(args) {
    const handle = typeof args.handle === 'string' ? args.handle : ''
    const key = typeof args.key === 'string' ? args.key : ''
    if (!handle) return fail('PARAM_INVALID', 'handle is required')
    const mapped = KEY_MAP[key]
    if (!mapped) {
      return fail('PARAM_INVALID', `unsupported key: ${key}. Supported: ${Object.keys(KEY_MAP).join(', ')}`)
    }
    try {
      const { session } = await getBrowserSession()
      await ensurePageApi(session)
      const focused = await clickAtHandle(session, handle)
      if (!focused.ok) return fail(focused.errorCode, focused.message, { handle })
      await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: mapped.code, windowsVirtualKeyCode: mapped.vk })
      if (mapped.text) {
        await session.send('Input.dispatchKeyEvent', { type: 'char', key, code: mapped.code, windowsVirtualKeyCode: mapped.vk, text: mapped.text, unmodifiedText: mapped.text })
      }
      await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: mapped.code, windowsVirtualKeyCode: mapped.vk })
      const out = actionOutput(`pressed ${key} on ${handle}`, true)
      return ok(out.text, out.data)
    } catch (err) {
      return fail('CDP_FAILED', err instanceof Error ? err.message : String(err))
    }
  },
}

const browserPagePickAtPoint: Tool = {
  name: 'browser_page_pick_at_point',
  description:
    'Fallback verb: hit-test a viewport coordinate and mint a fresh handle for the element found there. Use it when handles went stale (page navigated) or when you only know the position from a screenshot.',
  parameters: {
    x: { type: 'number', description: 'Viewport x' },
    y: { type: 'number', description: 'Viewport y' },
  },
  required: ['x', 'y'],
  dangerLevel: 'read',
  async execute(args) {
    const x = Number(args.x)
    const y = Number(args.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('PARAM_INVALID', 'x and y must be numbers')
    try {
      const { session } = await getBrowserSession()
      await ensurePageApi(session)
      const picked = await callPageApi<Record<string, unknown>>(session, 'pick', [x, y, COLLECT_CEILING])
      if (isPageCallFailure(picked)) return fail('EXECUTION_FAILED', picked.message ?? 'pick failed')
      if (picked.ok !== true) {
        return fail(
          (typeof picked.errorCode === 'string' ? picked.errorCode : 'NO_ELEMENT_AT_POINT') as PageActionErrorCode,
          typeof picked.error === 'string' ? picked.error : 'no element at point',
          { x, y },
        )
      }
      const detail = (picked.detail ?? {}) as Record<string, unknown>
      return ok(`fresh handle ${String(detail.handle)} · ${String(detail.role)} "${String(detail.name ?? '')}"`, {
        handle: detail.handle,
        role: detail.role,
        name: detail.name,
        rect: detail.rect,
        sideEffect: 'none' as const,
      })
    } catch (err) {
      return fail('CDP_FAILED', err instanceof Error ? err.message : String(err))
    }
  },
}

/** 句柄族工具集（由 browser.ts 并入 BROWSER_TOOLS 注册面）。 */
export const BROWSER_PAGE_TOOLS: Tool[] = [
  browserPageSnapshot,
  browserPageClick,
  browserPageType,
  browserPagePressKey,
  browserPagePickAtPoint,
]

/** 供测试与后续端复用：安装入口与预算钳制都在共享包，这里只做再导出。 */
export const __pageSnapshotInternals__ = { ensurePageApi, installIhuiPageApi, clampPageSnapshotBudget }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
