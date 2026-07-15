'use client'

import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui'
import { STATUS_LABEL } from './helpers'
import type { JobLog } from './types'
import { formatDate } from '@/lib/date-utils'

interface Props {
  detail: JobLog | null
  onClose: () => void
}

export function TaskLogDetailDialog({ detail, onClose }: Props) {
  return (
    <Dialog open={!!detail} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>任务日志详情</DialogTitle>
        </DialogHeader>
        {detail && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">日志ID：</span>
              {detail.id}
            </div>
            <div>
              <span className="text-muted-foreground">任务名称：</span>
              {detail.jobName}
            </div>
            <div>
              <span className="text-muted-foreground">任务组：</span>
              {detail.jobGroup}
            </div>
            <div>
              <span className="text-muted-foreground">状态：</span>
              {STATUS_LABEL[detail.status]?.label ?? '-'}
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">调用目标：</span>
              <code className="font-mono text-xs">{detail.invokeTarget}</code>
            </div>
            <div>
              <span className="text-muted-foreground">开始时间：</span>
              {detail.startTime ? formatDate(detail.startTime) : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">停止时间：</span>
              {detail.stopTime ? formatDate(detail.stopTime) : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">耗时：</span>
              {detail.costTime}ms
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">日志信息：</span>
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs">
                {detail.jobMessage || '-'}
              </pre>
            </div>
            {detail.status === 1 && (
              <div className="col-span-2">
                <span className="text-destructive">异常信息：</span>
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-red-500/5 p-2 text-xs text-destructive">
                  {detail.exceptionInfo || '-'}
                </pre>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
