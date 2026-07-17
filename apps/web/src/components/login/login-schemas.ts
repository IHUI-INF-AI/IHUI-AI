import { z } from 'zod'

export const phoneSchema = z
  .string()
  .min(1, 'auth.invalidPhone')
  .regex(/^1[3-9]\d{9}$/, 'auth.invalidPhone')

export const loginSchema = z.object({
  phone: phoneSchema,
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
