'use client'

import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui-react'
import { BIZ_TYPE, STATUS_LABEL } from './helpers'
import type { OperLog } from './types'
import { formatDate } from '@/lib/date-utils'

interface OperationLogsDetailDialogProps {
  detail: OperLog | null
  onClose: () => void
}

export function OperationLogsDetailDialog({ detail, onClose }: OperationLogsDetailDialogProps) {
  return (
    <Dialog open={!!detail} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>操作日志详情</DialogTitle>
        </DialogHeader>
        {detail && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">模块：</span>
              {detail.title}
            </div>
            <div>
              <span className="text-muted-foreground">类型：</span>
              {BIZ_TYPE[detail.businessType] ?? '-'}
            </div>
            <div>
              <span className="text-muted-foreground">操作人：</span>
              {detail.operName}
            </div>
            <div>
              <span className="text-muted-foreground">IP：</span>
              {detail.operIp}
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">请求URL：</span>
              {detail.operUrl}
            </div>
            <div>
              <span className="text-muted-foreground">请求方式：</span>
              {detail.requestMethod}
            </div>
            <div>
              <span className="text-muted-foreground">耗时：</span>
              {detail.costTime}ms
            </div>
            <div>
              <span className="text-muted-foreground">状态：</span>
              {STATUS_LABEL[detail.status]?.label ?? '-'}
            </div>
            <div>
              <span className="text-muted-foreground">操作时间：</span>
              {detail.operTime ? formatDate(detail.operTime) : '-'}
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">请求参数：</span>
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs">
                {detail.operParam || '-'}
              </pre>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">返回结果：</span>
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs">
                {detail.jsonResult || '-'}
              </pre>
            </div>
            {detail.status === 1 && (
              <div className="col-span-2">
                <span className="text-destructive">错误信息：</span>
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-red-500/5 p-2 text-xs text-destructive">
                  {detail.errorMsg || '-'}
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
