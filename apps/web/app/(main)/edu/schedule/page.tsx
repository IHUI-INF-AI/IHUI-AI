'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Loader2, Clock } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface ScheduleItem {
  id: string
  title: string
  instructor: string
  weekday: number
  startTime: string
  endTime: string
  location?: string
  type: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export default function EduSchedulePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'schedule'],
    queryFn: () => api<{ list: ScheduleItem[] }>('/api/edu/schedule').then((d) => d.list ?? []),
  })

  const byDay = React.useMemo(() => {
    const items = data ?? []
    const map: Record<number, ScheduleItem[]> = {}
    for (let i = 0; i < 7; i++) map[i] = []
    items.forEach((it) => {
      const arr = map[it.weekday] ?? (map[it.weekday] = [])
      arr.push(it)
    })
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)))
    return map
  }, [data])

  const today = new Date().getDay()
  const todayIdx = today === 0 ? 6 : today - 1

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarDays className="h-7 w-7 text-primary" />
          课程表
        </h1>
        <p className="text-sm text-muted-foreground">本周课程安排一览</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <Alert variant="danger" description={(error as Error).message} />
      ) : (data ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">本周暂无课程</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {WEEKDAYS.map((day, idx) => (
            <Card
              key={day}
              className={cn(idx === todayIdx && 'border-primary ring-1 ring-primary/20')}
            >
              <CardHeader className="p-3 pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{day}</span>
                  {idx === todayIdx && (
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      今天
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {(byDay[idx] ?? []).length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">无课</p>
                ) : (
                  (byDay[idx] ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border p-2 text-xs transition-colors hover:bg-accent"
                    >
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {item.startTime}-{item.endTime}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">{item.instructor}</p>
                      {item.location && <p className="text-muted-foreground">@ {item.location}</p>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
