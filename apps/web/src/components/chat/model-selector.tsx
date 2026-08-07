'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Crown,
  Loader2,
  Lock,
  Settings,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { fetchSelectorModels, fetchProvidersHealth, type ProviderHealth } from '@/lib/models-api'
import { BrandIcon, inferVendor } from '@/components/ai/brand-icon'
import { FALLBACK_MODELS, DEMO_TIER_MODELS, VENDOR_LABEL } from '@/components/chat/fallback-models'
import { fetchConfigs } from '@/lib/user-llm-configs'
import { providerToTemplateCode } from '@/lib/llm-templates'

export interface ModelOption {
  value: string
  label: string
  descriptionKey?: string
  /** 厂商代码,用于 BrandIcon 显示 */
  vendor?: string
  /** 自定义图标 URL(可选,优先于 vendor) */
  iconUrl?: string
  /** 积分消耗倍数(2026-08-06 立,对齐 workbuddy 风格)
   *  - 小数显示(如 0.77x / 0.05x)
   *  - 0 = 免费模型
   *  - 优先取后端返回的 points_multiplier(后端 infer 5 档后映射为小数)或前端 tierToDisplayMultiplier */
  pointsMultiplier?: number
  /** 是否支持会员 2.5 折(显示 "会员2.5折" 红色徽章 + 升级权益 popover 触发) */
  memberDiscountEligible?: boolean
  /** 是否正式版(显示 "正式版" 灰色徽章) */
  isOfficial?: boolean
  /** 是否有专属补贴(显示 "专属补贴" 橙红徽章) */
  subsidy?: boolean
  /** 是否锁定(显示 🔒 锁图标,需升级才能使用) */
  locked?: boolean
}

/** 自动模式(value='auto'):后端根据任务类型自动选择最优模型
 * 2026-07-30 用户反馈"智能路由"措辞太复杂,简化为"自动"
 * 2026-07-31 i18n 修复:label/description 走 t('modelAuto')/t('modelAutoDescription'),
 *   此处 label 仅作类型必填占位,渲染处统一用 t() 覆盖 */
const AUTO_OPTION: ModelOption = {
  value: 'auto',
  label: 'auto',
  descriptionKey: 'modelAutoDescription',
  vendor: 'auto',
}

interface ModelSelectorProps {
  value: string
  onChange: (model: string) => void
  disabled?: boolean
  label: string
}

