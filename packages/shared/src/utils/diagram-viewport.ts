// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 矢量图(Mermaid)预览的**视口数学**(G-854)
 *
 * 为什么住在 `packages/shared` 而不是端内:这份算式是**无 DOM 依赖的纯函数** ——
 * 输入全是数字,输出全是数字。web 端的内联渲染器与独立预览 Modal 要算的是同一件事
 * (倍率的合法域、适应视口的倍率、定点缩放后该滚到哪里),两处各写一遍就是本仓记过
 * 最多次的失效型「两处算同一件事必漂移」。内联那份今天已有 `clampZoom`/「适应屏幕」,
 * 本票落地后它改从这里取,不再留第二份。
 *
 * 取用方式:`@ihui/shared/utils/diagram-viewport`(子路径,同 `image-preview-offset`)。
 *
 * 「测不到」的口径(全文件统一,不要在各端自己补一遍):
 *   尺寸一律要求 **有限正数**;0 / 负数 / NaN / Infinity 都算**没量到**。
 *   - `fitZoom` 没量到 ⇒ 回落 1(不猜内容尺寸,见 `MermaidDiagram` 适应屏幕的同一条既有语义);
 *   - 滚动上限没量到 ⇒ **保持原位**(既不让它跳到 0,也不让一个未知上限放行一次越界滚动)。
 *     这一档与 §4「测不到的尺寸:上限由构造封顶,不由推断放行」同一条纪律。
 */

/** 倍率合法域下界(1 = 100%)。语义与 web 内联渲染器改造前**逐字等值**。 */
export const MIN_ZOOM = 0.4
/** 倍率合法域上界。 */
export const MAX_ZOOM = 4
/** 按钮/键盘每一档的倍率乘数(倍率制而非固定档位,粒度足够且实现简单)。 */
export const ZOOM_STEP = 1.2

/**
 * 把任意倍率收敛到 [MIN_ZOOM, MAX_ZOOM] 并保留两位小数,避免 1.2 连乘浮点尾巴。
 *
 * 与改造前 `MermaidDiagram.tsx` 内的私有实现逐字等值 —— 包括 `NaN` 的去向:
 * `Math.round(NaN*100)/100 = NaN`,再 `Math.max(0.4, NaN) = NaN`,所以本函数**原样透传 NaN**。
 * 这不是遗漏而是「不得顺手改语义」:调用方一律把已收敛过的值喂回来,而把 NaN 静默洗成
 * 0.4 会让「一次测量失败」伪装成「用户主动缩到最小」。NaN 由调用方自己判。
 */
export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}

