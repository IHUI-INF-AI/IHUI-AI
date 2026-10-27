// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { LoginTab, ThirdPartyPlatform } from '@ihui/types'

/**
 * 登录方式优先级判据(跨端唯一源) —— 2026-10-27 从 `@ihui/ui-react` 的 region-policy.ts
 * 下沉到共享层:web 主站、桌面壳、浏览器扩展(吃 ui-react)与 RN(不吃 DOM 包)必须
 * 用同一张排序表,否则「谁排第一」会在端内各写一套(§0.6)。
 *
 * 「哪个国家算国内」这一半**不在这里**:判据与伪造边界住在
 * `apps/api/src/services/login-region.ts`,前端只消费 `domestic | overseas | null`
 * 三个值,本文件零复算。
 *
 * 地区来源分两档,优先级固定:
 *   1. `ipRegion` —— 后端按请求来源 IP 判的国内/海外。
 *   2. `locale` —— IP 那腿判不出(Cloudflare 头缺失 + GeoIP 库未装/远程撞限/内网)
 *      时回落到界面语言。
 * 保留 locale 兜底而不让 IP 独判:边缘国家头与 GeoIP 都会失真(VPN、企业代理、跨境出差),
 * 而「判不出」在现网是常态而非异常。两档合起来的失效方向永远是「用更粗的判据给一个
 * 能用的排法」,绝不是白屏或空 tab 列表。
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
 * 显式列出未知值 ⇒ 传脏值也落兜底,不会被读成国内。
 */
export function resolveLoginRegion(input: {
  ipRegion: MaybeLoginRegion
  locale: string
}): LoginRegion {
  if (input.ipRegion === 'domestic' || input.ipRegion === 'overseas') return input.ipRegion
  return isOverseasLocale(input.locale) ? 'overseas' : 'domestic'
}

/**
 * 国内:扫码排第一(桌面弹窗的扫码 tab 即微信/企业微信/钉钉/飞书二维码;
 * 移动形态调用方不开放 qr tab,此时本序只排它给的三项,主推位由 featured 承担)。
 * 海外:邮箱验证码第一、密码次之,手机号整体不开放(海外号码被前端 isValidPhone
 * 与后端 `^1[3-9]\d{9}$` 双重拒绝,留着只会指向一个必然失败的入口)。
 */
export const LOGIN_TAB_ORDER: Readonly<Record<LoginRegion, readonly LoginTab[]>> = {
  domestic: ['qr', 'phone', 'email', 'password'],
  overseas: ['email', 'password', 'qr'],
}

/** 海外从 tab 集合里剔除的方式(2026-10-26 立的口径,随迁保留)。 */
export const LOGIN_EXCLUDED_TABS: Readonly<Record<LoginRegion, readonly LoginTab[]>> = {
  domestic: [],
  overseas: ['phone'],
}

/** 调用方没给 tabs 时共享层的默认集合(与 LoginForm 的 enabledTabs 默认值同集不同序)。 */
export const DEFAULT_LOGIN_TABS: readonly LoginTab[] = ['email', 'phone', 'password', 'qr']

/**
 * 第三方图标网格的优先序(主推大按钮之外的排序)。
 * 表外的平台一律排到末尾并保持调用方原序 —— 新加平台不必回来改这张表,也不会被丢掉;
 * 因此各端成员集不同(如 RN 没有 app/oidc)也无需各自维护一份。
 */
export const THIRD_PARTY_PRIORITY: Readonly<Record<LoginRegion, readonly ThirdPartyPlatform[]>> = {
  domestic: ['wechat', 'enterpriseWechat', 'dingtalk', 'feishu', 'alipay', 'app'],
  overseas: ['google', 'github', 'apple', 'oidc'],
}

/** 各地区的主推平台(整行大按钮)。可用性由调用方注入的 isPlatformAvailable 决定。 */
export const FEATURED_LOGIN_PLATFORM: Readonly<Record<LoginRegion, ThirdPartyPlatform>> = {
  domestic: 'wechat',
  overseas: 'google',
}

/**
 * 扫码 tab 内部各扫码渠道的优先序。
 *
 * 立因:调用方给的 QR 平台原序把「本站 App 扫码」排第一,而需求是"国内 IP 时微信扫码
 * 登录最优先显示" —— tab 排第一还不够,进了 tab 之后第一个子面板也得是微信,
 * 否则"最优先"只成立半格。
 * 海外档给空表 ⇒ 一个都不重排(维持调用方原序):海外没有"用微信扫码拉 App"这条动机。
 */
export const QR_LOGIN_PLATFORM_PRIORITY: Readonly<
  Record<LoginRegion, readonly ThirdPartyPlatform[]>
> = {
  domestic: ['wechat', 'enterpriseWechat', 'dingtalk', 'feishu'],
  overseas: [],
}

/**
 * 按地区的 tab 序重排调用方给的集合:不改成员(除该地区明确剔除的),只改顺序。
 * 表外的 tab 排在已知序之后,保持原相对顺序;剔到空集时兜底为该地区首位一项,
 * 绝不让 tab 列表为空(空列表会让表单整体消失)。
 */
export function orderLoginTabs(requested: readonly LoginTab[], region: LoginRegion): LoginTab[] {
  const order = LOGIN_TAB_ORDER[region]
  const excluded = LOGIN_EXCLUDED_TABS[region]
  const kept = requested.filter((tab) => !excluded.includes(tab))
  const ordered = [
    ...order.filter((tab) => kept.includes(tab)),
    ...kept.filter((tab) => !order.includes(tab)),
  ]
  if (ordered.length > 0) return ordered
  const first = order[0]
  return first ? [first] : [...kept]
}

/**
 * 按优先序表稳定排序:表内按键在表中的先后,表外保持调用方原相对顺序。
 * 传入空表 ⇒ 原样返回(排序不是"没给表就乱排")。
 */
export function orderByPlatformPriority<T extends { key: ThirdPartyPlatform }>(
  items: readonly T[],
  priority: readonly ThirdPartyPlatform[],
): T[] {
  const rank = new Map<ThirdPartyPlatform, number>()
  priority.forEach((key, index) => {
    if (!rank.has(key)) rank.set(key, index)
  })
  return items
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const rankA = rank.get(a.entry.key)
      const rankB = rank.get(b.entry.key)
      if (rankA !== undefined && rankB !== undefined) return rankA - rankB
      if (rankA !== undefined) return -1
      if (rankB !== undefined) return 1
      return a.index - b.index
    })
    .map((wrapped) => wrapped.entry)
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
  requestedTabs?: readonly LoginTab[]
  /** 该平台当前可用(凭据已配置且未被强制禁用)。缺省视为全可用。 */
  isPlatformAvailable?: (platform: ThirdPartyPlatform) => boolean
}

export function planLoginRegion(input: LoginRegionPlanInput): LoginRegionPlan {
  const region = resolveLoginRegion({ ipRegion: input.ipRegion, locale: input.locale })
  const requested = input.requestedTabs ?? [...DEFAULT_LOGIN_TABS]
  const tabs = orderLoginTabs(requested, region)

  const wantedFeatured = FEATURED_LOGIN_PLATFORM[region]
  const featuredPlatform =
    (input.isPlatformAvailable?.(wantedFeatured) ?? true) ? wantedFeatured : undefined

  return {
    region,
    tabs,
    featuredPlatform,
    priorityPlatforms: [...THIRD_PARTY_PRIORITY[region]],
    qrPlatformPriority: [...QR_LOGIN_PLATFORM_PRIORITY[region]],
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
