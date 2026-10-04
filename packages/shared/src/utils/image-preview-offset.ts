// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 图片预览的**平移量钳制**(G-853)
 *
 * 为什么住在 `packages/shared` 而不是端内:这是一份**无 DOM 依赖的纯函数**,而 web 与
 * mobile-rn 两端都有"放大后拖拽看局部"这同一个交互(RN 走 responder 系统、web 走 pointer
 * events,载体不同、算式同一)。按 §3「共享层优先」,算式只许有一份;两端各写一遍钳制逻辑
 * 就是本仓记过最多次的失效型 ——「两处算同一件事必漂移」。
 * 小程序端**不消费本文件**:它走微信原生预览器(`Taro.previewImage` 自带手势缩放与横滑),
 * 结构上没有自定义手势(理由登记在 `apps/miniapp-taro/src/lib/image-preview-pack.ts` 头注)。
 *
 * 取用方式只有一种:**子路径导入** `@ihui/shared/utils/image-preview-offset`。
 * 刻意没有并进 `src/utils/index.ts` —— 该 barrel 的具名清单是第二个真相源,而本票落地时它
 * 正被并行会话持有(§12 单写者); barrel 补递出是另一枚提交的动作,不得为过门去改别人的在飞文件。
 */

/** 一次平移的结论(相对视口中心的位移,单位与视口同一坐标系 = px)。 */
export interface ImagePreviewOffset {
  readonly x: number
  readonly y: number
}

/**
 * 钳制的输入。四个尺寸一律是**渲染后的实际像素**(图片要含缩放后的值),
 * 因此调用方不需要在端内再乘一次 zoom —— 乘过没有,是"两处算同一件事"。
 */
export interface ImagePreviewPanGeometry {
  /** 期望的平移量(未钳制),通常 = 起始量 + 本次拖拽增量 */
  readonly offsetX: number
  readonly offsetY: number
  /** 图片缩放后占用的宽/高 */
  readonly scaledWidth: number
  readonly scaledHeight: number
  /** 可视窗口(承载图片的那层容器)的宽/高 */
  readonly viewportWidth: number
  readonly viewportHeight: number
}

/** 取不到数(NaN/Infinity/未量)一律当 0:宁可不动,也不让 NaN 把 transform 洗成整块不渲染。 */
function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

/**
 * 单轴可平移的上限。图片以中心为变换原点(`transformOrigin: 'center'` / RN 的默认锚点),
 * 所以每一侧各分到溢出量的一半 —— 这正是"越界两向"必须各判一次的原因。
 * 两个fail-safe 方向:**未放大(不溢出)= 0**;**没量到视口(≤0)= 0** ——
 * 后者是"测不到时由构造封顶,不由推断放行"那条口径(§4 圆角上限同一课),
 * 否则一次未完成的测量就会让人"没放大也能拖"。
 */
function axisLimit(scaled: number, viewport: number): number {
  const view = finite(viewport)
  if (view <= 0) return 0
  const overflow = finite(scaled) - view
  return overflow > 0 ? overflow / 2 : 0
}

function withinSigned(value: number, limit: number): number {
  if (value > limit) return limit
  if (value < -limit) return -limit
  return value
}

/**
 * 把期望平移量钳制在"图片边缘不出视口"的范围内。
 * 放大到图片小于视口的某一轴上,该轴恒回 0(未放大不吃拖拽)。
 */
export function clampImagePreviewOffset(geo: ImagePreviewPanGeometry): ImagePreviewOffset {
  return {
    x: withinSigned(finite(geo.offsetX), axisLimit(geo.scaledWidth, geo.viewportWidth)),
    y: withinSigned(finite(geo.offsetY), axisLimit(geo.scaledHeight, geo.viewportHeight)),
  }
}

/**
 * 平移这一手势**当前是否该生效**。两端的手势入口都先问它:
 * 未放大时必须整段不吃事件(web 不吃掉页面滚动、RN 不把 tap 误当拖拽),
 * 所以这个谓词必须和钳制同源 —— 各端自己写一遍 `zoom > 1` 会与"某一轴其实没溢出"判出不同结论。
 */
export function imagePreviewPanApplies(geo: ImagePreviewPanGeometry): boolean {
  return axisLimit(geo.scaledWidth, geo.viewportWidth) > 0 || axisLimit(geo.scaledHeight, geo.viewportHeight) > 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