// ============================================================================
// 已知模型元数据查询表(2026-08-06 立,对齐 workbuddy 风格的"倍数+徽章"展示)
// 优先匹配,未命中走 tierToDisplayMultiplier 兜底。
// 数据按截图(Seed-2.1-Pro 0.77x / GLM-5.2 0.40x / Kimi-K3 1.65x 🔒 等)填写。
// ============================================================================
const KNOWN_MODEL_META: Record<string, Partial<ModelOption>> = {
  // === Step 系(plan 套餐主力)===
  'stepfun/step-router-v1': { pointsMultiplier: 0 },
  'stepfun/step-2.1-pro': { pointsMultiplier: 0.77 },
  'stepfun/step-2.1-turbo': { pointsMultiplier: 0.39, memberDiscountEligible: true },
  'stepfun/step-2.1-code': { pointsMultiplier: 0.12, memberDiscountEligible: true },
  'stepfun/step-2.1-flash': { pointsMultiplier: 0.05, isOfficial: true },
  'stepfun/step-3.7-flash': { pointsMultiplier: 0.05, isOfficial: true },
  'stepfun/step-3.5-flash': { pointsMultiplier: 0.05, isOfficial: true },
  'stepfun/step-3.5-flash-2603': { pointsMultiplier: 0.05, isOfficial: true },
  'stepfun/step-image-edit-2': { pointsMultiplier: 0.12, isOfficial: true },
  'stepfun/stepaudio-2.5-tts': { pointsMultiplier: 0.05, isOfficial: true },
  'stepfun/stepaudio-2.5-chat': { pointsMultiplier: 0.05, isOfficial: true },
  'stepfun/stepaudio-2.5-asr': { pointsMultiplier: 0.05, isOfficial: true },
  'stepfun/stepaudio-2.5-realtime': { pointsMultiplier: 0.05, isOfficial: true },
  // === DeepSeek 系 ===
  'deepseek/deepseek-v4-pro': { pointsMultiplier: 0.32 },
  'deepseek/deepseek-v4-flash': { pointsMultiplier: 0.05, isOfficial: true },
  'deepseek/deepseek-chat': { pointsMultiplier: 0.26 },
  'deepseek/deepseek-reasoner': { pointsMultiplier: 0.4 },
  // === Kimi / Moonshot 系 ===
  'moonshot/kimi-k3': { pointsMultiplier: 1.65, locked: true },
  'moonshot/kimi-k2.7-code': { pointsMultiplier: 0.62 },
  'moonshot/kimi-k2.6': { pointsMultiplier: 0.69 },
  'moonshot/kimi-k2': { pointsMultiplier: 0.69 },
  // === GLM / 智谱系 ===
  'zhipu/glm-5.2': { pointsMultiplier: 0.4, subsidy: true },
  'zhipu/glm-4.7-flash': { pointsMultiplier: 0.05, isOfficial: true },
  // === Qwen / 通义系 ===
  'qwen/qwen3.7-plus': { pointsMultiplier: 0.25 },
  'qwen/qwen3.7-max': { pointsMultiplier: 0.77 },
  'qwen/qwen-max': { pointsMultiplier: 0.4 },
  'qwen/qwen-turbo': { pointsMultiplier: 0.05 },
  'qwen/qwen-plus': { pointsMultiplier: 0.12 },
  // === MiniMax 系(项目自有模型)===
  'minimax/minimax-m3': { pointsMultiplier: 0.26 },
  'minimax/abab6.5s-chat': { pointsMultiplier: 0.25 },
  'minimax/abab6.5-chat': { pointsMultiplier: 0.4 },
  // === OpenAI / Anthropic / Google ===
  'openai/gpt-4o': { pointsMultiplier: 0.77, memberDiscountEligible: true },
  'openai/gpt-4o-mini': { pointsMultiplier: 0.05, isOfficial: true },
  'openai/gpt-5': { pointsMultiplier: 1.65, locked: true },
  'openai/o1-preview': { pointsMultiplier: 1.65, locked: true },
  'anthropic/claude-3-5-sonnet': { pointsMultiplier: 0.77, memberDiscountEligible: true },
  'anthropic/claude-3-opus': { pointsMultiplier: 1.65, locked: true },
  'gemini/gemini-2.5-flash': { pointsMultiplier: 0.05, isOfficial: true },
  'gemini/gemini-2.0-flash': { pointsMultiplier: 0.05, isOfficial: true },
  'gemini/gemini-pro': { pointsMultiplier: 0.77, memberDiscountEligible: true },
  // === 免费 zero_cost ===
  '@cf/zai-org/glm-4.7-flash': { pointsMultiplier: 0, isOfficial: true },
  '@cf/google/gemma-2-27b-it': { pointsMultiplier: 0 },
  'ollama/llama3': { pointsMultiplier: 0 },
  'groq/llama-3.3-70b-versatile': { pointsMultiplier: 0 },
  'openrouter/auto': { pointsMultiplier: 0 },
}

/** 5 档 tier → 显示用小数映射(2026-08-06 立,对齐 workbuddy 风格)
 *  - 0 (免费) → "免费" 文本(不显示小数)
 *  - 1 (经济) → 0.05x
 *  - 3 (标准) → 0.12x
 *  - 10 (高级) → 0.40x
 *  - 30 (旗舰) → 0.77x
 *  - > 30 (锁定) → 1.65x
 *  显示侧用 tierToDisplayMultiplier(multiplier) 拿到小数 + 是否锁定 */
const TIER_TO_DISPLAY: Record<number, number> = {
  0: 0,
  1: 0.05,
  3: 0.12,
  10: 0.4,
  30: 0.77,
}

/** 整数 tier → 显示小数(已知模型走 KNOWN_MODEL_META 优先) */
function tierToDisplayMultiplier(tier: number): { value: number; locked: boolean } {
  if (tier > 30) return { value: 1.65, locked: true }
  if (tier in TIER_TO_DISPLAY) return { value: TIER_TO_DISPLAY[tier] ?? 1, locked: false }
  return { value: 1, locked: false }
}

/** 已知模型查询(精确匹配优先 + 子串 fallback) */
function lookupKnownMeta(modelId: string): Partial<ModelOption> {
  if (!modelId) return {}
  if (KNOWN_MODEL_META[modelId]) return KNOWN_MODEL_META[modelId]!
  // 子串 fallback:取第一个命中的 key
  for (const [k, v] of Object.entries(KNOWN_MODEL_META)) {
    if (modelId.includes(k) || k.includes(modelId)) return v
  }
  return {}
}

