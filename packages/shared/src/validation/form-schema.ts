/**
 * 共享 Zod schema 工具(实时校验、错误信息国际化)。
 *
 * 设计原则:
 * 1. 业务页直接复用预制 z.string().min(1, msg('required')) 模式
 * 2. `msg()` 自动将 zod issue code 映射到 `admin.validation.*` i18n key
 * 3. schema 不绑定到具体 page;`useZodForm` hook 调用 schema 时注入 i18n translator
 *
 * 用法:
 * ```ts
 * const schema = z.object({
 *   name: z.string().min(1, msg('required', { field: '名称' })),
 *   email: z.string().email(msg('email')),
 *   age: z.number().int().min(18, msg('min', { min: 18 })),
 * })
 * ```
 */

/** i18n key 命名空间前缀 */
export const VALIDATION_NS = 'admin.validation' as const

/**
 * 构造 zod 错误消息(单 i18n key + 可选插值)。
 * 调用方传入 next-intl translator;返回的字符串直接给 zod 字段使用。
 */
export function buildMessage(
  t: (key: string, vars?: Record<string, string | number>) => string,
  key: keyof typeof VALIDATION_KEYS,
  vars?: Record<string, string | number>,
): string {
  return t(`${VALIDATION_NS}.${key}`, vars as Record<string, string | number> | undefined)
}

/** 所有支持的 zod 错误 code 对应的 i18n key 列表(强制 parity 守门用) */
export const VALIDATION_KEYS = {
  required: true,
  min: true,
  max: true,
  minLength: true,
  maxLength: true,
  email: true,
  url: true,
  uuid: true,
  number: true,
  integer: true,
  positive: true,
  pattern: true,
  enum: true,
  custom: true,
} as const

export type ValidationKey = keyof typeof VALIDATION_KEYS

/**
 * 默认错误消息构造器:fallback 到英文(避免 zod 在 SSR + i18n 未就绪时崩溃)。
 * 业务 page 应当用 `useZodForm` 的 translator 注入真实 i18n 消息。
 */
export const DEFAULT_VALIDATION_MESSAGES: Record<ValidationKey, string> = {
  required: 'Required',
  min: 'Min value is {min}',
  max: 'Max value is {max}',
  minLength: 'Min length is {min}',
  maxLength: 'Max length is {max}',
  email: 'Invalid email',
  url: 'Invalid URL',
  uuid: 'Invalid UUID',
  number: 'Must be a number',
  integer: 'Must be an integer',
  positive: 'Must be positive',
  pattern: 'Invalid format',
  enum: 'Invalid value',
  custom: 'Invalid value',
}
