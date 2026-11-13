// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  RefreshCw,
  Settings,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { SearchInput } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { MODEL_CATEGORY_META, normalizeCategory, normalizeTier } from '@ihui/shared'
import { useAuthStore } from '@/stores/auth'
import { Tooltip } from '@/components/feedback'
import {
  fetchModelHealthRefreshStatus,
  fetchProvidersHealth,
  fetchSelectorModels,
  triggerModelHealthRefresh,
  type ProviderHealth,
  type SelectorModel,
} from '@/lib/models-api'
// 2026-11-10 立:个人号池模型(「我的号池」分组)与平台模型并行拉取,失败静默降级为空
import { fetchPoolChatModels, type PoolChatModel } from '@ihui/api-client'
// 2026-10-21 首屏瘦身:图标全集与纯函数分家(同 ai-side-panel.tsx:15-17 的既有口径)。
// 本文件此前静态 `import { BrandIcon }`,而 message-input → AISidePanel → GlobalShell →
// 根 layout 全是静态边,于是纯展示的营销页(/、/en、/pricing)也被迫下载整包
// @lobehub/icons(现读单 chunk 1,541KB / gzip 258KB)。图标改走 React.lazy 边界。
import type { BrandIconProps } from '@/components/ai/brand-icon'
import { inferVendor } from '@/components/ai/vendor-infer'
import { FALLBACK_MODELS, DEMO_TIER_MODELS, VENDOR_LABEL } from '@/components/chat/fallback-models'
import { fetchConfigs } from '@/lib/user-llm-configs'
import { providerToTemplateCode, BACKEND_BUILTIN_FREE_CODES } from '@/lib/llm-templates'
import {
  buildCapabilitySegments,
  filterByCapabilities,
  groupByCategory,
  splitByTier,
  type CapsVerified,
  type ModelOption,
  type ModelCapabilityKey,
  type ModelUsageCategory,
} from '@/components/chat/model-tier-utils'

// 兼容既有外部引用(model-selector 此前直接导出这些类型)
export type { ModelOption, ModelTier, ModelUsageCategory } from '@/components/chat/model-tier-utils'

/**
 * 是否未通过连通性探测(2026-11-11 立;字段缺失也按未验证处理,避免误判为可用)。
 * `verified` 只有后端 `health_status === 'healthy'`(真 ping 通过)才为 true;
 * pending(账户级错误/未探测)与 unknown(无状态)都不可依赖,一律按未验证展示。
 */
function isUnverified(opt: ModelOption): boolean {
  return opt.verified !== true
}

/**
 * 厂商图标的懒加载边界(形态与 ai-side-panel.tsx:170 的 BrandIconLazy 一致):
 * React.lazy 只出现在动态 import 里,图标全集因此不进入本路由组的初始编译图;
 * fallback 按同一 size 占位 ⇒ 加载完成不跳动。
 */
const BrandIconLazy = React.lazy(() =>
  import('@/components/ai/brand-icon').then((m) => ({ default: m.BrandIcon })),
)

