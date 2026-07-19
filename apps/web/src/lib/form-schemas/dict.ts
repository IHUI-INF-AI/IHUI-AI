import { z } from 'zod'

/**
 * 字典类型(Type)表单 schema。
 *
 * 校验规则:
 * - name:必填,长度 1-64
 * - code:必填,小写字母/数字/下划线,1-64
 * - description:可选,最大 500
 */
export const dictTypeSchema = z.object({
  name: z.string().min(1, 'required').max(64, 'maxLength'),
  code: z
    .string()
    .min(1, 'required')
    .max(64, 'maxLength')
    .regex(/^[a-z][a-z0-9_]*$/, 'pattern'),
  description: z.string().max(500, 'maxLength').optional().default(''),
})

export type DictTypeFormValues = z.infer<typeof dictTypeSchema>

export const EMPTY_DICT_TYPE_FORM: DictTypeFormValues = {
  name: '',
  code: '',
  description: '',
}

/**
 * 字典项(Item)表单 schema。
 *
 * 校验规则:
 * - label:必填,1-128
 * - value:必填,1-128
 * - sort:整数,>= 0
 * - dictType:必填
 * - listClass:必须是预定义的 ListClass
 * - status:0 或 1
 * - cssClass:可选
 * - remark:可选,最大 500
 */
const LIST_CLASS_VALUES = [
  'default',
  'primary',
  'success',
  'info',
  'warning',
  'danger',
] as const

export const dictItemSchema = z.object({
  label: z.string().min(1, 'required').max(128, 'maxLength'),
  value: z.string().min(1, 'required').max(128, 'maxLength'),
  sort: z.number().int('integer').min(0, 'min'),
  dictType: z.string().min(1, 'required'),
  listClass: z.enum(LIST_CLASS_VALUES),
  status: z.union([z.literal(0), z.literal(1)]),
  cssClass: z.string().max(64, 'maxLength').optional().default(''),
  remark: z.string().max(500, 'maxLength').optional().default(''),
})

export type DictItemFormValues = z.infer<typeof dictItemSchema>

export const EMPTY_DICT_ITEM_FORM: DictItemFormValues = {
  label: '',
  value: '',
  sort: 0,
  cssClass: '',
  listClass: 'default',
  status: 1,
  remark: '',
  dictType: '',
}
