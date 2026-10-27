// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { LoginTab, ThirdPartyProvider, ThirdPartyPlatform } from './types'

/**
 * 登录方式优先级判据(地区单源) —— 2026-10-26 立,自 apps/web/src/lib/login-region-policy.ts
 * 迁入共享层:web 主站、桌面壳(Tauri 加载同一份 web 产物)与浏览器扩展都吃渲染层这一份,
 * 不得在端内各写一套「谁排第一」(§0.6)。
 *
 * 地区来源分两档,优先级固定:
 *   1. `ipRegion` —— 后端按**请求来源 IP** 判的国内/海外(判据与伪造边界住在
 *      apps/api/src/services/login-region.ts;前端只认 domestic/overseas 两个字面量,
 *      不在这里复算「哪个国家算国内」)。
 *   2. `locale` —— IP 那一腿判不出(Cloudflare 头缺失 + GeoIP 库未装/远程撞限/内网)
 *      时回落到界面语言。原 2026-10-26 版整条判据只有这一档。
 *
 * 为什么保留 locale 兜底而不让 IP 独判:边缘国家头与 GeoIP 都会失真(VPN、企业代理、
 * 跨境出差),而「判不出」在现网是常态而非异常(本机实测 GeoLite2 库缺失)。两档合起来
 * 的失效方向永远是「用更粗的判据给一个能用的排法」,绝不是白屏或空 tab 列表。
 */

/** 服务器按请求来源 IP 判出的地区;`null`/`undefined` = 未判定。 */
export type LoginRegion = 'domestic' | 'overseas'
export type MaybeLoginRegion = LoginRegion | null | undefined

/** 非简体中文界面即视为海外(IP 未判定时的兜底档)。 */
export function isOverseasLocale(locale: string): boolean {
  return locale !== 'zh-CN'
}

/**
 * 取最终生效地区:IP 优先,判不出才落 locale。
 * 显式列出未知值 ⇒ 传脏值(IP 字段被别的响应形态写成第三种值)也落兜底,不会被读成国内。
 */
export function resolveLoginRegion(input: {
  ipRegion: MaybeLoginRegion
  locale: string
}): LoginRegion {
  if (input.ipRegion === 'domestic' || input.ipRegion === 'overseas') return input.ipRegion
  return isOverseasLocale(input.locale) ? 'overseas' : 'domestic'
}

/**
 * 「该平台当前可用吗」的唯一实现(2026-10-27 立):`enabled` ∧ 未被强制禁用。
 *
 * 立因:`planLoginRegion` 的 `isPlatformAvailable` 入参由调用方注入,而各端对同一件事
 * (注入进来的 provider 列表里这一项能不能点)只能有一种问法 —— web 端一度内联写了
 * 一份 `providers.some(...)`,扩展端接着写第二份就会开始漂移(§0.6)。消费方传
 * `(platform) => isProviderPlatformAvailable(config.providers, platform)`,不再复述条件。
 */
export function isProviderPlatformAvailable(
  providers: readonly ThirdPartyProvider[],
  platform: ThirdPartyPlatform,
): boolean {
  return providers.some(
    (provider) => provider.key === platform && provider.enabled && !provider.forceDisabled,
  )
}

/**
 * 国内:扫码排第一(桌面弹窗的扫码 tab 即微信/企业微信/钉钉/飞书二维码;
 * 移动形态调用方不开放 qr tab,此时本序只排它给的三项,主推位由 featured 承担)。
 * 海外:邮箱验证码第一、密码次之,手机号整体不开放(海外号码被前端 isValidPhone
 * 与后端 `^1[3-9]\d{9}$` 双重拒绝,留着只会指向一个必然失败的入口)。
 */
const TAB_ORDER: Readonly<Record<LoginRegion, readonly LoginTab[]>> = {
  domestic: ['qr', 'phone', 'email', 'password'],
  overseas: ['email', 'password', 'qr'],
}

/** 海外从 tab 集合里剔除的方式(既有行为,2026-10-26 立的口径,随迁保留)。 */
const REGION_EXCLUDED_TABS: Readonly<Record<LoginRegion, readonly LoginTab[]>> = {
  domestic: [],
  overseas: ['phone'],
}

/** 调用方没给 tabs 时共享层的默认集合(与 LoginForm 的 enabledTabs 默认值同集不同序)。 */
const DEFAULT_TABS: readonly LoginTab[] = ['email', 'phone', 'password', 'qr']

/**
 * 第三方图标网格的优先序(主推大按钮之外的排序)。
 * 表外的平台一律排到末尾并保持调用方原序 —— 新加平台不必回来改这张表,也不会被丢掉。
 */
