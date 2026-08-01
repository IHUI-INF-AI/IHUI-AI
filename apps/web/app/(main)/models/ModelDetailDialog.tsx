'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  Cable,
  CheckCircle2,
  Cpu,
  Gift,
  KeyRound,
  Sparkles,
  Tags,
  Zap,
} from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ihui/ui-react'
import { BrandIcon } from '@/components/ai/brand-icon'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useChatStore } from '@/stores/chat'

import { PROVIDER_LABEL } from './helpers'
import type { Model } from './types'

interface Props {
  model: Model | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 用户已配置该 provider 的 API Key 且启用 */
  isConfigured?: boolean
  /** 该 provider 在 LLM 配置中心有预置模板,可一键配置 */
  canConfigure?: boolean
  /** 一键配置回调(弹起 QuickKeyDialog) */
  onConfigure?: (m: Model) => void
}

/**
 * 模型详情对话框:展示模型完整信息 + "立即体验" CTA
 * - 立即体验走 SPA: setModel + openPanel + router.push('/chat'),无全页刷新
 * - 价格同时展示输入价 / 输出价(若 outputPrice 缺失,按 inputPrice*3 推算并标注"估算")
 * - 已配置:header 显示 ✓ 已配置徽章;底部「立即体验」+「更新 Key」(打开 QuickKeyDialog)
 * - 可配置但未配置:header 显示 ⚠ 可配置;底部「立即体验」+「一键配置 Key」(打开 QuickKeyDialog)
 * - P0-5g 中转站:模型已上架中转站时显示"中转站可用"徽章 + 中转站定价(基础价 × 倍率)+「获取 API Key」按钮
 */