/** 积分消耗倍数前端兜底推断(API 未返回 pointsMultiplier 时按 modelId 关键词推断)
 *  5 档:tier 0=免费 / 1=经济 / 3=标准 / 10=高级 / 30=旗舰 */
function inferPointsMultiplier(modelId: string): number {
  const mid = (modelId || '').toLowerCase()
  if (['mini', 'nano', 'haiku'].some((k) => mid.includes(k))) return 1
  if (['opus', 'thinking', 'o1', 'o3', 'gpt-5'].some((k) => mid.includes(k))) return 30
  if (['gpt-4-turbo', 'gpt-4.5', 'claude-3-opus', 'gemini-pro'].some((k) => mid.includes(k)))
    return 10
  if (['sonnet', 'gpt-4o', 'gpt-4.1', 'deepseek', 'glm-4', 'qwen-max'].some((k) => mid.includes(k)))
    return 3
  if (['mini', 'flash', 'lite', 'nano', 'haiku'].some((k) => mid.includes(k))) return 1
  if (
    ['ollama', 'llama', 'llm7', 'pollinations', 'aihorde', 'opencode_zen'].some((k) =>
      mid.includes(k),
    )
  )
    return 0
  return 1
}

/** Provider 健康状态 → 圆点徽章(装饰点豁免 rounded-full) */
function ProviderHealthDot({ health }: { health: ProviderHealth }) {
  const t = useTranslations('chat')
  const tip = t('providerHealthTip', { latency: health.latency_ms, count: health.model_count })
  return (
    <Tooltip content={tip} side="top">
      <span
        aria-label={tip}
        className={cn(
          'inline-block h-1.5 w-1.5 shrink-0 cursor-default rounded-full',
          health.status === 'ok' && 'bg-green-500',
          health.status === 'invalid_key' && 'bg-red-500',
          health.status === 'unreachable' && 'bg-muted-foreground/40',
        )}
      />
    </Tooltip>
  )
}

/** 积分倍数显示格式化(2026-08-06 立,workbuddy 风格)
 *  - value === 0 → i18n "modelFree"
 *  - value < 1   → "0.77x" / "0.05x" 等
 *  - value >= 1  → "1.65x" 等 */
function formatMultiplier(value: number): string {
  if (value === 0) return 'free' // i18n key,渲染处走 t()
  if (value < 1) {
    // 2 位小数(0.05 / 0.12 / 0.39 / 0.77)
    return value.toFixed(2)
  }
  return value.toFixed(2)
}

