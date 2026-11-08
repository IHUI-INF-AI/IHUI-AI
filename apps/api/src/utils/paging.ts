// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 分页解析的唯一出口(2026-10-31 收口)。
 *
 * 立因:`function parsePaging` 这段 5 行 clamp 在 routes/ 下被逐字节复制了 11 份,
 * 而 `routes/admin/_shared.ts` 的 zod `paginationSchema` 又写了同一组边界 ——
 * 四处算同一件事,改一处其余三处静默不同形(§0.6「同类判据/清单/取值实现全仓只许一份」)。
 * 边界值(≥1 / ≤1e6 / ≤100 / 默认 1·20)住本文件,query 形态与 zod 形态都从这里取。
 */
import { z } from 'zod'

/** 页码下界(1 起,0 与负数一律抬到 1) */
const PAGE_MIN = 1
/**
 * 页码上界(F-26,2026-11-08)。
 *
 * 只夹下界时,`page=1e308` 是有限整数会原样放行,而 `(page-1)*pageSize` 立刻变成
 * `Infinity` —— PG 报 `invalid input syntax for type bigint: "Infinity"`,列表端点 500。
 * 上界同时保证 offset ≤ 1e6×100 落在安全整数内,且百万页之后已无实际翻页语义。
 */
const PAGE_MAX = 1_000_000
/** 单页条数上界(防 `pageSize=1e6` 把整表拉进内存) */
const PAGE_SIZE_MAX = 100
/** 缺省页码 */
const DEFAULT_PAGE = 1
/** 缺省单页条数 */
const DEFAULT_PAGE_SIZE = 20

export interface PagingQuery {
  page?: string
  pageSize?: string
}

export interface Paging {
  page: number
  pageSize: number
}

/** 原始 NaN/Infinity 一律回落到缺省档,再按边界夹住 */
export function parsePaging(q: PagingQuery): Paging {
  return { page: clampPage(Number(q.page)), pageSize: clampPageSize(Number(q.pageSize)) }
}

/**
 * 页码夹取(F-26)。`undefined`/NaN/Infinity → 缺省 1;否则夹到 [PAGE_MIN, PAGE_MAX]。
 * 单值形态供 `limit` 等非标准 query 名复用同一组边界(agents.ts 的 28 处)。
 */
export function clampPage(value: number | undefined): number {
  const n = Math.floor(value ?? DEFAULT_PAGE)
  if (!Number.isFinite(n)) return DEFAULT_PAGE
  return Math.min(PAGE_MAX, Math.max(PAGE_MIN, n))
}

/** 页大小夹取(F-26/F-31):`undefined`/NaN/Infinity → 缺省 20;否则夹到 [PAGE_MIN, PAGE_SIZE_MAX] */
export function clampPageSize(value: number | undefined): number {
  const n = Math.floor(value ?? DEFAULT_PAGE_SIZE)
  if (!Number.isFinite(n)) return DEFAULT_PAGE_SIZE
  return Math.min(PAGE_SIZE_MAX, Math.max(PAGE_MIN, n))
}

/** zod 形态的同一组边界(管理端 query 校验共用,不再各处重打一遍数值) */
export const pageQuerySchema = z.coerce
  .number()
  .int()
  .min(PAGE_MIN)
  .max(PAGE_MAX)
  .default(DEFAULT_PAGE)
export const pageSizeQuerySchema = z.coerce
  .number()
  .int()
  .min(PAGE_MIN)
  .max(PAGE_SIZE_MAX)
  .default(DEFAULT_PAGE_SIZE)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
