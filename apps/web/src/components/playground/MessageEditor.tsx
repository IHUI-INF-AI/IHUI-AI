'use client'

/**
 * 消息构造器:多轮消息列表编辑(role + content + 增删 + 上下移动)。
 */

import * as React from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import type { PlaygroundMessage, PlaygroundRole } from './PlaygroundTypes'

interface MessageEditorProps {
  messages: PlaygroundMessage[]
  onChange: (messages: PlaygroundMessage[]) => void
  disabled?: boolean
}

const ROLES: PlaygroundRole[] = ['system', 'user', 'assistant']

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createMessage(role: PlaygroundRole = 'user'): PlaygroundMessage {
  return { id: genId(), role, content: '' }
}

export function MessageEditor({ messages, onChange, disabled }: MessageEditorProps) {
  const updateMessage = React.useCallback(
    (id: string, patch: Partial<PlaygroundMessage>) => {
      onChange(messages.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    },
    [messages, onChange],
  )

  const addMessage = React.useCallback(() => {
    onChange([...messages, createMessage('user')])
  }, [messages, onChange])

  const removeMessage = React.useCallback(
    (id: string) => {
      onChange(messages.filter((m) => m.id !== id))
    },
    [messages, onChange],
  )

  const moveMessage = React.useCallback(
    (index: number, direction: 'up' | 'down') => {
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= messages.length) return
      const next = [...messages]
      const a = next[index]
      const b = next[target]
      if (a && b) {
        next[index] = b
        next[target] = a
        onChange(next)
      }
    },
    [messages, onChange],
  )

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">消息列表</Label>
          <span className="text-xs text-muted-foreground">{messages.length} 条</span>
        </div>

        {messages.map((msg, index) => (
          <div key={msg.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Select
                value={msg.role}
                onValueChange={(v) => updateMessage(msg.id, { role: v as PlaygroundRole })}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => moveMessage(index, 'up')}
                  disabled={disabled || index === 0}
                  aria-label="上移"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => moveMessage(index, 'down')}
                  disabled={disabled || index === messages.length - 1}
                  aria-label="下移"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  onClick={() => removeMessage(msg.id)}
                  disabled={disabled}
                  aria-label="删除消息"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <textarea
              value={msg.content}
              onChange={(e) => updateMessage(msg.id, { content: e.target.value })}
              disabled={disabled}
              rows={msg.role === 'system' ? 2 : 3}
              placeholder={`输入 ${msg.role} 消息内容…`}
              className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addMessage}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          添加消息
        </Button>
      </CardContent>
    </Card>
  )
}