/** 按厂商分组模型 */
function groupByVendor(options: ModelOption[]): Array<[string, ModelOption[]]> {
  const map = new Map<string, ModelOption[]>()
  for (const opt of options) {
    const vendor = opt.vendor ?? inferVendor(opt.value) ?? 'other'
    if (!map.has(vendor)) map.set(vendor, [])
    map.get(vendor)!.push(opt)
  }
  const order = Object.keys(VENDOR_LABEL)
  return Array.from(map.entries()).sort((a, b) => {
    const ia = order.indexOf(a[0])
    const ib = order.indexOf(b[0])
    if (ia === -1 && ib === -1) return a[0].localeCompare(b[0])
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

/** 模型行右侧:倍数 + 徽章 + 锁(2026-08-06 立,workbuddy 风格)
 *  顺序:[member discount tag] [official tag] [subsidy tag] [lock?] [multiplier] */
function ModelTierTags({ opt }: { opt: ModelOption }) {
  const t = useTranslations('chat')
  const value = opt.pointsMultiplier
  return (
    <div className="flex shrink-0 items-center gap-1">
      {/* 会员 2.5 折(红色徽章 + popover 触发) */}
      {opt.memberDiscountEligible && (
        <span
          className={cn(
            'inline-flex items-center rounded-sm px-1 py-px text-[10px] font-medium leading-tight',
            'bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
          )}
          aria-label={t('modelTagMemberDiscount')}
        >
          {t('modelTagMemberDiscount')}
        </span>
      )}
      {/* 正式版(灰色徽章) */}
      {opt.isOfficial && !opt.subsidy && (
        <span
          className={cn(
            'inline-flex items-center rounded-sm px-1 py-px text-[10px] font-medium leading-tight',
            'bg-muted text-muted-foreground',
          )}
          aria-label={t('modelTagOfficial')}
        >
          {t('modelTagOfficial')}
        </span>
      )}
      {/* 专属补贴(橙红徽章) */}
      {opt.subsidy && (
        <span
          className={cn(
            'inline-flex items-center rounded-sm px-1 py-px text-[10px] font-medium leading-tight',
            'bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
          )}
          aria-label={t('modelTagSubsidy')}
        >
          {t('modelTagSubsidy')}
        </span>
      )}
      {/* 锁定(锁图标) */}
      {opt.locked && (
        <Lock
          className="h-3 w-3 shrink-0 text-muted-foreground"
          aria-label={t('modelLockedHint')}
        />
      )}
      {/* 倍数(右对齐灰色文本) */}
      {value !== undefined && (
        <span
          className={cn(
            'shrink-0 text-[11px] tabular-nums',
            value === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
          )}
        >
          {value === 0 ? t('modelFree') : `${formatMultiplier(value)}x`}
        </span>
      )}
    </div>
  )
}

/** 升级权益 popover(2026-08-06 立,workbuddy 风格)
 *  - 悬停或聚焦 "会员2.5折" 徽章触发
 *  - 展示会员额外折扣说明 + 跳转 /user/subscription
 *
 *  2026-08-06 bugfix:父组件在 onMouseEnter 时 setPopoverAnchor({el, multiplier}),
 *  但本组件 useState(open=false) 默认未打开,且没有 useEffect 把 anchor 变化同步到 open,
 *  导致 popover 永远不显示。改为 anchor 变化时自动 setOpen(true) + 定位 pos。 */
function MemberDiscountPopover({
  currentMultiplier,
  anchor,
}: {
  currentMultiplier: number
  anchor: HTMLElement | null
}) {
  const router = useRouter()
  const t = useTranslations('chat')
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)

  // anchor 变化时自动打开 + 定位
  React.useEffect(() => {
    if (!anchor) {
      setOpen(false)
      return
    }
    const rect = anchor.getBoundingClientRect()
    setPos({
      top: rect.top + window.scrollY,
      left: rect.right + window.scrollX + 8,
    })
    setOpen(true)
  }, [anchor])

  if (!open || !pos) return null
  // 会员额外 2.5 折 = 25% 折扣,会员后倍数 = currentMultiplier * 0.25
  const memberRate = (currentMultiplier * 0.25).toFixed(2)
  return (
    <div
      role="dialog"
      aria-label={t('modelPopoverMemberTitle')}
      className={cn(
        'fixed z-popover w-64 rounded-lg border bg-card p-3 text-card-foreground shadow-lg',
        'animate-in fade-in-0 zoom-in-95',
      )}
      style={{ top: pos.top, left: pos.left }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-start gap-2">
        <Crown className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t('modelPopoverMemberTitle')}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('modelPopoverMemberDesc', {
              from: currentMultiplier.toFixed(2),
              to: memberRate,
            })}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          router.push('/user/subscription')
        }}
        className={cn(
          'mt-3 inline-flex h-8 w-full items-center justify-center rounded-md px-3 text-xs font-medium',
          'bg-foreground text-background transition-colors hover:bg-foreground/90',
        )}
      >
        {t('modelPopoverUpgradeButton')}
      </button>
    </div>
  )
}

