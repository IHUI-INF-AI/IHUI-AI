// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useLoginRegionPlan —— RN 登录页「按访客 IP 地区排登录方式优先级」的取数与接线层
 * (票 L28754 RN 半格,2026-10-27 立)
 *
 * RN 登录页此前**从不取** `GET /api/auth/oauth-status` 的 `loginRegion`(现读该文件对
 * `loginRegion` / `oauth-status` 零引用),所以同一访客在 App 里看到的排法与 web 主站、
 * 桌面壳、浏览器扩展不一致 —— 那三端都走共享判据。本模块只做两件事:
 *   1. 把服务器按**访客来源 IP** 判出的地区取回来(取不到 = `null` = 未判定);
 *   2. 连同界面语言交给共享判据 `planLoginRegion`(@ihui/shared/auth/login-region-policy),
 *      并用同一个执行器 `reorderByPriority` 重排第三方登录项。
 * 「谁排第一」的表与排序执行器都住在共享层,端内不复算(§0.6);端内只有取数与形状适配。
 *
 * 为什么判据从 `@ihui/ui-react` 下沉到 `@ihui/shared`:mobile-rn 不依赖 ui-react
 * (pnpm 严格布局下没有符号链接,引即 TS2307),而 ui-react 的 barrel 会把 Radix DOM
 * 组件与 lucide-react 拖进 RN 包。下沉后 web/扩展的 `@ihui/ui-react` 消费面一字未动。
 *
 * 本票射程只有「优先序」:`plan.tabs`(tab 顺序 + 海外剔手机号)与 `plan.featuredPlatform`
 * (整行主推大按钮)两格**未接** —— 前者改的是成员集(会摘掉 RN 的手机号 tab),后者要动
 * packages/app 的渲染层并过真机观感验证,都超出「只改顺序、不改成员」的边界。
 */
import { useEffect, useMemo, useState } from 'react'
import { getOAuthStatus, type OAuthStatus } from '@ihui/api-client'
import type { ApiResult, ThirdPartyLoginOption } from '@ihui/types'
import {
  planLoginRegion,
  reorderByPriority,
  type LoginRegionPlan,
  type MaybeLoginRegion,
} from '@ihui/shared/auth/login-region-policy'

/**
 * 只认 `domestic` / `overseas` 两个字面量:端点挂、`success=false`、缺键、脏值(第三种值、
 * 国名、大小写变体)一律算未判定。把「没判」读成某一侧会直接给出错误的排法,而错误排法
 * 在界面上看起来完全正常 —— 这一格不能猜(与扩展端 use-extension-login-plan 同口径)。
 */
export function pickServerLoginRegion(status: ApiResult<OAuthStatus>): MaybeLoginRegion {
  if (!status.success) return null
  const value = status.data.loginRegion
  return value === 'domestic' || value === 'overseas' ? value : null
}

let loginRegionCache: Promise<MaybeLoginRegion> | null = null

/** 访客 IP 地区(整进程一次);失败/判不出 ⇒ `null`,由共享判据回落界面语言。 */
export function loadServerLoginRegion(): Promise<MaybeLoginRegion> {
  if (!loginRegionCache) {
    loginRegionCache = getOAuthStatus()
      .then(pickServerLoginRegion)
      .catch(() => null)
  }
  return loginRegionCache
}

/**
 * 第三方登录项按地区优先序重排:**只改顺序、不改成员**。
 * 表外平台(如 RN 独有的 apple)自动落到末尾并保持原相对顺序;执行器是共享层那一份,
 * 端内只注入取键函数(RN 的选项以 `platform` 为身份,web 图标网格以 `key` 为身份)。
 */
export function orderThirdPartyOptionsByRegion(
  options: readonly ThirdPartyLoginOption[],
  plan: LoginRegionPlan,
): ThirdPartyLoginOption[] {
  return reorderByPriority(options, plan.priorityPlatforms, (option) => option.platform)
}

/**
 * @param locale 当前界面语言(IP 判不出时共享判据按它兜底)
 * @returns 已按访客地区算好的登录方式优先级计划
 */
export function useLoginRegionPlan(locale: string): LoginRegionPlan {
  const [ipRegion, setIpRegion] = useState<MaybeLoginRegion>(null)

  useEffect(() => {
    let alive = true
    void loadServerLoginRegion().then((region) => {
      if (alive) setIpRegion(region)
    })
    return () => {
      alive = false
    }
  }, [])

  return useMemo(() => planLoginRegion({ ipRegion, locale }), [ipRegion, locale])
}

/** 模块级缓存在同进程内只取一次;不清掉就没法逐档验服务器的不同答复。 */
export const __test__ = {
  resetLoginRegionCache: (): void => {
    loginRegionCache = null
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
