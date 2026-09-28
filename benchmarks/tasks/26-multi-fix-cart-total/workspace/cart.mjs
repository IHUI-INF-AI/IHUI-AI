// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { applyDiscount } from './pricing.mjs';

export function cartTotal(items, discountPct) {
  let sum = 0;
  for (const it of items) sum += it.price * it.qty;
  return applyDiscount(discountPct, sum);
}
