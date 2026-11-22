// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import {
  listImportBatches,
  getImportBatchDetail,
  resolveImportRow,
  discardImportBatch,
} from '../services/hr-import.js'
import {
  createAnyImportBatch,
  confirmAnyImportBatch,
  parseImportKind,
} from '../services/hr-import-entry.js'
import { saveFile } from '../services/storage-service.js'
import { requirePermission } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import { buildSchema } from '../utils/swagger.js'

/**
 * 人事考勤导入路由(HR-5 第 2 期,2026-11-12 立)。
 *
 * 用途:把飞书/钉钉/企业微信导出的打卡表传进来,解析 → 暂存 → 人工裁决差异 → 确认写入。
 *
 * 权限:hr:attendance:manage(导入是写面动作,与建档/规则 upsert 同档)。
 * 安全性:
 *   · 文件大小硬闸 10MB(multipart bodyLimit 11MB),只收 xlsx/xls/csv。
 *   · 解析失败不留半成品批次(service 内已标 rejected)。
 *   · 差异行必须人工裁决才允许确认,绝不自动覆盖系统记录。
 */

const HR_MANAGE = 'hr:attendance:manage'

const IMPORT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
const IMPORT_ALLOWED_EXTS = ['.xlsx', '.xls', '.csv']

const uuidSchema = z.string().uuid()

const resolveRowSchema = z.object({
  resolution: z.enum(['adopt_import', 'keep_system', 'manual']),
  finalValue: z
    .object({
      employeeNo: z.string().max(50).optional(),
      employeeName: z.string().max(100).optional(),
      date: z.string().max(30).optional(),
      checkInTime: z.string().max(40).optional(),
      checkOutTime: z.string().max(40).optional(),
      rawStatus: z.string().max(100).optional(),
    })
    .optional(),
})

