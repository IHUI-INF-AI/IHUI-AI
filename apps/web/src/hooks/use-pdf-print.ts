'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface PdfPrintOptions {
  fileId: string
  copies?: number
  duplex?: boolean
  color?: boolean
  pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal'
  orientation?: 'portrait' | 'landscape'
}

export interface PdfPrintResult {
  jobId: string
  status: 'queued' | 'printing' | 'done' | 'failed'
  message?: string
}

export interface UsePdfPrintReturn {
  print: (options: PdfPrintOptions) => Promise<PdfPrintResult | null>
  printing: boolean
  error: Error | null
}

async function printPdf(options: PdfPrintOptions): Promise<PdfPrintResult> {
  const res = await fetchApi<PdfPrintResult>('/api/pdf-service/print', {
    method: 'POST',
    body: JSON.stringify(options),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** PDF 打印 Hook，提交打印任务到后端 */
export function usePdfPrint(): UsePdfPrintReturn {
  const mutation = useMutation({ mutationFn: printPdf })

  const print = React.useCallback(
    async (options: PdfPrintOptions): Promise<PdfPrintResult | null> => {
      try {
        return await mutation.mutateAsync(options)
      } catch {
        return null
      }
    },
    [mutation],
  )

  return {
    print,
    printing: mutation.isPending,
    error: mutation.error as Error | null,
  }
}
