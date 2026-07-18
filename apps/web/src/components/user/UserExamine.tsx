'use client'

import * as React from 'react'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ExamineStatus = 'pending' | 'approved' | 'rejected'

export interface UserExamineProps {
  status?: ExamineStatus
  title?: string
  reason?: string
  submittedAt?: string
  className?: string
}

const META: Record<ExamineStatus, { text: string; icon: React.ReactNode; color: string }> = {
  pending: {
    text: '审核中',
    icon: <Clock className="h-6 w-6 text-amber-500" />,
    color: 'text-amber-500',
  },
  approved: {
    text: '已通过',
    icon: <CheckCircle2 className="h-6 w-6 text-emerald-500" />,
    color: 'text-emerald-500',
  },
  rejected: {
    text: '未通过',
    icon: <XCircle className="h-6 w-6 text-destructive" />,
    color: 'text-destructive',
  },
}

export default function UserExamine({
  status = 'pending',
  title = '审核状态',
  reason,
  submittedAt,
  className,
}: UserExamineProps): React.JSX.Element {
  const meta = META[status]
  return (
    <div className={cn('rounded-xl border bg-card p-5 shadow', className)}>
      <div className="flex items-center gap-3">
        {meta.icon}
        <div>
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className={cn('text-base font-medium', meta.color)}>{meta.text}</div>
        </div>
      </div>
      {submittedAt && (
        <div className="mt-3 text-xs text-muted-foreground">提交时间：{submittedAt}</div>
      )}
      {status === 'rejected' && reason && (
        <div className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          原因：{reason}
        </div>
      )}
    </div>
  )
}