/** 有限正数才算「量到了」;其余一律当作没测到。 */
function isMeasured(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

/** 视口与内容(均为**未缩放**的自然像素)的测量输入。 */
export interface DiagramFitInput {
  readonly viewportW: number
  readonly viewportH: number
  readonly naturalW: number
  readonly naturalH: number
}

/**
 * 「适应视口」的倍率:能完整看见内容的**最大不放大**倍率,即 `Math.min(1, …)`。
 * 任一侧没量到 ⇒ 回落 1(jsdom / 未挂载 / 内容为 0×0 时不猜尺寸)。
 */
export function fitZoom(input: DiagramFitInput): number {
  const { viewportW, viewportH, naturalW, naturalH } = input
  if (!isMeasured(naturalW) || !isMeasured(naturalH)) return 1
  if (!isMeasured(viewportW) || !isMeasured(viewportH)) return 1
  const fit = Math.min(1, viewportW / naturalW, viewportH / naturalH)
  return isMeasured(fit) ? clampZoom(fit) : 1
}

/** 滚动位置(与 DOM 的 `scrollTop` / `scrollLeft` 同一份真相,不另造偏移量)。 */
export interface DiagramScroll {
  readonly scrollTop: number
  readonly scrollLeft: number
}

/** 内容坐标(未缩放的自然像素,原点 = 内容左上角)。 */
export interface DiagramContentPoint {
  readonly x: number
  readonly y: number
}

/**
 * 一次滚动可平移的上限:`内容缩放后占位 − 视口`。
 * 返回 `null` = 这一轴**没量到**,调用方据此保持原位而不是猜一个上限。
 */
function scrollUpperLimit(scaledSpan: number, viewport: number): number | null {
  if (!isMeasured(scaledSpan) || !isMeasured(viewport)) return null
  const overflow = scaledSpan - viewport
  return overflow > 0 ? overflow : 0
}

/** 两位小数收敛(与 `clampZoom` 同一条"不留浮点尾巴"的口径)。 */
function roundScroll(value: number): number {
  return Math.round(value * 100) / 100
}

/** 单轴钳制:上限未知 ⇒ 回原值(不动);已知 ⇒ 钳到 [0, 上限](请求值不可计时也回原值)。 */
function clampAxis(desired: number, original: number, scaledSpan: number, viewport: number): number {
  const upper = scrollUpperLimit(scaledSpan, viewport)
  if (upper === null || !Number.isFinite(desired)) return Number.isFinite(original) ? original : 0
  // 先收敛再钳:反过来会让 0.005 的浮点尾巴把值顶过上限
  return Math.min(upper, Math.max(0, roundScroll(desired)))
}

/** 定点缩放的输入:`point` 为内容坐标,`scroll` 为**当前**滚动位置。 */
export interface DiagramKeepPointInput extends DiagramFitInput {
  readonly zoomFrom: number
  readonly zoomTo: number
  readonly point: DiagramContentPoint
  readonly scroll: DiagramScroll
}

/**
 * 换倍率后让 `point` 这个内容点**停在视口里原来的位置**,并钳在合法滚动范围内。
 *
 * 推导:`transformOrigin: 'top left'` 下,内容点 p 在视口里的位置 = `zoom*p − scroll`。
 * 要它不变 ⇒ `scrollTo = scrollFrom + (zoomTo − zoomFrom) * p`。
 * ctrl+滚轮的「光标下的内容不动」、双指捏合的「两指中点不动」、按钮缩放后「视口中心不动」
 * 三条手势共用这一份算式,只差喂进来的 `point` 是谁。
 */
export function scrollToKeepPoint(input: DiagramKeepPointInput): DiagramScroll {
  const { zoomFrom, zoomTo, point, scroll, naturalW, naturalH, viewportW, viewportH } = input
  const untouched: DiagramScroll = {
    scrollTop: Number.isFinite(scroll.scrollTop) ? scroll.scrollTop : 0,
    scrollLeft: Number.isFinite(scroll.scrollLeft) ? scroll.scrollLeft : 0,
  }
  if (!Number.isFinite(zoomFrom) || !Number.isFinite(zoomTo)) return untouched
  const dx = zoomTo - zoomFrom
  const desiredLeft = scroll.scrollLeft + dx * point.x
  const desiredTop = scroll.scrollTop + dx * point.y
  return {
    scrollTop: clampAxis(desiredTop, scroll.scrollTop, zoomTo * naturalH, viewportH),
    scrollLeft: clampAxis(desiredLeft, scroll.scrollLeft, zoomTo * naturalW, viewportW),
  }
}

/** 拖拽平移的输入:`delta` 是**本次要移动的滚动增量**(已按「拖向右 = 看左边」换过号)。 */
export interface DiagramPanInput extends DiagramFitInput {
  readonly zoom: number
  readonly scroll: DiagramScroll
  readonly delta: { readonly dx: number; readonly dy: number }
}

/**
 * 平移(= 改滚动位置)并钳制。内容某一轴没超出视口时该轴回 0,所以「未放大到溢出」
 * 自然表现为「拖不动」,调用方不需要再判一次 `zoom > 1`(两处判一件事必漂移)。
 */
export function panScroll(input: DiagramPanInput): DiagramScroll {
  const { scroll, delta, zoom, naturalW, naturalH, viewportW, viewportH } = input
  if (!Number.isFinite(zoom)) {
    return { scrollTop: Number.isFinite(scroll.scrollTop) ? scroll.scrollTop : 0, scrollLeft: Number.isFinite(scroll.scrollLeft) ? scroll.scrollLeft : 0 }
  }
  return {
    scrollTop: clampAxis(scroll.scrollTop + delta.dy, scroll.scrollTop, zoom * naturalH, viewportH),
    scrollLeft: clampAxis(scroll.scrollLeft + delta.dx, scroll.scrollLeft, zoom * naturalW, viewportW),
  }
}

/** 预览器接管的键盘动作(封闭集;新增一档必须同时给消费方,不得先建表再等人用)。 */
export type DiagramViewportAction =
  | 'in'
  | 'out'
  | 'fit'
  | 'reset'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'

/**
 * 「哪些键归预览器管」这张表**只写这一份** —— 内联渲染器与独立 Modal 都从这里问,
 * 于是"同一个键在两块地方一个管一个不管"这种分叉结构上不可能出现。
 *
 * 刻意**不含** `Escape`:关闭 Modal 是承载层(Radix Dialog)的职责,预览器抢走它
 * 就等于把「按 Esc 关窗」这条全局习惯改成「按 Esc 什么都不发生」。
 */
const DIAGRAM_KEY_ACTIONS: Readonly<Record<string, DiagramViewportAction>> = {
  '+': 'in',
  '=': 'in',
  '-': 'out',
  '_': 'out',
  '0': 'reset',
  f: 'fit',
  F: 'fit',
  ArrowLeft: 'pan-left',
  ArrowRight: 'pan-right',
  ArrowUp: 'pan-up',
  ArrowDown: 'pan-down',
}

/** 带修饰键时仍归预览器管的动作(倍率族);其余在 ctrl/meta 下属于浏览器与文本编辑。 */
const CTRL_ALLOWED_ACTIONS: ReadonlySet<DiagramViewportAction> = new Set(['in', 'out', 'reset'])

/**
 * 把按键映射成动作;**认不出就回 `null`**。
 *
 * 调用方判序(G-843 那条键盘纪律):先 `if (event.defaultPrevented) return`,
 * 再问本函数,`null` ⇒ **绝不 `preventDefault()`**(把键还给上层与浏览器)。
 * 顺序反了会先吃掉别人的键、再决定要不要动 —— 表现是「快捷键突然失灵」而账面全绿。
 */
export function zoomFromKey(
  key: string,
  opts?: { readonly ctrlKey?: boolean; readonly metaKey?: boolean },
): DiagramViewportAction | null {
  const action = DIAGRAM_KEY_ACTIONS[key] ?? null
  if (action === null) return null
  const modified = Boolean(opts?.ctrlKey) || Boolean(opts?.metaKey)
  if (modified && !CTRL_ALLOWED_ACTIONS.has(action)) return null
  return action
}

/** 双指捏合的输入:两指间距(与倍率同为像素,单位两侧一致即可,不做换算)。 */
export interface DiagramPinchInput {
  readonly prevDistance: number
  readonly nextDistance: number
  readonly baseZoom: number
}

/**
 * 捏合后的新倍率 = `baseZoom × (next / prev)`,收敛到合法域。
 *
 * 距离为 0 / NaN / 负(第二指刚按下、指纹重叠、jsdom 无量测)⇒ **不动**:
 * 回 `baseZoom` 原值,而不是除以 0 得到 Infinity 再被 clamp 洗成 MAX_ZOOM ——
 * 那会把「还没量到第二指」显示成「用户已经缩到最大」。
 */
export function pinchZoom(input: DiagramPinchInput): number {
  const { prevDistance, nextDistance, baseZoom } = input
  if (!isMeasured(prevDistance) || !isMeasured(nextDistance)) return baseZoom
  return clampZoom((baseZoom * nextDistance) / prevDistance)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
