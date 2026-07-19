'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { Check, CheckCircle2, ChevronDown, Loader2, TriangleAlert } from 'lucide-react'
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
            'inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm font-medium transition-colors',
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
            className="text-muted-foreground"
          />
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <span className="hidden max-w-[12rem] truncate sm:inline">
              {current?.label ?? value}
            </span>
          )}
          {/* 配置感知徽章:已配置 → 绿色 ✓,未配置 → 琥珀 ⚠
              引导用户到模型广场页 /settings/llm 或模型详情对话框里配置 */}
          {showConfigBadge && !loading && (
            currentConfigured ? (
              <CheckCircle2
                className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                aria-label={t('modelConfigured')}
              />
            ) : (
              <TriangleAlert
                className="h-3.5 w-3.5 shrink-0 text-amber-500"
                aria-label={t('modelNotConfigured')}
              />
            )
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
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
