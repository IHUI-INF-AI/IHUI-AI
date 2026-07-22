'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'

export interface PdfSignatureInput {
  fileId: string
  signerName: string
  reason?: string
  location?: string
  /** Base64 编码的签名图片 */
  signatureImage?: string
  pageNumber?: number
  position?: { x: number; y: number; width: number; height: number }
}

export interface PdfSignatureResult {
  fileId: string
  signed: boolean
  downloadUrl?: string
  signedAt: string
}

export interface UsePdfSignatureReturn {
  sign: (input: PdfSignatureInput) => Promise<PdfSignatureResult | null>
  signing: boolean
  error: Error | null
}

/** 数字签名需证书,后端暂未实现,直接返回错误提示。 */
async function signPdf(_input: PdfSignatureInput): Promise<PdfSignatureResult> {
  throw new Error('该功能暂不支持:数字签名需证书,暂未实现')
}

/** PDF 签名 Hook，提交数字签名到后端 */
export function usePdfSignature(): UsePdfSignatureReturn {
  const mutation = useMutation({ mutationFn: signPdf })

  const sign = React.useCallback(
    async (input: PdfSignatureInput): Promise<PdfSignatureResult | null> => {
      try {
        return await mutation.mutateAsync(input)
      } catch {
        return null
      }
    },
    [mutation],
  )

  return {
    sign,
    signing: mutation.isPending,
    error: mutation.error as Error | null,
  }
}
