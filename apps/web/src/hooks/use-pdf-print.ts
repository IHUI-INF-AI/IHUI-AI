'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'

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

/** 打印是浏览器端行为,后端不支持,直接返回错误提示。 */
async function printPdf(_options: PdfPrintOptions): Promise<PdfPrintResult> {
  throw new Error('该功能暂不支持:打印请使用浏览器自带功能')
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
