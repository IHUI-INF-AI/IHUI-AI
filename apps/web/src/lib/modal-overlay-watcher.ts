// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模态遮罩检测器:给桌面端自绘窗口按钮提供"等效压暗"颜色(2026-09-22 立)。
 *
 * 为什么要检测而不是让遮罩直接盖住按钮:窗口按钮容器挂 z-max=10003 是硬约束
 * (必须高过 8 方向 resize 抓手 z-loading=10000,否则右上角拖不动窗口),而全站模态
 * 遮罩只有 z-modal=2000,顶栏外层又不形成 stacking context → 10003 直接和 2000 比大小,
 * 遮罩在 DOM 上永远盖不到按钮(登录窗打开时三个按钮仍全亮,同族第 3 次复发)。
 *
 * 为什么颜色必须 DOM 实测而不是写死 bg-black/80:全屏遮罩有 29+ 处且底色各不相同
 * (bg-black/80、bg-black/40、bg-white/40、不透明 bg-background、ImageViewer bg-black/90),
 * 尤其 ui-react Sheet 浅色模式是 bg-white/80(遮罩语义是"变亮"),写死黑色会把顶栏压成黑块。
 */

export interface ModalDimState {
  readonly active: boolean
  readonly color: string | null
}

/** z-modal=2000 起算(含 TagsView 的 z-popover=2001 半透明遮罩)。 */
const MIN_OVERLAY_Z_INDEX = 2000
/** 低于此 alpha 的遮罩肉眼无压暗效果,不跟着变暗避免"看着没变但按钮灰了"。 */
const MIN_OVERLAY_ALPHA = 0.05
const MIN_VIEWPORT_COVERAGE = 0.98
const DIM_MARKER_SELECTOR = '[data-window-controls-dim]'
const FIXED_LAYER_SELECTOR = '[class~="fixed"][class~="inset-0"]'
const ABSOLUTE_LAYER_SELECTOR = '[class~="absolute"][class~="inset-0"]'

interface QueryableRoot {
  querySelectorAll(selectors: string): ArrayLike<Element>
}

function currentDocument(): Document | null {
  return typeof document === 'undefined' ? null : document
}

function colorBody(color: string | null | undefined): string | null {
  const raw = (color ?? '').trim().toLowerCase()
  if (!raw || raw === 'transparent') return null
  const open = raw.indexOf('(')
  const close = raw.lastIndexOf(')')
  if (open < 0 || close <= open) return null
  const body = raw.slice(open + 1, close).trim()
  return body.length > 0 ? body : null
}

function alphaFromToken(token: string): number {
  const raw = token.trim()
  if (raw === 'none') return 1
  const value = raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw)
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 1)
}

/** 解析 computed background-color 的 alpha;语法解析不出来一律视为 0(不压暗)。 */
function readAlpha(color: string | null | undefined): number {
  const body = colorBody(color)
  if (!body) return 0
  const slash = body.indexOf('/')
  if (slash >= 0) return alphaFromToken(body.slice(slash + 1))
  // 无斜杠语法:rgba(r, g, b, a) 的 alpha 落在第 4 个数值分量上。
  // 先滤掉非数值 token(color(srgb 0 0 0) 的染色空间名),否则分量数会被算错。
  const values = body.split(/[,/\s]+/).filter(isColorValue)
  if (values.length < 3) return 0
  const alphaToken = values[3]
  return alphaToken === undefined ? 1 : alphaFromToken(alphaToken)
}

function isColorValue(token: string): boolean {
  return token === 'none' || token.endsWith('%') || Number.isFinite(Number(token))
}

/** computed z-index 数值化(auto / NaN 视为 0)。 */
function readZIndex(raw: string | null | undefined): number {
  const value = Number((raw ?? '').trim())
  return Number.isFinite(value) ? value : 0
}

function computedOf(el: Element): CSSStyleDeclaration | null {
  const view = el.ownerDocument?.defaultView
  return view ? view.getComputedStyle(el) : null
}

