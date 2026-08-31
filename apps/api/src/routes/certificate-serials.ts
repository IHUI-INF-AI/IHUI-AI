// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, sql } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db, dbRead } from '../db/index.js'
import {
  certificateSerialNumber,
  certificates,
  type Certificate,
  type CertificateSerialNumber,
} from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { error, paginatedSuccess, success } from '../utils/response.js'

// =============================================================================
// 序列号生成: IHUI-YYYYMMDD-8位大写字母数字(密码学安全随机)
// =============================================================================

const SERIAL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function generateSerialNumber(): string {
  const now = new Date()
  const ymd =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const bytes = randomBytes(8)
  let rand = ''
  for (let i = 0; i < 8; i++) {
    rand += SERIAL_CHARS[bytes[i]! % SERIAL_CHARS.length]
  }
  return `IHUI-${ymd}-${rand}`
}

function isUniqueViolation(e: unknown): boolean {
  // PostgreSQL unique_violation
  return (e as { code?: string }).code === '23505'
}

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const issueBodySchema = z.object({
  certificateId: z.uuid({ error: '无效的证书 ID' }),
  holderName: z.string().max(100).optional(),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'revoked', 'expired']).optional(),
})

const verifyQuerySchema = z.object({
  serialNumber: z.string().min(1).max(64),
})

// =============================================================================
// 查询辅助
// =============================================================================

async function findCertificateById(id: string): Promise<Certificate | undefined> {
  const rows = await db.select().from(certificates).where(eq(certificates.id, id)).limit(1)
  return rows[0]
}

async function findSerialByNumber(
  serialNumber: string,
): Promise<CertificateSerialNumber | undefined> {
  const rows = await dbRead
    .select()
    .from(certificateSerialNumber)
    .where(eq(certificateSerialNumber.serialNumber, serialNumber))
    .limit(1)
  return rows[0]
}

/**
 * 颁发序列号:唯一索引兜底,唯一冲突时重新生成,最多重试 3 次。
 */
async function issueSerialWithRetry(values: {
  certificateId: string
  issuedTo: string | null
  issuedAt: Date
}): Promise<CertificateSerialNumber> {
  const maxAttempts = 3
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const serialNumber = generateSerialNumber()
    try {
      const rows = await db
        .insert(certificateSerialNumber)
        .values({ ...values, serialNumber })
        .returning()
      const row = rows[0]
      if (!row) throw new Error('写入序列号失败')
      return row
    } catch (e) {
      if (isUniqueViolation(e) && attempt < maxAttempts - 1) continue
      throw e
    }
  }
  throw new Error('生成序列号失败，请重试')
}

// =============================================================================
// 路由插件
// =============================================================================

export const certificateSerialsRoutes: FastifyPluginAsync = async (server) => {
  // ----- 颁发序列号(管理端) -----
  server.post(
    '/certificate-serials/issue',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = issueBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const cert = await findCertificateById(parsed.data.certificateId)
      if (!cert) return reply.status(404).send(error(404, '证书不存在'))

      const serial = await issueSerialWithRetry({
        certificateId: parsed.data.certificateId,
        issuedTo: parsed.data.holderName ?? null,
        issuedAt: new Date(),
      })
      return reply
        .status(201)
        .send(success({ serialNumber: serial.serialNumber, status: serial.status, id: serial.id }))
    },
  )

  // ----- 序列号列表(管理端,分页 + status 筛选) -----
  server.get(
    '/certificate-serials',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize, status } = parsed.data
      const conds = []
      if (status) conds.push(eq(certificateSerialNumber.status, status))
      const where = conds.length ? and(...conds) : undefined

      const [rows, totalRows] = await Promise.all([
        db
          .select({
            serial: certificateSerialNumber,
            certificateNo: certificates.certificateNo,
            certificateTitle: certificates.title,
          })
          .from(certificateSerialNumber)
          .leftJoin(certificates, eq(certificateSerialNumber.certificateId, certificates.id))
          .where(where)
          .orderBy(desc(certificateSerialNumber.issuedAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(certificateSerialNumber)
          .where(where),
      ])
      const items = rows.map((r) => ({
        ...r.serial,
        certificateNo: r.certificateNo,
        certificateTitle: r.certificateTitle,
      }))
      return reply.send(paginatedSuccess(items, totalRows[0]?.count ?? 0, { page, pageSize }))
    },
  )

  // ----- 撤销序列号(管理端) -----
  server.post(
    '/certificate-serials/:id/revoke',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const rows = await db
        .update(certificateSerialNumber)
        .set({ status: 'revoked' })
        .where(eq(certificateSerialNumber.id, parsed.data.id))
        .returning()
      const serial = rows[0]
      if (!serial) return reply.status(404).send(error(404, '序列号不存在'))
      return reply.send(success({ serial }))
    },
  )

  // ----- 验真(公开,供证书查验) -----
  server.get(
    '/certificate-serials/verify',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = verifyQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const serial = await findSerialByNumber(parsed.data.serialNumber)
      if (!serial) return reply.status(404).send(error(404, '序列号不存在'))

      let certificate: Certificate | undefined
      if (serial.certificateId) {
        certificate = await findCertificateById(serial.certificateId)
      }
      return reply.send(
        success({
          serialNumber: serial.serialNumber,
          status: serial.status,
          // 仅 active 视为有效(revoked/expired 前端据此提示不可用)
          valid: serial.status === 'active',
          holderName: serial.issuedTo,
          issuedAt: serial.issuedAt,
          certificateId: serial.certificateId,
          certificateTitle: certificate?.title ?? null,
          certificateNo: certificate?.certificateNo ?? null,
        }),
      )
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
