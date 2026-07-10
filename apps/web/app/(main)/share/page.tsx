'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, Share2, QrCode, Link as LinkIcon } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@ihui/ui'

interface ShareItem {
  id: string
  title: string
  description: string
  url: string
  qrcode?: string
}

export default function SharePage() {
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['share'],
    queryFn: async () => {
      const r = await fetchApi<ShareItem[]>('/api/share')
      if (r.success && r.data) return r.data
      return []
    },
  })

  const copyLink = (url: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {})
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Share2 className="h-6 w-6 text-primary" />
          分享中心
        </h1>
        <p className="text-sm text-muted-foreground">管理并分享你的内容</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          暂无分享内容
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((item) => (
            <Card key={item.id}>
              <CardHeader className="space-y-2 p-4">
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription className="line-clamp-2 text-sm">{item.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 p-4 pt-0">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted">
                  {item.qrcode ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.qrcode} alt="二维码" className="h-16 w-16 rounded-md" />
                  ) : (
                    <QrCode className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => copyLink(item.url)}>
                  <LinkIcon className="mr-1 h-3.5 w-3.5" />
                  复制链接
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