function BrandIconDeferred({ size = 16, className, ...rest }: BrandIconProps) {
  return (
    <React.Suspense
      fallback={
        <span
          aria-hidden
          className={cn('inline-block shrink-0 rounded bg-muted', className)}
          style={{ width: size, height: size }}
        />
      }
    >
      <BrandIconLazy size={size} className={className} {...rest} />
    </React.Suspense>
  )
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
  /** 第二参 = 模型通道(2026-11-12 立):'pool' 表示选中了「我的号池」模型,
   *  宿主据此把 chat store 的 currentModelChannel 一起切走;缺省 = 平台模型。 */
  onChange: (model: string, channel?: 'platform' | 'pool') => void
  disabled?: boolean
  label: string
  /** 2026-11-11 用户要求:auto 模式下宿主传入「当前对话实际使用的模型」,
   *  trigger 按钮显示该模型名/图标而非「自动」文案(新会话无信号时仍显示「自动」)。 */
  autoResolvedModel?: string
  /** 弹层底部扩展段(2026-09-30 底栏单行化):推理强度轴 + 采样参数入口等
   *  "模型相关调参"控件收纳进模型弹层 footer,宿主以 ReactNode 传入。 */
  footer?: React.ReactNode
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
 * 左侧:选中勾 + 厂商图标 + 名称 + 未验证/未配置/分类/能力徽章(均可选)
 * 右侧:会员/正式版/补贴 徽章 + 锁 + 积分倍数
 * 2026-11-11:未验证(未探测通过)的行整体降权,但 hover/focus 时恢复可读性。
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
  const unverified = isUnverified(opt)
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      title={opt.healthError || undefined}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-body outline-none',
        'focus:bg-accent focus:text-accent-foreground',
        unverified && 'opacity-60 focus:opacity-100 data-[highlighted]:opacity-100',
      )}
    >
      <Check className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
      <BrandIconDeferred
        vendor={opt.vendor}
        iconUrl={opt.iconUrl}
        size={14}
        className="shrink-0 text-muted-foreground"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium">{opt.label}</span>
          {/* 未验证徽章(2026-11-11 立):未探测通过/账户级错误,与已验证模型区分 */}
          {unverified && (
            <span className="inline-flex shrink-0 items-center rounded-sm bg-muted px-1 py-px text-[10px] font-medium leading-tight text-muted-foreground">
              {t('modelUnverified')}
            </span>
          )}
          {/* 智汇AI 官方模型徽章 */}
          {opt.vendor === 'ihui_relay' && (
            <span className="inline-flex shrink-0 items-center rounded-sm bg-blue-500/10 px-1 py-px text-[10px] font-medium leading-tight text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              {t('modelOfficialBadge')}
            </span>
          )}
          {/* 智汇 Auto-Model 专属卖点徽章:服务端随机低档池,标称倍率全场最低,省钱入口(2026-08-31 立) */}
          {opt.id?.toLowerCase() === 'ihui/auto-model' && (
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
          {/* 2026-09-19 D23 立:能力徽章(vision/fim,紫色系与用途分类天蓝区分;缺失时整体不显示=未知不标注) */}
          <ModelCapBadges capabilities={opt.capabilities} />
        </div>
        {/* 2026-11-11 立:名称下方实测能力摘要(流式 · 工具 · 长上下文),未知也显示问号保持行结构一致 */}
        <ModelCapsSummary opt={opt} />
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

/**
 * 实测能力摘要行(2026-11-11 立):名称下方的 10px 灰色一行,
 * 三段 "流式 · 工具 · 长上下文" 用 ` · ` 分隔。
 * - 已验证段 text-muted-foreground,失败段 amber,未知段 muted-foreground/60
 * - 失败/未知段 title 优先展示后端错误,否则固定说明(尚未实测/实测未通过)
 * - capsVerified 整体缺失时仍显示三段问号,保证所有行结构一致
 */
export function ModelCapsSummary({ opt }: { opt: ModelOption }) {
  const t = useTranslations('chat')
  const segments = buildCapabilitySegments(opt, {
    stream: t('capStream'),
    tools: t('capTools'),
    context: t('capContext'),
  })
  // 后端可能追加分段错误字段(类型未固定声明),存在即优先展示
  const caps = opt.capsVerified as
    (CapsVerified & { tools_error?: string; context_error?: string }) | undefined
  return (
    <span className="flex min-w-0 items-center overflow-hidden whitespace-nowrap text-[10px] leading-tight">
      {segments.map((seg, index) => {
        const title =
          seg.state === 'ok'
            ? undefined
            : (seg.key === 'tools'
                ? caps?.tools_error
                : seg.key === 'context'
                  ? caps?.context_error
                  : undefined) ||
              opt.healthError ||
              t(seg.state === 'fail' ? 'capFailHint' : 'capUnknownHint')
        return (
          <span key={seg.key} className="flex min-w-0 items-center">
            {index > 0 && (
              <span aria-hidden className="px-0.5 text-muted-foreground/40">
                ·
              </span>
            )}
            <span
              title={title}
              className={cn(
                'truncate',
                seg.state === 'ok' && 'text-muted-foreground',
                seg.state === 'fail' && 'text-amber-600 dark:text-amber-500',
                seg.state === 'unknown' && 'text-muted-foreground/60',
              )}
            >
              {seg.text}
            </span>
          </span>
        )
      })}
    </span>
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
        'inline-flex shrink-0 items-center rounded-md px-1 py-px text-[10px] font-medium leading-tight',
        'bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
      )}
    >
      {t(MODEL_CATEGORY_META[cat].labelKey)}
    </span>
  )
}

