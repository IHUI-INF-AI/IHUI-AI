import { z } from 'zod'

const STATUS_VALUES = [-1, 0, 1] as const

/**
 * 问答(Ask)表单 schema。
 *
 * 校验规则:
 * - title:必填,1-200
 * - content:必填,1-10000
 * - tags:可选,逗号/空格分隔,每段最大 32,最多 10 段
 * - status:-1 / 0 / 1
 * - isResolved:布尔
 */
export const askSchema = z.object({
  title: z.string().min(1, 'required').max(200, 'maxLength'),
  content: z.string().min(1, 'required').max(10_000, 'maxLength'),
  tags: z.string().max(500, 'maxLength').optional().default(''),
  status: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  isResolved: z.boolean(),
})

export type AskFormValues = z.infer<typeof askSchema>

export const EMPTY_ASK_FORM: AskFormValues = {
  title: '',
  content: '',
  tags: '',
  status: 1,
  isResolved: false,
}

export const ASK_STATUS_VALUES = STATUS_VALUES
