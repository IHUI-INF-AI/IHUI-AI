// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 财务路由共享件(2026-11-23 拆):入参 schema 与响应封装。
 *
 * 为什么拆:fin-accounting.ts 曾到 1084 行(客户/凭证/报表/结账 + 发票/银行 + 税务),
 * 超出单文件守门。这里只放"多份要共用"的东西 —— schema 与 guard/badRequest;
 * 端点本身留在各自的插件里,路径与权限一字未改。
 */
import { z } from 'zod'

import { AppError } from '../errors/AppError.js'
import { success, error } from '../utils/response.js'

export const VIEW = 'finance:ledger:view'
export const MANAGE = 'finance:ledger:manage'
export const PERIOD = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '期间必须是 YYYY-MM')

export const clientBody = z.object({
  name: z.string().min(1).max(200),
  shortName: z.string().max(100).optional(),
  taxNo: z.string().max(50).optional(),
  taxpayerType: z.enum(['general', 'small']).optional(),
  industry: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  taxAuthority: z.string().max(200).optional(),
  legalPerson: z.string().max(100).optional(),
  contactName: z.string().max(100).optional(),
  contactPhone: z.string().max(50).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  remark: z.string().max(2000).optional(),
})

export const ledgerBody = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(100),
  accountingStandard: z.enum(['small_business', 'general']).optional(),
  startPeriod: PERIOD,
})

export const openingBody = z.object({
  period: PERIOD,
  rows: z
    .array(
      z.object({
        accountCode: z.string().min(1),
        debit: z.union([z.string(), z.number()]).optional(),
        credit: z.union([z.string(), z.number()]).optional(),
        aux: z.record(z.string(), z.string()).optional(),
      }),
    )
    .max(2000),
})

export const lineBody = z.object({
  accountCode: z.string().min(1),
  direction: z.enum(['debit', 'credit']),
  amount: z.union([z.string(), z.number()]),
  summary: z.string().max(500).optional(),
  aux: z.record(z.string(), z.string()).optional(),
})

export const voucherBody = z.object({
  period: PERIOD,
  voucherDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.string().max(500).optional(),
    source: z.enum(['manual', 'auto', 'import', 'payroll', 'closing', 'reverse', 'asset-dep']).optional(),

  sourceRef: z.string().max(200).optional(),
  post: z.boolean().optional(),
  lines: z.array(lineBody).min(2),
})

export const importBody = z.object({
  vouchers: z
    .array(voucherBody.extend({ sourceRef: z.string().min(1).max(200) }))
    .min(1)
    .max(500),
})

export const accountBody = z.object({
  code: z.string().regex(/^\d{4}(\d{2})?(\d{2})?$/),
  name: z.string().min(1).max(100),
  category: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense', 'cost']).optional(),
  direction: z.enum(['debit', 'credit']).optional(),
  parentCode: z.string().optional(),
  aux: z.record(z.string(), z.boolean()).optional(),
})

export const money = z.union([z.string(), z.number()])

export const invoiceBody = z.object({
  direction: z.enum(['output', 'input']),
  invoiceType: z.enum(['special', 'general', 'electronic', 'electronic_special']).optional(),
  invoiceCode: z.string().max(20).optional(),
  invoiceNo: z.string().min(1).max(20),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: PERIOD,
  sellerName: z.string().max(200).optional(),
  sellerTaxNo: z.string().max(50).optional(),
  buyerName: z.string().max(200).optional(),
  buyerTaxNo: z.string().max(50).optional(),
  amountExclTax: money,
  taxRate: money.optional(),
  taxAmount: money.optional(),
  totalAmount: money.optional(),
  deductible: z.boolean().optional(),
  source: z.enum(['platform', 'import', 'manual']).optional(),
  sourceRef: z.string().max(200).optional(),
  remark: z.string().max(2000).optional(),
})

export const statementBody = z.object({
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  direction: z.enum(['in', 'out']),
  amount: money,
  balance: money.optional(),
  counterparty: z.string().max(200).optional(),
  summary: z.string().max(500).optional(),
  serialNo: z.string().max(100).optional(),
  sourceRef: z.string().max(200).optional(),
})

export function userIdOf(request: { user?: unknown; jwtPayload?: unknown }): string | null {
  const u = request.user as { id?: string } | undefined
  const p = request.jwtPayload as { userId?: string } | undefined
  return u?.id ?? p?.userId ?? null
}

export async function guard<T>(
  reply: { status: (n: number) => { send: (b: unknown) => void }; send: (b: unknown) => void },
  fn: () => Promise<T>,
) {
  try {
    reply.send(success(await fn()))
  } catch (err) {
    if (err instanceof AppError) {
      reply.status(err.statusCode).send(error(err.statusCode, err.message, err.errorCode))
      return
    }
    throw err
  }
}

export function badRequest(
  reply: { status: (n: number) => { send: (b: unknown) => void } },
  message: string,
) {
  reply.status(400).send(error(400, message, 'VALIDATION_FAILED'))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
