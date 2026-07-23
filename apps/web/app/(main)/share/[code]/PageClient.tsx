'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'

import { fetchShareContent } from '@/lib/share-api'
import { useClipboard } from '@/hooks/use-clipboard'
import { ShareContent } from './ShareContent'

export default function ShareCodePage() {
  const params = useParams<{ code: string }>()
  const code = params?.code ?? ''
  const { copied, copy } = useClipboard()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['share', 'content', code],
    queryFn: () => fetchShareContent(code),
    enabled: !!code,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-background px-10 text-center">
        <AlertCircle className="mb-6 h-16 w-16 text-muted-foreground/50" />
        <p className="mb-8 text-sm text-muted-foreground">
          {(error as Error)?.message || '分享链接无效'}
        </p>
        <button
          onClick={() => refetch()}
          className="rounded-md bg-primary px-7 py-2.5 text-sm text-white transition-colors hover:bg-primary/90"
        >
          重试
        </button>
      </div>
    )
  }

  return <ShareContent shareData={data} copy={copy} copied={copied} />
}
