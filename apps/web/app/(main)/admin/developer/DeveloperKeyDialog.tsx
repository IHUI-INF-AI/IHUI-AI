// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
} from '@ihui/ui-react'
import { API_KEY_PERMISSIONS, isValidApiKeyPermission } from '@ihui/types'
import type { ApiKeyPermission } from '@ihui/types'
import { textareaClass } from './helpers'

// 权限点标签表:值为 apiKeyPerms.* 全路径键名(与 PermissionSelector.PERM_LABELS 对齐,
// 死键扫描器看得见引用),渲染处用 tPerms() 取词。真相唯一来源:zh-CN.json apiKeyPerms.*。
const PERMISSION_LABELS: Record<ApiKeyPermission, string> = {
  'agents:read': 'apiKeyPerms.agentsRead',
  'agents:call': 'apiKeyPerms.agentsCall',
  'chat:read': 'apiKeyPerms.chatRead',
  'chat:write': 'apiKeyPerms.chatWrite',
  'models:read': 'apiKeyPerms.modelsRead',
  'models:write': 'apiKeyPerms.modelsWrite',
  'embeddings:write': 'apiKeyPerms.embeddingsWrite',
  'files:read': 'apiKeyPerms.filesRead',
  'files:write': 'apiKeyPerms.filesWrite',
  'audio:read': 'apiKeyPerms.audioRead',
  'audio:write': 'apiKeyPerms.audioWrite',
  'images:write': 'apiKeyPerms.imagesWrite',
  'videos:write': 'apiKeyPerms.videosWrite',
  'videos:read': 'apiKeyPerms.videosRead',
  'threed:write': 'apiKeyPerms.threedWrite',
  'generation:write': 'apiKeyPerms.generationWrite',
  'knowledge:read': 'apiKeyPerms.knowledgeRead',
  'knowledge:write': 'apiKeyPerms.knowledgeWrite',
  'tools:read': 'apiKeyPerms.toolsRead',
  'tools:call': 'apiKeyPerms.toolsCall',
  'memory:read': 'apiKeyPerms.memoryRead',
  'memory:write': 'apiKeyPerms.memoryWrite',
  'messages:read': 'apiKeyPerms.messagesRead',
  'messages:write': 'apiKeyPerms.messagesWrite',
  'user:read': 'apiKeyPerms.userRead',
  'workspace:read': 'apiKeyPerms.workspaceRead',
  'workflows:read': 'apiKeyPerms.workflowsRead',
  'workflows:write': 'apiKeyPerms.workflowsWrite',
  'stats:read': 'apiKeyPerms.statsRead',
  'assistants:read': 'apiKeyPerms.assistantsRead',
  'assistants:write': 'apiKeyPerms.assistantsWrite',
  'threads:read': 'apiKeyPerms.threadsRead',
  'threads:write': 'apiKeyPerms.threadsWrite',
  'runs:read': 'apiKeyPerms.runsRead',
  'runs:write': 'apiKeyPerms.runsWrite',
  'batches:read': 'apiKeyPerms.batchesRead',
  'batches:write': 'apiKeyPerms.batchesWrite',
  'responses:write': 'apiKeyPerms.responsesWrite',
  'realtime:connect': 'apiKeyPerms.realtimeConnect',
  'rerank:write': 'apiKeyPerms.rerankWrite',
  'moderation:write': 'apiKeyPerms.moderationWrite',
  'codebase:read': 'apiKeyPerms.codebaseRead',
  'codebase:write': 'apiKeyPerms.codebaseWrite',
  'diff:apply': 'apiKeyPerms.diffApply',
  'sandbox:run': 'apiKeyPerms.sandboxRun',
  'browser:operate': 'apiKeyPerms.browserOperate',
  'computer:operate': 'apiKeyPerms.computerOperate',
  'web:fetch': 'apiKeyPerms.webFetch',
  'search:web': 'apiKeyPerms.searchWeb',
  'webhooks:manage': 'apiKeyPerms.webhooksManage',
  'connectors:read': 'apiKeyPerms.connectorsRead',
  'connectors:write': 'apiKeyPerms.connectorsWrite',
  'skills:read': 'apiKeyPerms.skillsRead',
  'skills:write': 'apiKeyPerms.skillsWrite',
  'edu:read': 'apiKeyPerms.eduRead',
  'edu:write': 'apiKeyPerms.eduWrite',
  'im:send': 'apiKeyPerms.imSend',
  'publish:operate': 'apiKeyPerms.publishOperate',
  'billing:read': 'apiKeyPerms.billingRead',
  'oauth:manage': 'apiKeyPerms.oauthManage',
  'mcp:connect': 'apiKeyPerms.mcpConnect',
  'ops:execute': 'apiKeyPerms.opsExecute',
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
  // 无命名空间:用全路径取 apiKeyPerms.*(与 PermissionSelector 对齐)
  const tPerms = useTranslations()
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
                <label key={perm} className="flex cursor-pointer items-center gap-2 text-sm">
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
                  <span>{tPerms(PERMISSION_LABELS[perm])}</span>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