/** 能力徽章(2026-09-19 D23 立,紫色系与用途分类天蓝徽章区分)
 *  只展示区分度高的 vision/fim —— reasoning/tools 在 latest 对话模型上几乎恒真,
 *  行内常显等于刷屏,它们只参与历史区能力过滤。 */
const MODEL_CAP_BADGES: Array<{ key: ModelCapabilityKey; labelKey: string }> = [
  { key: 'vision', labelKey: 'modelCapVision' },
  { key: 'fim', labelKey: 'modelCapFim' },
]

function ModelCapBadges({ capabilities }: { capabilities?: ModelOption['capabilities'] }) {
  const t = useTranslations('chat')
  if (!capabilities) return null
  return (
    <>
      {MODEL_CAP_BADGES.map(({ key, labelKey }) =>
        capabilities[key] === true ? (
          <span
            key={key}
            className={cn(
              'inline-flex shrink-0 items-center rounded-sm px-1 py-px text-[10px] font-medium leading-tight',
              'bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
            )}
          >
            {t(labelKey)}
          </span>
        ) : null,
      )}
    </>
  )
}

/** 历史模型区能力过滤 chips(2026-09-19 D23 立):与搜索框组合使用,多项 AND */
const CAP_FILTER_ITEMS: Array<{ key: ModelCapabilityKey; labelKey: string }> = [
  { key: 'vision', labelKey: 'modelCapVision' },
  { key: 'reasoning', labelKey: 'modelCapReasoning' },
  { key: 'tools', labelKey: 'modelCapTools' },
  { key: 'fim', labelKey: 'modelCapFim' },
]

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
    // 2026-09-15 bugfix:弹层用 fixed 定位,坐标必须是视口坐标。
    // 原实现叠加 window.scrollY/scrollX,页面滚动后弹层错位(偏移正好等于滚动量)。
    setPos({
      top: rect.top,
      left: rect.right + 8,
    })
    setOpen(true)
  }, [eligible, cancelHide])

  // 渲染后按卡片实际尺寸 clamp,防止右侧/底部溢出视口(与全项目浮层治理一致)
  const cardRef = React.useRef<HTMLDivElement | null>(null)
  React.useLayoutEffect(() => {
    if (!open || !pos || !cardRef.current) return
    const r = cardRef.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(pos.left, window.innerWidth - r.width - 8))
    const top = Math.max(8, Math.min(pos.top, window.innerHeight - r.height - 8))
    if (left !== pos.left || top !== pos.top) setPos({ left, top })
  }, [open, pos])

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
          ref={cardRef}
          role="dialog"
          aria-label={t('modelPopoverMemberTitle')}
          className={cn(
            'fixed z-popover w-64 rounded-lg border bg-card p-3 text-card-foreground shadow-elevation-lg',
            'animate-in fade-in-0 zoom-in-95 duration-(--duration-unified) ease-unified',
          )}
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
        >
          <div className="flex items-start gap-2">
            <Crown className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold">{t('modelPopoverMemberTitle')}</p>
              <p className="mt-1 text-label leading-relaxed text-muted-foreground">
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
              'mt-3 inline-flex h-8 w-full items-center justify-center rounded-sm px-3 text-label font-medium',
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
    // 2026-11-11 立:硬编码种子从未做过连通性探测,一律按未验证展示
    verified: false,
  }))
}

