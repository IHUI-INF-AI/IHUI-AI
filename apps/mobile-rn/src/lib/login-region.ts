// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:取数腿依赖 @ihui/api-client 的 fetchApi(RN 宿主请求出口,复用现成客户端,不新造 fetch)
import { getOAuthStatus } from '@ihui/api-client'
import {
  THIRD_PARTY_PRIORITY,
  orderByPlatformPriority,
  orderLoginTabs,
  resolveLoginRegion,
  type LoginRegion,
  type MaybeLoginRegion,
} from '@ihui/shared/utils/login-order-policy'
import type { LoginTab, ThirdPartyPlatform } from '@ihui/types'

/**
 * RN 登录页「按访客来源 IP 分档的登录方式优先级」接线(2026-10-27 立)。
 *
 * 排序表与判定**不在本文件**:唯一实现在 `@ihui/shared` 的 `utils/login-order-policy.ts`
 * (web 主站、桌面壳、扩展与 RN 共用同一份,§0.6);「哪个国家算国内」那一半更只在后端
 * `apps/api/src/services/login-region.ts`,本文件零复算。这里只做 RN 特有的两件事:
 *   1. 取数:经 RN 的请求出口拿 `loginRegion`,失败一律 null(未判定);
 *   2. 适配:RN 的第三方选项以 `platform` 为身份(共享层排序列以 `key` 为身份)。
 */

/** 最终生效地区;与共享层同形(此处只作别名,便于端内 import 面稳定)。 */
export type RnLoginRegion = LoginRegion
/** 服务器 IP 档:后端 `loginRegion` 的原始形态,`null`/缺键/脏值 = 未判定。 */
export type MaybeRnLoginRegion = MaybeLoginRegion

/**
 * RN 侧取 loginRegion 的最小出口 — GET /api/auth/oauth-status(公开端点,免鉴权)。
 * 请求失败、响应不成功、字段缺失或非值域值 ⇒ 一律 null(未判定),
 * 由调用方落 locale 粗判据兜底;绝不把"没判"当成国内或海外。
 */
export async function fetchRnLoginRegion(): Promise<LoginRegion | null> {
  try {
    const res = await getOAuthStatus()
    if (!res.success) return null
    const region = res.data?.loginRegion
    return region === 'domestic' || region === 'overseas' ? region : null
  } catch {
    return null
  }
}

/** 取最终生效地区:IP 优先,判不出才落 locale(与 web 同序;实现住共享层)。 */
export function resolveRnLoginRegion(input: {
  ipRegion: MaybeRnLoginRegion
  locale: string
}): LoginRegion {
  return resolveLoginRegion(input)
}

/**
 * 按地区重排 tab 顺序并剔除该地区不开放的方式:
 * domestic ⇒ 手机验证码优先;overseas ⇒ 邮箱优先且整体隐藏 phone
 * (后端 `^1[3-9]\d{9}$` 只收中国大陆号码,留着是指向必然失败的入口)。
 * 只改顺序与剔除,不增删成员;剔到空集时兜底该地区首位一项,绝不给空列表。
 */
export function orderRnLoginTabs(
  requested: readonly LoginTab[],
  region: RnLoginRegion,
): LoginTab[] {
  return orderLoginTabs(requested, region)
}

/**
 * 按地区重排第三方选项。RN 的选项以 `platform` 为身份,共享层排序列以 `key` 为身份,
 * 这里只做一次「同一对象换个字段名交给共享层」的适配 —— 排序规则本身不复写。
 */
export function orderRnThirdPartyOptions<T extends { platform: ThirdPartyPlatform }>(
  options: readonly T[],
  region: RnLoginRegion,
): T[] {
  const withKey = options.map((option) => ({ option, key: option.platform }))
  return orderByPlatformPriority(withKey, THIRD_PARTY_PRIORITY[region]).map(
    (wrapped) => wrapped.option,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
