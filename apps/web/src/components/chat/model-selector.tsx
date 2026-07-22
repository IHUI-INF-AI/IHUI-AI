'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Check, CheckCircle2, ChevronDown, Loader2, Settings, Sparkles, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { fetchModels } from '@ihui/api-client'

import { cn } from '@/lib/utils'
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
}

/** 智能路由模型选项(2026-07-22 立,对标 Qoder Auto 模型调度)
 * value='auto' 表示由后端根据任务类型自动选择最优模型,
 * 在下拉列表中作为独立分组置顶显示 */
const AUTO_OPTION: ModelOption = {
  value: 'auto',
  label: '智能路由',
  descriptionKey: 'modelAutoRoute',
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
  return { value: m.value, label: m.label, vendor: m.vendor, descriptionKey: m.descriptionKey }
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
    fetchModels()
      .then((res) => {
        if (cancelled) return
        const models = res?.models ?? []
        if (models.length === 0) {
          setOptions(FALLBACK_MODELS.map(toOption))
          return
        }
        setOptions(
          models.map((m) => ({
            value: m.id,
            label: m.name || m.id,
            vendor: inferVendor(m.id) ?? m.provider,
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

  const current = options.find((m) => m.value === value)
  const grouped = groupByVendor(options)

  // 当前选中模型是否已配置(根据 vendor 映射到 templateCode 后查 configuredTemplateCodes)
  const currentTemplateCode = current?.vendor
    ? providerToTemplateCode(current.vendor)
    : null
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
            /* 2026-07-20 修复底部工具栏溢出(双策略):
               1. span max-w 从 12rem(192px) 收缩到 6rem(96px),常规宽度下不挤占其他按钮
               2. 原生 CSS container query(在 globals.css .ai-input-toolbar 规则中):
                  工具栏容器 <= 359px(对应面板 <= 391px)时 .model-selector-text 隐藏,
                  只显示 BrandIcon + chevron,保证最窄 320px 面板也能完整显示所有按钮。
               不用 Tailwind hidden sm:inline 模式:
               实测 Tailwind v4 把 sm:inline 编译为裸类(无 @media 包裹)且顺序在 .hidden 之后,
               导致 specificity 相同时由顺序决定胜负,400px 默认宽度下 span 仍隐藏。
               改为不带任何 Tailwind display 类,默认 span inline,container query 决定隐藏。 */
            <span className="model-selector-text min-w-0 max-w-[6rem] truncate">
              {current?.label ?? value}
            </span>
          )}
          {/* 配置感知徽章:已配置 → 绿色 ✓,未配置 → 琥珀 ⚠
              引导用户到模型广场页 /settings/llm 或模型详情对话框里配置
              2026-07-20 原生 CSS container query:窄面板(<= 391px)时与 span 同步隐藏 */}
          {showConfigBadge && !loading && (
            currentConfigured ? (
              <CheckCircle2
                className="model-selector-badge h-3.5 w-3.5 shrink-0 text-emerald-500"
                aria-label={t('modelConfigured')}
              />
            ) : (
              <TriangleAlert
                className="model-selector-badge h-3.5 w-3.5 shrink-0 text-amber-500"
                aria-label={t('modelNotConfigured')}
              />
            )
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-popover max-h-[60vh] min-w-[16rem] overflow-y-auto rounded-lg border bg-card p-1 text-card-foreground shadow-md',
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
            {grouped.length > 0 && (
              <DropdownMenu.Separator className="my-1 h-px bg-border/60" />
            )}
          </DropdownMenu.Group>
          {/* 智能路由选项(独立分组,置顶于所有模型分组之前,2026-07-22 立)
              value='auto' 时后端根据任务类型自动选择最优模型(对标 Qoder Auto 模型调度) */}
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
                className={cn('h-4 w-4 shrink-0', value === AUTO_OPTION.value ? 'opacity-100' : 'opacity-0')}
              />
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{AUTO_OPTION.label}</span>
                <span className="truncate text-xs text-muted-foreground">自动选择最优模型</span>
              </div>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-border/60" />
          </DropdownMenu.Group>
          {grouped.map(([vendor, items]) => (
            <DropdownMenu.Group key={vendor}>
              <DropdownMenu.Label
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide',
                  'sticky top-0 z-10 bg-card text-muted-foreground',
                )}
              >
                <BrandIcon vendor={vendor} size={12} className="text-muted-foreground" />
                {VENDOR_LABEL[vendor] || vendor}
              </DropdownMenu.Label>
              {items.map((opt) => {
                const active = opt.value === value
                // 计算当前模型选项的配置状态(根据 vendor 映射到 templateCode)
                const optTemplateCode = opt.vendor
                  ? providerToTemplateCode(opt.vendor)
                  : null
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
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{opt.label}</span>
                      {opt.descriptionKey && (
                        <span className="truncate text-xs text-muted-foreground">
                          {t(opt.descriptionKey)}
                        </span>
                      )}
                    </div>
                    {/* 配置感知徽章:已配置 → 绿色 ✓,未配置 → 琥珀 ⚠
                        (仅在 cfgData 加载完成后显示,避免登录前闪烁) */}
                    {showConfigBadge && (
                      optConfigured ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      )
                    )}
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
