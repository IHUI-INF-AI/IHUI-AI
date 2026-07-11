import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, ilike, sql, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  aiEducationPolicy,
  aiTeacherCertification,
  aigcToolDetail,
  k12AiCurriculum,
  universityAiCourse,
} from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

const ADMIN_ROLE_ID = 1

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
  const roleId = request.jwtPayload?.roleId ?? 0
  if (roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'))
    return false
  }
  return true
}

// =============================================================================
// 通用 Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

// =============================================================================
// 1. AI 教育政策 (ai_education_policy)
// =============================================================================

const policyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  status: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  policyLevel: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
})

const createPolicySchema = z.object({
  policyName: z.string().min(1).max(300),
  issuingAuthority: z.string().min(1).max(200),
  issueDate: z.string().optional(),
  effectiveDate: z.string().optional(),
  policyLevel: z.string().max(50).optional(),
  targetGroup: z.string().max(200).optional(),
  summary: z.string().optional(),
  keyPoints: z.string().optional(),
  implementation: z.string().optional(),
  goals: z.string().optional(),
  supportingMeasures: z.string().optional(),
  relatedPolicies: z.string().optional(),
  sourceUrl: z.string().max(500).optional(),
  status: z.string().max(20).optional(),
})

const updatePolicySchema = createPolicySchema.partial()

// =============================================================================
// 2. AI 师资认证 (ai_teacher_certification)
// =============================================================================

const certListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  level: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
})

const createCertSchema = z.object({
  certName: z.string().min(1).max(200),
  issuingAuthority: z.string().min(1).max(200),
  targetTeachers: z.string().max(200).optional(),
  level: z.string().max(50).optional(),
  trainingHours: z.number().int().min(0).optional(),
  trainingContent: z.string().optional(),
  assessmentMethod: z.string().optional(),
  certificationRequirements: z.string().optional(),
  validity: z.string().max(100).optional(),
  benefits: z.string().optional(),
})

const updateCertSchema = createCertSchema.partial()

// =============================================================================
// 3. AIGC 工具详情 (aigc_tool_detail)
// =============================================================================

const toolListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  category: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
})

const createToolSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  nameCn: z.string().max(100).optional(),
  subcategory: z.string().max(50).optional(),
  provider: z.string().max(200).optional(),
  url: z.string().max(500).optional(),
  description: z.string().optional(),
  coreFeatures: z.string().optional(),
  useCases: z.string().optional(),
  pricingModel: z.string().max(50).optional(),
  pricingDetail: z.string().optional(),
  freeTier: z.string().max(100).optional(),
  generationSpeed: z.string().max(100).optional(),
  outputQuality: z.string().max(100).optional(),
  chineseSupport: z.string().max(50).optional(),
  learningCurve: z.string().max(50).optional(),
  apiAvailable: z.boolean().optional(),
  mobileApp: z.boolean().optional(),
  pros: z.string().optional(),
  cons: z.string().optional(),
  tips: z.string().optional(),
  alternatives: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  userCount: z.string().max(100).optional(),
})

const updateToolSchema = createToolSchema.partial()

// =============================================================================
// 4. K12 AI 课程标准 (k12_ai_curriculum)
// =============================================================================

const k12ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  stage: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
})

const createK12Schema = z.object({
  stage: z.string().min(1).max(50),
  gradeRange: z.string().max(100).optional(),
  courseName: z.string().max(200).optional(),
  hoursPerYear: z.number().int().min(0).optional(),
  courseType: z.string().max(50).optional(),
  learningObjectives: z.string().optional(),
  contentModules: z.string().optional(),
  keyConcepts: z.string().optional(),
  skillRequirements: z.string().optional(),
  teachingMethods: z.string().optional(),
  assessmentMethods: z.string().optional(),
  toolsResources: z.string().optional(),
  integrationSubjects: z.string().optional(),
})

const updateK12Schema = createK12Schema.partial()

// =============================================================================
// 5. 高校 AI 通识课程 (university_ai_course)
// =============================================================================

const uniListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  university: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  courseType: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
})

