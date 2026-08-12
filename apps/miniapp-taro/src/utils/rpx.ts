/**
 * rpx 单位运行时转换 helper(2026-08-12 立,根治 Taro H5 inline rpx 失效)
 *
 * 根因:Taro 4 + SWC 编译时,inline `style={{ width: '140rpx' }}` 中的 rpx 字符串
 * 被 SWC 直接剥离(bundle 里完全找不到 inline rpx 字符串,只剩 camelCase 数字属性),
 * 渲染时元素回退到默认 320×240。
 *
 * 方案:H5 环境用 vw 单位(750rpx = 100vw,与 Taro 默认 viewport 宽度一致);
 * 小程序环境保留 rpx 字符串(小程序原生支持 rpx,无需转换)。
 *
 * 使用:把 `style={{ width: '140rpx' }}` 改成 `style={{ width: rpx(140) }}`。
 * 副作用:函数调用表达式 SWC 不会剥离,编译后 inline style 是计算后的 vw 字符串。
 *
 * 750rpx = 100vw 的设计稿基础(Taro 默认),可按需改 designWidth。
 */
const DESIGN_WIDTH = 750
let _isH5: boolean | null = null

function detectH5(): boolean {
  if (_isH5 !== null) return _isH5
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    _isH5 = true
  } else {
    _isH5 = false
  }
  return _isH5
}

/**
 * rpx 单位 → 浏览器/小程序可识别的 CSS 长度字符串
 * @param n rpx 数值(基于 750rpx = 100vw 的设计稿)
 * @returns H5 返回 `${(n/750)*100}vw`,小程序返回 `${n}rpx`
 */
export function rpx(n: number): string {
  if (detectH5()) {
    const v = (n / DESIGN_WIDTH) * 100
    return `${Math.round(v * 10000) / 10000}vw`
  }
  return `${n}rpx`
}

/**
 * rpx 转 px(用于 fontSize 等需要 px 的场景,H5 下用 px 不用 vw 避免字太小)
 * @param n rpx 数值
 * @returns 1rpx = 1px(粗略估算,不准确但足够用于字号/边框)
 */
export function rpxToPx(n: number): string {
  if (detectH5()) {
    return `${n}px`
  }
  return `${n}rpx`
}

/**
 * 纯 px 值(不参与 rpx 转换,如状态栏高度这种与设备相关的实际像素)
 * 修复 (2026-08-12):模板字面量 `${navBarHeight}px` 同样被 SWC 剥离,导致
 * NavBar 高度塌陷。用 px(n) 替代,让 SWC 看到的是函数调用,保留输出。
 */
export function px(n: number): string {
  return `${n}px`
}
