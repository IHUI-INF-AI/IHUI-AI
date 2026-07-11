'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ShieldCheck, Loader2 } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { fetchApi } from '@/lib/api'

interface ScoreItem {
  id: string
  name: string
  score: number
  maxScore: number
  status: 'good' | 'warning' | 'bad'
}

interface ScoreData {
  total: number
  maxScore: number
  level: 'excellent' | 'high' | 'medium' | 'low'
  items: ScoreItem[]
}

const levelColor = (level: ScoreData['level']) => {
  switch (level) {
    case 'excellent':
    case 'high':
      return '#16a34a'
    case 'medium':
      return '#f59e0b'
    default:
      return '#ef4444'
  }
}

/**
 * 安全评分：综合密码强度、二因素、设备风险等维度，环形展示总分与各分项。
 */
export function SecurityScore() {
  const t = useTranslations('settings')
  const [data, setData] = React.useState<ScoreData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    void fetchApi<ScoreData>('/api/user/security-score')
      .then((res) => {
        if (res.success && res.data) setData(res.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const circumference = 2 * Math.PI * 45
  const ratio = data ? data.total / data.maxScore : 0
  const dashOffset = circumference * (1 - ratio)
  const color = data ? levelColor(data.level) : '#94a3b8'

  const levelLabel = (level: ScoreData['level']) => {
    const map: Record<ScoreData['level'], string> = {
      excellent: t('score.excellent'),
      high: t('score.high'),
      medium: t('score.medium'),
      low: t('score.low'),
    }
    return map[level]
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          {t('score.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-32 w-32 shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={color}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold" style={{ color }}>
                  {data.total}
                </span>
                <span className="text-xs text-muted-foreground">/{data.maxScore}</span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color }}>
                {levelLabel(data.level)}
              </div>
              {data.items.map((item) => (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-mono">
                      {item.score}/{item.maxScore}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(item.score / item.maxScore) * 100}%`,
                        backgroundColor:
                          item.status === 'good'
                            ? '#16a34a'
                            : item.status === 'warning'
                              ? '#f59e0b'
                              : '#ef4444',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('score.empty')}</p>
        )}
      </CardContent>
    </Card>
  )
}
