// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { PERMISSION_TIER_WORD_KEYS, permissionTierWordKeys } from '@ihui/shared/chat'

/**
 * 权限档取词(档名 + 后果说明),词表在跨端共享命名空间 permissionTier。
 * 档位归一与词表键都来自共享真相源 @ihui/shared/chat:未配置 → 默认档,
 * 认不出 → unknown 档(绝不把用户配的高危档显示成"默认模式")。
 *
 * 10 个键在此逐个写成实参为字面量的取词调用,而不是把共享表的值当变量传进去:
 * 静态守门(`check-i18n-keys` / 词表可解析闸)只提取实参为字面量的取词调用,
 * 传变量会让"五语齐备"校验形同虚设。比对走对象同一性 —— 共享表若改值,
 * 各消费点同时失配 → 落到 unknown 分支,不会静默错位。
 *
 * 本文件是 web 侧唯一一份(此前 6 个消费文件各存一份逐字节相同的副本,共 ~130 行重复)。
 * `tTier` 由调用方注入(`useTranslations()` 根命名空间),故这里不依赖 React。
 */
export function permissionTierText(
  mode: string | null | undefined,
  tTier: (key: string) => string,
): { title: string; desc: string } {
  const keys = permissionTierWordKeys(mode)
  if (keys === PERMISSION_TIER_WORD_KEYS.default) {
    return {
      title: tTier('permissionTier.mode.default.title'),
      desc: tTier('permissionTier.mode.default.desc'),
    }
  }
  if (keys === PERMISSION_TIER_WORD_KEYS.plan) {
    return {
      title: tTier('permissionTier.mode.plan.title'),
      desc: tTier('permissionTier.mode.plan.desc'),
    }
  }
  if (keys === PERMISSION_TIER_WORD_KEYS['accept-edits']) {
    return {
      title: tTier('permissionTier.mode.accept-edits.title'),
      desc: tTier('permissionTier.mode.accept-edits.desc'),
    }
  }
  if (keys === PERMISSION_TIER_WORD_KEYS['bypass-permissions']) {
    return {
      title: tTier('permissionTier.mode.bypass-permissions.title'),
      desc: tTier('permissionTier.mode.bypass-permissions.desc'),
    }
  }
  return {
    title: tTier('permissionTier.mode.unknown.title'),
    desc: tTier('permissionTier.mode.unknown.desc'),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
