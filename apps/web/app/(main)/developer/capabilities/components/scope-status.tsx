// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Ban, FileQuestion, ShieldX } from 'lucide-react'
import {
  effectiveDataClass,
  getCapability,
  isM2MAllowed,
  isValidApiKeyPermission,
  type CapabilityEntry,
} from '@ihui/types'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'

/**
 * 一个 scope 在**机器凭据**下的可申请性。
 * 判定口径直接复用后端的 `getCapability` / `effectiveDataClass` / `isM2MAllowed`,
 * 界面不另编一套规则:platform 域与 thirdPartyEligible=false 都会让
 * `isM2MAllowed()` 返回 false → 运行时 403 M2M_FORBIDDEN;未登记 → 403 CAPABILITY_UNREGISTERED。
 * 这里只是把「为什么被拒」拆成两种可解释的原因。
 */
export type ScopeStatus =
  | { kind: 'open'; entry: CapabilityEntry }
  | { kind: 'platform-only'; entry: CapabilityEntry }
  | { kind: 'third-party-closed'; entry: CapabilityEntry }
  | { kind: 'unregistered' }

export function classifyScope(scope: string): ScopeStatus {
  if (!isValidApiKeyPermission(scope)) return { kind: 'unregistered' }
  // 类型守卫已把 scope 收窄成 ApiKeyPermission,无需断言
  const entry: CapabilityEntry | undefined = getCapability(scope)
  if (!entry) return { kind: 'unregistered' }
  // 与 isM2MAllowed 保持一致:两条放行条件任一不满足即为「不可申请」
  if (effectiveDataClass(entry) === 'platform') return { kind: 'platform-only', entry }
  if (!entry.thirdPartyEligible) return { kind: 'third-party-closed', entry }
  if (!isM2MAllowed(scope)) return { kind: 'platform-only', entry }
  return { kind: 'open', entry }
}

const BLOCKED_CLASS = 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
const OPEN_CLASS = 'bg-muted text-muted-foreground'

/**
 * scope 芯片:不可申请的项加锁形图标 + 说明,避免用户申请了却永远 403。
 * 文字与图标各自包 <span>/<svg>,对齐补偿规则可见。
 */
export function ScopeChip({ scope }: { scope: string }): React.JSX.Element {
  const t = useTranslations('developer.capabilities')
  const status = classifyScope(scope)
  const blocked = status.kind !== 'open'
  const tipKey =
    status.kind === 'unregistered'
      ? 'unregisteredScopeTip'
      : status.kind === 'third-party-closed'
        ? 'thirdPartyBlockedTip'
        : 'platformBlockedTip'
  const Icon =
    status.kind === 'open'
      ? null
      : status.kind === 'unregistered'
        ? FileQuestion
        : status.kind === 'third-party-closed'
          ? Ban
          : ShieldX
  const chip = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-none',
        blocked ? BLOCKED_CLASS : OPEN_CLASS,
      )}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
      <span className="font-mono">{scope}</span>
    </span>
  )
  if (!blocked) return chip
  return (
    <Tooltip
      side="top"
      content={<span className="block max-w-64 leading-relaxed">{t(tipKey)}</span>}
    >
      {chip}
    </Tooltip>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