export function ModelDetailDialog({
  model,
  open,
  onOpenChange,
  isConfigured = false,
  canConfigure = false,
  onConfigure,
}: Props) {
  const t = useTranslations('models')
  const router = useRouter()
  const openPanel = useAiPanelStore((s) => s.openPanel)
  const setModel = useChatStore((s) => s.setModel)

  const handleTry = React.useCallback(() => {
    if (!model) return
    setModel(model.id)
    openPanel()
    onOpenChange(false)
    router.push('/chat')
  }, [model, setModel, openPanel, router, onOpenChange])

  const handleConfigure = React.useCallback(() => {
    if (!model || !onConfigure) return
    onOpenChange(false)
    onConfigure(model)
  }, [model, onConfigure, onOpenChange])

  /** P0-5g 跳转中转站 API Key 管理页 */
  const handleRelayKeys = React.useCallback(() => {
    onOpenChange(false)
    router.push('/developer/relay/keys')
  }, [router, onOpenChange])

  if (!model) return null

  const outputPrice = model.outputPrice ?? model.inputPrice * 3
  const isOutputEstimated = model.outputPrice === undefined
  const vendorLabel = PROVIDER_LABEL[model.provider] ?? '其他'
  const description = model.description ? t(model.description) : t('market.defaultDescription')

  // P0-5g 中转站定价计算
  const relayMultiplier = model.relayPriceMultiplier ?? 1
  const hasRelayMultiplier = Math.abs(relayMultiplier - 1) > 0.001
  const relayInputPrice = model.inputPrice * relayMultiplier
  const relayOutputPrice = outputPrice * relayMultiplier

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader className="gap-2 p-5 pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
              <BrandIcon vendor={model.provider} size={26} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-lg leading-tight [&>span]:translate-y-[0.5px]">
                <span>{model.name.startsWith('model.') ? t(model.name) : model.name}</span>
                {model.highlight && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    <Sparkles className="h-2.5 w-2.5" />
                    {t('detail.highlight')}
                  </span>
                )}
                {/* 配置状态徽章(详情) */}
                {isConfigured && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {t('quickKey.configured')}
                  </span>
                )}
                {/* P0-5g 中转站可用徽章 */}
                {model.relayPublic && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-400">
                    <Cable className="h-2.5 w-2.5" />
                    {t('market.relayAvailable')}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-1 text-xs [&>span]:translate-y-[0.5px]">
                <Building2 className="h-3 w-3" />
                <span>{vendorLabel}</span>
                <span className="text-muted-foreground/60">·</span>
                <code className="font-mono text-[11px] text-muted-foreground">{model.id}</code>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 pb-4">
          {/* 未配置提示条(可配置时) */}
          {canConfigure && !isConfigured && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{t('market.configureKeyHint')}</span>
              {onConfigure && (
                <button
                  type="button"
                  onClick={handleConfigure}
                  className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-800 transition-colors hover:bg-amber-500/30 dark:bg-amber-500/30 dark:text-amber-200"
                >
                  {t('market.configureKey')}
                </button>
              )}
            </div>
          )}

          {/* P0-5g 中转站可用提示条 */}
          {model.relayPublic && (
            <div className="flex items-start gap-2 rounded-md bg-sky-50 px-3 py-2 text-[11px] text-sky-800 dark:bg-sky-950/30 dark:text-sky-300">
              <Cable className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{t('market.relayAvailableHint')}</span>
              <button
                type="button"
                onClick={handleRelayKeys}
                className="rounded-md bg-sky-500/20 px-2 py-0.5 text-[11px] font-medium text-sky-800 transition-colors hover:bg-sky-500/30 dark:bg-sky-500/30 dark:text-sky-200"
              >
                {t('market.getRelayKey')}
              </button>
            </div>
          )}

          <p className="text-sm leading-relaxed text-foreground/90">{description}</p>

          <div className="grid grid-cols-2 min-[640px]:grid-cols-3 gap-2">
            <DetailStat
              icon={<Cpu className="h-3.5 w-3.5" />}
              label={t('contextLength')}
              value={formatContext(model.contextLength)}
            />
            <DetailStat
              icon={<Zap className="h-3.5 w-3.5" />}
              label={t('market.inputPrice')}
              value={model.inputPrice === 0 ? t('free') : `$${model.inputPrice.toFixed(2)}`}
            />
            <DetailStat
              icon={<Gift className="h-3.5 w-3.5" />}
              label={t('market.outputPrice')}
              value={
                outputPrice === 0
                  ? t('free')
                  : `$${outputPrice.toFixed(2)}${isOutputEstimated ? '*' : ''}`
              }
              hint={isOutputEstimated ? t('detail.estimatedHint') : undefined}
            />
          </div>

          {/* P0-5g 中转站定价区(模型已上架中转站且倍率 ≠ 1.0 时显示) */}
          {model.relayPublic && hasRelayMultiplier && (
            <div className="rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2.5 dark:border-sky-900 dark:bg-sky-950/20">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-sky-800 dark:text-sky-300 [&>span]:translate-y-[0.5px]">
                <Cable className="h-3 w-3" />
                <span>{t('market.relayPricingTitle')}</span>
                <span className="ml-auto rounded bg-sky-200/60 px-1.5 py-0.5 text-[10px] text-sky-800 dark:bg-sky-900 dark:text-sky-300">
                  ×{relayMultiplier.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground [&>span]:translate-y-[0.5px]">
                    <span>{t('market.relayInputPrice')}</span>
                  </div>
                  <div className="mt-0.5 font-semibold text-foreground">
                    {relayInputPrice === 0 ? t('free') : `$${relayInputPrice.toFixed(2)}`}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground [&>span]:translate-y-[0.5px]">
                    <span>{t('market.relayOutputPrice')}</span>
                  </div>
                  <div className="mt-0.5 font-semibold text-foreground">
                    {relayOutputPrice === 0 ? t('free') : `$${relayOutputPrice.toFixed(2)}`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {model.features.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&>span]:translate-y-[0.5px]">
                <Tags className="h-3 w-3" />
                <span>{t('detail.capabilities')}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {model.features.map((f) => (
                  <span
                    key={f}
                    className="rounded-md bg-primary/8 px-2 py-1 text-[11px] font-medium text-primary"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 rounded-b-lg bg-muted/40 px-5 py-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('detail.close')}
          </Button>
          {canConfigure && onConfigure && (
            <Button
              variant={isConfigured ? 'outline' : 'outline'}
              size="sm"
              className="gap-1.5"
              onClick={handleConfigure}
            >
              <KeyRound className="h-3.5 w-3.5" />
              {isConfigured ? t('market.updateKey') : t('market.configureKey')}
            </Button>
          )}
          {/* P0-5g 中转站可用时,加「获取 API Key」CTA */}
          {model.relayPublic && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRelayKeys}>
              <KeyRound className="h-3.5 w-3.5" />
              {t('market.getRelayKey')}
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={handleTry}>
            <Sparkles className="h-3.5 w-3.5" />
            {t('market.tryNow')}
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DetailStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-md bg-muted/50 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground [&>span]:translate-y-[0.5px]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-0.5 truncate text-[10px] text-muted-foreground/70">{hint}</div>}
    </div>
  )
}

function formatContext(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(n)
}
