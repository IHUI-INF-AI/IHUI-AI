'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  AlertTriangle,
  Check,
  Loader2,
  Plus,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import {
  addPermissionRule,
  deletePermissionRule,
  listPermissionRules,
  resetPermissionRules,
  setWorkspacePermission,
  type PermissionDecision,
  type PermissionRuleType,
  type WorkspacePermission,
  type WorkspacePermissionMode,
  type WorkspacePermissionRule,
} from '@ihui/api-client/endpoints/workspace'
import { cn } from '@/lib/utils'

interface WorkspacePermissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspacePath: string
  workspaceName: string
  techStack?: string[]
  /** 已有权限(编辑场景);首次打开时为 null */
  existingPermission?: WorkspacePermission | null
  onSaved?: (perm: WorkspacePermission) => void
}

const MODE_OPTIONS: Array<{
  value: WorkspacePermissionMode
  icon: React.ComponentType<{ className?: string }>
  risk: 'low' | 'medium' | 'high'
}> = [
  { value: 'default', icon: ShieldAlert, risk: 'low' },
  { value: 'accept-edits', icon: ShieldCheck, risk: 'medium' },
  { value: 'bypass-permissions', icon: Shield, risk: 'high' },
]

/**
 * 工作区权限配置弹窗 — 用户首次打开本地项目文件夹时弹出。
 *
 * 三种模式:
 *   - default            全部人工审计(最安全)
 *   - accept-edits       白名单放行(预置安全模板,可自定义规则)
 *   - bypass-permissions 完全访问(风险最高)
 */
