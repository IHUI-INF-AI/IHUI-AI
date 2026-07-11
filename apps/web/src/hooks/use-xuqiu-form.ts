'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

export interface XuqiuFormData {
  title: string
  description: string
  category: string
  budget: number | null
  contact: string
  attachments: string[]
}

export interface UseXuqiuFormReturn {
  form: XuqiuFormData
  submitting: boolean
  update: (patch: Partial<XuqiuFormData>) => void
  reset: () => void
  submit: () => Promise<boolean>
}

const EMPTY_FORM: XuqiuFormData = {
  title: '',
  description: '',
  category: '',
  budget: null,
  contact: '',
  attachments: [],
}

/** 需求表单 Hook，管理需求发布表单的状态与提交 */
export function useXuqiuForm(): UseXuqiuFormReturn {
  const toast = useToast()
  const [form, setForm] = React.useState<XuqiuFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = React.useState(false)

  const update = React.useCallback((patch: Partial<XuqiuFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const reset = React.useCallback(() => setForm(EMPTY_FORM), [])

  const submit = React.useCallback(async (): Promise<boolean> => {
    if (!form.title.trim()) {
      toast.error('请填写需求标题')
      return false
    }
    setSubmitting(true)
    try {
      const res = await fetchApi<{ id: string }>('/xuqiu', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      if (res.success) {
        toast.success('需求发布成功')
        reset()
        return true
      }
      toast.error('发布失败', res.error)
      return false
    } finally {
      setSubmitting(false)
    }
  }, [form, reset, toast])

  return { form, submitting, update, reset, submit }
}
