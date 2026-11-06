// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 弹层 / 限高容器高度的单一真相源(mobile-rn 端)。
 *
 * RN 0.86 Fabric 下,StyleSheet 里的百分比 maxHeight 不会给子节点一个确定高度:
 * 内部 ScrollView / FlatList 拿不到可测量的边界 ⇒ 列表无法滚动,配合 overflow:'hidden'
 * 还会把底部内容直接裁掉。此前比例散在各屏样式表里各写一份,改一处忘另一处即截断。
 *
 * 现在:① 所有比例只在 DIALOG_HEIGHT_RATIOS 定义一次(六档,按用途命名);
 * ② height 与 maxHeight 由同一个函数成对产出,杜绝两处数值不一致;
 * ③ 需要「内容短时自适应」的容器只取数值 maxHeight,不强行拉高。
 * 样式表里保留 maxHeight / height 键(值为 undefined)供门 217 识别 bounded 容器,
 * 真正的数值由 lib/use-dialog-height.ts 的 hook 在消费点运行时叠加。
 */
export const DIALOG_HEIGHT_RATIOS = {
  /** 页内统计 / 趋势限高区 */
  stats: 0.45,
  /** 通用弹层族(ChatScreen 五弹层及其派生面板) */
  standard: 0.7,
  /** 文章评论弹层 */
  articleComment: 0.72,
  /** 业务表单 sheet */
  businessForm: 0.78,
  /** 较高弹层 / 素材列表面板 */
  tall: 0.8,
  /** 超高 sheet(分类详情 / 发布管理) */
  extraTall: 0.85,
} as const

export type DialogHeightRatio = (typeof DIALOG_HEIGHT_RATIOS)[keyof typeof DIALOG_HEIGHT_RATIOS]

/** 向后兼容:既有无参消费者仍取 0.7 默认档 */
export const DIALOG_MAX_HEIGHT_RATIO = DIALOG_HEIGHT_RATIOS.standard

/** 屏高异常(SSR / 测量未就绪)时不产出确定尺寸,让容器退回自然高度而非塌成 0 高 */
export function isValidWindowHeight(windowHeight: number): boolean {
  return Number.isFinite(windowHeight) && windowHeight > 0
}

/** 纯函数,不依赖 React Native 运行时,便于直接单测 */
export function dialogContentHeight(
  windowHeight: number,
  ratio: DialogHeightRatio = DIALOG_MAX_HEIGHT_RATIO,
): number {
  return Math.round(windowHeight * ratio)
}

/**
 * 成对产出 height/maxHeight。两者恒等,杜绝「两处数值不一致 ⇒ overflow 截断」。
 * 取不到有效屏高时返回 null:style 数组里的 falsy 项被 RN 忽略。
 */
export function dialogContentHeightStyle(
  windowHeight: number,
  ratio: DialogHeightRatio = DIALOG_MAX_HEIGHT_RATIO,
): { height: number; maxHeight: number } | null {
  if (!isValidWindowHeight(windowHeight)) return null
  const height = dialogContentHeight(windowHeight, ratio)
  return { height, maxHeight: height }
}

/**
 * 只产出数值 maxHeight:给「内容短时自适应、内容长时封顶」的容器用,不改变视觉。
 * 数值上限不依赖父容器高度的百分比解析,Yoga 可以直接约束。
 */
export function dialogMaxHeightStyle(
  windowHeight: number,
  ratio: DialogHeightRatio = DIALOG_MAX_HEIGHT_RATIO,
): { maxHeight: number } | null {
  if (!isValidWindowHeight(windowHeight)) return null
  return { maxHeight: dialogContentHeight(windowHeight, ratio) }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
