'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  History,
  Loader2,
  Lock,
  Search,
  Settings,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { MODEL_CATEGORY_META, normalizeCategory, normalizeTier } from '@ihui/shared'
import { useAuthStore } from '@/stores/auth'
import { Tooltip } from '@/components/feedback'
import { fetchSelectorModels, fetchProvidersHealth, type ProviderHealth } from '@/lib/models-api'
import { BrandIcon, inferVendor } from '@/components/ai/brand-icon'
import { FALLBACK_MODELS, DEMO_TIER_MODELS, VENDOR_LABEL } from '@/components/chat/fallback-models'
import { fetchConfigs } from '@/lib/user-llm-configs'
import { providerToTemplateCode, BACKEND_BUILTIN_FREE_CODES } from '@/lib/llm-templates'
import {
  groupByCategory,
  splitByTier,
  type ModelOption,
  type ModelUsageCategory,
} from '@/components/chat/model-tier-utils'

// 兼容既有外部引用(model-selector 此前直接导出这些类型)
export type { ModelOption, ModelTier, ModelUsageCategory } from '@/components/chat/model-tier-utils'

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
  // 智汇AI 官方中转模型(ihui/ 前缀):付费模型,按档位映射积分倍数
  const IHUI_MAP: Record<string, number> = {
    // 倍率 = 极速扣费比例 × 3(统一利润系数),与 proxy-llm.ts / free_provider_registry.py 同步
    'ihui/auto-model': 3,
    'ihui/minimax-m2.7': 6,
    'ihui/minimax-m2.7-highspeed': 15,
    'ihui/minimax-m3': 15,
    'ihui/deepseek-v4-flash-0731': 15,
    'ihui/glm-5.1': 18,
    'ihui/glm-5.2': 18,
    'ihui/glm-5.3-flash': 18,
    'ihui/kimi-k2.6': 18,
    'ihui/deepseek-v4-pro': 18,
    'ihui/deepseek-v4-pro-0813': 18,
    'ihui/grok-4.5': 18,
    'ihui/glm-5.3': 30,
    'ihui/gpt-5.6': 30,
    'ihui/grok-4.6': 30,
    'ihui/qwen3.7-max': 30,
    'ihui/kimi-k2.7-code': 30,
  }
  if (IHUI_MAP[mid] !== undefined) return IHUI_MAP[mid]
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

/**
 * 单个模型行(默认区与历史模型区共用,2026-08-29 抽出)。
 * 左侧:选中勾 + 厂商图标 + 名称 + 未配置⚠(可选) + 用途分类徽章(可选)
 * 右侧:会员/正式版/补贴 徽章 + 锁 + 积分倍数
 */
function ModelOptionRow({
  opt,
  active,
  warning,
  showCategory,
  onSelect,
}: {
  opt: ModelOption
  active: boolean
  warning: boolean
  /** 历史模型区需要显示用途分类(嵌入/语音/图像…),默认区都是对话类无需标注 */
  showCategory?: boolean
  onSelect: () => void
}) {
  const t = useTranslations('chat')
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
        'focus:bg-accent focus:text-accent-foreground',
      )}
    >
      <Check className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
      <BrandIcon
        vendor={opt.vendor}
        iconUrl={opt.iconUrl}
        size={14}
        className="shrink-0 text-muted-foreground"
      />
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate font-medium">{opt.label}</span>
        {/* 智汇AI 官方模型徽章 */}
        {opt.vendor === 'ihui_relay' && (
          <span className="inline-flex shrink-0 items-center rounded-sm bg-blue-500/10 px-1 py-px text-[10px] font-medium leading-tight text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
            {t('modelOfficialBadge')}
          </span>
        )}
        {/* 智汇 Auto-Model 专属卖点徽章:服务端随机低档池,标称倍率全场最低,省钱入口(2026-08-31 立) */}
        {opt.id.toLowerCase() === 'ihui/auto-model' && (
          <span className="inline-flex shrink-0 items-center rounded-sm bg-emerald-500/10 px-1 py-px text-[10px] font-medium leading-tight text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            {t('modelSmartSaveBadge')}
          </span>
        )}
        {/* 未配置时的琥珀 ⚠ 徽章(2026-08-06 调整位置:从右移到名称旁,腾出右侧给倍数) */}
        {warning && (
          <TriangleAlert
            className="h-3 w-3 shrink-0 text-amber-500"
            aria-label={t('modelNotConfigured')}
          />
        )}
        {showCategory && <ModelCategoryBadge category={opt.category} />}
      </div>
      {/* 右侧:会员/正式版/补贴 徽章 + 锁 + 倍数(2026-08-06 立)
         2026-08-12 bugfix:原 onMouseEnter/onMouseLeave 写在父 div 上,
         setTimeout 闭包读 e.currentTarget 失效导致 popover 常驻显示。
         改为 MemberDiscountSection 内部自管理 hover 状态,父组件只管渲染 children。 */}
      <MemberDiscountSection opt={opt}>
        <ModelTierTags opt={opt} />
      </MemberDiscountSection>
    </DropdownMenu.Item>
  )
}

