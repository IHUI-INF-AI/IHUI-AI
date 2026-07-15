/**
 * community 子路由共享工具(从 community.ts 拆分)。
 * 包含:Zod schemas + 常量(ADMIN_ROLE_ID / errRespSchema / 各种 query/body schema)。
 */
import { z } from 'zod'
import { emptyToUndefined } from '../../utils/response.js'

export const ADMIN_ROLE_ID = 1

/** 通用错误响应 schema（400/401/404/500 共用） */
export const errRespSchema = {
  type: 'object' as const,
  properties: { code: { type: 'number' }, message: { type: 'string' } },
}

// =============================================================================
// Zod schemas
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

export const listCirclesQuery = z.object({
  ...paginationQuery,
  search: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
})

export const listCirclePostsQuery = z.object(paginationQuery)

export const listAsksQuery = z.object({
  ...paginationQuery,
  search: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  resolved: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
})

export const listAskAnswersQuery = z.object(paginationQuery)

// 圈子 id 支持 UUID 或 slug
export const circleIdParamSchema = z.object({
  id: z.string().min(1).max(120, '无效的 ID'),
})

export const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

export const createPostSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长'),
  content: z.string().min(1, '内容不能为空').max(50000, '内容过长'),
  images: z.array(z.string().max(512)).max(20).optional().nullable(),
})

export const updatePostSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长').optional(),
  content: z.string().min(1, '内容不能为空').max(50000, '内容过长').optional(),
  images: z.array(z.string().max(512)).max(20).optional().nullable(),
})

export const createAskSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长'),
  content: z.string().min(1, '内容不能为空').max(50000, '内容过长'),
  tags: z.array(z.string().max(64)).max(20).optional().nullable(),
})

export const updateAskSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长').optional(),
  content: z.string().min(1, '内容不能为空').max(50000, '内容过长').optional(),
  tags: z.array(z.string().max(64)).max(20).optional().nullable(),
})

export const createAnswerSchema = z.object({
  content: z.string().min(1, '内容不能为空').max(20000, '内容过长'),
})

export const circleShowSchema = z.object({
  isPublished: z.boolean(),
})
