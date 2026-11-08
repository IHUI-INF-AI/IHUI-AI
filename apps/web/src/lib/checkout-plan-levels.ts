// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * 结账页档位解析（2026-11-08）。
 *
 * 背景：`payment/page.tsx` 的 plan id 是前端语义名（`free|pro|enterprise`），
 * 而 `POST /vip/order` 的 `vipLevelId` 必须是 `vip_levels.id`（uuid）。
 * 直接把 plan id 当 `vipLevelId` 传会按 uuid 查库 404，结账页无法下单。
 *
 * 映射按 `levelValue` 显式固定，且与 DB 种子价格对齐：
 *   free→levelValue 0（¥0）/ pro→2（¥99=9900 分）/ enterprise→3（¥499=49900 分）。
 * 个人版（levelValue 1）不在本结账页的档位设计内，故不参与映射。
 */

export interface CheckoutLevel {
  id: string
  levelValue: number
  price: number
  status?: number
}

export const CHECKOUT_PLAN_LEVEL_VALUE: Record<string, number> = {
  free: 0,
  pro: 2,
  enterprise: 3,
}

/** 解析 plan id → 服务端档位；未知 plan 或档位缺失/下架时返回 null，由调用方拦住下单。 */
export function resolveCheckoutLevel(
  levels: readonly CheckoutLevel[],
  planId: string,
): CheckoutLevel | null {
  const levelValue = CHECKOUT_PLAN_LEVEL_VALUE[planId]
  if (levelValue === undefined) return null
  return (
    levels.find((l) => l.levelValue === levelValue && (l.status === undefined || l.status === 1)) ??
    null
  )
}
