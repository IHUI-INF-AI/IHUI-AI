import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  findCategoriesByPid,
  findCategoryById,
  createResourceCategory,
  updateResourceCategory,
  deleteResourceCategory,
  findResources,
  findResourceByIdAndIncrementView,
  findResourceById,
  findResourcesByIds,
  createResource,
  updateResource,
  deleteResource,
  publishResource,
  findProducts,
  findProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  findTags,
  findTagById,
  createTag,
  updateTag,
  deleteTag,
} from '../db/resource-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// 通用响应 schema(data 透传)
const responseSchema = {
  200: {
    type: 'object',
    properties: {
      code: { type: 'number' },
      message: { type: 'string' },
      data: { type: 'object', additionalProperties: true },
    },
  },
  400: {
    type: 'object',
    properties: { code: { type: 'number' }, message: { type: 'string' } },
  },
  401: {
    type: 'object',
    properties: { code: { type: 'number' }, message: { type: 'string' } },
  },
  404: {
    type: 'object',
    properties: { code: { type: 'number' }, message: { type: 'string' } },
  },
}

const responseSchema201 = {
  ...responseSchema,
  201: responseSchema[200],
}

// =============================================================================
// Zod schemas
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const resourcesListQuery = z.object({
  ...paginationQuery,
  title: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  categoryId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  isPublished: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
})

const byIdsQuery = z.object({
  ids: z.string().min(1, 'ids 不能为空'),
})

const categoryQuery = z.object({
  pid: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  fetchAll: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
})

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const createResourceSchema = z.object({
  title: z.string().min(1).max(200),
  coverImage: z.string().max(500).nullable().optional(),
  intro: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  fileUrl: z.string().max(500).nullable().optional(),
  fileType: z.string().max(50).nullable().optional(),
  fileSize: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
})

const updateResourceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  coverImage: z.string().max(500).nullable().optional(),
  intro: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  fileUrl: z.string().max(500).nullable().optional(),
  fileType: z.string().max(50).nullable().optional(),
  fileSize: z.number().int().min(0).optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
})

const publishResourceSchema = z.object({
  isPublished: z.boolean(),
})

const productsListQuery = z.object({
  ...paginationQuery,
  resourceId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  name: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  isPublished: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
})

const createProductSchema = z.object({
  resourceId: z.string().uuid('无效的资源 ID'),
  name: z.string().min(1).max(200),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .optional(),
  originalPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .nullable()
    .optional(),
  description: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
})

const updateProductSchema = z.object({
  resourceId: z.string().uuid().optional(),
  name: z.string().min(1).max(200).optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .optional(),
  originalPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .nullable()
    .optional(),
  description: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
})

