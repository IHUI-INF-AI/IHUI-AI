// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { type UseQueryResult } from '@tanstack/react-query'
import { Loader2, CheckCircle2 } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { type ProgressTimelineResponse } from './types'

export function StudyPlanTimelineDialog({
  open,
  onOpenChange,
  query,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  query: UseQueryResult<ProgressTimelineResponse>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>进度时间线</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {query.isFetching ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              加载中...
            </div>
          ) : query.data ? (
            <>
              {/* Plan summary */}
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{query.data.plan.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {query.data.plan.startDate} ~ {query.data.plan.endDate}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">{query.data.completionRate}%</p>
                  <p className="text-xs text-muted-foreground">
                    {query.data.completedItems}/{query.data.totalItems}
                  </p>
                </div>
              </div>

              {/* Timeline */}
              {query.data.timeline.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">暂无完成记录</p>
              ) : (
                <div className="space-y-4">
                  {query.data.timeline.map((day) => (
                    <div key={day.date}>
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>{day.date}</span>
                        <span className="text-xs text-muted-foreground">
                          ({day.items.length} 项)
                        </span>
                      </div>
                      <div className="ml-6 space-y-1.5 border-l-2 pl-4">
                        {day.items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-md border bg-muted/20 px-3 py-1.5 text-sm"
                          >
                            <p>{item.content}</p>
                            {item.completedAt && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                完成于 {item.completedAt}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">暂无时间线数据</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
