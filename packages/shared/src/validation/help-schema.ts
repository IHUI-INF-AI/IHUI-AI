import { z } from 'zod'

const HELP_CATEGORIES = ['account', 'payment', 'project', 'ai', 'tech'] as const
export type HelpCategory = (typeof HELP_CATEGORIES)[number]

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * 帮助文章(Help)表单 schema。
 *
 * 校验规则:
 * - title:必填,1-200
 * - slug:可选(为空时由 title 派生),若提供必须是 kebab-case
 * - category:必须是预定义的 HelpCategory
 * - content:必填,1-50000
 * - isPublished:布尔
 */
export const helpSchema = z.object({
  title: z.string().min(1, 'required').max(200, 'maxLength'),
  slug: z
    .string()
    .max(120, 'maxLength')
    .refine((v) => v === '' || SLUG_RE.test(v), { message: 'pattern' })
    .optional()
    .default(''),
  category: z.enum(HELP_CATEGORIES),
  content: z.string().min(1, 'required').max(50_000, 'maxLength'),
  isPublished: z.boolean(),
})

export type HelpFormValues = z.infer<typeof helpSchema>

export const EMPTY_HELP_FORM: HelpFormValues = {
  title: '',
  slug: '',
  category: 'account',
  content: '',
  isPublished: false,
}

export const HELP_CATEGORY_VALUES: readonly HelpCategory[] = HELP_CATEGORIES