export const hrImportRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 1. POST /api/hr-import/batches — 上传打卡表并解析
  // ==========================================================================
  server.post(
    '/batches',
    {
      bodyLimit: IMPORT_MAX_SIZE + 1024 * 1024,
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['人事-考勤导入'],
        summary: '上传考勤打卡表(飞书/钉钉/企业微信导出)并解析',
        description:
          '支持 .xlsx/.xls/.csv。解析后进入待核对状态,不直接写正式考勤。' +
          '同一份文件(按 SHA-256)在同一月份重复上传会被拒绝。',
      }),
    },
    async (request, reply) => {
      const file = await request.file()
      if (!file) {
        reply.status(400).send(error(400, '请上传打卡表文件'))
        return
      }

      const filename = file.filename ?? ''
      const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
      if (!IMPORT_ALLOWED_EXTS.includes(ext)) {
        file.file.resume()
        reply.status(400).send(error(400, `仅支持 ${IMPORT_ALLOWED_EXTS.join(' / ')} 格式的打卡表`))
        return
      }

      // 流式读取 + 总量闸(防止超大文件先缓冲再拒绝)
      const chunks: Buffer[] = []
      let totalBytes = 0
      let overflow = false
      for await (const chunk of file.file) {
        totalBytes += chunk.length
        if (totalBytes > IMPORT_MAX_SIZE) {
          overflow = true
          file.file.resume()
          break
        }
        chunks.push(chunk as Buffer)
      }
      if (overflow) {
        reply.status(400).send(error(400, '打卡表文件不能超过 10MB'))
        return
      }
      const buffer = Buffer.concat(chunks)

      // periodMonth 从 multipart field 取
      const periodField = file.fields['periodMonth']
      const periodRaw =
        periodField && !Array.isArray(periodField) && 'value' in periodField
          ? String(periodField.value ?? '')
          : ''
      if (!/^\d{4}-\d{2}$/.test(periodRaw)) {
        reply.status(400).send(error(400, '请提供考勤月份 periodMonth(格式 YYYY-MM),例如 2026-11'))
        return
      }

      const stored = saveFile(buffer, undefined, { fileName: filename, purpose: 'hr-import' })
      const userId = (request.user as { id?: string } | undefined)?.id

      // 导入类型默认 attendance(打卡),请假/加班显式指定
      const kindField = file.fields['importKind']
      const kindRaw =
        kindField && !Array.isArray(kindField) && 'value' in kindField
          ? String(kindField.value ?? 'attendance')
          : 'attendance'

      try {
        const importKind = parseImportKind(kindRaw)
        const result = await createAnyImportBatch({
          periodMonth: periodRaw,
          importKind,
          fileName: filename,
          storageFileId: stored.id,
          buffer,
          uploadedBy: userId,
        })
        reply.send(
          success({
            batchId: result.batch.id,
            importKind,
            status: result.batch.status,
            totalRows: result.batch.totalRows,
            matchedRows: result.batch.matchedRows,
            conflictRows: result.batch.conflictRows,
            notFoundRows: result.batch.notFoundRows,
            mapping: result.mapping,
            preview: result.preview,
          }),
        )
      } catch (err) {
        if (err instanceof AppError) {
          reply.status(err.statusCode).send(error(err.statusCode, err.message))
          return
        }
        throw err
      }
    },
  )

  // ==========================================================================
  // 2. GET /api/hr-import/batches — 批次列表
  // ==========================================================================
  server.get(
    '/batches',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['人事-考勤导入'],
        summary: '导入批次列表',
      }),
    },
    async (request, reply) => {
      const q = request.query as { periodMonth?: string; limit?: string }
      const rows = await listImportBatches({
        periodMonth: q.periodMonth,
        limit: q.limit ? Number(q.limit) : undefined,
      })
      reply.send(success(rows))
    },
  )

  // ==========================================================================
  // 3. GET /api/hr-import/batches/:id — 批次详情(含行明细)
  // ==========================================================================
  server.get(
    '/batches/:id',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['人事-考勤导入'],
        summary: '导入批次详情(行明细,可按状态过滤)',
      }),
    },
    async (request, reply) => {
      const params = request.params as { id: string }
      const parsed = uuidSchema.safeParse(params.id)
      if (!parsed.success) {
        reply.status(400).send(error(400, '批次 id 格式不正确'))
        return
      }
      const q = request.query as { matchStatus?: string; limit?: string }
      try {
        const detail = await getImportBatchDetail(parsed.data, {
          matchStatus: q.matchStatus,
          limit: q.limit ? Number(q.limit) : undefined,
        })
        reply.send(success(detail))
      } catch (err) {
        if (err instanceof AppError) {
          reply.status(err.statusCode).send(error(err.statusCode, err.message))
          return
        }
        throw err
      }
    },
  )

  // ==========================================================================
  // 4. POST /api/hr-import/rows/:rowId/resolve — 人工裁决单行
  // ==========================================================================
  server.post(
    '/rows/:rowId/resolve',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['人事-考勤导入'],
        summary: '人工裁决单行(采用导入值 / 保留系统值 / 人工填写)',
      }),
    },
    async (request, reply) => {
      const params = request.params as { rowId: string }
      const parsedId = uuidSchema.safeParse(params.rowId)
      if (!parsedId.success) {
        reply.status(400).send(error(400, '行 id 格式不正确'))
        return
      }
      const parsedBody = resolveRowSchema.safeParse(request.body)
      if (!parsedBody.success) {
        reply.status(400).send(error(400, '裁决参数不正确', 'IMPORT_BAD_RESOLVE_BODY'))
        return
      }
      const userId = (request.user as { id?: string } | undefined)?.id
      try {
        const row = await resolveImportRow({
          rowId: parsedId.data,
          resolution: parsedBody.data.resolution,
          finalValue: parsedBody.data.finalValue,
          resolvedBy: userId,
        })
        reply.send(success(row))
      } catch (err) {
        if (err instanceof AppError) {
          reply.status(err.statusCode).send(error(err.statusCode, err.message))
          return
        }
        throw err
      }
    },
  )

  // ==========================================================================
  // 5. POST /api/hr-import/batches/:id/confirm — 确认写入正式考勤
  // ==========================================================================
  server.post(
    '/batches/:id/confirm',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['人事-考勤导入'],
        summary: '确认批次,写入正式考勤记录',
        description: '所有 conflict 行必须先裁决,否则拒绝确认。',
      }),
    },
    async (request, reply) => {
      const params = request.params as { id: string }
      const parsed = uuidSchema.safeParse(params.id)
      if (!parsed.success) {
        reply.status(400).send(error(400, '批次 id 格式不正确'))
        return
      }
      const userId = (request.user as { id?: string } | undefined)?.id
      try {
        const result = await confirmAnyImportBatch({ batchId: parsed.data, operatedBy: userId })
        reply.send(success(result))
      } catch (err) {
        if (err instanceof AppError) {
          reply.status(err.statusCode).send(error(err.statusCode, err.message))
          return
        }
        throw err
      }
    },
  )

  // ==========================================================================
  // 6. DELETE /api/hr-import/batches/:id — 作废未确认批次
  // ==========================================================================
  server.delete(
    '/batches/:id',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['人事-考勤导入'],
        summary: '作废未确认的导入批次',
      }),
    },
    async (request, reply) => {
      const params = request.params as { id: string }
      const parsed = uuidSchema.safeParse(params.id)
      if (!parsed.success) {
        reply.status(400).send(error(400, '批次 id 格式不正确'))
        return
      }
      try {
        await discardImportBatch(parsed.data)
        reply.send(success({ batchId: parsed.data, status: 'rejected' }))
      } catch (err) {
        if (err instanceof AppError) {
          reply.status(err.statusCode).send(error(err.statusCode, err.message))
          return
        }
        throw err
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
