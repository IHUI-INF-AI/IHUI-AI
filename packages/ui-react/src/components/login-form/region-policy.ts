// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 地区→登录方式优先级判据 —— 本包消费面(票 L28754,2026-10-27 下沉后只留转出)。
 *
 * 唯一实现自 2026-10-27 起住在跨端共享层 `@ihui/shared/auth/login-region-policy`;
 * 本文件只做两件事:
 *   ① **原路径转出** —— web 与浏览器扩展的 `import { planLoginRegion } from '@ihui/ui-react'`
 *      一字不动。下沉原因(全账在共享层文件头):`@ihui/ui-react` 不是 `apps/mobile-rn`
 *      的依赖,其 barrel 又 `export * from 'lucide-react'` + Radix DOM 组件,接进 RN 等于
 *      把 Web 专用运行时拖进 Metro 包;而依赖方向是 ui-react → shared,所以判据落共享层、
 *      本包转出(同型先例:G-365 冷启动重登判据、D28 场景分析判据)。
 *   ② **留下 `isProviderPlatformAvailable`** —— 它判的是本包自己的 provider 配置形状
 *      (`ThirdPartyProvider` 含 `ReactNode` 图标),属 UI 契约,不下沉。
 */
export {
  isOverseasLocale,
  planLoginRegion,
  reorderByPriority,
  resolveLoginRegion,
} from '@ihui/shared/auth/login-region-policy'
export type {
  LoginRegion,
  LoginRegionPlan,
  LoginRegionPlanInput,
  MaybeLoginRegion,
} from '@ihui/shared/auth/login-region-policy'

import type { ThirdPartyPlatform, ThirdPartyProvider } from './types'

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
