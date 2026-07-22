'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Checkbox,
} from '@ihui/ui'
import { API_KEY_PERMISSIONS, isValidApiKeyPermission } from '@ihui/types'
import type { ApiKeyPermission } from '@ihui/types'
import { textareaClass } from './helpers'

const PERMISSION_LABELS: Record<ApiKeyPermission, string> = {
  'agents:read': '读取智能体',
  'agents:call': '调用智能体',
  'chat:read': '读取对话',
  'chat:write': '发起对话',
  'models:read': '读取模型',
  'files:read': '读取文件',
  'files:write': '上传文件',
}

interface DeveloperKeyDialogProps {
  open: boolean
  name: string
  isPending: boolean
  permissions?: ApiKeyPermission[]
  onNameChange: (v: string) => void
  onPermissionsChange?: (v: ApiKeyPermission[]) => void
  onClose: () => void
  onSubmit: () => void
}

export function DeveloperKeyDialog({
  open,
  name,
  isPending,
  permissions,
  onNameChange,
  onPermissionsChange,
  onClose,
  onSubmit,
}: DeveloperKeyDialogProps) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const [internalPerms, setInternalPerms] = React.useState<ApiKeyPermission[]>([])

  React.useEffect(() => {
    if (!open) setInternalPerms([])
  }, [open])

  const currentPermissions = permissions ?? internalPerms
  const handlePermsChange = (v: ApiKeyPermission[]) => {
    if (onPermissionsChange) onPermissionsChange(v)
    else setInternalPerms(v)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : !isPending && onClose())}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) {
              toast.error(t('developer.nameRequired'))
              return
            }
            // 防御性过滤:确保 permissions 仅含合法权限点枚举值
            handlePermsChange(currentPermissions.filter(isValidApiKeyPermission))
            onSubmit()
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{t('developer.createKeyTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="k-name">{t('developer.fieldName')}</Label>
            <Input
              id="k-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t('developer.namePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>权限点</Label>
            <p className="text-xs text-muted-foreground">选择该密钥可访问的 API 权限</p>
            <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
              {API_KEY_PERMISSIONS.map((perm) => (
                <label
                  key={perm}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={currentPermissions.includes(perm)}
                    onCheckedChange={(checked) => {
                      if (checked && isValidApiKeyPermission(perm)) {
                        handlePermsChange([...currentPermissions, perm])
                      } else {
                        handlePermsChange(currentPermissions.filter((p) => p !== perm))
                      }
                    }}
                  />
                  <span>{PERMISSION_LABELS[perm]}</span>
                  <code className="ml-auto font-mono text-xs text-muted-foreground">{perm}</code>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeveloperWebhookDialogProps {
  open: boolean
  url: string
  events: string
  isPending: boolean
  onUrlChange: (v: string) => void
  onEventsChange: (v: string) => void
  onClose: () => void
  onSubmit: () => void
}

export function DeveloperWebhookDialog({
  open,
  url,
  events,
  isPending,
  onUrlChange,
  onEventsChange,
  onClose,
  onSubmit,
}: DeveloperWebhookDialogProps) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : !isPending && onClose())}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!url.trim()) {
              toast.error(t('developer.urlRequired'))
              return
            }
            onSubmit()
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{t('developer.createWebhookTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="w-url">URL</Label>
            <Input
              id="w-url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com/hooks/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-events">{t('developer.fieldEvents')}</Label>
            <textarea
              id="w-events"
              value={events}
              onChange={(e) => onEventsChange(e.target.value)}
              rows={3}
              className={textareaClass}
              placeholder="order.created,order.paid"
            />
            <p className="text-xs text-muted-foreground">{t('developer.eventsHint')}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
