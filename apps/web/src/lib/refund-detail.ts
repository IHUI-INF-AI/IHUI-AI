// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 退款详情加载(W-03,2026-11-08)。
 *
 * 旧实现:详情接口返回任何失败(401/403/500/网络)都静默退化为
 * `/api/refunds/me?page=1&pageSize=100` ——
 *   1) 第 101 条以后的退款永远查不到,表现为「找不到」;
 *   2) 降级没有任何可见痕迹,order / auditRecords 以空值冒充「本来就没有」。
 *
 * 新口径:
 * - 只有详情接口明确 404 才允许降级到列表查询(例如详情端点尚未部署);
 * - 列表查询按页翻到 `total` 为止,不截断在第 1 页;
 * - 返回 `degraded: true`,由页面显式展示「数据降级」提示。
 */

export const REFUND_FALLBACK_PAGE_SIZE = 100
export const REFUND_FALLBACK_MAX_PAGES = 20

export interface RefundDetailResult<R> {
  refund: R
  degraded: boolean
}

export type RefundDetailFetch<R> =
  | { ok: true; data: { refund: R } }
  | { ok: false; status?: number; error?: string }

export type RefundListFetch<R> =
  | { ok: true; data: { list: R[]; total: number } }
  | { ok: false; error?: string }

export interface LoadRefundDetailOptions<R extends { id: string }> {
  id: string
  detail: (id: string) => Promise<RefundDetailFetch<R>>
  list: (page: number) => Promise<RefundListFetch<R>>
  notFoundMessage: string
}

export async function loadRefundDetail<R extends { id: string }>(
  options: LoadRefundDetailOptions<R>,
): Promise<RefundDetailResult<R>> {
  const { id, detail, list, notFoundMessage } = options

  const detailRes = await detail(id)
  if (detailRes.ok) return { refund: detailRes.data.refund, degraded: false }
  // 只有 404(详情端点不存在/该单不在详情面)才允许降级;
  // 401/403/5xx/网络错误必须原样暴露,不能拿列表数据冒充详情。
  if (detailRes.status !== 404) {
    throw new Error(detailRes.error || notFoundMessage)
  }

  for (let page = 1; page <= REFUND_FALLBACK_MAX_PAGES; page++) {
    const listRes = await list(page)
    if (!listRes.ok) throw new Error(listRes.error || notFoundMessage)
    const items = listRes.data.list ?? []
    const found = items.find((item) => item.id === id)
    if (found) return { refund: found, degraded: true }
    const total = listRes.data.total ?? 0
    if (items.length < REFUND_FALLBACK_PAGE_SIZE || page * REFUND_FALLBACK_PAGE_SIZE >= total) break
  }

  throw new Error(notFoundMessage)
}
