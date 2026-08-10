'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, GitCompare, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ihui/ui-react'
import { rollbackSkill } from './helpers'
import { VersionDiffDialog } from './VersionDiffDialog'
import type { SkillVersion, SkillWithVersions } from './types'

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

interface VersionTableProps {
  skills: SkillWithVersions[]
  loading: boolean
  error: Error | null
}

export function VersionTable({ skills, loading, error }: VersionTableProps) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [selectedA, setSelectedA] = React.useState<SkillVersion | null>(null)
  const [selectedB, setSelectedB] = React.useState<SkillVersion | null>(null)
  const [diffOpen, setDiffOpen] = React.useState(false)

  const rollbackMut = useMutation({
    mutationFn: ({ name, content }: { name: string; content: string }) =>
      rollbackSkill(name, content),
    onSuccess: () => {
      toast.success('回滚成功')
      qc.invalidateQueries({ queryKey: ['admin', 'skill-versions'] })
    },
    onError: (e: Error) => toast.error('回滚失败: ' + e.message),
  })

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const openDiff = (a: SkillVersion, b: SkillVersion) => {
    setSelectedA(a)
    setSelectedB(b)
    setDiffOpen(true)
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
        加载失败: {error.message}
      </div>
    )
  }

  if (skills.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">暂无技能版本数据</div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {skills.map((skill) => {
          const isExpanded = expanded.has(skill.name)
          return (
            <Card key={skill.name}>
              <CardHeader
                className="flex cursor-pointer flex-row items-center justify-between py-3"
                onClick={() => toggleExpand(skill.name)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{skill.name}</span>
                  <span className="rounded-sm bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {skill.versions.length} 个版本
                  </span>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pb-3 pt-0">
                  <div className="space-y-2">
                    {/* 版本对比选择提示 */}
                    {skill.versions.length >= 2 && (
                      <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-1.5">
                        <GitCompare className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          选中两个版本进行对比
                        </span>
                      </div>
                    )}
                    {skill.versions.map((v) => {
                      const isSelectedA = selectedA?.version === v.version && selectedA?.name === v.name
                      const isSelectedB = selectedB?.version === v.version && selectedB?.name === v.name
                      const canCompare = skill.versions.length >= 2
                      const isCompareTarget = isSelectedA || isSelectedB

                      return (
                        <div
                          key={v.version}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors ${
                            isCompareTarget ? 'border-primary/50 bg-primary/5' : 'border-transparent bg-muted/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* 选择框 */}
                            {canCompare && (
                              <button
                                type="button"
                                className={`flex h-4 w-4 items-center justify-center rounded-sm border transition-colors ${
                                  isCompareTarget
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-muted-foreground/30 hover:border-muted-foreground/50'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (isSelectedA) {
                                    setSelectedA(null)
                                  } else if (isSelectedB) {
                                    setSelectedB(null)
                                  } else if (!selectedA) {
                                    setSelectedA(v)
                                  } else if (!selectedB && selectedA.name === v.name && selectedA.version !== v.version) {
                                    setSelectedB(v)
                                  } else {
                                    setSelectedA(v)
                                    setSelectedB(null)
                                  }
                                }}
                              >
                                {isCompareTarget && <span className="text-[8px]">✓</span>}
                              </button>
                            )}
                            <span className="font-medium">{v.version}</span>
                            {v.changelog && (
                              <span className="text-muted-foreground">- {v.changelog}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{formatDate(v.updatedAt)}</span>
                            {/* 对比按钮 */}
                            {canCompare && isCompareTarget && selectedA && selectedB && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openDiff(selectedA, selectedB)
                                    }}
                                  >
                                    <GitCompare className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>对比选中版本</TooltipContent>
                              </Tooltip>
                            )}
                            {/* 回滚按钮 */}
                            {v.content && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      disabled={rollbackMut.isPending}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (window.confirm(`确定回滚到 ${v.name}@${v.version} 吗？`)) {
                                          rollbackMut.mutate({ name: v.name, content: v.content! })
                                        }
                                      }}
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>回滚到该版本</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      <VersionDiffDialog
        open={diffOpen}
        onClose={() => setDiffOpen(false)}
        oldVersion={selectedA}
        newVersion={selectedB}
      />
    </>
  )
}