export function WorkspacePermissionDialog({
  open,
  onOpenChange,
  workspacePath,
  workspaceName,
  techStack,
  existingPermission,
  onSaved,
}: WorkspacePermissionDialogProps) {
  const t = useTranslations('workspace.permission')
  const queryClient = useQueryClient()

  const [selectedMode, setSelectedMode] = React.useState<WorkspacePermissionMode>(
    existingPermission?.mode ?? 'accept-edits',
  )
  const [showRulesPanel, setShowRulesPanel] = React.useState(false)

  // 拉取规则列表(仅 accept-edits 模式)
  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['workspace', 'permission-rules', workspacePath],
    queryFn: async () => {
      const res = await listPermissionRules(workspacePath)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: open && selectedMode === 'accept-edits',
  })

  // 保存权限模式
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await setWorkspacePermission({
        workspacePath,
        name: workspaceName,
        techStack: techStack?.join(','),
        mode: selectedMode,
        initializeDefaults: selectedMode === 'accept-edits' && !existingPermission,
      })
      if (!res.success) throw new Error(res.error)
      return res.data.permission
    },
    onSuccess: (perm) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'permission-rules'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'permissions'] })
      onSaved?.(perm)
      onOpenChange(false)
    },
  })

  const handleSave = () => {
    saveMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span>{t('title')}</span>
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        {/* 工作区信息 */}
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('path')}:</span>
            <span className="font-mono">{workspacePath}</span>
          </div>
          {techStack && techStack.length > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-muted-foreground">{t('techStack')}:</span>
              <span>{techStack.join(' / ')}</span>
            </div>
          )}
        </div>

        {/* 三种模式卡片 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('selectMode')}</Label>
          <div className="grid gap-2">
            {MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isSel = selectedMode === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedMode(opt.value)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                    isSel
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 h-5 w-5 shrink-0',
                      isSel
                        ? 'text-primary'
                        : opt.risk === 'high'
                          ? 'text-amber-500'
                          : opt.risk === 'medium'
                            ? 'text-emerald-500'
                            : 'text-muted-foreground',
                    )}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {t(`mode.${opt.value}.title`)}
                      </span>
                      {opt.risk === 'high' && (
                        <span className="rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          {t('highRisk')}
                        </span>
                      )}
                      {isSel && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t(`mode.${opt.value}.desc`)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 白名单规则管理入口(仅 accept-edits 模式) */}
        {selectedMode === 'accept-edits' && (
          <div className="rounded-md border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">{t('whitelistRules')}</span>
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {rulesData?.rules.length ?? 0}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowRulesPanel((v) => !v)}
              >
                {showRulesPanel ? t('collapseRules') : t('manageRules')}
              </Button>
            </div>
            {showRulesPanel && (
              <RulesEditor
                workspacePath={workspacePath}
                rules={rulesData?.rules ?? []}
                loading={rulesLoading}
              />
            )}
          </div>
        )}

        {/* 风险提示 */}
        {selectedMode === 'bypass-permissions' && (
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('bypassWarning')}</span>
          </div>
        )}

        {saveMutation.isError && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{(saveMutation.error as Error)?.message}</span>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            {t('cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {saveMutation.isPending ? t('saving') : t('saveAndOpen')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// 白名单规则编辑器(子组件)
// =============================================================================

function RulesEditor({
  workspacePath,
  rules,
  loading,
}: {
  workspacePath: string
  rules: WorkspacePermissionRule[]
  loading: boolean
}) {
  const t = useTranslations('workspace.permission')
  const queryClient = useQueryClient()

  const [newPattern, setNewPattern] = React.useState('')
  const [newRuleType, setNewRuleType] = React.useState<PermissionRuleType>('path')
  const [newDecision, setNewDecision] = React.useState<PermissionDecision>('allow')

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await addPermissionRule({
        workspacePath,
        ruleType: newRuleType,
        pattern: newPattern,
        decision: newDecision,
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'permission-rules', workspacePath] })
      setNewPattern('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await deletePermissionRule(id)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'permission-rules', workspacePath] })
    },
  })

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await resetPermissionRules(workspacePath)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'permission-rules', workspacePath] })
    },
  })

  const handleAdd = () => {
    if (!newPattern.trim()) return
    addMutation.mutate()
  }

  return (
    <div className="mt-3 space-y-3">
      {/* 添加规则 */}
      <div className="flex items-center gap-2">
        <select
          value={newRuleType}
          onChange={(e) => setNewRuleType(e.target.value as PermissionRuleType)}
          className="rounded-md border border-input bg-transparent px-2 py-1.5 text-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="path">{t('ruleType.path')}</option>
          <option value="command">{t('ruleType.command')}</option>
          <option value="tool">{t('ruleType.tool')}</option>
        </select>
        <Input
          value={newPattern}
          onChange={(e) => setNewPattern(e.target.value)}
          placeholder={t('patternPlaceholder')}
          className="h-8 flex-1 text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
        />
        <select
          value={newDecision}
          onChange={(e) => setNewDecision(e.target.value as PermissionDecision)}
          className="rounded-md border border-input bg-transparent px-2 py-1.5 text-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="allow">{t('decision.allow')}</option>
          <option value="deny">{t('decision.deny')}</option>
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAdd}
          disabled={!newPattern.trim() || addMutation.isPending}
        >
          <Plus className="h-3 w-3" />
          {t('add')}
        </Button>
      </div>

      {/* 规则列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          {t('loadingRules')}
        </div>
      ) : rules.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">{t('noRules')}</div>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-xs"
            >
              <span
                className={cn(
                  'rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
                  rule.decision === 'allow'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-destructive/10 text-destructive',
                )}
              >
                {rule.decision === 'allow' ? t('decision.allow') : t('decision.deny')}
              </span>
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {t(`ruleType.${rule.ruleType}`)}
              </span>
              <span className="flex-1 truncate font-mono">{rule.pattern}</span>
              {rule.builtin && (
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {t('builtin')}
                </span>
              )}
              <button
                type="button"
                onClick={() => deleteMutation.mutate(rule.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label={t('deleteRule')}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 重置为默认模板 */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
        >
          <RotateCcw className="h-3 w-3" />
          {t('resetToDefaults')}
        </Button>
      </div>
    </div>
  )
}
