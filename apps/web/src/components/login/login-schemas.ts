import { z } from 'zod'

export const phoneSchema = z
  .string()
  .min(1, 'auth.invalidPhone')
  .regex(/^1[3-9]\d{9}$/, 'auth.invalidPhone')

/** 通用账号:手机号 / 邮箱 / 用户名 */
export const accountSchema = z
  .string()
  .min(3, 'auth.invalidAccount')
  .max(72, 'auth.invalidAccount')

export const loginSchema = z.object({
  account: accountSchema,
  password: z.string().min(6, 'auth.invalidPassword'),
})

export type LoginValues = z.infer<typeof loginSchema>

export const emailSchema = z.string().email('auth.invalidEmail')
export const usernameSchema = z.string().min(3, 'auth.invalidUsername')

export type TokenResult = {
  userId: string
  accessToken: string
  refreshToken: string
  tokenType: string
}
