'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Loader2, Shield, ShieldAlert, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { useAllWorkspacePermissions, useDeleteWorkspacePermission } from '@/hooks/use-workspace-permissions'
import { WorkspacePermissionDialog } from '@/components/workspace/workspace-permission-dialog'
import type { WorkspacePermission, WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'
import { cn } from '@/lib/utils'

const MODE_LABEL: Record<WorkspacePermissionMode, { icon: LucideIcon; color: string }> = {
  default: { icon: ShieldAlert, color: 'text-muted-foreground' },
  'accept-edits': { icon: ShieldCheck, color: 'text-emerald-500' },
  'bypass-permissions': { icon: Shield, color: 'text-amber-500' },
}

export default function WorkspacePermissionsPage() {
  const t = useTranslations('workspace.permissionsPage')
  const tw = useTranslations('workspace.permission')
  const { data: permissions, isLoading } = useAllWorkspacePermissions()
  const deleteMutation = useDeleteWorkspacePermission()
  const [editing, setEditing] = React.useState<WorkspacePermission | null>(null)

  const handleDelete = (path: string) => {
    if (confirm(t('confirmDelete'))) {
      deleteMutation.mutate(path)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/workspace" className="text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : !permissions || permissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Shield className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
          <Link href="/workspace">
            <Button variant="outline" size="sm" className="mt-2">
              {t('goToWorkspace')}
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {permissions.map((perm) => {
            const Mode = MODE_LABEL[perm.mode]
            const ModeIcon = Mode.icon
            return (
              <li
                key={perm.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
              >
                <ModeIcon className={cn('h-5 w-5 shrink-0', Mode.color)} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{perm.name}</p>
                    <span
                      className={cn(
                        'rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
                        perm.mode === 'bypass-permissions'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : perm.mode === 'accept-edits'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {tw(`mode.${perm.mode}.title`)}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground truncate">
                    {perm.workspacePath}
                  </p>
                  {perm.techStack && (
                    <p className="text-xs text-muted-foreground">
                      {perm.techStack.split(',').join(' / ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(perm)}
                  >
                    {t('edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(perm.workspacePath)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <WorkspacePermissionDialog
          open={true}
          onOpenChange={(next) => {
            if (!next) setEditing(null)
          }}
          workspacePath={editing.workspacePath}
          workspaceName={editing.name}
          techStack={editing.techStack ? editing.techStack.split(',') : undefined}
          existingPermission={editing}
        />
      )}
    </div>
  )
}
