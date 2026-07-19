// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// next-intl mock:useTranslations 返回 i18n key 字面字符串(便于测试断言)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, vars?: Record<string, string | number>) => {
    if (!vars) return `[${key}]`
    const parts = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(',')
    return `[${key}|${parts}]`
  },
}))

import { useZodForm } from './use-zod-form'
import { z } from 'zod'

interface FormData {
  name: string
  email: string
  age: number
}

const schema = z.object({
  name: z.string().min(1, 'required').max(20, 'maxLength'),
  email: z.string().email('email'),
  age: z.number().int().min(0, 'min'),
})

describe('useZodForm', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初始渲染时表单为空,无错误', () => {
    const { result } = renderHook(() =>
      useZodForm<FormData>({
        schema,
        defaultValues: { name: '', email: '', age: 0 },
      }),
    )
    expect(result.current.form.getValues()).toEqual({ name: '', email: '', age: 0 })
    expect(result.current.isReady).toBe(true)
  })

  it('schema 单独校验:空 name 触发 required 错误', () => {
    const result = schema.safeParse({ name: '', email: 'a@b.com', age: 25 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('required')
    }
  })

  it('schema 单独校验:非法 email 触发 email 错误', () => {
    const result = schema.safeParse({ name: 'Alice', email: 'bad', age: 25 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const emailErr = result.error.issues.find((i) => i.path.includes('email'))
      expect(emailErr?.message).toBe('email')
    }
  })

  it('schema 单独校验:负数 age 触发 min 错误', () => {
    const result = schema.safeParse({ name: 'Alice', email: 'a@b.com', age: -1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const ageErr = result.error.issues.find((i) => i.path.includes('age'))
      expect(ageErr?.message).toBe('min')
    }
  })

  it('合法值通过 schema 校验', () => {
    const result = schema.safeParse({ name: 'Alice', email: 'a@b.com', age: 25 })
    expect(result.success).toBe(true)
  })

  it('hook:提交空表单不触发 onValid', async () => {
    const onValid = vi.fn()
    const { result } = renderHook(() =>
      useZodForm<FormData>({
        schema,
        defaultValues: { name: '', email: '', age: 0 },
      }),
    )
    await act(async () => {
      await result.current.form.handleSubmit(onValid)()
    })
    expect(onValid).not.toHaveBeenCalled()
  })

  it('hook:合法值触发 onValid', async () => {
    const onValid = vi.fn()
    const { result } = renderHook(() =>
      useZodForm<FormData>({
        schema,
        defaultValues: { name: '', email: '', age: 0 },
      }),
    )
    await act(async () => {
      result.current.form.setValue('name', 'Alice', { shouldValidate: true })
      result.current.form.setValue('email', 'a@b.com', { shouldValidate: true })
      result.current.form.setValue('age', 25, { shouldValidate: true })
    })
    await act(async () => {
      await result.current.form.handleSubmit(onValid)()
    })
    expect(onValid).toHaveBeenCalled()
    expect(onValid.mock.calls[0]?.[0]).toEqual({ name: 'Alice', email: 'a@b.com', age: 25 })
  })

  it('tValidation helper 返回 i18n 文案', () => {
    const { result } = renderHook(() =>
      useZodForm<FormData>({
        schema,
        defaultValues: { name: '', email: '', age: 0 },
      }),
    )
    expect(result.current.tValidation('required')).toBe('[admin.validation.required]')
    expect(result.current.tValidation('min', { min: 18 })).toBe('[admin.validation.min|min=18]')
  })

  it('hook 暴露 form.register 接口(react-hook-form 兼容)', () => {
    const { result } = renderHook(() =>
      useZodForm<FormData>({
        schema,
        defaultValues: { name: '', email: '', age: 0 },
      }),
    )
    expect(typeof result.current.form.register).toBe('function')
    expect(typeof result.current.form.handleSubmit).toBe('function')
    expect(typeof result.current.form.watch).toBe('function')
    expect(typeof result.current.form.setValue).toBe('function')
    expect(typeof result.current.form.reset).toBe('function')
  })
})
