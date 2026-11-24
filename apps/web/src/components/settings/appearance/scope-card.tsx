// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * ScopeCard — 工作区外观覆盖 + 账号级云同步(2026-11-15 v3)
 *
 * 工作区覆盖是"快照"语义:保存时复制当前全局配置,之后该工作区独立于全局变化;
 * 想跟随全局就清除覆盖。这样不需要在每个设置控件里判断"当前写哪一层"。
 *
 * 云同步用 user_preferences 的 appearance group 单行 JSON 快照,
 * 冲突策略见 use-appearance-cloud-sync(updatedAt 新者胜)。
 */

import { useTranslations } from 'next-intl'
import { Cloud, Layers, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@ihui/ui-react'
import { clearAppearanceCloudSnapshot } from '@/hooks/use-appearance-cloud-sync'
import { getAppearanceConfig } from '@/stores/appearance-settings'
import { useAppearanceScopeStore } from '@/stores/appearance-scope'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useAuthStore } from '@/stores/auth'

import { SectionCard, ToggleField } from './controls'

export function ScopeCard() {
  const t = useTranslations('appearanceSettings')
  const activeWorkspace = useAiPanelStore((state) => state.activeWorkspace)
  const workspacePath = activeWorkspace?.path ?? null
  const entry = useAppearanceScopeStore((state) =>
    workspacePath ? state.workspaces[workspacePath] : undefined,
  )
  const setWorkspaceConfig = useAppearanceScopeStore((state) => state.setWorkspaceConfig)
  const setWorkspaceEnabled = useAppearanceScopeStore((state) => state.setWorkspaceEnabled)
  const clearWorkspace = useAppearanceScopeStore((state) => state.clearWorkspace)

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const cloudSyncEnabled = useAppearanceScopeStore((state) => state.cloudSyncEnabled)
  const setCloudSyncEnabled = useAppearanceScopeStore((state) => state.setCloudSyncEnabled)
  const syncState = useAppearanceScopeStore((state) => state.syncState)
  const lastSyncedAt = useAppearanceScopeStore((state) => state.lastSyncedAt)
  const messageOverrideCount = useAppearanceScopeStore(
    (state) => Object.keys(state.messages).length,
  )
  const clearAllMessageOverrides = useAppearanceScopeStore(
    (state) => state.clearAllMessageOverrides,
  )

  const statusText =
    syncState === 'syncing'
      ? t('syncSyncing')
      : syncState === 'synced'
        ? t('syncSynced')
        : syncState === 'error'
          ? t('syncError')
          : t('syncIdle')

  const lastSyncedText =
    lastSyncedAt > 0
      ? t('syncLast', { time: new Date(lastSyncedAt).toLocaleString() })
      : t('syncNever')

  return (
    <SectionCard
      icon={Layers}
      title={t('scopeTitle')}
      desc={t('scopeDesc')}
      testId="appearance-scope"
    >
      <div className="space-y-2 rounded-sm border p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-body font-medium">{t('workspaceCurrent')}</span>
          <span
            className="max-w-[60%] truncate text-label text-muted-foreground"
            title={workspacePath ?? ''}
          >
            {activeWorkspace?.name || workspacePath || t('workspaceNone')}
          </span>
        </div>
        <ToggleField
          label={t('workspaceOverride')}
          hint={t('workspaceOverrideHint')}
          checked={entry?.enabled === true}
          onCheckedChange={(enabled) => {
            if (!workspacePath) {
              toast.error(t('workspaceNone'))
              return
            }
            if (enabled) {
              setWorkspaceConfig(workspacePath, getAppearanceConfig())
              toast.success(t('workspaceSaved'))
              return
            }
            setWorkspaceEnabled(workspacePath, false)
          }}
          testId="appearance-workspace-override"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!workspacePath}
            onClick={() => {
              if (!workspacePath) return
              setWorkspaceConfig(workspacePath, getAppearanceConfig())
              toast.success(t('workspaceSaved'))
            }}
            data-testid="appearance-workspace-save"
          >
            {t('workspaceSaveCurrent')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!workspacePath || !entry}
            onClick={() => {
              if (!workspacePath) return
              clearWorkspace(workspacePath)
              toast.success(t('workspaceCleared'))
            }}
            data-testid="appearance-workspace-clear"
          >
            {t('workspaceClear')}
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-sm border p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-body font-medium">{t('messageStylesLabel')}</span>
          <span className="text-label text-muted-foreground">{messageOverrideCount}</span>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">{t('messageStylesHint')}</p>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={messageOverrideCount === 0}
            onClick={() => {
              clearAllMessageOverrides()
              toast.success(t('messageStylesCleared'))
            }}
            data-testid="appearance-message-styles-clear"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('messageStylesClear')}
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-sm border p-3">
        <ToggleField
          label={t('cloudSyncEnable')}
          hint={isAuthenticated ? t('cloudSyncHint') : t('syncLoginRequired')}
          checked={cloudSyncEnabled}
          onCheckedChange={(enabled) => {
            if (enabled && !isAuthenticated) {
              toast.error(t('syncLoginRequired'))
              return
            }
            setCloudSyncEnabled(enabled)
          }}
          testId="appearance-cloud-sync"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-label text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
            {statusText} · {lastSyncedText}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!cloudSyncEnabled || !isAuthenticated}
              onClick={() => window.dispatchEvent(new CustomEvent('ihui-appearance-sync-now'))}
              data-testid="appearance-sync-now"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t('syncNow')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!isAuthenticated}
              onClick={() => {
                if (!window.confirm(t('cloudClearConfirm'))) return
                void clearAppearanceCloudSnapshot().then((ok) => {
                  if (ok) toast.success(t('cloudCleared'))
                  else toast.error(t('cloudClearFailed'))
                })
              }}
              data-testid="appearance-cloud-clear"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t('cloudClear')}
            </Button>
          </span>
        </div>
      </div>
    </SectionCard>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
