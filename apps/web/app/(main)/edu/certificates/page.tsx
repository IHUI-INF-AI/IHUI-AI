'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Award, Loader2, Download } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface Certificate {
  id: string
  name: string
  certificateNo: string
  courseName?: string
  issuedAt: string
  status: number
}
interface CertsData {
  list: Certificate[]
  total: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduCertificatesPage() {
  const router = useRouter()
  const locale = useLocale()
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'certificates'],
    queryFn: () => api<CertsData>('/api/edu/certificates'),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const certs = data?.list ?? []

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Award className="h-7 w-7 text-primary" />
          我的证书
        </h1>
        <p className="text-sm text-muted-foreground">查看已获得的全部证书</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <Alert variant="danger" description={(error as Error).message} />
      ) : certs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <Award className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无证书</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certs.map((cert) => (
            <Card
              key={cert.id}
              className="cursor-pointer transition-colors hover:bg-accent"
              onClick={() => router.push(`/edu/certificates/${cert.id}`)}
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs',
                      cert.status === 1
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {cert.status === 1 ? '有效' : '已撤销'}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="line-clamp-1 font-medium">{cert.name}</p>
                  <p className="text-xs text-muted-foreground">编号：{cert.certificateNo}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{fmt(cert.issuedAt)}</span>
                  <span className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    查看
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