export function ModelSelector({ value, onChange, disabled, label }: ModelSelectorProps) {
  const t = useTranslations('chat')
  const router = useRouter()
  const [options, setOptions] = React.useState<ModelOption[]>(() => {
    // 合并 FALLBACK + DEMO:确保 5 档积分 + 徽章 + 锁定演示数据全部可见
    // (2026-08-06 立,对齐 workbuddy 风格;详见 packages/shared/src/constants/fallback-models.ts)
    const seed = [...FALLBACK_MODELS, ...DEMO_TIER_MODELS]
    return seed.map((m): ModelOption => ({
      value: m.value,
      label: m.label,
      vendor: m.vendor,
      descriptionKey: m.descriptionKey,
      // FallbackModel 上 5 字段已显式提供(2026-08-06),透传
      pointsMultiplier: m.pointsMultiplier ?? inferPointsMultiplier(m.value),
      memberDiscountEligible: m.memberDiscountEligible,
      isOfficial: m.isOfficial,
      subsidy: m.subsidy,
      locked: m.locked,
    }))
  })
  const [loading, setLoading] = React.useState(true)
  const [healthByVendor, setHealthByVendor] = React.useState<Record<string, ProviderHealth>>({})
  // 会员折扣 popover 状态(2026-08-06 立,workbuddy 风格)
  const [popoverAnchor, setPopoverAnchor] = React.useState<{
    el: HTMLElement | null
    multiplier: number
  } | null>(null)

  // 拉取用户已保存的 LLM 配置
  const { data: cfgData } = useQuery({
    queryKey: ['user-llm-configs'],
    queryFn: () => fetchConfigs(),
    retry: false,
    throwOnError: false,
    staleTime: 60_000,
  })
  const configuredTemplateCodes = React.useMemo(() => {
    const set = new Set<string>()
    const list = cfgData?.list ?? []
    for (const c of list) {
      if (c.enabled) set.add(c.providerCode)
    }
    return set
  }, [cfgData])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchSelectorModels()
      .then((models) => {
        if (cancelled) return
        // 合并策略(2026-08-06 升级):API + 已有(FALLBACK + DEMO 演示档位)
        // 优先级:API > FALLBACK > DEMO;同 value 取优先级最高的(API 模型覆盖演示)
        // 这样既保留真实可调用的模型,又确保 5 档积分 + 徽章 + 锁定演示不丢失。
        const merged = new Map<string, ModelOption>()
        // 1. 先放当前 options(FALLBACK + DEMO 已经在初始 state 中)
        setOptions((prev) => {
          for (const o of prev) merged.set(o.value, o)
          // 2. 再放 API 返回的模型(覆盖同 value 的旧数据)
          for (const m of models) {
            // 1. 已知模型查表(精确 / 子串)
            const known = lookupKnownMeta(m.id)
            // 2. 后端 tier → 显示小数
            const tier =
              typeof m.points_multiplier === 'number'
                ? m.points_multiplier
                : inferPointsMultiplier(m.id)
            const display = tierToDisplayMultiplier(tier)
            // 3. 已知模型的 pointsMultiplier 优先,否则用 tier 推导
            const finalPoints =
              typeof known.pointsMultiplier === 'number' ? known.pointsMultiplier : display.value
            merged.set(m.id, {
              value: m.id,
              label: m.name || m.id,
              vendor: m.provider || inferVendor(m.id),
              // 已知元数据优先(包括 memberDiscountEligible / isOfficial / subsidy / locked)
              ...known,
              // 用 finalPoints 覆盖 known 内的 pointsMultiplier,确保后端 tier 推导也生效
              pointsMultiplier: finalPoints,
              locked: known.locked ?? display.locked,
            })
          }
          return Array.from(merged.values())
        })
      })
      .catch(() => {
        // 静默:保留 FALLBACK + DEMO 默认值
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // mount 时拉取 provider 健康状态
  React.useEffect(() => {
    let cancelled = false
    fetchProvidersHealth()
      .then((list) => {
        if (cancelled) return
        const map: Record<string, ProviderHealth> = {}
        for (const h of list) map[h.provider] = h
        if (!cancelled) setHealthByVendor(map)
      })
      .catch(() => {
        // 静默
      })
    return () => {
      cancelled = true
    }
  }, [])

  const isAuto = value === AUTO_OPTION.value
  const current = React.useMemo(
    () => (isAuto ? AUTO_OPTION : options.find((m) => m.value === value)),
    [options, value, isAuto],
  )
  const grouped = React.useMemo(() => groupByVendor(options), [options])

  const currentTemplateCode = current?.vendor ? providerToTemplateCode(current.vendor) : null
  const currentConfigured = currentTemplateCode
    ? configuredTemplateCodes.has(currentTemplateCode)
    : false
  const showConfigBadge = cfgData !== undefined

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled || loading}
          aria-label={label}
          className={cn(
            'inline-flex h-9 min-w-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm font-medium transition-colors',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-60',
            '[&>span]:translate-y-[var(--text-vcenter-offset)]',
          )}
        >
          <BrandIcon
            vendor={current?.vendor}
            iconUrl={current?.iconUrl}
            size={16}
            className="shrink-0 text-muted-foreground"
          />
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <span className="model-selector-text min-w-0 max-w-[6rem] truncate">
              {current ? (current.value === 'auto' ? t('modelAuto') : current.label) : value}
            </span>
          )}
          {showConfigBadge && !loading && currentConfigured && (
            <CheckCircle2
              className="model-selector-badge h-3.5 w-3.5 shrink-0 text-emerald-500"
              aria-label={t('modelConfigured')}
            />
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-popover max-h-[60vh] w-fit max-w-[320px] overflow-y-auto rounded-lg border bg-card p-1 text-card-foreground shadow-md',
            ' [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30',
          )}
        >
          {/* 自定义配置模型入口 */}
          <DropdownMenu.Group>
            <DropdownMenu.Item
              onSelect={() => router.push('/settings/llm')}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
                'focus:bg-accent focus:text-accent-foreground',
                '[&>span]:translate-y-[var(--text-vcenter-offset)]',
              )}
            >
              <div className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Settings className="h-3.5 w-3.5" />
              </div>
              <span className="flex-1 truncate font-medium">{t('manageModels')}</span>
            </DropdownMenu.Item>
            {grouped.length > 0 && <DropdownMenu.Separator className="my-1 h-px bg-border/60" />}
          </DropdownMenu.Group>
          {/* 自动选项(2026-08-06 改:自动模式显示 "Auto Mode" + "0.05x" 风格,
              实际无积分倍数,保持纯文本 "自动" + 描述) */}
          <DropdownMenu.Group>
            <DropdownMenu.Item
              onSelect={() => onChange(AUTO_OPTION.value)}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
                'focus:bg-accent focus:text-accent-foreground',
                '[&>span]:translate-y-[var(--text-vcenter-offset)]',
              )}
            >
              <Check
                className={cn(
                  'h-4 w-4 shrink-0',
                  value === AUTO_OPTION.value ? 'opacity-100' : 'opacity-0',
                )}
              />
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="flex-1 truncate font-medium">{t('modelAuto')}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-border/60" />
          </DropdownMenu.Group>
          {grouped.map(([vendor, items]) => (
            <DropdownMenu.Group key={vendor}>
              <DropdownMenu.Label
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide',
                  'bg-card text-muted-foreground',
                )}
              >
                <BrandIcon vendor={vendor} size={12} className="text-muted-foreground" />
                <span className="flex-1 truncate">
                  {VENDOR_LABEL[vendor] ? t(VENDOR_LABEL[vendor]) : vendor}
                </span>
                {healthByVendor[vendor] && <ProviderHealthDot health={healthByVendor[vendor]} />}
              </DropdownMenu.Label>
              {items.map((opt) => {
                const active = opt.value === value && value !== AUTO_OPTION.value
                const optTemplateCode = opt.vendor ? providerToTemplateCode(opt.vendor) : null
                const optConfigured = optTemplateCode
                  ? configuredTemplateCodes.has(optTemplateCode)
                  : false
                return (
                  <DropdownMenu.Item
                    key={opt.value}
                    onSelect={() => onChange(opt.value)}
                    className={cn(
                      'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
                      'focus:bg-accent focus:text-accent-foreground',
                    )}
                  >
                    <Check
                      className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-0')}
                    />
                    <BrandIcon
                      vendor={opt.vendor}
                      iconUrl={opt.iconUrl}
                      size={14}
                      className="shrink-0 text-muted-foreground"
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="truncate font-medium">{opt.label}</span>
                      {/* 未配置时的琥珀 ⚠ 徽章(2026-08-06 调整位置:从右移到名称旁,腾出右侧给倍数) */}
                      {showConfigBadge && !optConfigured && (
                        <TriangleAlert
                          className="h-3 w-3 shrink-0 text-amber-500"
                          aria-label={t('modelNotConfigured')}
                        />
                      )}
                    </div>
                    {/* 右侧:会员/正式版/补贴 徽章 + 锁 + 倍数(2026-08-06 立) */}
                    <div
                      onMouseEnter={(e) => {
                        if (opt.memberDiscountEligible && opt.pointsMultiplier !== undefined) {
                          e.stopPropagation()
                          setPopoverAnchor({ el: e.currentTarget, multiplier: opt.pointsMultiplier })
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (opt.memberDiscountEligible) {
                          // 延迟关闭,允许鼠标移到 popover 上
                          setTimeout(() => {
                            setPopoverAnchor((prev) => (prev?.el === e.currentTarget ? null : prev))
                          }, 100)
                        }
                      }}
                    >
                      <ModelTierTags opt={opt} />
                    </div>
                  </DropdownMenu.Item>
                )
              })}
              <DropdownMenu.Separator className="my-1 h-px bg-border/60 last:hidden" />
            </DropdownMenu.Group>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
      {/* 升级权益 popover(2026-08-06 立,固定在右下,通过锚点元素的 bounding rect 定位到右侧) */}
      {popoverAnchor?.el && popoverAnchor.multiplier > 0 && (
        <MemberDiscountPopover
          currentMultiplier={popoverAnchor.multiplier}
          anchor={popoverAnchor.el}
        />
      )}
    </DropdownMenu.Root>
  )
}

export default ModelSelector
