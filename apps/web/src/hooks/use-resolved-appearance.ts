// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生效外观配置(resolved appearance)。
 *
 * 立因(2026-11-15):`components/ai/markdown-stream.tsx` 早在「外观 v2」那批就
 * import 了本 hooks 的 `useResolvedAppearanceConfig`,但本文件当时没随提交入库 ⇒
 * web typecheck 结构性失败(TS2307)。本次补实现。
 *
 * 为什么需要「resolved」这一层,而不是让组件直接读 `useAppearanceStore`:
 *   ① **缺键回落**:盘上旧快照不会带后来新增的字段(比如 11-15 才加的 `bionicReading`)。
 *      直接读原始 state 会拿到 `undefined`,`if (undefined)` 与 `if (false)` 走同一条路,
 *      但 `undefined` 传给需要 boolean 的地方就是类型/行为双坑。这里一次性补齐默认值。
 *   ② **分层单一出入口**:生效值 = 默认值 ← 全局用户配置 ← (预留)工作区覆盖。
 *      目前只有前两层有存储(工作区级外观覆盖尚未落地,见 `stores/appearance-settings.ts`
 *      顶部注释),将来加第三层只改这里,消费方一行不用动。
 *   ③ **与消息级覆盖的分工**:单条消息的 `--message-*` 覆盖在
 *      `stores/appearance-scope.ts`,属"渲染期变量增量",不属于本配置对象。
 *
 * 性能:返回对象每次都是新建的 ⇒ 必须用 `useShallow` 做浅比较,否则 store 任何
 * 无关字段变动都会把所有消费方重渲一遍。
 */

import { useShallow } from 'zustand/react/shallow'

import {
  APPEARANCE_DEFAULTS,
  useAppearanceStore,
  type AppearanceConfig,
} from '@/stores/appearance-settings'

/**
 * 配置键表 —— 从默认值对象的键派生,**不手写第二份清单**:
 * `AppearanceConfig` 加字段 ⇒ `APPEARANCE_DEFAULTS` 必须同步加 ⇒ 这里自动跟上。
 */
const CONFIG_KEYS = Object.keys(APPEARANCE_DEFAULTS) as (keyof AppearanceConfig)[]

/**
 * 把任意来路的(可能是旧版/残缺的)配置收敛成完整生效配置。
 *
 * 纯函数,便于单测;store 里同时带着方法(update/importConfig…),
 * 所以这里按键表白名单取值,**不整体展开 state** —— 否则方法会被一起拷进配置对象。
 */
export function resolveAppearanceConfig(source: Partial<AppearanceConfig>): AppearanceConfig {
  const resolved: AppearanceConfig = { ...APPEARANCE_DEFAULTS }
  // 具体接口没有字符串索引签名,写回缺省项必须显式绕一次(不能直接断言)
  const target = resolved as unknown as Record<string, unknown>
  const input = source as Record<string, unknown>
  for (const key of CONFIG_KEYS) {
    const value = input[key]
    if (value !== undefined) target[key] = value
  }
  return resolved
}

function selectResolved(s: Partial<AppearanceConfig>): AppearanceConfig {
  return resolveAppearanceConfig(s)
}

/** 当前生效的外观配置(默认值已补齐,可直接当 boolean/number 用) */
export function useResolvedAppearanceConfig(): AppearanceConfig {
  return useAppearanceStore(useShallow(selectResolved))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
