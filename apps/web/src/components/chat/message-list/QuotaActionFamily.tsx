// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D39 额度型错误动作族(2026-09-23 立)。
//
// 六个处置动作:补积分 / 升级套餐 / 切档 / 查看用量 / 重登 / 重试。
// 接我方既有钱包 / VIP / BYOK 体系:
//   - 补积分      → /points(侧栏 nav-data.ts:558)
//   - 升级套餐    → /vip(nav-data.ts:552)
//   - 查看用量    → /models/usage(nav-data.ts:156)
//   - 重登        → openLoginDialogOnce(lib/login-dialog-trigger.ts)
//   - 切档        → 由调用方注入 onSwitchTier(打开会话内模型选择器;降级路由 /models)
//   - 重试        → 由调用方注入 onRetry(重发当前消息)
//
// 免费额度心智边界(2026-09-21 三轮口径,验收硬性项):
//   freeTierAvailable=true(免费档仍可用)时,**绝不渲染付费诱导**(补积分/升级套餐),
//   并明示"免费额度仍可使用"。判据显式:paid 两动作仅在 !freeTierAvailable 时渲染。

import * as React from 'react'
import { ArrowLeftRight, BarChart3, Coins, Crown, LogIn, RotateCcw } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { useNavigateWithProgress } from '@/stores/navigation'
import { openLoginDialogOnce } from '@/lib/login-dialog-trigger'
import type { TFunction } from './retry-countdown'

export interface QuotaActionFamilyProps {
  t: TFunction
  /** D39 免费额度心智边界:免费档可用时不渲染付费诱导(补积分/升级套餐) */
  freeTierAvailable?: boolean
  /** 重试(调用方注入:重发当前消息) */
  onRetry?: () => void
  /** 切档(调用方注入:打开会话内模型选择器;降级路由 /models) */
  onSwitchTier?: () => void
  /** 补积分目标路由(默认 /points) */
  addPointsHref?: string
  /** 升级套餐目标路由(默认 /vip) */
  upgradePlanHref?: string
  /** 查看用量目标路由(默认 /models/usage) */
  viewUsageHref?: string
  /** 测试/特殊场景注入导航函数;默认 useNavigateWithProgress() */
  navigate?: (href: string) => void
  /** 测试/特殊场景注入重登函数;默认 openLoginDialogOnce(window.location.pathname) */
  reLogin?: () => void
  /** 重试按钮 testid(错误卡复用 message-retry-${id} 契约;FallbackBanner 自行指定) */
  retryTestId?: string
}

const DEFAULT_ADD_POINTS = '/points'
const DEFAULT_UPGRADE_PLAN = '/vip'
const DEFAULT_VIEW_USAGE = '/models/usage'

export function QuotaActionFamily({
  t,
  freeTierAvailable = false,
  onRetry,
  onSwitchTier,
  addPointsHref = DEFAULT_ADD_POINTS,
  upgradePlanHref = DEFAULT_UPGRADE_PLAN,
  viewUsageHref = DEFAULT_VIEW_USAGE,
  navigate,
  reLogin,
  retryTestId = 'quota-action-retry',
}: QuotaActionFamilyProps) {
  const navFromHook = useNavigateWithProgress()
  const go = navigate ?? navFromHook
  const doReLogin = reLogin ?? (() => openLoginDialogOnce(window.location.pathname))

  return (
    <div
      data-testid="quota-action-family"
      className="flex flex-wrap items-center gap-1.5 border-t border-destructive/20 pt-2"
    >
      <span className="text-xs text-muted-foreground">{t('quotaAction.title')}</span>

      {onRetry && (
        <Button size="xs" variant="outline" data-testid={retryTestId} onClick={onRetry}>
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          {t('quotaAction.retry')}
        </Button>
      )}

      {/* 免费档可用:不渲染付费诱导(补积分/升级套餐) —— D39 心智边界显式判据 */}
      {!freeTierAvailable && (
        <>
          <Button
            size="xs"
            data-testid="quota-action-add-points"
            onClick={() => go(addPointsHref)}
          >
            <Coins className="h-3 w-3" aria-hidden="true" />
            {t('quotaAction.addPoints')}
          </Button>
          <Button
            size="xs"
            data-testid="quota-action-upgrade-plan"
            onClick={() => go(upgradePlanHref)}
          >
            <Crown className="h-3 w-3" aria-hidden="true" />
            {t('quotaAction.upgradePlan')}
          </Button>
        </>
      )}

      {onSwitchTier && (
        <Button
          size="xs"
          variant="outline"
          data-testid="quota-action-switch-tier"
          onClick={onSwitchTier}
        >
          <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
          {t('quotaAction.switchTier')}
        </Button>
      )}

      <Button
        size="xs"
        variant="outline"
        data-testid="quota-action-view-usage"
        onClick={() => go(viewUsageHref)}
      >
        <BarChart3 className="h-3 w-3" aria-hidden="true" />
        {t('quotaAction.viewUsage')}
      </Button>

      <Button
        size="xs"
        variant="outline"
        data-testid="quota-action-relogin"
        onClick={doReLogin}
      >
        <LogIn className="h-3 w-3" aria-hidden="true" />
        {t('quotaAction.relogin')}
      </Button>

      {freeTierAvailable && (
        <span
          data-testid="quota-action-free-hint"
          className="text-xs text-emerald-600 dark:text-emerald-400"
        >
          {t('quotaAction.freeHint')}
        </span>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
