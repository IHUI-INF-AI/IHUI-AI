/**
 * 安全布尔解析工具(2026-08-05 P1 审计)。
 *
 * 背景:z.coerce.boolean() 使用 JS 真值语义,任意非空字符串(包括 "false"/"0")
 * 都会被 coerce 为 true,导致 SMTP_ENABLED=false / API_LOG_ENABLED=false 等
 * 配置实际失效,是典型的安全配置绕过。
 *
 * 语义:
 * - "true" / "1" / "yes" / "on"(大小写不敏感) → true
 * - "false" / "0" / "no" / "off" → false
 * - 其它值 → 解析失败(返回 issue),避免静默误判
 *
 * 用法(环境变量 schema):
 *   SMTP_ENABLED: booleanFromString(false),
 *   或组合可选:
 *   DEBUG_FLAG: booleanStringSchemaOptional,
 */
import { z } from 'zod'

const TRUE_LIKE = /^(true|1|yes|on)$/i
const BOOL_TOKEN_RE = /^(true|false|1|0|yes|no|on|off)$/i

/**
 * 解析布尔字符串;非法值抛错(zod 内使用)。
 * @param v 环境变量原始值
 */
export function parseBooleanString(v: string): boolean {
  if (!BOOL_TOKEN_RE.test(v)) {
    throw new Error(`布尔值非法: "${v}"(仅接受 true/false/1/0/yes/no/on/off)`)
  }
  return TRUE_LIKE.test(v)
}

/**
 * zod schema:把字符串按显式白名单解析为 boolean。
 * 与 z.coerce.boolean() 不同,"false"/"0" 会正确解析为 false,非法值直接失败。
 */
export const booleanStringSchema: z.ZodType<boolean, z.ZodTypeDef, unknown> = z
  .string()
  .refine((v) => BOOL_TOKEN_RE.test(v), {
    message: '布尔配置仅接受 true/false/1/0/yes/no/on/off',
  })
  .transform((v) => TRUE_LIKE.test(v))

/**
 * zod schema:可选布尔(undefined/空字符串 → undefined)。
 * 用于 query/body 中可省略的布尔字段,替代 `z.transform(emptyToUndefined).pipe(z.coerce.boolean().optional())`。
 */
export const booleanStringSchemaOptional: z.ZodType<boolean | undefined, z.ZodTypeDef, unknown> =
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined
      return parseBooleanString(v)
    })

/**
 * 环境变量布尔配置工厂:带默认值的布尔 schema。
 * @param def 默认值(zod4 要求 default 与 transform 后输出类型一致,传 boolean 字面量)
 */
export function booleanFromString(def: boolean): z.ZodType<boolean, z.ZodTypeDef, unknown> {
  return booleanStringSchema.default(def)
}
