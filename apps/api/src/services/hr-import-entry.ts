// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import { hrImportBatch, hrImportRow } from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../errors/AppError.js'
import {
  createImportBatch as createAttendanceBatch,
  confirmImportBatch as confirmAttendance,
} from './hr-import.js'
import {
  matchAndStageLeaveRows,
  matchAndStageOvertimeRows,
  matchAndStageOutgoingRows,
  parseLeaveMatrix,
  parseOvertimeMatrix,
  parseOutgoingMatrix,
  readImportMatrix,
  confirmLeaveImport,
  confirmOvertimeImport,
  confirmOutgoingImport,
} from './hr-import-leave.js'

/**
 * 导入类型统一入口(HR-5 第 3 期)。
 *
 * 打卡走 hr-import.ts 的原实现(已真库验证),请假/加班走 hr-import-leave.ts。
 * 本文件只做**类型分发与共享前置校验**,不复制任何解析/落库判据 ——
 * 三类导入的差异全部收敛在各自的 parse/match/confirm 里。
 */

export type ImportKind = 'attendance' | 'leave' | 'overtime' | 'outgoing'

const SUPPORTED_KINDS: readonly ImportKind[] = ['attendance', 'leave', 'overtime', 'outgoing']

export function parseImportKind(raw: unknown): ImportKind {
  const value = String(raw ?? 'attendance')
  if (!SUPPORTED_KINDS.includes(value as ImportKind)) {
    throw new AppError(
      `导入类型只能是 ${SUPPORTED_KINDS.join(' / ')},收到:${value}`,
      400,
      'IMPORT_BAD_KIND',
    )
  }
  return value as ImportKind
}

/** 统一上传解析入口 */
export async function createAnyImportBatch(params: {
  periodMonth: string
  importKind: ImportKind
  fileName: string
  storageFileId: string
  buffer: Buffer
  uploadedBy?: string | undefined
}): Promise<{
  batch: typeof hrImportBatch.$inferSelect
  mapping: Record<string, string>
  preview: unknown[]
}> {
  const { periodMonth, importKind, fileName, storageFileId, buffer, uploadedBy } = params

  if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new AppError('考勤月份格式必须是 YYYY-MM', 400, 'IMPORT_BAD_PERIOD')
  }
  if (buffer.length === 0) {
    throw new AppError('上传文件为空', 400, 'IMPORT_EMPTY_FILE')
  }

  // 打卡走原实现(含它自己的幂等与解析)
  if (importKind === 'attendance') {
    const result = await createAttendanceBatch({
      periodMonth,
      fileName,
      storageFileId,
      buffer,
      uploadedBy,
    })
    return { batch: result.batch, mapping: result.mapping, preview: result.preview }
  }

  // 请假 / 加班:共用幂等闸 + 解析 + 匹配
  const fileHash = createHash('sha256').update(buffer).digest('hex')
  // 幂等口径必须按「类型 + 月份」判:同一份文件可以既是打卡表又是请假表吗?
  // 实际不会,但允许用户重传同名不同类型文件,所以要区分类型
  const [same] = await db
    .select({ id: hrImportBatch.id, periodMonth: hrImportBatch.periodMonth })
    .from(hrImportBatch)
    .where(
      and(
        eq(hrImportBatch.fileHash, fileHash),
        eq(hrImportBatch.periodMonth, periodMonth),
        eq(hrImportBatch.importKind, importKind),
      ),
    )
    .limit(1)
  if (same) {
    throw new AppError(
      `该文件已在 ${same.periodMonth} 作为「${kindLabel(importKind)}」导入过(批次 ${same.id}),请勿重复导入`,
      409,
      'IMPORT_DUPLICATE_FILE',
    )
  }

  const matrix = await readImportMatrix(fileName, buffer)
  const parsed =
    importKind === 'leave'
      ? parseLeaveMatrix(matrix)
      : importKind === 'outgoing'
        ? parseOutgoingMatrix(matrix)
        : parseOvertimeMatrix(matrix)

  if (parsed.rows.length === 0) {
    throw new AppError('文件中没有识别出有效数据行', 400, 'IMPORT_NO_ROWS')
  }

  const [batch] = await db
    .insert(hrImportBatch)
    .values({
      periodMonth,
      importKind,
      storageFileId,
      fileName,
      fileHash,
      status: 'parsing',
      totalRows: parsed.rows.length,
      mappingConfig: parsed.mapping as Record<string, string>,
      uploadedBy: uploadedBy ?? null,
    })
    .returning()
  if (!batch) throw new AppError('创建导入批次失败', 500, 'IMPORT_BATCH_CREATE_FAILED')

  try {
    const stats =
      importKind === 'leave'
        ? await matchAndStageLeaveRows({
            batchId: batch.id,
            rows: parsed.rows as Parameters<typeof matchAndStageLeaveRows>[0]['rows'],
          })
        : importKind === 'outgoing'
          ? await matchAndStageOutgoingRows({
              batchId: batch.id,
              rows: parsed.rows as Parameters<typeof matchAndStageOutgoingRows>[0]['rows'],
            })
          : await matchAndStageOvertimeRows({
              batchId: batch.id,
              rows: parsed.rows as Parameters<typeof matchAndStageOvertimeRows>[0]['rows'],
            })

    const [updated] = await db
      .update(hrImportBatch)
      .set({
        status: 'pending_review',
        matchedRows: stats.matched,
        conflictRows: stats.conflict,
        notFoundRows: stats.notFound,
        updatedAt: new Date(),
      })
      .where(eq(hrImportBatch.id, batch.id))
      .returning()

    return {
      batch: updated ?? batch,
      mapping: parsed.mapping as Record<string, string>,
      preview: parsed.rows.slice(0, 20),
    }
  } catch (err) {
    await db
      .update(hrImportBatch)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(hrImportBatch.id, batch.id))
    logger.error('导入解析失败', { err, batchId: batch.id, importKind })
    throw err
  }
}

