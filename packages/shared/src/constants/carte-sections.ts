// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「社群宣传卡」(carte)屏的分段构成 —— RN 共享屏与小程序端共用的唯一真相源。
 *
 * 立因:同一件事此前住在三处(RN `screens/CarteScreen.tsx` 自带一份、共享层
 * `features/carte/CarteScreen.tsx` 一份、小程序 `pkg-content/carte/index.tsx` 一份),
 * 三份的段落顺序与取词键各自漂移而"看起来都像名片",没有任何一层能判(§0.6 单一真相源)。
 * 本表把**平台无关**的那部分(段落构成、顺序、i18n 键、字形名、图片槽位)收出来;
 * 图标组件句柄与图片资源本体属平台侧,留在各端(RN 用 lucide-react-native 组件 + require(),
 * 小程序用本端 LineIcon 注册表键 + 分包静态路径),与 `about-sections.ts` 同一分工。
 *
 * 取词键的字面量只住在本文件:dead-key 扫描对 mobile-rn 与 miniapp-taro 两端都把
 * `packages/shared/src` 列进参照语料(见 scripts/lib/i18n-scan-targets.mjs),
 * 因此各端写 `t(CARTE_I18N_KEYS.xxx)` 不会再被读成"没人取这个词"。
 */

/** 图片槽位(顺序即渲染顺序;资源本体由两端各自注入) */
export const CARTE_IMAGE_SLOTS = ['avatar', 'qrcode'] as const
export type CarteImageSlot = (typeof CARTE_IMAGE_SLOTS)[number]

/** 本屏全部取词键(五语言词包同一族) */
export const CARTE_I18N_KEYS = {
  /** 页头标题 */
  title: 'carte.title',
  /** 推荐人一行:社群名 | 身份 | 称呼 */
  founder: 'carte.founder',
  /** 推荐语 */
  recommend: 'carte.recommend',
  /** 扫码进社群的邀请语 */
  invite: 'carte.inviteHint',
  /** 二维码下方提示语 */
  scan: 'carte.scanHint',
} as const

/** 段落标识(两端按它选版式,漏一段即结构分叉) */
export const CARTE_SEGMENT_IDS = ['hero', 'invite', 'qrcode', 'scan'] as const
export type CarteSegmentId = (typeof CARTE_SEGMENT_IDS)[number]

export interface CarteSegment {
  readonly id: CarteSegmentId
  /** 该段内自上而下的文案行(取词键,已按渲染顺序排好) */
  readonly textKeys: readonly string[]
  /** lucide 官方 kebab 字形名(同时是小程序端 LineIcon 注册表键);无图标为 null */
  readonly icon: string | null
  /** 该段内图片槽位;无图为 null */
  readonly imageSlot: CarteImageSlot | null
}

/**
 * 页面构成(原项目 pagesA/carte/index.vue 的四段:渐变头卡 → 邀请语 → 社群二维码 → 扫码提示)。
 * 两端必须按本数组的顺序出段;原页面的「购买」按钮在历史版本里就是注释状态,故不在此表内。
 */
export const CARTE_SEGMENTS: readonly CarteSegment[] = [
  {
    id: 'hero',
    textKeys: [CARTE_I18N_KEYS.founder, CARTE_I18N_KEYS.recommend],
    icon: null,
    imageSlot: 'avatar',
  },
  { id: 'invite', textKeys: [CARTE_I18N_KEYS.invite], icon: null, imageSlot: null },
  { id: 'qrcode', textKeys: [], icon: null, imageSlot: 'qrcode' },
  { id: 'scan', textKeys: [CARTE_I18N_KEYS.scan], icon: 'users', imageSlot: null },
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
