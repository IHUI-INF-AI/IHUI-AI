'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, RefreshCw } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { fetchSkills } from './helpers'
import { VersionTable } from './VersionTable'
import type { SkillWithVersions } from './types'

export default function SkillVersionsPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'skill-versions'],
    queryFn: fetchSkills,
    refetchInterval: 60_000,
  })

  const skills = React.useMemo<SkillWithVersions[]>(() => {
    if (!data) return []
    const map = new Map<string, SkillWithVersions>()
    for (const s of data) {
      if (!map.has(s.name)) {
        map.set(s.name, { name: s.name, versions: [] })
      }
      map.get(s.name)!.versions.push({
        name: s.name,
        version: s.version,
        updatedAt: s.updatedAt,
        changelog: s.changelog,
        content: s.content,
      })
    }
    // 按技能名排序,版本按更新时间降序
    return Array.from(map.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({
        ...s,
        versions: s.versions.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
      }))
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <History className="h-5 w-5 text-primary" />
            技能版本管理
          </h1>
          <p className="mt-1 text-xs text-muted-foreground [&>span]:translate-y-[var(--text-vcenter-offset)]">
            <span>查看技能版本历史、对比差异、一键回滚</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      <VersionTable skills={skills} loading={isLoading} error={error as Error | null} />
    </div>
  )
}
