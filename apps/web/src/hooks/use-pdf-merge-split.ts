'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface PdfMergeInput {
  fileIds: string[]
  outputName?: string
}

export interface PdfSplitInput {
  fileId: string
  ranges: string[]
}

export interface PdfTaskResult {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  downloadUrl?: string
  error?: string
}

export interface UsePdfMergeSplitReturn {
  merge: (input: PdfMergeInput) => Promise<PdfTaskResult | null>
  split: (input: PdfSplitInput) => Promise<PdfTaskResult | null>
  merging: boolean
  splitting: boolean
  error: Error | null
}

async function mergePdf(input: PdfMergeInput): Promise<PdfTaskResult> {
  const res = await fetchApi<PdfTaskResult>('/api/pdf-service/merge', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

async function splitPdf(input: PdfSplitInput): Promise<PdfTaskResult> {
  const res = await fetchApi<PdfTaskResult>('/api/pdf-service/split', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** PDF 合并/拆分 Hook，对接后端 pdf-service */
export function usePdfMergeSplit(): UsePdfMergeSplitReturn {
  const mergeMutation = useMutation({ mutationFn: mergePdf })
  const splitMutation = useMutation({ mutationFn: splitPdf })

  const merge = React.useCallback(
    async (input: PdfMergeInput): Promise<PdfTaskResult | null> => {
      try {
        return await mergeMutation.mutateAsync(input)
      } catch {
        return null
      }
    },
    [mergeMutation],
  )

  const split = React.useCallback(
    async (input: PdfSplitInput): Promise<PdfTaskResult | null> => {
      try {
        return await splitMutation.mutateAsync(input)
      } catch {
        return null
      }
    },
    [splitMutation],
  )

  return {
    merge,
    split,
    merging: mergeMutation.isPending,
    splitting: splitMutation.isPending,
    error: (mergeMutation.error ?? splitMutation.error) as Error | null,
  }
}