function coversViewport(el: Element): boolean {
  const view = el.ownerDocument?.defaultView
  if (!view) return false
  const width = view.innerWidth
  const height = view.innerHeight
  if (width <= 0 || height <= 0) return false
  const rect = el.getBoundingClientRect()
  return (
    rect.width >= width * MIN_VIEWPORT_COVERAGE && rect.height >= height * MIN_VIEWPORT_COVERAGE
  )
}

/** 排除压暗覆盖层自身(否则自己检测自己 → 压暗层永不自愈)。 */
function isOwnDimLayer(el: Element): boolean {
  return el.closest(DIM_MARKER_SELECTOR) !== null
}

/** 纯判据函数:从给定根节点找出最应当用于等效压暗的全屏遮罩色,无遮罩返回 null */
export function detectModalOverlayColor(root?: Document | DocumentFragment): string | null {
  const scope: QueryableRoot | null = root ?? currentDocument()
  if (!scope) return null
  let bestZ = Number.NEGATIVE_INFINITY
  let bestColor: string | null = null

  for (const layer of Array.from(scope.querySelectorAll(FIXED_LAYER_SELECTOR))) {
    if (isOwnDimLayer(layer)) continue
    const style = computedOf(layer)
    if (!style || style.position !== 'fixed') continue
    const z = readZIndex(style.zIndex)
    if (z < MIN_OVERLAY_Z_INDEX) continue
    if (!coversViewport(layer)) continue

    const ownColor = (style.backgroundColor ?? '').trim()
    if (readAlpha(ownColor) >= MIN_OVERLAY_ALPHA) {
      if (z > bestZ) {
        bestZ = z
        bestColor = ownColor
      }
      continue
    }

    // Drawer/Sheet 双层陷阱:父 fixed 层自身无背景,压暗色挂在 absolute inset-0 子层上。
    // 层级比较仍用父层 z(子层 z 只在父 stacking context 内部有意义)。
    for (const child of Array.from(layer.querySelectorAll(ABSOLUTE_LAYER_SELECTOR))) {
      if (isOwnDimLayer(child)) continue
      const childStyle = computedOf(child)
      if (!childStyle || childStyle.position !== 'absolute') continue
      const childColor = (childStyle.backgroundColor ?? '').trim()
      if (readAlpha(childColor) < MIN_OVERLAY_ALPHA) continue
      if (!coversViewport(child)) continue
      if (z > bestZ) {
        bestZ = z
        bestColor = childColor
      }
      break
    }
  }

  return bestColor
}

const listeners = new Set<(state: ModalDimState) => void>()
let observer: MutationObserver | null = null
let frameQueued = false
// 稳定引用:color 未变时复用同一对象,订阅者 setState 可被 React bail out。
let cached: ModalDimState = { active: false, color: null }

function readState(): ModalDimState {
  const color = detectModalOverlayColor()
  if (color === cached.color) return cached
  cached = { active: color !== null, color }
  return cached
}

export function getModalDimState(): ModalDimState {
  return readState()
}

function refresh(): void {
  const previous = cached
  const next = readState()
  if (next === previous) return
  listeners.forEach((listener) => listener(next))
}

/** rAF 合并节流:一帧内多次 DOM 变更只重算一次(禁止 setInterval 轮询)。 */
function scheduleRefresh(): void {
  if (frameQueued) return
  frameQueued = true
  const run = () => {
    frameQueued = false
    refresh()
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
  else setTimeout(run, 0)
}

export function subscribeModalDim(listener: (state: ModalDimState) => void): () => void {
  const doc = currentDocument()
  if (!doc) return () => {}

  listeners.add(listener)
  if (!observer) {
    observer = new MutationObserver(scheduleRefresh)
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
  }
  // 订阅瞬间同步一次:遮罩恰好在"渲染取初值 → effect 挂观察者"之间打开时不会漏掉
  listener(readState())

  return () => {
    listeners.delete(listener)
    if (listeners.size > 0 || !observer) return
    // 最后一个订阅者退订即断开,不留常驻观察者(浏览器端压根不订阅)
    observer.disconnect()
    observer = null
    frameQueued = false
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
