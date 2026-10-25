// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 字号档位唯一真相源(全端共用:mobile-rn / miniapp-taro / web)。
 *
 * 立因:RN 屏 `fontSize` 大量写死裸数字(11/12/13/14/15/16…),小程序写 rpx 字面量,
 * 同一语义文字两端字号差 1-2px,守门 128 对账为「视觉不一致」。缺单一真相源的字号档,
 * 「一模一样」在文字层就立不住。
 *
 * 取值依据(与 geometry.js 的文字档对齐,逐条可复核):
 *  - caption 11 / label 12 / body 14 / strong 15 直接复用 geometry 同名字段现值,不新造。
 *  - lineHeight = size × 1.4 取整(正文 14→20、标题 16→24、显示 24→32),符合中文行高习惯。
 *  - weight:正文 400、强调 500、标题 600/700,对齐本项目字体权重约定。
 *
 * 消费方式:
 *  - RN → `rnType.body` 得到 `{ fontSize:14, lineHeight:20, fontWeight:400 }`(直接喂 Text style)
 *  - 小程序 → `taroType.body` 得到 `{ fontSize:'28rpx', lineHeight:'40rpx', fontWeight:400 }`
 *
 * 新增档位:先落本表(带取值依据)→ 两端同枚提交取用 → 守门 128 复核。
 */

/** 单档字号:px 字号 + px 行高 + 字重 */
export type TypeStep = {
  size: number
  lineHeight: number
  weight: number
}

export const TYPE_STEPS = {
  /** 辅助说明 / 日期分组(对齐 geometry.textCaption=11) */
  caption: { size: 11, lineHeight: 16, weight: 400 },
  /** 标签 / 空态文案(对齐 geometry.textLabel=12) */
  label: { size: 12, lineHeight: 16, weight: 400 },
  /** 正文(对齐 geometry.textBody=14) */
  body: { size: 14, lineHeight: 20, weight: 400 },
  /** 强调文字 / 昵称(对齐 geometry.textStrong=15) */
  strong: { size: 15, lineHeight: 22, weight: 500 },
  /** 卡片标题 / 区段标题 */
  title: { size: 16, lineHeight: 24, weight: 600 },
  /** 次级标题 */
  subtitle: { size: 18, lineHeight: 26, weight: 600 },
  /** 区块标题 */
  heading: { size: 20, lineHeight: 28, weight: 700 },
  /** 页面主标题 */
  display: { size: 24, lineHeight: 32, weight: 700 },
  /** 特大展示标题 */
  displayLg: { size: 30, lineHeight: 38, weight: 700 },
} as const satisfies Record<string, TypeStep>

/** 字重单一真相源 */
export const FONT_WEIGHTS = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

/** RN / 共享包侧消费入口:Text style 里写 `{ ...rnType.body }` */
export const rnType = TYPE_STEPS

/** 小程序侧消费入口:rpx 字符串形式(字号 / 行高已折 2 倍) */
export const taroType = Object.fromEntries(
  Object.entries(TYPE_STEPS).map(([step, v]) => [
    step,
    { fontSize: `${v.size * 2}rpx`, lineHeight: `${v.lineHeight * 2}rpx`, fontWeight: v.weight },
  ]),
) as Record<keyof typeof TYPE_STEPS, { fontSize: string; lineHeight: string; fontWeight: number }>

export type TypeStepName = keyof typeof TYPE_STEPS
export type FontWeightName = keyof typeof FONT_WEIGHTS
