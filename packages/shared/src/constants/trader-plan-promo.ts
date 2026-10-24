// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「操盘手计划」宣传页(recruitment)的构成 —— RN 共享屏与小程序端共用的唯一真相源。
 *
 * 立因:同一件事此前住在三处(RN `screens/RecruitmentScreen.tsx` 自带一份、共享层
 * `features/recruitment/RecruitmentScreen.tsx` 躺着一份**没人渲染的招聘列表屏**、小程序
 * `pkg-content/recruitment/index/index.tsx` 又是一份 API 驱动的「岗位要求/专属福利/预估收入」页,
 * 而它请求的 `privileges`/`incomeEstimates` 字段与 `POST /recruitment/apply` 后端根本不存在)。
 * 三处没有一处是这一屏的真相 ⇒ 按 §0.6 把**平台无关**的那部分(取词键、图片槽位、段落顺序)收出来。
 * 图标句柄与图片本体属平台侧,留在各端(RN 用 require() 打进包,小程序用 aizhsUrl 在册 CDN 键),
 * 分工与 `about-sections.ts` / `carte-sections.ts` 同一条。
 *
 * 取词键的字面量只住在本文件:dead-key 扫描把 `packages/shared/src` 列进 mobile-rn 与
 * miniapp-taro 两端的参照语料(见 scripts/lib/i18n-scan-targets.mjs),所以两端写
 * `t(TRADER_PLAN_PROMO_KEYS.xxx)` 不会被读成"没人取这个词"。
 *
 * 三处复用 `carte.*`(与社群宣传卡屏同一条文案,同一键、不抄第二份):founder / recommend / invite。
 */

/** 图片槽位(顺序即渲染顺序;资源本体由两端各自注入) */
export const TRADER_PLAN_IMAGE_SLOTS = ['background', 'founderAvatar', 'groupQrcode'] as const
export type TraderPlanImageSlot = (typeof TRADER_PLAN_IMAGE_SLOTS)[number]

/** 本屏全部取词键(五语言词包同一族,两端同名同值) */
export const TRADER_PLAN_PROMO_KEYS = {
  /** 压在背景上的居中大标题:操盘手计划(与 RN 侧边栏入口同一键 ⇒ 入口与页面一张脸) */
  heroTitle: 'recruitment.title',
  /** 推荐人一行:社群名 | 身份 | 称呼(与 carte 屏同键同文案) */
  founder: 'carte.founder',
  /** 推荐语(与 carte 屏同键同文案) */
  recommended: 'carte.recommend',
  /** 扫码进社群的邀请语(与 carte 屏同键同文案) */
  groupIntro: 'carte.inviteHint',
  /** 长按二维码保存提示(二维码是真能长按落相册的在册能力,不是装饰) */
  qrcodeHint: 'vipScreen.qr.hint',
  /** 购买 CTA:落点是本端在册的操盘手开通页(RN 路由 VipTrader / 小程序 /pkg-shop/vip-trader/index/index) */
  purchase: 'vipTrader.openTrader',
} as const

/** 段落标识(两端按它选版式,漏一段或换序即结构分叉) */
export const TRADER_PLAN_SEGMENT_IDS = ['hero', 'founder', 'intro', 'qrcode', 'purchase'] as const
export type TraderPlanSegmentId = (typeof TRADER_PLAN_SEGMENT_IDS)[number]

export interface TraderPlanSegment {
  readonly id: TraderPlanSegmentId
  /** 该段内自上而下的文案行(取词键,已按渲染顺序排好) */
  readonly textKeys: readonly string[]
  /** 该段内图片槽位;无图为 null */
  readonly imageSlot: TraderPlanImageSlot | null
}

/**
 * 段落顺序(自上而下):全屏背景 + 标题 → 底部色块卡片内「创始人行 → 邀请语 → 二维码 → 购买 CTA」。
 * 两端渲染必须与此同序;文案段列在 textKeys 里,图片段列在 imageSlot 里。
 */
export const TRADER_PLAN_SEGMENTS: readonly TraderPlanSegment[] = [
  {
    id: 'hero',
    textKeys: [TRADER_PLAN_PROMO_KEYS.heroTitle],
    imageSlot: 'background',
  },
  {
    id: 'founder',
    textKeys: [TRADER_PLAN_PROMO_KEYS.founder, TRADER_PLAN_PROMO_KEYS.recommended],
    imageSlot: 'founderAvatar',
  },
  {
    id: 'intro',
    textKeys: [TRADER_PLAN_PROMO_KEYS.groupIntro],
    imageSlot: null,
  },
  {
    id: 'qrcode',
    textKeys: [TRADER_PLAN_PROMO_KEYS.qrcodeHint],
    imageSlot: 'groupQrcode',
  },
  {
    id: 'purchase',
    textKeys: [TRADER_PLAN_PROMO_KEYS.purchase],
    imageSlot: null,
  },
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
