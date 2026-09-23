// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { Checkbox } from '@ihui/ui-react'
import { API_KEY_PERMISSIONS, type ApiKeyPermission } from '@ihui/types'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * API Key 权限点标签表(只存键名,渲染处取词)。
 *
 * - 对象**键**是 `@ihui/types` 的权限点枚举值,与 /v1/* 路由、后端鉴权中间件、
 *   api_keys.permissions 持久化字段做字面比对 —— 协议字面值,不得改写、不得翻译。
 * - 对象**值**是 web 语言包 `apiKeyPerms.*` 的**全路径字面量**(存全路径,死键扫描器
 *   才看得见引用),渲染处 `t(PERM_LABELS[perm])` 取词。
 * - 消费方若直接渲染本表(如 ApiKeyListCard),必须先过 t(),否则展示的是键名。
 */
export const PERM_LABELS: Record<ApiKeyPermission, string> = {
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

interface Props {
  value: ApiKeyPermission[]
  onChange: (v: ApiKeyPermission[]) => void
  disabled?: boolean
}

export function PermissionSelector({ value, onChange, disabled }: Props) {
  const t = useTranslations()

  const toggle = (perm: ApiKeyPermission) => {
    if (disabled) return
    onChange(value.includes(perm) ? value.filter((p) => p !== perm) : [...value, perm])
  }

  return (
    <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-2 min-[768px]:grid-cols-3">
      {API_KEY_PERMISSIONS.map((item) => {
        const checked = value.includes(item)
        return (
          <label
            key={item}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
              checked
                ? 'border-primary/40 bg-primary/5 text-foreground'
                : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(item)} />
            <span>{t(PERM_LABELS[item] ?? item)}</span>
          </label>
        )
      })}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
