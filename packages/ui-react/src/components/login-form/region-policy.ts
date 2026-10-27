// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ThirdPartyProvider, ThirdPartyPlatform } from './types'

/**
 * 登录方式优先级判据(DOM 端的取用面) —— 2026-10-27 起**不再是实现**,只是转发:
 * 排序表与 plan 函数住在 `@ihui/shared` 的 `utils/login-order-policy.ts`(web 主站、
 * 桌面壳、浏览器扩展与 RN 共用同一张表,§0.6 单一真相源)。
 *
 * 立因:RN 不能依赖 `@ihui/ui-react`(DOM 组件包),此前若各端自留一份排序表,
 * 「谁排第一」就会有两个真相源;下沉共享层后,端内只剩「取 region」这一件事
 * (web: useServerLoginRegion / RN: fetchRnLoginRegion / 扩展: useExtensionLoginRegion)。
 * 例外一枚:`isProviderPlatformAvailable`(provider 可用性谓词)住本文件——
 * `ThirdPartyProvider.icon` 是 ReactNode(DOM 形状),不宜下沉 shared;它不碰排序,不与 §0.6 冲突。
 * (2026-10-27 收敛分叉时自 origin/ad94f971901 逐字移植。)
 */
export {
  DEFAULT_LOGIN_TABS,
  FEATURED_LOGIN_PLATFORM,
  LOGIN_EXCLUDED_TABS,
  LOGIN_TAB_ORDER,
  QR_LOGIN_PLATFORM_PRIORITY,
  THIRD_PARTY_PRIORITY,
  isOverseasLocale,
  orderByPlatformPriority,
  orderLoginTabs,
  planLoginRegion,
  resolveLoginRegion,
} from '@ihui/shared/utils/login-order-policy'
export type {
  LoginRegion,
  LoginRegionPlan,
  LoginRegionPlanInput,
  MaybeLoginRegion,
} from '@ihui/shared/utils/login-order-policy'

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
