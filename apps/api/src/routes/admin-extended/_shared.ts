// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * admin-extended 子路由共享 schema/工具(从原 frontend-stub-admin-routes.ts 拆分)。
 */
import { z } from 'zod'

export const idParamSchema = z.object({ id: z.string().min(1) })

export const adminListSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})
