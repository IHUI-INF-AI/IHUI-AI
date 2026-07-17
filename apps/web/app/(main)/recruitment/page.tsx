'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2, CheckCircle2, TrendingUp, Users, Award, Target, ArrowRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Requirement {
  title: string
  detail: string
}

interface Benefit {
  title: string
  detail: string
}

interface RecruitmentPlan {
  title: string
  subtitle: string
  description: string
  requirements: Requirement[]
  benefits: Benefit[]
  stats: { label: string; value: string }[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function RecruitmentPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['recruitment'],
    queryFn: () => api<RecruitmentPlan>('/api/recruitment'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {(error as Error).message}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
        <Users className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">暂无招募计划</p>
      </div>
    )
  }

  const requirements = Array.isArray(data.requirements) ? data.requirements : []
  const benefits = Array.isArray(data.benefits) ? data.benefits : []
  const stats = Array.isArray(data.stats) ? data.stats : []

  const statIcons = [TrendingUp, Users, Award]
  const statColors = ['text-primary', 'text-emerald-600', 'text-amber-500']

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <header className="space-y-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1 text-sm text-primary">
          <Target className="h-4 w-4" />
          {data.subtitle ?? '招募计划'}
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{data.title}</h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
          {data.description}
        </p>
      </header>

      {stats.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((s, i) => {
            const Icon = statIcons[i] ?? TrendingUp
            const color = statColors[i] ?? 'text-primary'
            return (
              <Card key={s.label}>
                <CardContent className="flex items-center gap-3 p-5">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg bg-muted',
                      color,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xl font-bold">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              招募要求
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requirements.length > 0 ? (
              <ul className="space-y-3">
                {requirements.map((r, i) => (
                  <li key={r.title} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-medium text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-medium">{r.title}</div>
                      <div className="text-muted-foreground">{r.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">暂无要求</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="h-5 w-5 text-amber-500" />
              专属权益
            </CardTitle>
          </CardHeader>
          <CardContent>
            {benefits.length > 0 ? (
              <ul className="space-y-3">
                {benefits.map((b) => (
                  <li key={b.title} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <div>
                      <div className="font-medium">{b.title}</div>
                      <div className="text-muted-foreground">{b.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">暂无权益</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-6 text-center">
        <h2 className="text-xl font-bold">准备好加入我们了吗？</h2>
        <p className="text-sm text-muted-foreground">立即申请成为操盘手，开启专属成长路径</p>
        <Button asChild size="lg">
          <Link href="/vip/trader">
            立即申请
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
