// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Layers } from 'lucide-react'
import {
  APPROVAL_POLICIES,
  APPROVAL_PRESETS,
  APPROVAL_PRESET_IDS,
  SANDBOX_MODES,
  type ApprovalPolicyId,
  type ApprovalPresetId,
  type SandboxModeId,
} from '@ihui/types'

import { useAiPanelStore } from '@/stores/ai-panel'
import { axisPairOrDefaults, effectiveAxisPair } from '@/lib/permission-axes'
import { cn } from '@/lib/utils'

/**
 * 权限双轴选择器(79 号票,2026-10-23 立)。
 *
 * 落在既有权限弹层(PermissionModePopover)内,与上方单轴卡片**互相排斥**:
 * - 点单轴卡片 ⇒ 宿主把 permissionAxes 清回 null(跟随单轴);
 * - 点这里任一档 ⇒ 写入显式双轴,后端裁决器以双轴为准(优先级见
 *   apps/ai-service/app/core/permission_axis_gate.py 的 resolve_axis_resolution)。
 * 两者的换算表只有一份:@ihui/types 的 PERMISSION_MODE_TO_AXIS / APPROVAL_PRESETS,
 * 本组件不写字面量档位、不写第二份映射。
 *
 * 为什么单独成文件:宿主 permission-mode-popover.tsx 已承担工作区落库/确认弹窗/撤销 toast,
 * 再塞两轴会把"请求级偏好"和"工作区落库"两件事搅在一起(前者不落库)。
 */
const SANDBOX_TONE: Record<SandboxModeId, 'muted' | 'safe' | 'danger'> = {
  'read-only': 'safe',
  'workspace-write': 'muted',
  'danger-full-access': 'danger',
}

function sandboxText(v: SandboxModeId, t: (key: string) => string): string {
  // 逐档写字面量取词键:静态 i18n 闸只认实参为字面量的 t() 调用(传变量会让"五语齐备"校验空转)
  if (v === 'read-only') return t('axesSandboxReadOnly')
  if (v === 'workspace-write') return t('axesSandboxWorkspaceWrite')
  return t('axesSandboxDangerFullAccess')
}

function approvalText(v: ApprovalPolicyId, t: (key: string) => string): string {
  if (v === 'untrusted') return t('axesApprovalUntrusted')
  if (v === 'on-failure') return t('axesApprovalOnFailure')
  if (v === 'on-request') return t('axesApprovalOnRequest')
  return t('axesApprovalNever')
}

function presetText(v: ApprovalPresetId, t: (key: string) => string): string {
  if (v === 'readOnly') return t('axesPresetReadOnly')
  if (v === 'auto') return t('axesPresetAuto')
  return t('axesPresetFullAccess')
}

function AxisChip({
  label,
  selected,
  tone,
  disabled,
  testId,
  onClick,
}: {
  label: string
  selected: boolean
  tone: 'muted' | 'safe' | 'danger'
  disabled?: boolean
  testId: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'inline-flex h-6 items-center rounded-sm px-1.5 text-[10px] font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        selected
          ? tone === 'danger'
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
            : tone === 'safe'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'bg-primary/10 text-foreground'
          : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

export function PermissionAxesPicker({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('chat.permission')
  const explicit = useAiPanelStore((s) => s.permissionAxes)
  const setAxes = useAiPanelStore((s) => s.setPermissionAxes)
  // 单轴模式的唯一读法(与弹层 currentMode 同源):已绑定工作区 → 暂存值
  const singleMode = useAiPanelStore(
    (s) => s.activeWorkspace?.mode ?? s.pendingPermissionMode ?? null,
  )

  const effective = effectiveAxisPair(explicit, singleMode)
  // 用户点某一轴 = 把两轴都钉下来,另一轴沿用当前可见档(或契约默认档)
  const base = axisPairOrDefaults(explicit, singleMode)

  const presets = APPROVAL_PRESET_IDS

  return (
    <section
      data-testid="permission-axes-picker"
      aria-label={t('axesTitle')}
      className="mt-1 space-y-1.5 rounded-lg border border-border/60 p-2"
    >
      <div className="flex items-center gap-1.5">
        <Layers className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-[11px] font-medium text-foreground">{t('axesTitle')}</span>
        <button
          type="button"
          onClick={() => setAxes(null)}
          disabled={disabled || explicit === null}
          data-testid="permission-axes-follow"
          className={cn(
            'ml-auto inline-flex h-5 items-center rounded-sm px-1.5 text-[10px] transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-50',
            explicit === null
              ? 'bg-primary/10 text-foreground'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          {t('axesFollowMode')}
        </button>
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">{t('axesHint')}</p>

      <div className="flex flex-wrap gap-1" role="group" aria-label={t('axesTitle')}>
        {presets.map((preset) => {
          const pair = APPROVAL_PRESETS[preset]
          const selected =
            explicit !== null &&
            explicit.sandboxMode === pair.sandboxMode &&
            explicit.approvalPolicy === pair.approvalPolicy
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setAxes({ ...APPROVAL_PRESETS[preset] })}
              disabled={disabled}
              aria-pressed={selected}
              data-testid={`permission-axes-preset-${preset}`}
              className={cn(
                'inline-flex h-6 items-center rounded-sm border px-1.5 text-[10px] font-medium transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-60',
                selected
                  ? 'border-primary/60 bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/40 hover:text-foreground',
              )}
            >
              {presetText(preset, t)}
            </button>
          )
        })}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="w-8 shrink-0 text-[10px] text-muted-foreground">
            {t('axesSandboxLabel')}
          </span>
          <div
            className="flex flex-wrap gap-1"
            role="radiogroup"
            aria-label={t('axesSandboxLabel')}
          >
            {SANDBOX_MODES.map((mode) => (
              <AxisChip
                key={mode}
                label={sandboxText(mode, t)}
                tone={SANDBOX_TONE[mode]}
                selected={base.sandboxMode === mode}
                disabled={disabled}
                testId={`permission-axes-sandbox-${mode}`}
                onClick={() => setAxes({ ...base, sandboxMode: mode })}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-8 shrink-0 text-[10px] text-muted-foreground">
            {t('axesApprovalLabel')}
          </span>
          <div
            className="flex flex-wrap gap-1"
            role="radiogroup"
            aria-label={t('axesApprovalLabel')}
          >
            {APPROVAL_POLICIES.map((policy) => (
              <AxisChip
                key={policy}
                label={approvalText(policy, t)}
                tone="muted"
                selected={base.approvalPolicy === policy}
                disabled={disabled}
                testId={`permission-axes-approval-${policy}`}
                onClick={() => setAxes({ ...base, approvalPolicy: policy })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 状态行:显式覆盖 / 跟随单轴的映射结果 / 无等价档(绝不静默) */}
      <p
        data-testid="permission-axes-status"
        className="text-[10px] leading-snug text-muted-foreground"
      >
        {explicit !== null
          ? t('axesOverride')
          : effective !== null
            ? t('axesFollowHint', {
                sandbox: sandboxText(effective.sandboxMode, t),
                approval: approvalText(effective.approvalPolicy, t),
              })
            : t('axesUnmapped')}
      </p>
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
