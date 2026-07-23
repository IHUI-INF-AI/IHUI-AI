'use client'

import * as React from 'react'
import { MessagesSquare, Loader2, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import type { AgentMessage } from '@ihui/shared/subagents/index'

const MESSAGE_TYPE_BADGE: Record<AgentMessage['messageType'], string> = {
  task: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  review: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  critique: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  vote: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  result: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
}

const MESSAGE_TYPE_LABEL: Record<AgentMessage['messageType'], string> = {
  task: '任务',
  review: '评审',
  critique: '批评',
  vote: '投票',
  result: '结果',
}

interface AgentMessageListProps {
  messages: AgentMessage[] | undefined
  isLoading: boolean
}

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export function AgentMessageList({ messages, isLoading }: AgentMessageListProps) {
  const list = messages ?? []

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessagesSquare className="h-4 w-4 text-muted-foreground" />
          Agent 间消息
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">暂无消息</p>
        ) : (
          <ul className="space-y-2">
            {list.map((msg) => (
              <li key={msg.id} className="rounded-md bg-muted/40 p-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{msg.fromAgent}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium text-foreground">{msg.toAgent}</span>
                  <span
                    className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${MESSAGE_TYPE_BADGE[msg.messageType]}`}
                  >
                    {MESSAGE_TYPE_LABEL[msg.messageType]}
                  </span>
                  <span className="tabular-nums">{timeFmt.format(new Date(msg.timestamp))}</span>
                </div>
                <p className="mt-1.5 text-sm">{msg.content}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export { MESSAGE_TYPE_BADGE, MESSAGE_TYPE_LABEL }
