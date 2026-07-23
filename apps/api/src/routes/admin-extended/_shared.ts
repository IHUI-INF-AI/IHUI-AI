/**
 * admin-extended 子路由共享 schema/工具(从原 frontend-stub-admin-routes.ts 拆分)。
 */
import { z } from 'zod'

export const idParamSchema = z.object({ id: z.string().min(1) })

export const adminListSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})