/** 用途分类徽章(聊天类不显示,避免"对话"标签刷屏) */
function ModelCategoryBadge({ category }: { category?: ModelUsageCategory }) {
  const t = useTranslations('chat')
  const cat = normalizeCategory(category)
  if (cat === 'chat') return null
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm px-1 py-px text-[10px] font-medium leading-tight',
        'bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
      )}
    >
      {t(MODEL_CATEGORY_META[cat].labelKey)}
    </span>
  )
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

/** 升级权益徽章 + 弹层(2026-08-06 立,workbuddy 风格)
 *  - 悬停 "会员2.5折" 徽章触发
 *  - 展示会员额外折扣说明 + 跳转 /user/subscription
 *
 *  2026-08-12 bugfix:原实现父 + 子双状态 + setTimeout 闭包读取已失效的 e.currentTarget
 *  (React 17+ SyntheticEvent 在 handler 返回后 currentTarget 置 null),导致 setPopoverAnchor
 *  永远走 prev?.el === null 分支(永真为 false)→ popover 常驻显示。改为单组件持有
 *  hover 状态 + useRef 管理 timer,徽章与 popover 共享同一 show/scheduleHide 桥接。 */
function MemberDiscountSection({ opt, children }: { opt: ModelOption; children: React.ReactNode }) {
  const router = useRouter()
  const t = useTranslations('chat')
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)
  const anchorRef = React.useRef<HTMLDivElement | null>(null)
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const eligible = opt.memberDiscountEligible && (opt.pointsMultiplier ?? 0) > 0

  const cancelHide = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const show = React.useCallback(() => {
    if (!eligible) return
    cancelHide()
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      top: rect.top + window.scrollY,
      left: rect.right + window.scrollX + 8,
    })
    setOpen(true)
  }, [eligible, cancelHide])

  // 徽章/弹层都共用 scheduleHide,实现 hover bridge
  const scheduleHide = React.useCallback(() => {
    cancelHide()
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      setOpen(false)
    }, 120)
  }, [cancelHide])

  React.useEffect(() => {
    return () => cancelHide()
  }, [cancelHide])

  if (!eligible) return <>{children}</>

  return (
    <>
      <div ref={anchorRef} onMouseEnter={show} onMouseLeave={scheduleHide}>
        {children}
      </div>
      {open && pos && opt.pointsMultiplier !== undefined && (
        <div
          role="dialog"
          aria-label={t('modelPopoverMemberTitle')}
          className={cn(
            'fixed z-popover w-64 rounded-lg border bg-card p-3 text-card-foreground shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
          )}
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
        >
          <div className="flex items-start gap-2">
            <Crown className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t('modelPopoverMemberTitle')}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t('modelPopoverMemberDesc', {
                  from: opt.pointsMultiplier.toFixed(2),
                  to: (opt.pointsMultiplier * 0.25).toFixed(2),
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              // 立即关闭(不走 scheduleHide 延迟),防止跳转瞬间残留
              cancelHide()
              setOpen(false)
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
      )}
    </>
  )
}