/** 统一确认入口 */
export async function confirmAnyImportBatch(params: {
  batchId: string
  operatedBy?: string | undefined
}): Promise<Record<string, unknown>> {
  const { batchId, operatedBy } = params
  const [batch] = await db
    .select()
    .from(hrImportBatch)
    .where(eq(hrImportBatch.id, batchId))
    .limit(1)
  if (!batch) throw new AppError('导入批次不存在', 404, 'IMPORT_BATCH_NOT_FOUND')
  if (batch.status === 'verified') {
    throw new AppError('该批次已确认写入,不可重复确认', 409, 'IMPORT_BATCH_ALREADY_VERIFIED')
  }

  // 差异必须全部裁决(三类共用同一闸门)
  const rows = await db.select().from(hrImportRow).where(eq(hrImportRow.batchId, batchId))
  const unresolved = rows.filter((r) => r.matchStatus === 'conflict' && !r.resolved)
  if (unresolved.length > 0) {
    throw new AppError(
      `还有 ${unresolved.length} 条差异行未裁决,必须先逐条处理才能确认`,
      409,
      'IMPORT_HAS_UNRESOLVED_CONFLICTS',
    )
  }

  let result: Record<string, unknown>
  if (batch.importKind === 'leave') {
    result = await confirmLeaveImport({ batchId, operatedBy })
  } else if (batch.importKind === 'overtime') {
    result = await confirmOvertimeImport({ batchId, operatedBy })
  } else if (batch.importKind === 'outgoing') {
    result = await confirmOutgoingImport({ batchId, operatedBy })
  } else {
    result = await confirmAttendance({ batchId, operatedBy })
  }

  await db
    .update(hrImportBatch)
    .set({ status: 'verified', updatedAt: new Date() })
    .where(eq(hrImportBatch.id, batchId))

  logger.info('导入批次已确认', { batchId, importKind: batch.importKind, ...result })
  return { batchId, importKind: batch.importKind, ...result }
}

function kindLabel(kind: ImportKind): string {
  if (kind === 'attendance') return '打卡'
  if (kind === 'leave') return '请假'
  if (kind === 'outgoing') return '外出'
  return '加班'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
