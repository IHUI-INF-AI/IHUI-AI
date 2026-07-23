import { z } from 'zod'

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * 标签(Tag)表单 schema。
 *
 * 校验规则:
 * - name:必填,1-64
 * - description:可选,最大 500
 * - color:可选,必须是 #RGB 或 #RRGGBB
 */
export const tagSchema = z.object({
  name: z.string().min(1, 'required').max(64, 'maxLength'),
  description: z.string().max(500, 'maxLength').optional().default(''),
  color: z
    .string()
    .max(16, 'maxLength')
    .refine((v) => v === '' || HEX_COLOR_RE.test(v), { message: 'pattern' })
    .optional()
    .default(''),
})

export type TagFormValues = z.infer<typeof tagSchema>

export const EMPTY_TAG_FORM: TagFormValues = {
  name: '',
  description: '',
  color: '',
}
