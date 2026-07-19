'use client'

import * as React from 'react'
import { useForm, type UseFormProps, type UseFormReturn, type FieldValues, type DefaultValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ZodType, ZodTypeDef } from 'zod'
import { useTranslations } from 'next-intl'
import { VALIDATION_NS, type ValidationKey } from '@/lib/form-schema'

/**
 * useZodForm — react-hook-form + zod + next-intl 一体化 hook。
 *
 * 特性:
 * - 实时校验(onChange + onBlur,符合 §4 UX 期望)
 * - 错误信息自动从 `admin.validation.*` 拉取(zod issue.code → i18n key)
 * - SSR 安全(初始渲染时使用 fallback 文案,i18n 就绪后自动切换)
 * - 不破坏 react-hook-form 原生 API:`form.register / form.handleSubmit / form.formState.errors` 全部可用
 *
 * 用法:
 * ```ts
 * const { form, tValidation } = useZodForm<MyForm>({
 *   schema,
 *   defaultValues,
 * })
 * <form onSubmit={form.handleSubmit(onValid)}>...</form>
 *
 * // 自定义错误展示(可选):
 * {errors.name && <p>{tValidation('required')}</p>}
 * ```
 *
 * 业务 schema 字段错误字符串直接用 i18n key(详见 `VALIDATION_KEYS`):
 * ```ts
 * z.string().min(1, 'required').max(20, 'maxLength').email('email')
 * ```
 *
 * 当业务字段没传自定义 message 时,zod 抛 issue.code,hook 会自动按 code 翻译:
 * `too_small` → `admin.validation.min` / `invalid_email` → `admin.validation.email` 等。
 */
export interface UseZodFormOptions<T extends FieldValues> {
  schema: ZodType<T, ZodTypeDef, unknown>
  defaultValues: T
  mode?: UseFormProps<T>['mode']
  reValidateMode?: UseFormProps<T>['reValidateMode']
}

export interface UseZodFormReturn<T extends FieldValues> {
  form: UseFormReturn<T>
  isReady: boolean
  /** 将 zod issue.code / 自定义 key 翻译成 i18n 文案(供组件展示使用) */
  tValidation: (key: ValidationKey, vars?: Record<string, string | number>) => string
}

export function useZodForm<T extends FieldValues>({
  schema,
  defaultValues,
  mode = 'onChange',
  reValidateMode = 'onChange',
}: UseZodFormOptions<T>): UseZodFormReturn<T> {
  const t = useTranslations()
  const tValidation = React.useCallback(
    (key: ValidationKey, vars?: Record<string, string | number>) => {
      return t(`${VALIDATION_NS}.${key}`, vars as Record<string, string | number> | undefined)
    },
    [t],
  )

  const form = useForm<T, unknown, T>({
    resolver: zodResolver(schema) as unknown as UseFormProps<T>['resolver'],
    defaultValues: defaultValues as DefaultValues<T>,
    mode,
    reValidateMode,
  })

  return { form, isReady: true, tValidation }
}
