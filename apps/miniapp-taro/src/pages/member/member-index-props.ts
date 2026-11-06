// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { VipLevel } from '@/api'
import type { VipLevelItem2 } from '@ihui/types'

/**
 * 权益文案归一:后端 /vip/levels 的 benefits 实返数组(string 或 {name}),
 * 与 RN 端 `apps/mobile-rn/src/screens/VipScreen.tsx:60-75` 同口径。
 * 纯函数;不 import 任何 `@ihui/rn-app`(壳声明生成器会把共享包导出降级)。
 */
export function normalizeBenefits(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const text = item.trim()
      if (text) out.push(text)
      continue
    }
    if (item && typeof item === 'object') {
      const name = (item as { name?: unknown }).name
      if (typeof name === 'string' && name.trim()) out.push(name.trim())
    }
  }
  return out
}

/**
 * 在架最低档 —— 母页「开通 VIP」CTA 的价格源(与本页同一支 GET /vip/levels,不另取端点)。
 * `/vip/levels` 已由 listVipLevels(true) 过滤 status=1,这里再核一次是防在册清单口径变动。
 * 取不到档位 ⇒ 返回 null,由调用方整块不渲染(拿 0 或写死常量冒充 = 可见错误文案)。
 */
export function pickEntryLevel(levels: VipLevel[]): VipLevel | null {
  return levels
    .filter((l) => l.status === 1)
    .reduce<VipLevel | null>((min, l) => (!min || l.price < min.price ? l : min), null)
}

/**
 * 时长最长的一档 —— 母页「升级永久 VIP」CTA 的价格源。
 * 库里没有「永久」标志位,可判定的最近语义是 durationDays 最大(种子 0037:永久会员 36500 天);
 * 划线原价后端无字段(vip_levels 无 original_price 列)⇒ 不伪造,母页不再展示原价。
 */
export function pickPermanentLevel(levels: VipLevel[]): VipLevel | null {
  return levels
    .filter((l) => l.status === 1)
    .reduce<VipLevel | null>(
      (max, l) => (!max || l.durationDays > max.durationDays ? l : max),
      null,
    )
}

/**
 * 档位列表转换:接口 price 单位为分(`formatPrice` 同口径),共享段 `VipLevelsSection`
 * 按元渲染(`¥ {price.toFixed(2)}`)⇒ 这里做 分→元。
 * 权益归一成 string[],其余字段透传。
 */
export function toLevelItems(levels: VipLevel[]): VipLevelItem2[] {
  return levels.map((l) => ({
    id: l.id,
    levelName: l.levelName,
    levelValue: l.levelValue,
    price: l.price / 100,
    durationDays: l.durationDays,
    status: l.status,
    benefits: normalizeBenefits(l.benefits),
  }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