/** /llm/models 响应 → 选择器选项(2026-11-07 从 effect 抽出:刷新按钮复用同一套映射) */
export function buildOptionsFromApi(models: SelectorModel[]): ModelOption[] {
  const merged = new Map<string, ModelOption>()
  for (const m of models) {
    // 1. 已知模型查表(精确 / 子串)
    const known = lookupKnownMeta(m.id)
    // 2. 后端 tier → 显示小数
    const tier =
      typeof m.points_multiplier === 'number' ? m.points_multiplier : inferPointsMultiplier(m.id)
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
      // 2026-09-19 D23 立:语义能力四布尔(后端 derive_capabilities 产出),
      // 驱动历史模型区"按能力过滤"与行内能力徽章;缺失时按未知处理不误藏
      capabilities: m.capabilities,
      // 2026-11-11 立:只有 health_status==='healthy' 才是真 ping 通过;
      // 缺失/unknown/pending 均不可依赖,按未验证处理
      verified: m.health_status === 'healthy',
      healthError: m.health_error,
      // 2026-11-11 立:实测能力原样透传,缺失即 undefined(=三段未知)
      capsVerified: m.caps_verified,
    })
  }
  return Array.from(merged.values())
}

/**
 * 平台模型 + 个人号池模型合并(2026-11-10 立)。
 *
 * 平台登记行优先(带展示名/定价/代次,可参与折叠与筛选);号池独有的模型
 * (未登记,id 形如 `<平台>/<上游模型名>`)才追加到末尾。pointsMultiplier=0:
 * 走的是用户自己的平台账号,不产生平台积分消耗,显示为免费档。
 */
function withPoolModels(base: ModelOption[], pool: PoolChatModel[]): ModelOption[] {
  if (pool.length === 0) return base
  const seen = new Set(base.map((o) => o.value))
  for (const m of pool) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    base.push({
      value: m.id,
      label: m.name || m.id,
      // 2026-11-12 立:打上号池通道标记 —— 发送路径据此走 /ws/relay/chat 而非 agent runtime
      channel: 'pool',
      // 用平台 code 当 vendor:命中 VENDOR_LABEL 的(豆包/MiniMax 等)显示中文名,
      // 其余按品牌 code 原样分组,语义就是「这是我名下某个平台的号」
      vendor: m.provider,
      pointsMultiplier: 0,
      // 2026-11-11 立:个人号池模型未做连通性探测,按未验证展示并说明原因
      verified: false,
      healthError: '个人号池模型,未做连通性探测',
    })
  }
  return base
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

