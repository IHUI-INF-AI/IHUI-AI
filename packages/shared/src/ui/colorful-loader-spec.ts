// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ColorfulLoader 加载器的结构与几何单一源(小程序端与 RN 端共用),形状照 back-chevron-spec。
 *
 * 两端真实实现:apps/miniapp-taro/src/components/ColorfulLoader.tsx 与
 * .../components/adapters/ColorfulLoader.taro.tsx(72 彩点环)↔
 * apps/mobile-rn/src/components/ColorfulLoader.tsx(单环 spinner)。
 * (packages/app/src/components/ColorfulLoader.tsx 是 DOM 副本,同样改读本表,不留第三份数字。)
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/colorful-loader-spec`(禁挂根桶)。
 * spec 内只存逻辑 px;小程序端换算 `(px) => rpx(px * TARO_RPX_PER_PX)`,RN 端 1:1。
 *
 * 平台机制差异(数值对齐、通道各端保留 —— 台账 waivers 素材):
 *  - 旋转驱动:小程序端 CSS keyframes(`animate-spin` 类 + 行内 animation-duration),
 *    RN 端 Animated.loop(useNativeDriver) —— 周期数值统一为 COLORFUL_LOADER_SPIN_MS;
 *  - 形态:小程序端是 72 点 HSL 环,RN 端是单环边框 spinner —— 点阵参数只有小程序/DOM 腿消费。
 */

/** 默认直径 40:两端现值已同(小程序 80rpx = 40px、RN 默认 40dp;DOM 副本原 80px 是分叉,收口到 40)。 */
export const COLORFUL_LOADER_DEFAULT_SIZE_PX = 40

/** 单圈周期 1200ms:RN 与 DOM 副本现值;小程序 `animate-spin` 原 1000ms,行内 animation-duration 对齐到本档。 */
export const COLORFUL_LOADER_SPIN_MS = 1200

/** 彩点数 72:三腿现值已同(对齐原项目 colorful_loader.vue)。 */
export const COLORFUL_LOADER_DOT_COUNT = 72

/** 彩点色相步进 5(i * 5,70%/60% 循环彩虹):三腿现值已同,收一处。 */
export const COLORFUL_LOADER_HUE_STEP = 5

/** 轨道半径 = 直径一半(装饰点落在容器边缘)。 */
export function colorfuleLoaderRadiusPx(sizePx: number): number {
  return sizePx / 2
}

/**
 * 单个装饰点直径:min(4px 可见下限) + size/10。
 * 取小程序端现公式(RN/DOM 的 size/20 在 40px 档只剩 2px,低于可读下限,规则 2 取大档)。
 */
export function colorfuleLoaderDotSizePx(sizePx: number): number {
  return Math.max(4, sizePx / 10)
}

/** RN 端单环 spinner 的边框宽:max(2, size/12),收进共享源免得端内自定档。 */
export function colorfuleLoaderRingBorderPx(sizePx: number): number {
  return Math.max(2, sizePx / 12)
}

/** 第 i 个彩点的颜色(动态计算色无法 token 化,§5c/守门 93 已认可 HSL 循环为装饰色)。 */
export function colorfuleLoaderDotColor(i: number): string {
  return `hsl(${i * COLORFUL_LOADER_HUE_STEP}, 70%, 60%)`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
