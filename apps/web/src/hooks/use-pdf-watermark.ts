'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface PdfWatermarkInput {
  fileId: string
  text?: string
  imageBase64?: string
  opacity?: number
  rotation?: number
  fontSize?: number
  color?: string
  position?: 'center' | 'tile' | 'top-left' | 'bottom-right'
  pages?: 'all' | number[]
}

export interface PdfWatermarkResult {
  fileId: string
  watermarked: boolean
  downloadUrl?: string
  processedAt: string
}

export interface UsePdfWatermarkReturn {
  addWatermark: (input: PdfWatermarkInput) => Promise<PdfWatermarkResult | null>
  processing: boolean
  error: Error | null
}

async function addWatermark(input: PdfWatermarkInput): Promise<PdfWatermarkResult> {
  const res = await fetchApi<PdfWatermarkResult>('/api/pdf-service/watermark', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** PDF 水印 Hook，提交水印任务到后端 */
export function usePdfWatermark(): UsePdfWatermarkReturn {
  const mutation = useMutation({ mutationFn: addWatermark })

  const addWatermarkFn = React.useCallback(
    async (input: PdfWatermarkInput): Promise<PdfWatermarkResult | null> => {
      try {
        return await mutation.mutateAsync(input)
      } catch {
        return null
      }
    },
    [mutation],
  )

  return {
    addWatermark: addWatermarkFn,
    processing: mutation.isPending,
    error: mutation.error as Error | null,
  }
}
