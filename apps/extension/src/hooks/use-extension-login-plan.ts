// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useExtensionLoginPlan —— 扩展端登录方式优先级取数层(票 L28754,2026-10-27 立)
 *
 * 扩展端(popup + sidepanel)各有自己的登录 UI,却从没取过 `GET /api/auth/oauth-status`
 * 的 `loginRegion` ⇒ 同一访客在扩展里看到的排法与 web 主站不一致。本模块只做两件事:
 *   1. 把服务器按**访客来源 IP** 判出的地区取回来(取不到 = `null` = 未判定);
 *   2. 连同界面语言交给共享判据 `planLoginRegion`(@ihui/ui-react)。
 * 「谁排第一」的排序、剔除、主推可用性三件事一律住在共享层,端内不复算(§0.6)。
 *
 * 取数复用 `@ihui/api-client` 的 `getOAuthStatus()`(与 web 端同一个端点、同一份响应类型),
 * 模块级缓存「只取一次」:登录窗与页面其它消费者不该各打一次 GET。
 */
import * as React from 'react'
import { getOAuthStatus, type OAuthStatus } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { OAUTH_BRAND_COLORS } from '@ihui/design-tokens'
import {
  isProviderPlatformAvailable,
  planLoginRegion,
  type LoginRegionPlan,
  type MaybeLoginRegion,
  type ThirdPartyProvider,
} from '@ihui/ui-react'

import { useI18n } from '../i18n'

/**
 * 只认 `domestic` / `overseas` 两个字面量:端点挂、`success=false`、缺键、脏值(第三种值、
 * 国名、大小写变体)一律算未判定。把「没判」读成某一侧会直接给出错误的排法,而错误排法
 * 在界面上看起来完全正常 —— 这一格不能猜。
 */
export function pickServerLoginRegion(status: ApiResult<OAuthStatus>): MaybeLoginRegion {
  if (!status.success) return null
  const value = status.data.loginRegion
  return value === 'domestic' || value === 'overseas' ? value : null
}

let loginRegionCache: Promise<MaybeLoginRegion> | null = null

/** 访客 IP 地区(整进程一次);失败/判不出 ⇒ `null`,由调用方回落界面语言。 */
export function loadServerLoginRegion(): Promise<MaybeLoginRegion> {
  if (!loginRegionCache) {
    loginRegionCache = getOAuthStatus()
      .then(pickServerLoginRegion)
      .catch(() => null)
  }
  return loginRegionCache
}

export interface ExtensionLoginPlan {
  /** 共享判据的产出:tabs 顺序、主推平台、图标网格优先序。 */
  plan: LoginRegionPlan
  /** 主推大按钮的品牌底色;无主推 ⇒ undefined。 */
  featuredBackground?: string
}
/**
 * @param providers 注入共享 `LoginForm` 的那一份第三方 provider 列表(可用性判据的输入)。
 */
export function useExtensionLoginPlan(
  providers: readonly ThirdPartyProvider[],
): ExtensionLoginPlan {
  const { locale } = useI18n()
  const [ipRegion, setIpRegion] = React.useState<MaybeLoginRegion>(null)

  React.useEffect(() => {
    let alive = true
    void loadServerLoginRegion().then((region) => {
      if (alive) setIpRegion(region)
    })
    return () => {
      alive = false
    }
  }, [])

  const plan = React.useMemo(
    () =>
      planLoginRegion({
        ipRegion,
        locale,
        isPlatformAvailable: (platform) => isProviderPlatformAvailable(providers, platform),
      }),
    [ipRegion, locale, providers],
  )

  const featuredBackground =
    plan.featuredPlatform === undefined ? undefined : OAUTH_BRAND_COLORS[plan.featuredPlatform]

  return { plan, featuredBackground }
}

/** 模块级缓存在同进程内只取一次;不清掉就没法逐档验服务器的不同答复。 */
export const __test__ = {
  resetLoginRegionCache: (): void => {
    loginRegionCache = null
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