/** 初始/降级种子选项(FALLBACK + DEMO 演示档位,未登录/加载中展示) */
function createSeedOptions(): ModelOption[] {
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
    // 种子数据是人工挑选的当前可用主力,按"最新对话模型"处理
    category: 'chat',
    tier: 'latest',
  }))
}

/** vendor 是否视为"已配置/有配额"(降级列表过滤 + ⚠/✅ 徽章判定用)
 *  - 后端内置免费 provider(无需配置 key)直接豁免
 *  - 其余:vendor 映射到平台模板且模板在已配置集合内 */
function isConfiguredVendor(vendor: string | undefined, codes: Set<string>): boolean {
  if (!vendor) return false
  if (BACKEND_BUILTIN_FREE_CODES.includes(vendor)) return true
  const code = providerToTemplateCode(vendor)
  return code !== null && codes.has(code)
}

export function ModelSelector({ value, onChange, disabled, label }: ModelSelectorProps) {
  const t = useTranslations('chat')
  const router = useRouter()
  // 2026-08-14:未登录/无 token 不拉取鉴权接口,消除 dev overlay 401 噪音(models/providers-health/configs 均为 auth-gated)。
  // 依赖 token 而非仅 isAuthenticated:刷新后 store hydrate 先恢复 isAuthenticated=true,但 accessToken 需 bootstrap
  // refresh 完成后才写入——此时发请求必 401。短路后等 bootstrap setToken → token 变化 → effect 重跑 → 200。
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const token = useAuthStore((s) => s.token)
  const authedWithToken = isAuthenticated && !!token
  const [options, setOptions] = React.useState<ModelOption[]>(createSeedOptions)
  const [loading, setLoading] = React.useState(true)
  const [healthByVendor, setHealthByVendor] = React.useState<Record<string, ProviderHealth>>({})
  // 2026-08-12 bugfix:升级权益 popover 状态已收敛到 MemberDiscountSection 内部,
  // 父组件不再持有 popoverAnchor / timer。hover 状态机完全自包含,
  // 避免原 e.currentTarget 闭包失效导致 popover 常驻显示的 bug。

  // 拉取用户已保存的 LLM 配置
  const { data: cfgData } = useQuery({
    queryKey: ['user-llm-configs'],
    queryFn: () => fetchConfigs(),
    retry: false,
    throwOnError: false,
    staleTime: 60_000,
    enabled: authedWithToken,
  })
  // 2026-08-27 修复:configuredTemplateCodes 只含"用户真实配置 + 后端内置免费",
  // 不再全量注入 PRESET_TEMPLATE_CODES(否则所有预置模板厂商都绕过配额过滤,
  // "无配额模型不显示"失效——openai/anthropic 等未配 key 的模型也会被展示)。
  const configuredTemplateCodes = React.useMemo(() => {
    const set = new Set<string>()
    const list = cfgData?.list ?? []
    for (const c of list) {
      if (c.enabled || c.isBuiltin) set.add(c.providerCode)
    }
    // 后端内置免费 provider(无需用户配置 API Key 即视为有配额)
    for (const code of BACKEND_BUILTIN_FREE_CODES) {
      set.add(code)
    }
    return set
  }, [cfgData])

  // 2026-08-27 修复:已登录且 /llm/models 成功返回非空时,options 只保留后端
  // 过滤后的模型(可用+有配额),不再混入 FALLBACK/DEMO 硬编码模型;
  // API 空/失败才降级 FALLBACK+DEMO(由 grouped 按 configuredTemplateCodes 过滤)。
  const [useApiOnly, setUseApiOnly] = React.useState(false)
  // effect 依赖仅 authedWithToken,当前选中值经 ref 读取,避免切换模型触发重复拉取
  const valueRef = React.useRef(value)
  valueRef.current = value

  React.useEffect(() => {
    if (!authedWithToken) {
      // 登出/未登录:重置加载态与 API-only 标记(曾登录过的会话回到初始演示态,
      // trigger 重新禁用,避免残留上一会话的 API 模型列表)
      setLoading(true)
      setUseApiOnly(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchSelectorModels()
      .then((models) => {
        if (cancelled) return
        if (models.length === 0) {
          // API 空/失败:恢复 FALLBACK + DEMO 降级列表(由 grouped 按真实配置过滤)
          setUseApiOnly(false)
          setOptions(createSeedOptions())
          return
        }
        // 2026-08-27 修复:API 成功(后端已按可用性+配额过滤)→ 只展示后端返回的模型。
        // 不再与 FALLBACK/DEMO 合并(原实现把 38 个硬编码 demo 模型混入列表,
        // 含未配置厂商的 gpt-5/claude-opus 等,违反"可用且有配额才显示")。
        const merged = new Map<string, ModelOption>()
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
            // 2026-08-29 立:后端 model_catalog 产出的分类字段,驱动"默认展示 vs 历史模型折叠"
            category: normalizeCategory(m.category),
            tier: normalizeTier(m.model_tier),
            family: m.family,
          })
        }
        // 当前选中不在 API 列表时保留(trigger 与列表一致,切换后自然消失)
        setOptions((prev) => {
          const cur = prev.find((o) => o.value === valueRef.current)
          if (cur && !merged.has(cur.value)) merged.set(cur.value, cur)
          return Array.from(merged.values())
        })
        setUseApiOnly(true)
      })
      .catch(() => {
        // 静默:恢复 FALLBACK + DEMO 降级列表
        if (cancelled) return
        setUseApiOnly(false)
        setOptions(createSeedOptions())
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authedWithToken])

  // mount 时拉取 provider 健康状态
  React.useEffect(() => {
    if (!authedWithToken) return
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
  }, [authedWithToken])

  const isAuto = value === AUTO_OPTION.value
  const current = React.useMemo(
    () => (isAuto ? AUTO_OPTION : options.find((m) => m.value === value)),
    [options, value, isAuto],
  )
  // 2026-08-29 立:默认区(最新最强)/ 历史模型区(过时版本 + 专用模型)
  const { primary, archived } = React.useMemo(() => splitByTier(options), [options])
  const [showHistory, setShowHistory] = React.useState(false)
  const [historyQuery, setHistoryQuery] = React.useState('')
  /**
   * 派生展开态:默认列表为空时强制展开历史模型。
   * 后端 model_tier 字段是可选的,老后端 / 缓存数据缺失时若整批被判成非 latest,
   * 用户会看到空列表以为功能坏了 —— 这是不可接受的失败态,故用派生值兜底。
   * 用户仍可手动收起(toggle 走 setShowHistory(!historyExpanded))。
   */
  const historyExpanded = showHistory || (primary.length === 0 && archived.length > 0)

  /** 历史模型区:搜索过滤 + 按用途分类分组 */
  const archivedGroups = React.useMemo(() => {
    const q = historyQuery.trim().toLowerCase()
    const filtered = q
      ? archived.filter(
          (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
        )
      : archived
    return groupByCategory(filtered)
  }, [archived, historyQuery])

  const grouped = React.useMemo(() => {
    const all = groupByVendor(primary)
    // 2026-08-27 修复:API 成功路径(options=后端过滤后模型)直接展示,
    // 不再做前端配置过滤——后端 /llm/models 已保证"可用且有配额",
    // 再按 configuredTemplateCodes 过滤会误伤 agnes 等无平台模板的真实可用模型。
    if (useApiOnly) return all
    // 降级路径(FALLBACK/DEMO):没有配额(未配置)的模型不显示在可选择列表里。
    // 过滤条件:配置已加载且非空才过滤(未登录/加载中显示全部,避免列表空白);
    // 例外:当前选中的模型保留显示(trigger 与列表不一致会误导,切换后自然消失)。
    if (cfgData === undefined || configuredTemplateCodes.size === 0) return all
    const filtered: Array<[string, ModelOption[]]> = []
    for (const [vendor, items] of all) {
      const visible = items.filter((opt) => {
        if (opt.value === value) return true // 当前选中保留
        // 与 ⚠ 徽章判断一致:内置免费 provider 直接豁免;
        // vendor 无对应模板(code null)或模板未配置 → 无配额,隐藏
        return isConfiguredVendor(opt.vendor, configuredTemplateCodes)
      })
      if (visible.length > 0) filtered.push([vendor, visible])
    }
    return filtered
  }, [primary, cfgData, configuredTemplateCodes, value, useApiOnly])

  // API 成功路径下后端已保证模型可用,直接视为已配置(避免 agnes 等误显示 ⚠/缺失 ✅)
  const currentConfigured = useApiOnly
    ? true
    : isConfiguredVendor(current?.vendor, configuredTemplateCodes)
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
              {items.map((opt) => (
                <ModelOptionRow
                  key={opt.value}
                  opt={opt}
                  active={opt.value === value && value !== AUTO_OPTION.value}
                  // API 成功路径下后端已过滤,不显示"未配置"⚠ 徽章
                  warning={
                    showConfigBadge &&
                    !useApiOnly &&
                    !isConfiguredVendor(opt.vendor, configuredTemplateCodes)
                  }
                  onSelect={() => onChange(opt.value)}
                />
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-border/60 last:hidden" />
            </DropdownMenu.Group>
          ))}

          {/* 2026-08-29 立:历史模型折叠区。默认收起,点开才显示过时版本与专用模型
              (嵌入/重排/语音/图像等),并按用途分类分组标注,避免上千个模型糊成一片。 */}
          {archived.length > 0 && (
            <DropdownMenu.Group>
              <DropdownMenu.Separator className="my-1 h-px bg-border/60" />
              <DropdownMenu.Item
                onSelect={(e) => {
                  // preventDefault 阻止 Radix 选中后自动关闭菜单
                  e.preventDefault()
                  // 用派生值取反,保证"默认区为空被强制展开"时点一下也能收起
                  setShowHistory(!historyExpanded)
                  setHistoryQuery('')
                }}
                className={cn(
                  'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
                  'focus:bg-accent focus:text-accent-foreground',
                  '[&>span]:translate-y-[var(--text-vcenter-offset)]',
                )}
              >
                <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate font-medium">{t('modelHistoryToggle')}</span>
                <span className="shrink-0 rounded-sm bg-muted px-1 py-px text-[10px] tabular-nums text-muted-foreground">
                  {archived.length}
                </span>
                {historyExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </DropdownMenu.Item>

              {historyExpanded && (
                <>
                  {/* 搜索框:历史模型可能上千个,没有搜索等于不可用。
                      onKeyDown stopPropagation 防止 Radix DropdownMenu 的
                      typeahead 键盘导航吃掉输入。 */}
                  <div className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5 rounded-md border bg-background px-2">
                      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <input
                        value={historyQuery}
                        onChange={(e) => setHistoryQuery(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder={t('modelHistorySearch')}
                        aria-label={t('modelHistorySearch')}
                        className="h-7 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                  {archivedGroups.length === 0 ? (
                    <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                      {t('modelHistoryEmpty')}
                    </div>
                  ) : (
                    archivedGroups.map(([cat, items]) => (
                      <DropdownMenu.Group key={cat}>
                        <DropdownMenu.Label
                          className={cn(
                            'flex items-center gap-1.5 bg-card px-2 py-1.5',
                            'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                          )}
                        >
                          <span className="flex-1 truncate">
                            {t(MODEL_CATEGORY_META[cat].labelKey)}
                          </span>
                          <span className="shrink-0 tabular-nums">{items.length}</span>
                        </DropdownMenu.Label>
                        {items.map((opt) => (
                          <ModelOptionRow
                            key={opt.value}
                            opt={opt}
                            active={opt.value === value && value !== AUTO_OPTION.value}
                            warning={
                              showConfigBadge &&
                              !useApiOnly &&
                              !isConfiguredVendor(opt.vendor, configuredTemplateCodes)
                            }
                            showCategory
                            onSelect={() => onChange(opt.value)}
                          />
                        ))}
                      </DropdownMenu.Group>
                    ))
                  )}
                </>
              )}
            </DropdownMenu.Group>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
      {/* 2026-08-12 bugfix:升级权益 popover 已收敛到 MemberDiscountSection 内部,
          hover 状态自包含,父组件不再持有 popoverAnchor / 渲染顶层 popover。 */}
    </DropdownMenu.Root>
  )
}

export default ModelSelector
