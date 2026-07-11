'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface LegalDoc {
  id: string
  title: string
  type: 'terms' | 'privacy' | 'agreement' | 'policy' | 'notice'
  version: string
  content: string
  effectiveAt: string
  updatedAt: string
}

export interface UseLegalDocReturn {
  doc: LegalDoc | null
  loading: boolean
  error: string | null
  fetchDoc: (type: LegalDoc['type']) => Promise<void>
  accept: (docId: string) => Promise<boolean>
}

/** 法律文档内容 Hook，按类型获取文档并记录用户接受 */
export function useLegalDoc(): UseLegalDocReturn {
  const [doc, setDoc] = React.useState<LegalDoc | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchDoc = React.useCallback(async (type: LegalDoc['type']) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<LegalDoc>(`/api/legal/${type}`)
      if (res.success) {
        setDoc(res.data)
      } else {
        setError(res.error)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const accept = React.useCallback(async (docId: string) => {
    const res = await fetchApi(`/api/legal/${docId}/accept`, { method: 'POST' })
    return res.success
  }, [])

  return { doc, loading, error, fetchDoc, accept }
}
