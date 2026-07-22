'use client'

import { Checkbox } from '@ihui/ui'
import { API_KEY_PERMISSIONS, type ApiKeyPermission } from '@ihui/types'
import { cn } from '@/lib/utils'

/** 权限点中文标签映射(本地定义,不依赖 i18n 文件改动)。 */
export const PERM_LABELS: Record<ApiKeyPermission, string> = {
  'agents:read': '读取智能体',
  'agents:call': '调用智能体',
  'chat:read': '读取对话',
  'chat:write': '发起对话',
  'models:read': '读取模型',
  'files:read': '读取文件',
  'files:write': '上传文件',
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
