// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 凭证附件(票据影像)服务。
 *
 * 只存引用不存 blob:文件本体由 /api/files/upload/form 落盘,这里记 fileId/url/指纹。
 * attachmentCount 由本服务统一回写 —— 任何增删都必须经过这里,路由不得直接改计数。
 * 同一账套同一 fileId 重复挂到多张凭证会被拒(代账最常见的事故是"一张票贴两张凭证")。
 */

import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { finVoucher, finVoucherAttachment, type NewFinVoucherAttachment } from '@ihui/database'
import { AppError } from '../../errors/AppError.js'

export interface AttachmentInput {
  fileId: string
  name: string
  url: string
  mimeType?: string | undefined
  size?: number | undefined
  sha256?: string | undefined
}

async function loadVoucher(voucherId: string) {
  const [voucher] = await db
    .select({ id: finVoucher.id, ledgerId: finVoucher.ledgerId, deletedAt: finVoucher.deletedAt })
    .from(finVoucher)
    .where(eq(finVoucher.id, voucherId))
  if (!voucher || voucher.deletedAt) {
    throw new AppError('凭证不存在或已删除', 404, 'FIN_VOUCHER_NOT_FOUND')
  }
  return voucher
}

async function syncCount(voucherId: string) {
  const rows = await db
    .select({ id: finVoucherAttachment.id })
    .from(finVoucherAttachment)
    .where(
      and(eq(finVoucherAttachment.voucherId, voucherId), isNull(finVoucherAttachment.deletedAt)),
    )
  await db
    .update(finVoucher)
    .set({ attachmentCount: rows.length, updatedAt: new Date() })
    .where(eq(finVoucher.id, voucherId))
  return rows.length
}

export async function addVoucherAttachment(
  voucherId: string,
  input: AttachmentInput,
  userId?: string | null,
) {
  const voucher = await loadVoucher(voucherId)
  const [sameFile] = await db
    .select({ voucherId: finVoucherAttachment.voucherId })
    .from(finVoucherAttachment)
    .where(
      and(
        eq(finVoucherAttachment.ledgerId, voucher.ledgerId),
        eq(finVoucherAttachment.fileId, input.fileId),
        isNull(finVoucherAttachment.deletedAt),
      ),
    )
  if (sameFile) {
    throw new AppError(
      sameFile.voucherId === voucherId
        ? '该文件已在本凭证上'
        : '该文件已挂在同一账套的另一张凭证上(一张票不能贴两张凭证)',
      409,
      'FIN_ATTACHMENT_DUPLICATE',
    )
  }

  const values: NewFinVoucherAttachment = {
    voucherId,
    ledgerId: voucher.ledgerId,
    fileId: input.fileId,
    name: input.name,
    url: input.url,
    mimeType: input.mimeType ?? 'application/octet-stream',
    size: input.size ?? 0,
    sha256: input.sha256 ?? null,
    uploadedBy: userId ?? null,
  }
  const [row] = await db.insert(finVoucherAttachment).values(values).returning()
  const count = await syncCount(voucherId)

  const warnings: string[] = []
  if (input.sha256) {
    const dup = await db
      .select({ voucherId: finVoucherAttachment.voucherId })
      .from(finVoucherAttachment)
      .where(
        and(
          eq(finVoucherAttachment.ledgerId, voucher.ledgerId),
          eq(finVoucherAttachment.sha256, input.sha256),
          isNull(finVoucherAttachment.deletedAt),
        ),
      )
    if (dup.length > 1) warnings.push(`同一文件指纹已出现在 ${dup.length} 张凭证上`)
  }
  return { attachment: row!, attachmentCount: count, warnings }
}

export async function listVoucherAttachments(voucherId: string) {
  const voucher = await loadVoucher(voucherId)
  const rows = await db
    .select()
    .from(finVoucherAttachment)
    .where(
      and(eq(finVoucherAttachment.voucherId, voucherId), isNull(finVoucherAttachment.deletedAt)),
    )
    .orderBy(asc(finVoucherAttachment.createdAt))
  return { voucherId, ledgerId: voucher.ledgerId, list: rows, total: rows.length }
}

export async function removeVoucherAttachment(voucherId: string, attachmentId: string) {
  const [row] = await db
    .select({ id: finVoucherAttachment.id, voucherId: finVoucherAttachment.voucherId })
    .from(finVoucherAttachment)
    .where(eq(finVoucherAttachment.id, attachmentId))
  if (!row || row.voucherId !== voucherId) {
    throw new AppError('附件不存在或不属于该凭证', 404, 'FIN_ATTACHMENT_NOT_FOUND')
  }
  await db
    .update(finVoucherAttachment)
    .set({ deletedAt: new Date() })
    .where(eq(finVoucherAttachment.id, attachmentId))
  const count = await syncCount(voucherId)
  return { removed: true, attachmentCount: count }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