const THIRD_PARTY_PRIORITY: Readonly<Record<LoginRegion, readonly ThirdPartyPlatform[]>> = {
  domestic: ['wechat', 'enterpriseWechat', 'dingtalk', 'feishu', 'alipay', 'app'],
  overseas: ['google', 'github', 'apple', 'oidc'],
}

/**
 * 各地区的主推平台(整行大按钮)。可用性由调用方注入的 isPlatformAvailable 决定,不可用即不主推。 */
const FEATURED_PLATFORM: Readonly<Record<LoginRegion, ThirdPartyPlatform>> = {
  domestic: 'wechat',
  overseas: 'google',
}

/**
 * 扫码 tab 内部各扫码渠道的优先序(2026-10-27 立)。
 *
 * 立因:调用方给的 QR_PLATFORMS 原序把「本站 App 扫码」排第一,而需求是"国内 IP 时微信
 * 扫码登录最优先显示" —— tab 排第一还不够,进了 tab 之后第一个子面板也得是微信,
 * 否则"最优先"只成立半格。
 * 海外档给空表 ⇒ 一个都不重排(维持调用方原序):海外没有"用微信扫码拉 App"这条动机,
 * 保留 App 扫码在前是原设计,判据不越权改它。
 */
const QR_PLATFORM_PRIORITY: Readonly<Record<LoginRegion, readonly ThirdPartyPlatform[]>> = {
  domestic: ['wechat', 'enterpriseWechat', 'dingtalk', 'feishu'],
  overseas: [],
}

export interface LoginRegionPlan {
  /** 最终生效地区(IP 优先、locale 兜底之后的结果)。 */
  region: LoginRegion
  /** 已按地区排序、且只含调用方开放的方式;顺序即 tab 渲染顺序,首位即默认选中。 */
  tabs: LoginTab[]
  /** 整行主推大按钮的平台;undefined = 维持普通图标网格。 */
  featuredPlatform?: ThirdPartyPlatform
  /** 图标网格优先序(表外平台自动排末尾)。 */
  priorityPlatforms: readonly ThirdPartyPlatform[]
  /** 扫码 tab 内部渠道优先序;空表 = 不重排,维持调用方原序。 */
  qrPlatformPriority: readonly ThirdPartyPlatform[]
}

export interface LoginRegionPlanInput {
  /** 后端下发的 IP 地区;未判定传 null。 */
  ipRegion: MaybeLoginRegion
  /** 当前界面语言(BCP47,与 next-intl useLocale() 同形)。 */
  locale: string
  /** 调用方开放的 tab 集合;undefined = 用共享层默认全集。 */
  requestedTabs?: LoginTab[]
  /** 该平台当前可用(凭据已配置且未被强制禁用)。缺省视为全可用。 */
  isPlatformAvailable?: (platform: ThirdPartyPlatform) => boolean
}

/**
 * 按 TAB_ORDER 重排调用方给的集合:不改成员(除该地区明确剔除的),只改顺序。
 * 表外的 tab 排在已知序之后,保持原相对顺序。
 */
function orderTabs(
  requested: readonly LoginTab[],
  order: readonly LoginTab[],
  excluded: readonly LoginTab[],
): LoginTab[] {
  const kept = requested.filter((tab) => !excluded.includes(tab))
  return [
    ...order.filter((tab) => kept.includes(tab)),
    ...kept.filter((tab) => !order.includes(tab)),
  ]
}

export function planLoginRegion(input: LoginRegionPlanInput): LoginRegionPlan {
  const region = resolveLoginRegion({ ipRegion: input.ipRegion, locale: input.locale })
  const requested = input.requestedTabs ?? [...DEFAULT_TABS]
  const tabs = orderTabs(requested, TAB_ORDER[region], REGION_EXCLUDED_TABS[region])
  // 剔到空集时兜底为该地区首位一项,绝不让 tab 列表为空(空列表会让表单整体消失)。
  const firstTab = TAB_ORDER[region][0]
  const finalTabs = tabs.length > 0 ? tabs : firstTab ? [firstTab] : [...DEFAULT_TABS]

  const wantedFeatured = FEATURED_PLATFORM[region]
  const featuredPlatform =
    (input.isPlatformAvailable?.(wantedFeatured) ?? true) ? wantedFeatured : undefined

  return {
    region,
    tabs: finalTabs,
    featuredPlatform,
    priorityPlatforms: [...THIRD_PARTY_PRIORITY[region]],
    qrPlatformPriority: [...QR_PLATFORM_PRIORITY[region]],
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
