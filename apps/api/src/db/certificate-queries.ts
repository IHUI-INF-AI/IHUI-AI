import { eq, and, desc, asc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import {
  certificateTemplates,
  certificates,
  users,
  type CertificateTemplate,
  type Certificate,
} from '@ihui/database'

// =============================================================================
// Templates
// =============================================================================

export async function findTemplates(opts: {
  page: number
  pageSize: number
  search?: string
  status?: number
}): Promise<{ list: CertificateTemplate[]; total: number; page: number; pageSize: number }> {
  const conds = []
  if (opts.search) conds.push(ilike(certificateTemplates.name, `%${opts.search}%`))
  if (opts.status !== undefined) conds.push(eq(certificateTemplates.status, opts.status))
  const where = conds.length ? and(...conds) : undefined
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(certificateTemplates)
      .where(where)
      .orderBy(asc(certificateTemplates.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(certificateTemplates)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findTemplateById(id: string): Promise<CertificateTemplate | undefined> {
  const rows = await db
    .select()
    .from(certificateTemplates)
    .where(eq(certificateTemplates.id, id))
    .limit(1)
  return rows[0]
}

export interface CreateTemplateInput {
  name: string
  description?: string | null
  backgroundImage?: string | null
  templateConfig?: unknown
  awardingOrganization?: string | null
  awarderName?: string | null
  awardConditions?: string | null
  validityPolicy?: string | null
  status?: number
}

export async function createTemplate(data: CreateTemplateInput): Promise<CertificateTemplate> {
  const rows = await db
    .insert(certificateTemplates)
    .values({
      name: data.name,
      description: data.description,
      backgroundImage: data.backgroundImage,
      templateConfig: data.templateConfig,
      awardingOrganization: data.awardingOrganization,
      awarderName: data.awarderName,
      awardConditions: data.awardConditions,
      validityPolicy: data.validityPolicy,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建证书模板失败')
  return row
}

export interface UpdateTemplateInput {
  name?: string
  description?: string | null
  backgroundImage?: string | null
  templateConfig?: unknown
  awardingOrganization?: string | null
  awarderName?: string | null
  awardConditions?: string | null
  validityPolicy?: string | null
  status?: number
}

export async function updateTemplate(
  id: string,
  data: UpdateTemplateInput,
): Promise<CertificateTemplate | undefined> {
  const set: Record<string, unknown> = {}
  if (data.name !== undefined) set.name = data.name
  if (data.description !== undefined) set.description = data.description
  if (data.backgroundImage !== undefined) set.backgroundImage = data.backgroundImage
  if (data.templateConfig !== undefined) set.templateConfig = data.templateConfig
  if (data.awardingOrganization !== undefined) set.awardingOrganization = data.awardingOrganization
  if (data.awarderName !== undefined) set.awarderName = data.awarderName
  if (data.awardConditions !== undefined) set.awardConditions = data.awardConditions
  if (data.validityPolicy !== undefined) set.validityPolicy = data.validityPolicy
  if (data.status !== undefined) set.status = data.status
  set.updatedAt = new Date()
  const rows = await db
    .update(certificateTemplates)
    .set(set)
    .where(eq(certificateTemplates.id, id))
    .returning()
  return rows[0]
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.delete(certificateTemplates).where(eq(certificateTemplates.id, id))
}

// =============================================================================
// Certificates (发放记录)
// =============================================================================

export interface CertificateWithUser extends Certificate {
  nickname: string | null
  templateName: string | null
}

export async function findCertificates(opts: {
  page: number
  pageSize: number
  userId?: string
  templateId?: string
  search?: string
  status?: number
}): Promise<{ list: CertificateWithUser[]; total: number; page: number; pageSize: number }> {
  const conds = []
  if (opts.userId) conds.push(eq(certificates.userId, opts.userId))
  if (opts.templateId) conds.push(eq(certificates.templateId, opts.templateId))
  if (opts.status !== undefined) conds.push(eq(certificates.status, opts.status))
  if (opts.search) {
    conds.push(ilike(certificates.certificateNo, `%${opts.search}%`))
  }
  const where = conds.length ? and(...conds) : undefined
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        cert: certificates,
        nickname: users.nickname,
        templateName: certificateTemplates.name,
      })
      .from(certificates)
      .leftJoin(users, eq(certificates.userId, users.id))
      .leftJoin(certificateTemplates, eq(certificates.templateId, certificateTemplates.id))
      .where(where)
      .orderBy(desc(certificates.issuedAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(certificates)
      .where(where),
  ])
  const list: CertificateWithUser[] = rows.map((r) => ({
    ...r.cert,
    nickname: r.nickname,
    templateName: r.templateName,
  }))
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findCertificateById(id: string): Promise<CertificateWithUser | undefined> {
  const rows = await db
    .select({
      cert: certificates,
      nickname: users.nickname,
      templateName: certificateTemplates.name,
    })
    .from(certificates)
    .leftJoin(users, eq(certificates.userId, users.id))
    .leftJoin(certificateTemplates, eq(certificates.templateId, certificateTemplates.id))
    .where(eq(certificates.id, id))
    .limit(1)
  const row = rows[0]
  if (!row) return undefined
  return { ...row.cert, nickname: row.nickname, templateName: row.templateName }
}

export async function findCertificateByNo(
  certificateNo: string,
): Promise<CertificateWithUser | undefined> {
  const rows = await db
    .select({
      cert: certificates,
      nickname: users.nickname,
      templateName: certificateTemplates.name,
    })
    .from(certificates)
    .leftJoin(users, eq(certificates.userId, users.id))
    .leftJoin(certificateTemplates, eq(certificates.templateId, certificateTemplates.id))
    .where(eq(certificates.certificateNo, certificateNo))
    .limit(1)
  const row = rows[0]
  if (!row) return undefined
  return { ...row.cert, nickname: row.nickname, templateName: row.templateName }
}

export interface CreateCertificateInput {
  templateId?: string | null
  userId: string
  certificateNo: string
  title: string
  recipientName?: string | null
  source?: string
  sourceId?: string | null
  issuedAt?: Date
}

export async function createCertificate(data: CreateCertificateInput): Promise<Certificate> {
  const rows = await db
    .insert(certificates)
    .values({
      templateId: data.templateId,
      userId: data.userId,
      certificateNo: data.certificateNo,
      title: data.title,
      recipientName: data.recipientName,
      source: data.source,
      sourceId: data.sourceId,
      issuedAt: data.issuedAt ?? new Date(),
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建证书失败')
  return row
}

export async function updateCertificateStatus(
  id: string,
  status: number,
): Promise<Certificate | undefined> {
  const rows = await db
    .update(certificates)
    .set({ status })
    .where(eq(certificates.id, id))
    .returning()
  return rows[0]
}

export async function deleteCertificate(id: string): Promise<void> {
  await db.delete(certificates).where(eq(certificates.id, id))
}

/** 生成唯一证书编号: CERT-YYYYMMDD-随机8位。 */
export function generateCertificateNo(): string {
  const now = new Date()
  const ymd =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase()
  return `CERT-${ymd}-${rand}`
}