const createUniSchema = z.object({
  courseName: z.string().min(1).max(200),
  courseType: z.string().max(50).optional(),
  targetMajor: z.string().max(200).optional(),
  credits: z.number().min(0).optional(),
  hours: z.number().int().min(0).optional(),
  university: z.string().max(200).optional(),
  description: z.string().optional(),
  modules: z.string().optional(),
  prerequisites: z.string().optional(),
  textbooks: z.string().optional(),
  teachingTeam: z.string().optional(),
  assessment: z.string().optional(),
  isRequired: z.boolean().optional(),
})

const updateUniSchema = createUniSchema.partial()

// =============================================================================
// 路由
// =============================================================================

const aiEducationRoutes: FastifyPluginAsync = async (server) => {
  // ===========================================================================
  // AI 教育政策 CRUD
  // ===========================================================================

  server.get('/policy', async (request, reply) => {
    const parsed = policyListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, keyword, status, policyLevel } = parsed.data
    const conds = [isNull(aiEducationPolicy.deletedAt)]
    if (keyword) conds.push(ilike(aiEducationPolicy.policyName, `%${keyword}%`))
    if (status) conds.push(eq(aiEducationPolicy.status, status))
    if (policyLevel) conds.push(eq(aiEducationPolicy.policyLevel, policyLevel))
    const where = and(...conds)
    const [list, totalRows] = await Promise.all([
      db
        .select()
        .from(aiEducationPolicy)
        .where(where)
        .orderBy(desc(aiEducationPolicy.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiEducationPolicy)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  server.get<{ Params: { id: string } }>('/policy/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db
      .select()
      .from(aiEducationPolicy)
      .where(and(eq(aiEducationPolicy.id, parsed.data.id), isNull(aiEducationPolicy.deletedAt)))
      .limit(1)
    if (!rows[0]) return reply.status(404).send(error(404, '政策不存在'))
    return reply.send(success({ policy: rows[0] }))
  })

  server.post('/policy', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = createPolicySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.insert(aiEducationPolicy).values(parsed.data).returning()
    return reply.status(201).send(success({ policy: rows[0] }))
  })

  server.put<{ Params: { id: string } }>('/policy/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updatePolicySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await db
      .select()
      .from(aiEducationPolicy)
      .where(and(eq(aiEducationPolicy.id, idParsed.data.id), isNull(aiEducationPolicy.deletedAt)))
      .limit(1)
    if (!existing[0]) return reply.status(404).send(error(404, '政策不存在'))
    const rows = await db
      .update(aiEducationPolicy)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(aiEducationPolicy.id, idParsed.data.id))
      .returning()
    return reply.send(success({ policy: rows[0] }))
  })

  server.delete<{ Params: { id: string } }>('/policy/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await db
      .select()
      .from(aiEducationPolicy)
      .where(and(eq(aiEducationPolicy.id, parsed.data.id), isNull(aiEducationPolicy.deletedAt)))
      .limit(1)
    if (!existing[0]) return reply.status(404).send(error(404, '政策不存在'))
    await db
      .update(aiEducationPolicy)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(aiEducationPolicy.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // ===========================================================================
  // AI 师资认证 CRUD
  // ===========================================================================

  server.get('/teacher-certification', async (request, reply) => {
    const parsed = certListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, keyword, level } = parsed.data
    const conds = [isNull(aiTeacherCertification.deletedAt)]
    if (keyword) conds.push(ilike(aiTeacherCertification.certName, `%${keyword}%`))
    if (level) conds.push(eq(aiTeacherCertification.level, level))
    const where = and(...conds)
    const [list, totalRows] = await Promise.all([
      db
        .select()
        .from(aiTeacherCertification)
        .where(where)
        .orderBy(desc(aiTeacherCertification.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiTeacherCertification)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  server.get<{ Params: { id: string } }>('/teacher-certification/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db
      .select()
      .from(aiTeacherCertification)
      .where(
        and(
          eq(aiTeacherCertification.id, parsed.data.id),
          isNull(aiTeacherCertification.deletedAt),
        ),
      )
      .limit(1)
    if (!rows[0]) return reply.status(404).send(error(404, '师资认证不存在'))
    return reply.send(success({ certification: rows[0] }))
  })

  server.post('/teacher-certification', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = createCertSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.insert(aiTeacherCertification).values(parsed.data).returning()
    return reply.status(201).send(success({ certification: rows[0] }))
  })

  server.put<{ Params: { id: string } }>('/teacher-certification/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateCertSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await db
      .select()
      .from(aiTeacherCertification)
      .where(
        and(
          eq(aiTeacherCertification.id, idParsed.data.id),
          isNull(aiTeacherCertification.deletedAt),
        ),
      )
      .limit(1)
    if (!existing[0]) return reply.status(404).send(error(404, '师资认证不存在'))
    const rows = await db
      .update(aiTeacherCertification)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(aiTeacherCertification.id, idParsed.data.id))
      .returning()
    return reply.send(success({ certification: rows[0] }))
  })

  server.delete<{ Params: { id: string } }>(
    '/teacher-certification/:id',
    async (request, reply) => {
      if (!(await requireAdmin(request, reply))) return
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await db
        .select()
        .from(aiTeacherCertification)
        .where(
          and(
            eq(aiTeacherCertification.id, parsed.data.id),
            isNull(aiTeacherCertification.deletedAt),
          ),
        )
        .limit(1)
      if (!existing[0]) return reply.status(404).send(error(404, '师资认证不存在'))
      await db
        .update(aiTeacherCertification)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(aiTeacherCertification.id, parsed.data.id))
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    },
  )

  // ===========================================================================
  // AIGC 工具详情 CRUD
  // ===========================================================================

  server.get('/aigc-tool', async (request, reply) => {
    const parsed = toolListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, keyword, category } = parsed.data
    const conds = [isNull(aigcToolDetail.deletedAt)]
    if (keyword) conds.push(ilike(aigcToolDetail.name, `%${keyword}%`))
    if (category) conds.push(eq(aigcToolDetail.category, category))
    const where = and(...conds)
    const [list, totalRows] = await Promise.all([
      db
        .select()
        .from(aigcToolDetail)
        .where(where)
        .orderBy(desc(aigcToolDetail.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(aigcToolDetail)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  server.get<{ Params: { id: string } }>('/aigc-tool/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db
      .select()
      .from(aigcToolDetail)
      .where(and(eq(aigcToolDetail.id, parsed.data.id), isNull(aigcToolDetail.deletedAt)))
      .limit(1)
    if (!rows[0]) return reply.status(404).send(error(404, 'AIGC工具不存在'))
    return reply.send(success({ tool: rows[0] }))
  })

  server.post('/aigc-tool', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = createToolSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.insert(aigcToolDetail).values(parsed.data).returning()
    return reply.status(201).send(success({ tool: rows[0] }))
  })

  server.put<{ Params: { id: string } }>('/aigc-tool/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateToolSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await db
      .select()
      .from(aigcToolDetail)
      .where(and(eq(aigcToolDetail.id, idParsed.data.id), isNull(aigcToolDetail.deletedAt)))
      .limit(1)
    if (!existing[0]) return reply.status(404).send(error(404, 'AIGC工具不存在'))
    const rows = await db
      .update(aigcToolDetail)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(aigcToolDetail.id, idParsed.data.id))
      .returning()
    return reply.send(success({ tool: rows[0] }))
  })

  server.delete<{ Params: { id: string } }>('/aigc-tool/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await db
      .select()
      .from(aigcToolDetail)
      .where(and(eq(aigcToolDetail.id, parsed.data.id), isNull(aigcToolDetail.deletedAt)))
      .limit(1)
    if (!existing[0]) return reply.status(404).send(error(404, 'AIGC工具不存在'))
    await db
      .update(aigcToolDetail)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(aigcToolDetail.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // ===========================================================================
  // K12 AI 课程标准 CRUD
  // ===========================================================================

  server.get('/k12-curriculum', async (request, reply) => {
    const parsed = k12ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, keyword, stage } = parsed.data
    const conds = [isNull(k12AiCurriculum.deletedAt)]
    if (keyword) conds.push(ilike(k12AiCurriculum.courseName, `%${keyword}%`))
    if (stage) conds.push(eq(k12AiCurriculum.stage, stage))
    const where = and(...conds)
    const [list, totalRows] = await Promise.all([
      db
        .select()
        .from(k12AiCurriculum)
        .where(where)
        .orderBy(desc(k12AiCurriculum.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(k12AiCurriculum)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  server.get<{ Params: { id: string } }>('/k12-curriculum/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db
      .select()
      .from(k12AiCurriculum)
      .where(and(eq(k12AiCurriculum.id, parsed.data.id), isNull(k12AiCurriculum.deletedAt)))
      .limit(1)
    if (!rows[0]) return reply.status(404).send(error(404, '课程标准不存在'))
    return reply.send(success({ curriculum: rows[0] }))
  })

  server.post('/k12-curriculum', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = createK12Schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.insert(k12AiCurriculum).values(parsed.data).returning()
    return reply.status(201).send(success({ curriculum: rows[0] }))
  })

  server.put<{ Params: { id: string } }>('/k12-curriculum/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateK12Schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await db
      .select()
      .from(k12AiCurriculum)
      .where(and(eq(k12AiCurriculum.id, idParsed.data.id), isNull(k12AiCurriculum.deletedAt)))
      .limit(1)
    if (!existing[0]) return reply.status(404).send(error(404, '课程标准不存在'))
    const rows = await db
      .update(k12AiCurriculum)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(k12AiCurriculum.id, idParsed.data.id))
      .returning()
    return reply.send(success({ curriculum: rows[0] }))
  })

  server.delete<{ Params: { id: string } }>('/k12-curriculum/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await db
      .select()
      .from(k12AiCurriculum)
      .where(and(eq(k12AiCurriculum.id, parsed.data.id), isNull(k12AiCurriculum.deletedAt)))
      .limit(1)
    if (!existing[0]) return reply.status(404).send(error(404, '课程标准不存在'))
    await db
      .update(k12AiCurriculum)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(k12AiCurriculum.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // ===========================================================================
  // 高校 AI 通识课程 CRUD
  // ===========================================================================

  server.get('/university-course', async (request, reply) => {
    const parsed = uniListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, keyword, university, courseType } = parsed.data
    const conds = [isNull(universityAiCourse.deletedAt)]
    if (keyword) conds.push(ilike(universityAiCourse.courseName, `%${keyword}%`))
    if (university) conds.push(eq(universityAiCourse.university, university))
    if (courseType) conds.push(eq(universityAiCourse.courseType, courseType))
    const where = and(...conds)
    const [list, totalRows] = await Promise.all([
      db
        .select()
        .from(universityAiCourse)
        .where(where)
        .orderBy(desc(universityAiCourse.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(universityAiCourse)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  server.get<{ Params: { id: string } }>('/university-course/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db
      .select()
      .from(universityAiCourse)
      .where(and(eq(universityAiCourse.id, parsed.data.id), isNull(universityAiCourse.deletedAt)))
      .limit(1)
    if (!rows[0]) return reply.status(404).send(error(404, '课程不存在'))
    return reply.send(success({ course: rows[0] }))
  })

  server.post('/university-course', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = createUniSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.insert(universityAiCourse).values(parsed.data).returning()
    return reply.status(201).send(success({ course: rows[0] }))
  })

  server.put<{ Params: { id: string } }>('/university-course/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateUniSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await db
      .select()
      .from(universityAiCourse)
      .where(and(eq(universityAiCourse.id, idParsed.data.id), isNull(universityAiCourse.deletedAt)))
      .limit(1)
    if (!existing[0]) return reply.status(404).send(error(404, '课程不存在'))
    const rows = await db
      .update(universityAiCourse)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(universityAiCourse.id, idParsed.data.id))
      .returning()
    return reply.send(success({ course: rows[0] }))
  })

  server.delete<{ Params: { id: string } }>('/university-course/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await db
      .select()
      .from(universityAiCourse)
      .where(and(eq(universityAiCourse.id, parsed.data.id), isNull(universityAiCourse.deletedAt)))
      .limit(1)
    if (!existing[0]) return reply.status(404).send(error(404, '课程不存在'))
    await db
      .update(universityAiCourse)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(universityAiCourse.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
}

export default aiEducationRoutes