export function ModelSelector({
  value,
  onChange,
  disabled,
  label,
  autoResolvedModel,
  footer,
}: ModelSelectorProps) {
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
  // 2026-11-07 立:手动"刷新模型状态"期间按钮转圈并轮询后端进度
  const [refreshingModels, setRefreshingModels] = React.useState(false)
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
  // 异步回调(刷新/重拉列表)里读最新的 onChange;
  // 宿主传入的 onChange 多为内联箭头函数,若放进依赖会导致 effect 反复重跑。
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  React.useEffect(() => {
    if (!authedWithToken) {
      // 登出/未登录:回到初始演示态并**结束加载态**。原实现停在 loading=true ⇒ 按钮
      // 永远转圈且点不开,访客连当前模型名都读不到,看起来像坏了。
      // 重置为 seed 档即可满足"不残留上一会话的 API 模型列表",无需用 loading 代替禁用。
      setOptions(createSeedOptions())
      setUseApiOnly(false)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    // 平台模型 + 我的号池并行拉:两条腿各自吞错返回 [],谁空都不影响另一条
    Promise.all([fetchSelectorModels(), fetchPoolChatModels()])
      .then(([models, poolModels]) => {
        if (cancelled) return
        if (models.length === 0 && poolModels.length === 0) {
          // API 空/失败:恢复 FALLBACK + DEMO 降级列表(由 grouped 按真实配置过滤)
          setUseApiOnly(false)
          setOptions(createSeedOptions())
          return
        }
        // 2026-08-27:API 成功(后端已按可用性+配额过滤)→ 只展示后端返回的模型。
        // 2026-11-07:映射逻辑抽到 buildOptionsFromApi,手动刷新复用同一套。
        const next = withPoolModels(buildOptionsFromApi(models), poolModels)
        setOptions(next)
        setUseApiOnly(true)
        // 当前选中模型已不可用(不在 API 列表)→ 自动切回 auto,避免 trigger 指向死模型
        if (
          valueRef.current !== AUTO_OPTION.value &&
          !next.some((o) => o.value === valueRef.current)
        ) {
          onChangeRef.current(AUTO_OPTION.value)
        }
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

  /** 重拉模型列表(手动刷新 / 打开菜单节流复用) */
  const reloadModels = React.useCallback(async () => {
    try {
      const [models, poolModels] = await Promise.all([fetchSelectorModels(), fetchPoolChatModels()])
      if (models.length === 0 && poolModels.length === 0) return
      const next = withPoolModels(buildOptionsFromApi(models), poolModels)
      setOptions(next)
      setUseApiOnly(true)
      // 刷新后当前模型若已被判死 → 自动切回 auto
      if (
        valueRef.current !== AUTO_OPTION.value &&
        !next.some((o) => o.value === valueRef.current)
      ) {
        onChangeRef.current(AUTO_OPTION.value)
      }
    } catch {
      // 静默:保留当前列表
    }
  }, [])

  const reloadProvidersHealth = React.useCallback(async () => {
    try {
      const list = await fetchProvidersHealth()
      const map: Record<string, ProviderHealth> = {}
      for (const h of list) map[h.provider] = h
      setHealthByVendor(map)
    } catch {
      // 静默
    }
  }, [])

  /**
   * 手动刷新模型可用性(2026-11-07 立):
   * 触发后端逐模型复测 → 轮询进度 → 重拉列表。探测是异步的,
   * 最多等 4 分钟;超时也重拉一次,剩余进度由后端继续跑完。
   */
  const refreshModels = React.useCallback(async () => {
    if (refreshingModels) return
    setRefreshingModels(true)
    try {
      const started = await triggerModelHealthRefresh()
      if (started) {
        // 全量探测最坏耗时 ≈ 457 × 20s ÷ 8 并发 ≈ 19 分钟,等待上限必须覆盖该场景;
        // 正常网络下通常 1~2 分钟完成,status.running 变 false 即提前退出。
        const deadline = Date.now() + 1_200_000
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 1500))
          const status = await fetchModelHealthRefreshStatus()
          if (!status || !status.running) break
        }
      }
      await reloadModels()
      await reloadProvidersHealth()
    } catch {
      // 静默:失败时保留原列表
    } finally {
      setRefreshingModels(false)
    }
  }, [refreshingModels, reloadModels, reloadProvidersHealth])

  const isAuto = value === AUTO_OPTION.value
  const current = React.useMemo(
    () => (isAuto ? AUTO_OPTION : options.find((m) => m.value === value)),
    [options, value, isAuto],
  )
  // 2026-11-11 用户要求:auto 模式下 trigger 显示「当前对话实际用的模型」而非「自动」——
  // auto 是路由模式没有固定名字,但对话里已经跑过一轮,真实模型由宿主(autoResolvedModel)传入,
  // 与最小化 FAB 图标同一信号源(消息 model → usage 真实计费模型 → 选择器)。
  const autoResolved =
    isAuto && autoResolvedModel && autoResolvedModel !== 'auto' ? autoResolvedModel : null
  const resolvedMeta = React.useMemo(() => {
    if (!autoResolved) return null
    const opt = options.find((o) => o.value === autoResolved)
    if (opt) return { label: opt.label, vendor: opt.vendor, iconUrl: opt.iconUrl }
    const known = lookupKnownMeta(autoResolved)
    return {
      label: known.label ?? autoResolved,
      vendor: known.vendor ?? inferVendor(autoResolved),
      iconUrl: known.iconUrl,
    }
  }, [autoResolved, options])
  // 2026-08-29 立:默认区(最新最强)/ 历史模型区(过时版本 + 专用模型)
  const { primary, archived } = React.useMemo(() => splitByTier(options), [options])
  const [showHistory, setShowHistory] = React.useState(false)
  const [historyQuery, setHistoryQuery] = React.useState('')
  // 2026-09-19 D23 立:历史模型区能力过滤(视觉/推理/工具/补全)。
  // 空集 = 不过滤;多项之间 AND(所有激活能力都为 true 才保留)。
  const [capFilter, setCapFilter] = React.useState<Set<ModelCapabilityKey>>(() => new Set())

  const toggleCapFilter = React.useCallback((key: ModelCapabilityKey) => {
    setCapFilter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  /**
   * 派生展开态:默认列表为空时强制展开历史模型。
   * 后端 model_tier 字段是可选的,老后端 / 缓存数据缺失时若整批被判成非 latest,
   * 用户会看到空列表以为功能坏了 —— 这是不可接受的失败态,故用派生值兜底。
   * 用户仍可手动收起(toggle 走 setShowHistory(!historyExpanded))。
   */
  const historyExpanded = showHistory || (primary.length === 0 && archived.length > 0)

  /** 历史模型区:搜索过滤 + 能力过滤 + 按用途分类分组 */
  const archivedGroups = React.useMemo(() => {
    const q = historyQuery.trim().toLowerCase()
    let filtered = q
      ? archived.filter(
          (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
        )
      : archived
    // D23:搜索之后再按激活能力过滤(AND 语义),capabilities 缺失的模型不误藏
    filtered = filterByCapabilities(filtered, Array.from(capFilter))
    return groupByCategory(filtered)
  }, [archived, historyQuery, capFilter])

  const groupedByVendor = React.useMemo(() => {
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

  /**
   * 2026-11-11 立:未验证模型不与已验证模型混排 —— 从各厂商组抽离,
   * 按 groupByVendor 的原有分组顺序统一收进 primary 末尾的独立组。
   */
  const { grouped, unverifiedPrimary } = React.useMemo(() => {
    const verifiedGroups: Array<[string, ModelOption[]]> = []
    const unverified: ModelOption[] = []
    for (const [vendor, items] of groupedByVendor) {
      const verifiedItems = items.filter((opt) => !isUnverified(opt))
      if (verifiedItems.length > 0) verifiedGroups.push([vendor, verifiedItems])
      unverified.push(...items.filter((opt) => isUnverified(opt)))
    }
    return { grouped: verifiedGroups, unverifiedPrimary: unverified }
  }, [groupedByVendor])

  // API 成功路径下后端已保证模型可用,直接视为已配置(避免 agnes 等误显示 ⚠/缺失 ✅)
  const currentConfigured = useApiOnly
    ? true
    : isConfiguredVendor(current?.vendor, configuredTemplateCodes)
  const showConfigBadge = cfgData !== undefined

  // D117 /model 斜杠命令(2026-09-27):程序化打开选择器。
  // Radix DropdownMenu 受控 open,trigger 常驻 DOM ⇒ 程序化置 true 时
  // content 仍以 trigger 为锚定位,无需额外坐标。
  const [menuOpen, setMenuOpen] = React.useState(false)
  // 打开菜单时节流重拉(60s):重新打开能看到最新可用列表,又不至于每次都打接口
  const lastMenuReloadRef = React.useRef(0)
  React.useEffect(() => {
    if (!menuOpen || !authedWithToken) return
    if (Date.now() - lastMenuReloadRef.current < 60_000) return
    lastMenuReloadRef.current = Date.now()
    void reloadModels()
  }, [menuOpen, authedWithToken, reloadModels])
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onOpen = () => setMenuOpen(true)
    window.addEventListener('ihui:model-selector:open', onOpen)
    return () => window.removeEventListener('ihui:model-selector:open', onOpen)
  }, [])

  return (
    <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled || loading}
          aria-label={label}
          // 2026-11-11 用户定档:工具栏模型按钮去描边去底色(ghost 化),与「添加」等
          // 工具栏按钮同一视觉语言;hover 才出底色。
          className={cn(
            'inline-flex h-8 min-w-0 items-center gap-1 rounded-sm px-2 text-body font-medium transition-colors',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          <BrandIconDeferred
            vendor={resolvedMeta?.vendor ?? current?.vendor}
            iconUrl={resolvedMeta?.iconUrl ?? current?.iconUrl}
            size={16}
            className="shrink-0 text-muted-foreground"
          />
          {loading ? (
            <Loader2 className="model-selector-loading h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            // 2026-11-11:去掉 6rem 上限,空间足够时完整显示模型名;min-w-0 truncate 仅作极窄视口兜底
            <span className="model-selector-text min-w-0 truncate">
              {resolvedMeta?.label ??
                (current ? (current.value === 'auto' ? t('modelAuto') : current.label) : value)}
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
            'z-popover max-h-[60vh] w-fit max-w-[320px] overflow-y-auto rounded-lg border bg-card p-1 text-card-foreground shadow-elevation-md',
            ' [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30',
          )}
        >
          {/* 自定义配置模型入口 */}
          <DropdownMenu.Group>
            <DropdownMenu.Item
              onSelect={() => router.push('/settings/llm')}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-body outline-none',
                'focus:bg-accent focus:text-accent-foreground',
                '[&>span]:translate-y-[var(--text-vcenter-offset)]',
              )}
            >
              <div className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Settings className="h-3.5 w-3.5" />
              </div>
              <span className="flex-1 truncate font-medium">{t('manageModels')}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={(e) => {
                // preventDefault 保持菜单打开,便于看到进度文案变化
                e.preventDefault()
                void refreshModels()
              }}
              disabled={refreshingModels}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-body outline-none',
                'focus:bg-accent focus:text-accent-foreground',
                '[&>span]:translate-y-[var(--text-vcenter-offset)]',
                refreshingModels && 'cursor-default opacity-70',
              )}
            >
              <div className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <RefreshCw className={cn('h-3.5 w-3.5', refreshingModels && 'animate-spin')} />
              </div>
              <span className="flex-1 truncate font-medium">
                {refreshingModels ? t('modelRefreshRunning') : t('modelRefresh')}
              </span>
            </DropdownMenu.Item>
            {grouped.length > 0 && <DropdownMenu.Separator className="my-1 h-px bg-border/60" />}
          </DropdownMenu.Group>
          {/* 自动选项(2026-08-06 改:自动模式显示 "Auto Mode" + "0.05x" 风格,
              实际无积分倍数,保持纯文本 "自动" + 描述) */}
          <DropdownMenu.Group>
            <DropdownMenu.Item
              onSelect={() => onChange(AUTO_OPTION.value)}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-body outline-none',
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
                  'flex items-center gap-1.5 px-2 py-1.5 text-label font-semibold uppercase tracking-wide',
                  'bg-card text-muted-foreground',
                )}
              >
                <BrandIconDeferred vendor={vendor} size={12} className="text-muted-foreground" />
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
                  onSelect={() => onChange(opt.value, opt.channel)}
                />
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-border/60 last:hidden" />
            </DropdownMenu.Group>
          ))}

          {/* 2026-11-11 立:未验证模型独立收口。不把未探测通过的模型混在各厂商组里
              (当前 34/53 是 pending 的平台中转模型,混排会误导用户),组内仍按厂商顺序排列。 */}
          {unverifiedPrimary.length > 0 && (
            <DropdownMenu.Group>
              <DropdownMenu.Separator className="my-1 h-px bg-border/60" />
              <DropdownMenu.Label
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 text-label font-semibold uppercase tracking-wide',
                  'bg-card text-muted-foreground',
                )}
              >
                <span className="flex-1 truncate">
                  {t('modelUnverifiedGroup', { count: unverifiedPrimary.length })}
                </span>
              </DropdownMenu.Label>
              {unverifiedPrimary.map((opt) => (
                <ModelOptionRow
                  key={opt.value}
                  opt={opt}
                  active={opt.value === value && value !== AUTO_OPTION.value}
                  warning={
                    showConfigBadge &&
                    !useApiOnly &&
                    !isConfiguredVendor(opt.vendor, configuredTemplateCodes)
                  }
                  onSelect={() => onChange(opt.value, opt.channel)}
                />
              ))}
            </DropdownMenu.Group>
          )}

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
                  'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-body outline-none',
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
                    <SearchInput
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder={t('modelHistorySearch')}
                      aria-label={t('modelHistorySearch')}
                      size="sm"
                      wrapperClassName="w-full"
                    />
                  </div>
                  {/* 2026-09-19 D23 立:历史区能力过滤 chips,与搜索框组合使用,多项 AND;
                      未知 capabilities 的模型不受过滤影响(宁可多显示也不误藏) */}
                  <div className="flex flex-wrap gap-1 px-2 pb-1.5">
                    {CAP_FILTER_ITEMS.map(({ key, labelKey }) => {
                      const on = capFilter.has(key)
                      return (
                        <DropdownMenu.Item
                          key={key}
                          onSelect={(e) => {
                            // preventDefault 阻止 Radix 选中后自动关闭菜单
                            e.preventDefault()
                            toggleCapFilter(key)
                          }}
                          className={cn(
                            'inline-flex cursor-pointer select-none items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium outline-none',
                            'focus:bg-accent focus:text-accent-foreground',
                            on
                              ? 'border-violet-500/40 bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
                              : 'border-border bg-muted/50 text-muted-foreground',
                          )}
                        >
                          {t(labelKey)}
                        </DropdownMenu.Item>
                      )
                    })}
                  </div>
                  {archivedGroups.length === 0 ? (
                    <div className="px-2 py-3 text-center text-label text-muted-foreground">
                      {t('modelHistoryEmpty')}
                    </div>
                  ) : (
                    archivedGroups.map(([cat, items]) => (
                      <DropdownMenu.Group key={cat}>
                        <DropdownMenu.Label
                          className={cn(
                            'flex items-center gap-1.5 bg-card px-2 py-1.5',
                            'text-label font-semibold uppercase tracking-wide text-muted-foreground',
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
                            onSelect={() => onChange(opt.value, opt.channel)}
                          />
                        ))}
                      </DropdownMenu.Group>
                    ))
                  )}
                </>
              )}
            </DropdownMenu.Group>
          )}
          {/* footer 扩展段(2026-09-30 底栏单行化):推理强度轴 + 采样参数等模型相关调参。
              非 DropdownMenu.Item 的普通节点:点击/键盘不会触发 Radix 自动关单,
              内部交互(档位切换/抽屉唤起)与弹层共存。 */}
          {footer ? <div className="border-t px-1 pb-1 pt-1.5">{footer}</div> : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
      {/* 2026-08-12 bugfix:升级权益 popover 已收敛到 MemberDiscountSection 内部,
          hover 状态自包含,父组件不再持有 popoverAnchor / 渲染顶层 popover。 */}
    </DropdownMenu.Root>
  )
}

export default ModelSelector
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
