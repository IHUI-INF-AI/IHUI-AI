'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Settings,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { fetchSelectorModels, fetchProvidersHealth, type ProviderHealth } from '@/lib/models-api'
import { BrandIcon, inferVendor } from '@/components/ai/brand-icon'
import {
  FALLBACK_MODELS,
  VENDOR_LABEL,
  type FallbackModel,
} from '@/components/chat/fallback-models'
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
  /** 积分消耗倍数(0=免费/1=经济/3=标准/10=高级/30=旗舰),未设置则不显示徽章 */
  pointsMultiplier?: number
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

/** 将 FallbackModel 转换为 ModelOption */
function toOption(m: FallbackModel): ModelOption {
  return {
    value: m.value,
    label: m.label,
    vendor: m.vendor,
    descriptionKey: m.descriptionKey,
    pointsMultiplier: inferPointsMultiplier(m.value),
  }
}

/** 积分消耗倍数前端兜底推断(API 未返回 pointsMultiplier 时按 modelId 关键词推断)
 *  档位:0=免费 / 1=经济 / 3=标准 / 10=高级 / 30=旗舰 */
function inferPointsMultiplier(modelId: string): number {
  const mid = (modelId || '').toLowerCase()
  // 优先 mini/nano/haiku(避免 gpt-4o-mini 被标准层 gpt-4o 遮蔽,o1-mini 被 o1 遮蔽)
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

/** Provider 健康状态 → 圆点徽章 + tooltip(Phase C+D 三态:绿/红/灰,装饰点豁免 rounded-full)
 *  hover 显示 "延迟 Xms · N 个模型可用"(用原生 title 属性,避免新建 Tooltip 组件) */
function ProviderHealthDot({ health }: { health: ProviderHealth }) {
  const t = useTranslations('chat')
  const tip = t('providerHealthTip', { latency: health.latency_ms, count: health.model_count })
  return (
    <span
      title={tip}
      aria-label={tip}
      className={cn(
        'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
        health.status === 'ok' && 'bg-green-500',
        health.status === 'invalid_key' && 'bg-red-500',
        health.status === 'unreachable' && 'bg-muted-foreground/40',
      )}
    />
  )
}

/** 按厂商分组模型,返回有序的 [vendor, items[]] 数组 */
function groupByVendor(options: ModelOption[]): Array<[string, ModelOption[]]> {
  const map = new Map<string, ModelOption[]>()
  for (const opt of options) {
    const vendor = opt.vendor ?? inferVendor(opt.value) ?? 'other'
    if (!map.has(vendor)) map.set(vendor, [])
    map.get(vendor)!.push(opt)
  }
  // 按 VENDOR_LABEL 的顺序排序,未知厂商排在最后
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

export function ModelSelector({ value, onChange, disabled, label }: ModelSelectorProps) {
  const t = useTranslations('chat')
  const router = useRouter()
  const [options, setOptions] = React.useState<ModelOption[]>(() => FALLBACK_MODELS.map(toOption))
  const [loading, setLoading] = React.useState(true)
  // Phase C+D:provider 健康状态(provider → ProviderHealth),mount 时拉取一次,空对象时不渲染徽章
  const [healthByVendor, setHealthByVendor] = React.useState<Record<string, ProviderHealth>>({})

  // 拉取用户已保存的 LLM 配置(用于在 model-selector 里显示 ✓/⚠ 配置感知徽章)
  // retry: false + throwOnError: false:未登录或网络异常时静默失败,不阻塞选择器渲染
  const { data: cfgData } = useQuery({
    queryKey: ['user-llm-configs'],
    queryFn: () => fetchConfigs(),
    retry: false,
    throwOnError: false,
    staleTime: 60_000,
  })
  // 已配置(且启用)的 templateCode 集合,用于快速 O(1) 查询
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
    // 2026-08-02 修复:改用 fetchSelectorModels(@/lib/models-api)。
    // 原 fetchModels(@ihui/api-client)走 fetchApi 校验 {code:0} 信封,而 ai-service
    // /llm/models 返回非标准格式 {models,...}(无 code 字段)→ 被误判业务失败 throw →
    // 选择器恒降级到 FALLBACK_MODELS(仅 3 个模型)。fetchSelectorModels 用
    // fetchAiServiceJson 直接消费 body,返回完整模型列表(DB 1380 enabled + default_models)。
    fetchSelectorModels()
      .then((models) => {
        if (cancelled) return
        if (models.length === 0) {
          setOptions(FALLBACK_MODELS.map(toOption))
          return
        }
        setOptions(
          models.map((m) => ({
            value: m.id,
            label: m.name || m.id,
            // 2026-08-02 修复:优先用后端权威 provider(避免 inferVendor 误判导致分组错乱,
            // 如 ollama/lmstudio 的 llama 模型被归入 meta、nvidia 的 deepseek/snowflake 系被归入对应厂商)
            vendor: m.provider || inferVendor(m.id),
            // 后端 points_multiplier(free_provider_registry 推断)优先,缺失时本地推断兜底
            pointsMultiplier:
              typeof m.points_multiplier === 'number'
                ? m.points_multiplier
                : inferPointsMultiplier(m.id),
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setOptions(FALLBACK_MODELS.map(toOption))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Phase C+D:mount 时拉取一次 provider 健康状态(不轮询,30s 缓存在 models-api 层)
  // 失败静默:healthByVendor 保持空对象 → 不渲染徽章,不阻塞选择器
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
        // 静默:无徽章渲染
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 性能修复(2026-07-25):用 useMemo 缓存 find + groupByVendor 结果,
  // 避免 ModelSelector 每次父级重渲染(由根因 #2 AISidePanel 高频渲染带动)都重算分组。
  // 2026-07-31:'auto' 降级到 stepfun/step-router-v1 后,value 永远不是 'auto'。
  // 当 value === 'stepfun/step-router-v1' 时优先匹配 AUTO_OPTION(用户选的是"自动"),
  // 即使该模型也在 options 列表里(FALLBACK_MODELS 含此项),也显示"自动"而非裸模型名。
  const current = React.useMemo(
    () =>
      value === 'stepfun/step-router-v1' ? AUTO_OPTION : options.find((m) => m.value === value),
    [options, value],
  )
  const grouped = React.useMemo(() => groupByVendor(options), [options])

  // 当前选中模型是否已配置(根据 vendor 映射到 templateCode 后查 configuredTemplateCodes)
  const currentTemplateCode = current?.vendor ? providerToTemplateCode(current.vendor) : null
  const currentConfigured = currentTemplateCode
    ? configuredTemplateCodes.has(currentTemplateCode)
    : false
  // cfgData 加载完成才显示徽章(避免登录前闪烁)
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
            // 2026-07-19 中文 + 图标垂直对齐:文字 span 视觉居中
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
            /* 2026-07-20 修复底部工具栏溢出(双策略),2026-07-25 修正阈值:
               1. span max-w 从 12rem(192px) 收缩到 6rem(96px),常规宽度下不挤占其他按钮
               2. 原生 CSS container query(在 globals.css .ai-input-toolbar 规则中):
                  工具栏 container 内容盒 <= 299px(面板 <= 347px)时 .model-selector-text 隐藏,
                  只显示 BrandIcon + chevron,保证最窄 320px 面板也能完整显示所有按钮。
                  原阈值 359px 误把"container 内容盒宽"当"面板内容宽",导致默认 400px 面板
                  (container 352 < 359)时 text 被隐藏,即使有 80px slack 可用。
                  badge 阈值保留 359px(面板 <= 407px 时隐藏),优先让 text 在更多面板宽度下可见。
               不用 Tailwind hidden min-[640px]:inline 模式:
               实测 Tailwind v4 把 min-[640px]:inline 编译为裸类(无 @media 包裹)且顺序在 .hidden 之后,
               导致 specificity 相同时由顺序决定胜负,400px 默认宽度下 span 仍隐藏。
               改为不带任何 Tailwind display 类,默认 span inline,container query 决定隐藏。 */
            <span className="model-selector-text min-w-0 max-w-[6rem] truncate">
              {current ? (current.value === 'auto' ? t('modelAuto') : current.label) : value}
            </span>
          )}
          {/* 配置感知徽章:已配置 → 绿色 ✓,未配置 → 琥珀 ⚠
              引导用户到模型广场页 /settings/llm 或模型详情对话框里配置
              2026-07-25 原生 CSS container query:container <= 359px(面板 <= 407px)时隐藏,
              badge 占 20px,仅在宽面板显示以避免挤占 text 空间(详见 globals.css 注释) */}
          {showConfigBadge &&
            !loading &&
            (currentConfigured ? (
              <CheckCircle2
                className="model-selector-badge h-3.5 w-3.5 shrink-0 text-emerald-500"
                aria-label={t('modelConfigured')}
              />
            ) : (
              <TriangleAlert
                className="model-selector-badge h-3.5 w-3.5 shrink-0 text-amber-500"
                aria-label={t('modelNotConfigured')}
              />
            ))}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-popover max-h-[60vh] w-fit max-w-[300px] overflow-y-auto rounded-lg border bg-card p-1 text-card-foreground shadow-md',
            ' [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30',
          )}
        >
          {/* 自定义配置模型入口(置顶):跳转 /settings/llm 配置 API Key
              2026-07-20 用户反馈"丢失了自定义配置模型的选项按钮",补回此入口,
              位置由原先埋在某个模型组中改为整张下拉的最顶部,确保一键可达。
              2026-07-20 视觉强化:Settings 图标用 bg-primary/10 + text-primary 圆角小色块包裹,
              与下方普通模型选项(纯 muted-foreground svg)形成区分,语义上更明确表达
              "这是配置入口,不是模型选项"。色块用 div 而非 span 包裹,避免被
              [&>span]:translate-y-[var(--text-vcenter-offset)] 规则错误偏移图标。 */}
          <DropdownMenu.Group>
            <DropdownMenu.Item
              onSelect={() => router.push('/settings/llm')}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
                'focus:bg-accent focus:text-accent-foreground',
                // 2026-07-19 中文 + 图标垂直对齐:文字 span 视觉居中
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
          {/* 自动选项(独立分组,置顶于所有模型分组之前,2026-07-22 立)
              value='auto' 时后端根据任务类型自动选择最优模型(对标 Qoder Auto 模型调度)
              2026-07-30 用户反馈"智能路由"措辞太复杂,简化为"自动" */}
          <DropdownMenu.Group>
            <DropdownMenu.Item
              onSelect={() => onChange('stepfun/step-router-v1')}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
                'focus:bg-accent focus:text-accent-foreground',
                '[&>span]:translate-y-[var(--text-vcenter-offset)]',
              )}
            >
              <Check
                className={cn(
                  'h-4 w-4 shrink-0',
                  value === 'stepfun/step-router-v1' ? 'opacity-100' : 'opacity-0',
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
                // 2026-07-31:'stepfun/step-router-v1' 已被 Auto 选项占用(降级映射),
                // 排除避免 Auto + 常规项双勾(FALLBACK_MODELS 含此模型)
                const active = opt.value === value && value !== 'stepfun/step-router-v1'
                // 计算当前模型选项的配置状态(根据 vendor 映射到 templateCode)
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
                    </div>
                    {/* 配置感知徽章:已配置 → 绿色 ✓,未配置 → 琥珀 ⚠
                        (仅在 cfgData 加载完成后显示,避免登录前闪烁) */}
                    {showConfigBadge &&
                      (optConfigured ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      ))}
                  </DropdownMenu.Item>
                )
              })}
              <DropdownMenu.Separator className="my-1 h-px bg-border/60 last:hidden" />
            </DropdownMenu.Group>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export default ModelSelector
