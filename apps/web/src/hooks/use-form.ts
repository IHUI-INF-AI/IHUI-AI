'use client'

import * as React from 'react'
import type { ZodType } from 'zod'

export interface UseFormOptions<T> {
  initial: T
  schema?: ZodType<T>
  validateOn?: 'onChange' | 'onBlur' | 'onSubmit'
}

export interface UseFormReturn<T> {
  values: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
  dirty: boolean
  isSubmitting: boolean
  setField: (name: keyof T, value: T[keyof T]) => void
  setValues: (values: Partial<T>) => void
  setTouched: (name: keyof T, touched?: boolean) => void
  validate: () => boolean
  reset: (values?: T) => void
  handleSubmit: (
    onValid: (values: T) => void | Promise<void>,
  ) => (e?: React.BaseSyntheticEvent) => Promise<void>
}

export function useForm<T extends Record<string, unknown>>(
  options: UseFormOptions<T>,
): UseFormReturn<T> {
  const { initial, schema, validateOn = 'onSubmit' } = options
  const [values, setValuesState] = React.useState<T>(initial)
  const [errors, setErrors] = React.useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouchedState] = React.useState<Partial<Record<keyof T, boolean>>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const initialValuesRef = React.useRef(initial)

  const dirty = React.useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValuesRef.current),
    [values],
  )

  const runValidation = React.useCallback(
    (fieldValues: T, field?: keyof T) => {
      if (!schema) {
        setErrors({})
        return true
      }
      const result = schema.safeParse(fieldValues)
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
      if (field) {
        setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }))
      } else {
        setErrors(fieldErrors)
      }
      return result.success
    },
    [schema],
  )

  const setField = React.useCallback(
    (name: keyof T, value: T[keyof T]) => {
      const newValues = { ...values, [name]: value }
      setValuesState(newValues)
      if (validateOn === 'onChange') {
        runValidation(newValues, name)
      } else {
        setErrors((prev) => ({ ...prev, [name]: undefined }))
      }
    },
    [values, validateOn, runValidation],
  )

  const setValues = React.useCallback((partial: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...partial }))
  }, [])

  const setTouched = React.useCallback(
    (name: keyof T, isTouched = true) => {
      setTouchedState((prev) => ({ ...prev, [name]: isTouched }))
      if (validateOn === 'onBlur' && isTouched) {
        runValidation(values, name)
      }
    },
    [validateOn, values, runValidation],
  )

  const validate = React.useCallback((): boolean => {
    return runValidation(values)
  }, [runValidation, values])

  const reset = React.useCallback(
    (resetValues?: T) => {
      const next = resetValues ?? initial
      initialValuesRef.current = next
      setValuesState(next)
      setErrors({})
      setTouchedState({})
      setIsSubmitting(false)
    },
    [initial],
  )

  const handleSubmit = React.useCallback(
    (onValid: (values: T) => void | Promise<void>) => async (e?: React.BaseSyntheticEvent) => {
      e?.preventDefault()
      if (validate()) {
        setIsSubmitting(true)
        try {
          await onValid(values)
        } finally {
          setIsSubmitting(false)
        }
      }
    },
    [validate, values],
  )

  return {
    values,
    errors,
    touched,
    dirty,
    isSubmitting,
    setField,
    setValues,
    setTouched,
    validate,
    reset,
    handleSubmit,
  }
}
