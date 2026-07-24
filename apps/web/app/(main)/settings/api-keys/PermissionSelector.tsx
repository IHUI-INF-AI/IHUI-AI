'use client'

import { Checkbox } from '@ihui/ui-react'
import { API_KEY_PERMISSIONS, type ApiKeyPermission } from '@ihui/types'
import { cn } from '@/lib/utils'

/** 权限点中文标签映射(本地定义,不依赖 i18n 文件改动)。 */
export const PERM_LABELS: Record<ApiKeyPermission, string> = {
  'agents:read': '读取智能体',
  'agents:call': '调用智能体',
  'chat:read': '读取对话',
  'chat:write': '发起对话',
  'models:read': '读取模型',
  'models:write': '管理自定义模型',
  'embeddings:write': '生成 Embedding',
  'files:read': '读取文件',
  'files:write': '上传文件',
  'audio:read': '读取音色',
  'audio:write': '语音合成/识别',
  'images:write': '生成/编辑图片',
  'videos:write': '生成/编排视频',
  'videos:read': '查询视频任务',
  'threed:write': '生成 3D 模型',
  'generation:write': '生成队列入队/查询',
  'knowledge:read': '读取知识库',
  'knowledge:write': '管理知识库',
  'tools:read': '读取工具/资源',
  'tools:call': '调用工具',
  'memory:read': '读取记忆',
  'memory:write': '写入记忆',
  'messages:read': '查询消息状态',
  'messages:write': '发布/订阅消息',
  'user:read': '读取当前用户',
  'workspace:read': '读取工作区',
  'workflows:read': '读取工作流',
  'workflows:write': '执行工作流',
  'stats:read': '读取使用量统计',
}

interface Props {
  value: ApiKeyPermission[]
  onChange: (v: ApiKeyPermission[]) => void
  disabled?: boolean
}

export function PermissionSelector({ value, onChange, disabled }: Props) {
  const toggle = (perm: ApiKeyPermission) => {
    if (disabled) return
    onChange(value.includes(perm) ? value.filter((p) => p !== perm) : [...value, perm])
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {API_KEY_PERMISSIONS.map((perm) => {
        const checked = value.includes(perm)
        return (
          <label
            key={perm}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
              checked
                ? 'border-primary/40 bg-primary/5 text-foreground'
                : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(perm)} />
            <span>{PERM_LABELS[perm]}</span>
          </label>
        )
      })}
    </div>
  )
}
