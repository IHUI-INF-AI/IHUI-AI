'use client'

import * as React from 'react'
import type { ZodType } from 'zod'

export interface UseFormOptions<T> {
  initial: T
  schema?: ZodType<T>
}

export interface UseFormReturn<T> {
  values: T
  errors: Partial<Record<keyof T, string>>
  setField: (name: keyof T, value: T[keyof T]) => void
  setValues: (values: Partial<T>) => void
  validate: () => boolean
  reset: (values?: T) => void
  handleSubmit: (
    onValid: (values: T) => void | Promise<void>,
  ) => (e?: React.BaseSyntheticEvent) => Promise<void>
}

/** 轻量表单 Hook，集成 zod 验证 */
export function useForm<T extends Record<string, unknown>>(
  options: UseFormOptions<T>,
): UseFormReturn<T> {
  const { initial, schema } = options
  const [values, setValuesState] = React.useState<T>(initial)
  const [errors, setErrors] = React.useState<Partial<Record<keyof T, string>>>({})

  const setField = React.useCallback((name: keyof T, value: T[keyof T]) => {
    setValuesState((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }, [])

  const setValues = React.useCallback((partial: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...partial }))
  }, [])

  const validate = React.useCallback((): boolean => {
    if (!schema) {
      setErrors({})
      return true
    }
    const result = schema.safeParse(values)
    if (result.success) {
      setErrors({})
      return true
    }
    const fieldErrors: Partial<Record<keyof T, string>> = {}
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof T
      if (key && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    setErrors(fieldErrors)
    return false
  }, [schema, values])

  const reset = React.useCallback(
    (resetValues?: T) => {
      setValuesState(resetValues ?? initial)
      setErrors({})
    },
    [initial],
  )

  const handleSubmit = React.useCallback(
    (onValid: (values: T) => void | Promise<void>) =>
      async (e?: React.BaseSyntheticEvent) => {
        e?.preventDefault()
        if (validate()) {
          await onValid(values)
        }
      },
    [validate, values],
  )

  return { values, errors, setField, setValues, validate, reset, handleSubmit }
}