const tagsListQuery = z.object({
  ...paginationQuery,
  name: z.preprocess(emptyToUndefined, z.string().min(1).max(100).optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
})

const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

// =============================================================================
// 公共路由（前缀 /api，需登录）
// =============================================================================

export const resourceRoutes: FastifyPluginAsync = async (server) => {
  // GET /resources/categories - 启用分类列表(可选 pid 筛选)（公开）
  server.get(
    '/resources/categories',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = categoryQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const list = await findCategoriesByPid(parsed.data.pid ?? null, false)
      return reply.send(success({ list }))
    },
  )

  // GET /resources/categories/:id - 分类详情
  server.get(
    '/resources/categories/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const category = await findCategoryById(parsed.data.id)
      if (!category) return reply.status(404).send(error(404, '分类不存在'))
      return reply.send(success({ category }))
    },
  )

  // GET /resources - 已发布资源列表(分页+筛选)
  server.get(
    '/resources',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = resourcesListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      // 公开端点强制只看已发布+启用
      const result = await findResources({
        ...parsed.data,
        isPublished: true,
        status: 1,
      })
      return reply.send(success(result))
    },
  )

  // GET /resources/by-ids - 批量获取资源
  server.get(
    '/resources/by-ids',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = byIdsQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const ids = parsed.data.ids
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const list = await findResourcesByIds(ids)
      return reply.send(success({ list }))
    },
  )

  // GET /resources/:id - 资源详情(自增浏览量)
  server.get(
    '/resources/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const resource = await findResourceByIdAndIncrementView(parsed.data.id)
      if (!resource) return reply.status(404).send(error(404, '资源不存在'))
      return reply.send(success({ resource }))
    },
  )

  // GET /resources/products/:id - 产品详情(公开)
  server.get(
    '/resources/products/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const product = await findProductById(parsed.data.id)
      if (!product) return reply.status(404).send(error(404, '产品不存在'))
      return reply.send(success({ product }))
    },
  )

  // GET /resources/tags/:id - 标签详情(公开)
  server.get(
    '/resources/tags/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const tag = await findTagById(parsed.data.id)
      if (!tag) return reply.status(404).send(error(404, '标签不存在'))
      return reply.send(success({ tag }))
    },
  )
}

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminResourceRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ----- Categories Admin -----

  // GET /resources/categories - 分类列表(含禁用,可选 pid)
  server.get(
    '/resources/categories',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = categoryQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const list = await findCategoriesByPid(parsed.data.pid ?? null, parsed.data.fetchAll ?? false)
      return reply.send(success({ list }))
    },
  )

  // POST /resources/categories - 创建分类
  server.post(
    '/resources/categories',
    { schema: { response: { ...responseSchema201 } } },
    async (request, reply) => {
      const parsed = createCategorySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const category = await createResourceCategory(parsed.data)
      return reply.status(201).send(success({ category }))
    },
  )

  // PUT /resources/categories/:id - 更新分类
  server.put(
    '/resources/categories/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateCategorySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findCategoryById(idParsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '分类不存在'))
      const category = await updateResourceCategory(idParsed.data.id, parsed.data)
      return reply.send(success({ category }))
    },
  )

  // DELETE /resources/categories/:id - 删除分类
  server.delete(
    '/resources/categories/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findCategoryById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '分类不存在'))
      await deleteResourceCategory(parsed.data.id)
      return reply.send(success({ ok: true }))
    },
  )

  // ----- Resources Admin -----

  // GET /resources - 资源列表(不限发布状态)
  server.get(
    '/resources',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = resourcesListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findResources(parsed.data)
      return reply.send(success(result))
    },
  )

  // GET /resources/:id - 资源详情(admin,不自增浏览量)
  server.get(
    '/resources/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const resource = await findResourceById(parsed.data.id)
      if (!resource) return reply.status(404).send(error(404, '资源不存在'))
      return reply.send(success({ resource }))
    },
  )

  // POST /resources - 创建资源
  server.post(
    '/resources',
    { schema: { response: { ...responseSchema201 } } },
    async (request, reply) => {
      const parsed = createResourceSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const resource = await createResource(parsed.data)
      return reply.status(201).send(success({ resource }))
    },
  )

  // PUT /resources/:id - 更新资源
  server.put(
    '/resources/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateResourceSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findResourceById(idParsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '资源不存在'))
      const resource = await updateResource(idParsed.data.id, parsed.data)
      return reply.send(success({ resource }))
    },
  )

  // DELETE /resources/:id - 删除资源
  server.delete(
    '/resources/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findResourceById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '资源不存在'))
      await deleteResource(parsed.data.id)
      return reply.send(success({ ok: true }))
    },
  )

  // PUT /resources/:id/publish - 发布/取消发布
  server.put(
    '/resources/:id/publish',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = publishResourceSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findResourceById(idParsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '资源不存在'))
      const resource = await publishResource(idParsed.data.id, parsed.data.isPublished)
      return reply.send(success({ resource }))
    },
  )

  // ----- Products Admin -----

  // GET /resources/products - 产品列表
  server.get(
    '/resources/products',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = productsListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findProducts(parsed.data)
      return reply.send(success(result))
    },
  )

  // POST /resources/products - 创建产品
  server.post(
    '/resources/products',
    { schema: { response: { ...responseSchema201 } } },
    async (request, reply) => {
      const parsed = createProductSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const product = await createProduct(parsed.data)
      return reply.status(201).send(success({ product }))
    },
  )

  // PUT /resources/products/:id - 更新产品
  server.put(
    '/resources/products/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateProductSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findProductById(idParsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '产品不存在'))
      const product = await updateProduct(idParsed.data.id, parsed.data)
      return reply.send(success({ product }))
    },
  )

  // DELETE /resources/products/:id - 删除产品
  server.delete(
    '/resources/products/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findProductById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '产品不存在'))
      await deleteProduct(parsed.data.id)
      return reply.send(success({ ok: true }))
    },
  )

  // ----- Tags Admin -----

  // GET /resources/tags - 标签列表
  server.get(
    '/resources/tags',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = tagsListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findTags(parsed.data)
      return reply.send(success(result))
    },
  )

  // POST /resources/tags - 创建标签
  server.post(
    '/resources/tags',
    { schema: { response: { ...responseSchema201 } } },
    async (request, reply) => {
      const parsed = createTagSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const tag = await createTag(parsed.data)
      return reply.status(201).send(success({ tag }))
    },
  )

  // PUT /resources/tags/:id - 更新标签
  server.put(
    '/resources/tags/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateTagSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findTagById(idParsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '标签不存在'))
      const tag = await updateTag(idParsed.data.id, parsed.data)
      return reply.send(success({ tag }))
    },
  )

  // DELETE /resources/tags/:id - 删除标签
  server.delete(
    '/resources/tags/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findTagById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '标签不存在'))
      await deleteTag(parsed.data.id)
      return reply.send(success({ ok: true }))
    },
  )
}
