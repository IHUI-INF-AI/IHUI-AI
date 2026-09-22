// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 工作区权限档展示(D111,G-164⑥):web 有完整档位面,移动端/extension 此前对
// "当前处于哪一档、该档会导致什么"零可见 —— 本模块给各端提供同一套取词逻辑。
//
// 词表约定(各端命名空间顶层,五语言 parity 由 check-i18n-keys 保证):
//   permissionTier.label
//   permissionTier.mode.default | plan | accept-edits | bypass-permissions | unknown
//     └─ title / desc
// 键按 wire 拼写命名,与 @ihui/types 的 PERMISSION_MODE_WIRE 一致。

import { permissionModeDisplayKey } from '@ihui/types/permission-mode'

export type PermissionTierDisplayKey =
  'default' | 'plan' | 'accept-edits' | 'bypass-permissions' | 'unknown'

/**
 * 档位展示键 → 词表键的**静态**映射。
 * 键必须是字面量:各端 i18n 键检查靠静态扫描保证"代码引用的键五语言都存在",
 * 动态模板拼接(`t(\`...${id}.title\`)`)会绕过这层保护。
 */
export const PERMISSION_TIER_WORD_KEYS: Readonly<
  Record<PermissionTierDisplayKey, { title: string; desc: string }>
> = {
  default: {
    title: 'permissionTier.mode.default.title',
    desc: 'permissionTier.mode.default.desc',
  },
  plan: {
    title: 'permissionTier.mode.plan.title',
    desc: 'permissionTier.mode.plan.desc',
  },
  'accept-edits': {
    title: 'permissionTier.mode.accept-edits.title',
    desc: 'permissionTier.mode.accept-edits.desc',
  },
  'bypass-permissions': {
    title: 'permissionTier.mode.bypass-permissions.title',
    desc: 'permissionTier.mode.bypass-permissions.desc',
  },
  unknown: {
    title: 'permissionTier.mode.unknown.title',
    desc: 'permissionTier.mode.unknown.desc',
  },
}

/**
 * 任意存储/接口值 → 该显示的词表键。
 * - 未配置(null/undefined)→ default(未配置的生效行为就是默认档,如实显示);
 * - 认不出 → unknown(绝不静默显示成 default:用户配了的高危档被显示成"默认模式"是授权误导);
 * - 其余(含历史 camel 拼写)归一到 wire 键。
 */
export function permissionTierWordKeys(mode: string | null | undefined): {
  title: string
  desc: string
} {
  return PERMISSION_TIER_WORD_KEYS[permissionModeDisplayKey(mode)]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
