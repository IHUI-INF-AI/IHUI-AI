'use client'

import { Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'

const ALL_EVENTS = [
  'api.called',
  'key.created',
  'key.deleted',
  'limit.reached',
  'webhook.failed',
  'subscription.updated',
]

interface Props {
  open: boolean
  isEdit: boolean
  url: string
  events: string[]
  isPending: boolean
  onOpenChange: (v: boolean) => void
  onUrlChange: (v: string) => void
  onToggleEvent: (ev: string) => void
  onSave: () => void
  onCancel: () => void
}

export function WebhookDialog({
  open,
  isEdit,
  url,
  events,
  isPending,
  onOpenChange,
  onUrlChange,
  onToggleEvent,
  onSave,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑 Webhook' : '新建 Webhook'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-sm">回调 URL</Label>
            <Input
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com/webhook"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">订阅事件</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => onToggleEvent(ev)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs transition-colors',
                    events.includes(ev)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={onSave} disabled={!url.trim() || events.length === 0 || isPending}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
