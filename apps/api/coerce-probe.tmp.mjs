// 临时探针:确认 z.coerce.number 转 JSON schema 的类型标注
import { z } from 'zod'
const q = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  departmentId: z.string().uuid().optional(),
})
console.log(JSON.stringify(z.toJSONSchema(q, { target: 'openApi3' }), null, 2))
