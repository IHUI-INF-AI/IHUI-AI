// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发票验真(2026-11-24 立)。
 *
 * 边界必须说清:本仓没有税局/服务商的查验接口,所以**不能**把"本地规则通过"当成
 * "税局验真通过"。这里分两层:
 *   · 本地勾稽(必做,确定性):金额勾稽、期间归属、购/销方税号与客户档一致、票号形态;
 *   · 外部查验(适配器):实现方可注册 provider;未配置时 verifyStatus 落 unavailable,
 *     并原样告诉调用方"未接外部查验源",绝不冒充 verified。
 */

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { finClient, finInvoice, finLedger } from '@ihui/database'
import { AppError } from '../../errors/AppError.js'
import { fromCents, toCents } from './money.js'

export interface LocalCheck {
  name: string
  ok: boolean
  detail: string
}

export interface InvoiceVerifyProvider {
  id: string
  label: string
  /** 返回 verified/failed;抛错由调用方落 unavailable 并保留原文 */
  verify(invoice: {
    invoiceCode: string | null
    invoiceNo: string
    invoiceDate: string
    amountExclTax: string
    taxAmount: string
    totalAmount: string
  }): Promise<{ ok: boolean; message: string; payload?: Record<string, unknown> }>
}

/** 外部查验源注册位(默认没有:未配置就必须诚实落 unavailable) */
const providers = new Map<string, InvoiceVerifyProvider>()

export function registerInvoiceVerifyProvider(provider: InvoiceVerifyProvider) {
  providers.set(provider.id, provider)
}

export function listInvoiceVerifyProviders() {
  return [...providers.values()].map((p) => ({ id: p.id, label: p.label }))
}

export async function verifyInvoice(invoiceId: string, providerId?: string) {
  const [invoice] = await db.select().from(finInvoice).where(eq(finInvoice.id, invoiceId))
  if (!invoice || invoice.deletedAt) {
    throw new AppError('发票不存在或已删除', 404, 'FIN_INVOICE_NOT_FOUND')
  }
  const [ledger] = await db
    .select({ id: finLedger.id, clientId: finLedger.clientId })
    .from(finLedger)
    .where(and(eq(finLedger.id, invoice.ledgerId), isNull(finLedger.deletedAt)))
  if (!ledger) throw new AppError('账套不存在', 404, 'FIN_LEDGER_NOT_FOUND')
  const [client] = await db
    .select({ name: finClient.name, taxNo: finClient.taxNo })
    .from(finClient)
    .where(eq(finClient.id, ledger.clientId))

  const checks: LocalCheck[] = []
  const amountCents = toCents(invoice.amountExclTax)
  const taxCents = toCents(invoice.taxAmount)
  const totalCents = toCents(invoice.totalAmount)
  const diff = Math.abs(amountCents + taxCents - totalCents)
  checks.push({
    name: '价税合计勾稽',
    ok: diff <= 2,
    detail: diff <= 2 ? '不含税+税额=价税合计(误差≤1分)' : `差额 ${fromCents(diff)}(超过 1 分)`,
  })

  const periodOfDate = invoice.invoiceDate.slice(0, 7)
  checks.push({
    name: '期间归属',
    ok: periodOfDate === invoice.period,
    detail:
      periodOfDate === invoice.period
        ? `开票月 ${periodOfDate} 与台账期间一致`
        : `开票日 ${invoice.invoiceDate} 落在 ${periodOfDate},台账期间却是 ${invoice.period}`,
  })

  if (client?.taxNo) {
    const own = invoice.direction === 'output' ? invoice.sellerTaxNo : invoice.buyerTaxNo
    checks.push({
      name: invoice.direction === 'output' ? '销方税号=客户' : '购方税号=客户',
      ok: own === client.taxNo,
      detail:
        own === client.taxNo
          ? `税号与客户档一致(${client.taxNo})`
          : `票面税号 ${own ?? '(空)'} 与客户档 ${client.taxNo} 不一致`,
    })
  } else {
    checks.push({
      name: '客户税号档',
      ok: false,
      detail: '客户档案未登记统一社会信用代码,无法核对购销方',
    })
  }

  const noLen = invoice.invoiceNo.replace(/\s/g, '').length
  checks.push({
    name: '票号形态',
    ok: noLen === 8 || noLen === 20,
    detail: `票号 ${invoice.invoiceNo} 长度 ${noLen}(数电票 20 位/旧票 8 位)`,
  })

  const localOk = checks.every((c) => c.ok)
  const provider = providerId ? providers.get(providerId) : undefined

  let verifyStatus: 'verified' | 'failed' | 'unavailable'
  let verifyMessage: string
  let payload: Record<string, unknown> | undefined

  if (!localOk) {
    verifyStatus = 'failed'
    verifyMessage = checks
      .filter((c) => !c.ok)
      .map((c) => `${c.name}:${c.detail}`)
      .join(';')
  } else if (!provider) {
    verifyStatus = 'unavailable'
    verifyMessage = providerId
      ? `外部查验源 ${providerId} 未注册`
      : '本地勾稽通过;未接入外部查验源(税局/服务商),不做"已验真"结论'
  } else {
    try {
      const result = await provider.verify({
        invoiceCode: invoice.invoiceCode,
        invoiceNo: invoice.invoiceNo,
        invoiceDate: invoice.invoiceDate,
        amountExclTax: invoice.amountExclTax,
        taxAmount: invoice.taxAmount,
        totalAmount: invoice.totalAmount,
      })
      verifyStatus = result.ok ? 'verified' : 'failed'
      verifyMessage = result.message
      payload = result.payload
    } catch (err) {
      verifyStatus = 'unavailable'
      verifyMessage = `外部查验调用失败:${err instanceof Error ? err.message : String(err)}`
    }
  }

  const [updated] = await db
    .update(finInvoice)
    .set({
      verifyStatus,
      verifyMessage,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(finInvoice.id, invoiceId))
    .returning()

  return {
    invoiceId,
    verifyStatus,
    verifyMessage,
    checks,
    localOk,
    externalProvider: provider?.id ?? null,
    externalPayload: payload ?? null,
    invoice: updated!,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
