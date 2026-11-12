// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 阴影 / 层级档位唯一真相源(全端共用:mobile-rn / miniapp-taro / web)。
 *
 * 立因:RN 用 `shadowColor/shadowOffset/shadowOpacity/shadowRadius` 四元组,小程序用 CSS
 * `box-shadow` 字符串,两套写法无单一来源 ⇒ 同一张卡片两端阴影深浅不一,守门 128 对账为不一致。
 * 本表把"层级"收成一份,再以双投影落到两端。
 *
 * 消费方式:
 *  - RN → `ELEVATION_STEPS.md` 得到 RN ShadowStyle 四元组(直接喂 View style)
 *  - 小程序 / web → `ELEVATION_CSS.md` / `ELEVATION_CSS_VAR.md` 得到 `box-shadow` 字符串
 *
 * 取值依据:与 tokens.css 的 `--shadow-premium: 0 2px 8px var(--color-black-6)` 同量级起步,
 * sm/md/lg/xl 按 2/4/8 的 offset 与 radius 递增,opacity 0.05→0.16,符合移动端轻投影习惯。
 */

/**
 * RN ShadowStyle 四元组 + Android `elevation`(Android 无 shadow* 渲染,靠 elevation 出投影)。
 * 两者同档携带,消费方 spread 一次即得 iOS / Android 同一层级,不必在各端分别补 elevation。
 */
export type RnElevation = {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowOpacity: number
  shadowRadius: number
  elevation: number
}

/**
 * 阴影档位名的**运行时清单**(与下面的联合类型同一份,顺序即文档顺序)。
 * 为什么要有它:类型只在编译期存在,而守门/测试需要在运行期遍历"应当是哪些档"。
 * 清单外置一份给类型用、一份给运行期用,是同一缺陷的两个源头 —— 故此处用
 * `as const` + 派生类型,让"加一档"只改这一行。
 */
export const ELEVATION_STEP_NAMES = ['none', 'sm', 'md', 'lg', 'xl'] as const

/**
 * 阴影档位名(唯一清单)。
 *
 * 为什么不是 `Record<string, …>`:`noUncheckedIndexedAccess` 下,用宽 string 键注解会让
 * `ELEVATION_STEPS.md` 的类型退化成 `RnElevation | undefined` —— 每个消费方都得多写一次
 * 非空断言或兜底分支(实测 tooltip.tsx 因此报 TS2322)。档位是**封闭集合**,用联合类型
 * 既让 `.md` 精确非空,也让拼错档位名(如 `.mk`)成为编译错误而不是运行时静默失样式。
 */
export type ElevationStepName = (typeof ELEVATION_STEP_NAMES)[number]

export const ELEVATION_STEPS: Record<ElevationStepName, RnElevation> = {
  none: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 24,
  },
}

/** CSS box-shadow 字符串(小程序 / web 共用)。键同样是封闭档位集合,理由见 ElevationStepName。 */
export const ELEVATION_CSS: Record<ElevationStepName, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 2px 8px rgba(0,0,0,0.08)',
  lg: '0 4px 16px rgba(0,0,0,0.12)',
  xl: '0 8px 24px rgba(0,0,0,0.16)',
}

/**
 * 同义的 CSS 变量名(web / CSS 端引用形式,守门与迁移脚本共用)。
 * 必须指向 tokens.css 的 `--shadow-elevation-*`(由本文件 ELEVATION_CSS 经
 * scripts/sync-css-tokens.mjs 派生)—— 旧值曾指向 `--shadow-premium*`,而那一族四档
 * 现值全等 `0 2px 8px`,与上面的阶梯值不一致,等于同一档两个数。
 */
export const ELEVATION_CSS_VAR = {
  none: 'none',
  sm: 'var(--shadow-elevation-sm)',
  md: 'var(--shadow-elevation-md)',
  lg: 'var(--shadow-elevation-lg)',
  xl: 'var(--shadow-elevation-xl)',
} as const

export type ElevationStep = ElevationStepName
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
