// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  BarChart3,
  BookOpen,
  Bot,
  Calendar,
  Database,
  FileText,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Settings,
  Sparkles,
  Table,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import type {
  CapabilityAppAction,
  CapabilityAppBlock,
  CapabilityAppCallName,
  CapabilityAppDataSource,
  CapabilityAppField,
  CapabilityAppRecord,
  CapabilityAppTone,
} from '@ihui/types'
import { invokeCapabilityApp } from '@ihui/api-client'
import { cn } from '@/lib/utils'
import { toast } from '@/components/common'

/**
 * 能力应用渲染器(2026-11-13 立)
 *
 * 纪律:
 *  - 只渲染**白名单**块;块注册表写成 Record<Kind, Component>,词表加档而这里没跟上 ⇒ 编译期即红。
 *  - 不执行任何来自 spec 的代码:没有 innerHTML、没有 eval、没有动态 import。
 *  - 数据绑定只允许同源 GET(服务端已校验 `/api/` 前缀),此处再判一次,双保险。
 *  - 应用动作 `agent` 走既有对话链路(sessionStorage 草稿 + 跳 /chat),与模板页同一套路。
 */

const ICONS: Record<string, LucideIcon> = {
  'layout-grid': LayoutGrid,
  sparkles: Sparkles,
  bot: Bot,
  'file-text': FileText,
  'bar-chart': BarChart3,
  table: Table,
  'list-checks': ListChecks,
  settings: Settings,
  zap: Zap,
  database: Database,
  'message-square': MessageSquare,
  calendar: Calendar,
  wallet: Wallet,
  'book-open': BookOpen,
}

/** 图标只认内置表;未知名回落 LayoutGrid(不加载远端资源)。 */
export function CapabilityAppIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name ? ICONS[name] : undefined) ?? LayoutGrid
  return <Icon className={className} aria-hidden />
}

const TONE_CLASS: Record<CapabilityAppTone, string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
}

// ===========================================================================
// 动作
// ===========================================================================

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g, (_m, key: string) => {
    return values[key] ?? ''
  })
}

interface ActionDeps {
  appId: string
  navigate: (path: string) => void
  refresh: () => void
  /** 把能力调用结果写回绑定,任何 `from: <key>` 的块随即重渲染 */
  writeBinding: (key: string, value: unknown) => void
}

/**
 * 执行一个声明式动作。
 *
 * `tool` 是唯一会出网的档:名字必须是白名单能力,参数只做 `{{field}}` 插值,
 * 没有任何地址/方法/请求头可被 spec 影响 —— 这是「声明式 UI 不携带入口」的延续。
 */
async function executeAction(
  action: CapabilityAppAction,
  values: Record<string, string>,
  deps: ActionDeps,
): Promise<void> {
  switch (action.type) {
    case 'navigate': {
      const target = interpolate(action.path, values)
      if (!target.startsWith('/') || target.startsWith('//')) return
      deps.navigate(target)
      return
    }
    case 'copy': {
      const text = interpolate(action.text, values)
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(text).then(
          () => toast.success('已复制'),
          () => toast.error('复制失败'),
        )
      }
      return
    }
    case 'agent': {
      const prompt = interpolate(action.prompt, values)
      if (!prompt.trim()) return
      // 与 app/(main)/chat/templates 同一套路:把内容写进对话草稿再跳转。
      try {
        sessionStorage.setItem('chat-draft', prompt)
      } catch {
        // 隐私模式下不可写:仍然跳转,由用户自行粘贴
      }
      deps.navigate('/chat')
      return
    }
    case 'submit': {
      if (action.prompt) {
        await executeAction({ type: 'agent', prompt: action.prompt }, values, deps)
        return
      }
      deps.refresh()
      return
    }
    case 'tool': {
      const args: Record<string, string> = {}
      for (const [key, raw] of Object.entries(action.args ?? {})) {
        args[key] = interpolate(raw, values)
      }
      try {
        const payload = await invokeCapabilityApp(deps.appId, action.call, args)
        if (action.into) deps.writeBinding(action.into, payload.result)
        toast.success(`调用完成 · ${payload.elapsedMs}ms`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '调用失败')
      }
      return
    }
    default:
      deps.refresh()
  }
}

// ===========================================================================
// 数据绑定
// ===========================================================================

/** 绑定失败分级:网络 / HTTP / 解析 / 被拒(路径不合规) / 能力调用被拒。 */
type BindingFailureKind = 'network' | 'http' | 'parse' | 'rejected' | 'call'

interface BindingFailure {
  source: string
  kind: BindingFailureKind
  message: string
}

interface BindingState {
  values: Record<string, unknown>
  loading: boolean
  failures: BindingFailure[]
}

/**
 * 会话内绑定缓存(30s):同一应用在对话卡片预览、右栏、独立页之间切换时不重复打接口。
 * 刻意用模块级 Map 而不是全局 store:数据绑定是「一次渲染的输入」,不是应用状态。
 */
const BINDING_CACHE_TTL = 30_000
const bindingCache = new Map<string, { at: number; value: unknown }>()

async function fetchBinding(source: { path: string; pick?: string }): Promise<unknown> {
  if (!source.path.startsWith('/api/') || source.path.includes('..')) {
    throw Object.assign(new Error('路径不在允许范围'), { bindingKind: 'rejected' as const })
  }
  const cached = bindingCache.get(source.path)
  if (cached && Date.now() - cached.at < BINDING_CACHE_TTL) return cached.value

  let response: Response
  try {
    response = await fetch(source.path, {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'include',
    })
  } catch (err) {
    throw Object.assign(err instanceof Error ? err : new Error('网络请求失败'), {
      bindingKind: 'network' as const,
    })
  }
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}`), { bindingKind: 'http' as const })
  }
  let json: unknown
  try {
    json = await response.json()
  } catch {
    throw Object.assign(new Error('响应不是合法 JSON'), { bindingKind: 'parse' as const })
  }
  const value = source.pick
    ? (json as Record<string, unknown> | null)?.[source.pick]
    : unwrapApiEnvelope(json)
  bindingCache.set(source.path, { at: Date.now(), value })
  return value
}

/**
 * 能力调用型绑定:走 `POST /:id/invoke`,结果本身即数据体(不需要 pick)。
 * 与 `fetchBinding` 共用失败分级,UI 上一视同仁。
 */
async function fetchCallBinding(
  appId: string,
  call: CapabilityAppCallName,
  args: Record<string, string> | undefined,
): Promise<unknown> {
  const cacheKey = `${appId}|${call}|${JSON.stringify(args ?? {})}`
  const cached = bindingCache.get(cacheKey)
  if (cached && Date.now() - cached.at < BINDING_CACHE_TTL) return cached.value
  let payload: Awaited<ReturnType<typeof invokeCapabilityApp>>
  try {
    payload = await invokeCapabilityApp(appId, call, args)
  } catch (err) {
    throw Object.assign(err instanceof Error ? err : new Error('调用失败'), {
      bindingKind: 'call' as const,
    })
  }
  bindingCache.set(cacheKey, { at: Date.now(), value: payload.result })
  return payload.result
}

function useBindings(
  app: CapabilityAppRecord,
): BindingState & { reload: () => void; writeBinding: (key: string, value: unknown) => void } {
  const data = app.spec.data
  const [values, setValues] = React.useState<Record<string, unknown>>({})
  const [loading, setLoading] = React.useState(false)
  const [failures, setFailures] = React.useState<BindingFailure[]>([])

  const load = React.useCallback(async () => {
    const entries = data ? Object.entries(data) : []
    if (entries.length === 0) return
    setLoading(true)
    setFailures([])
    const next: Record<string, unknown> = {}
    const errors: BindingFailure[] = []
    await Promise.all(
      entries.map(async ([key, source]: [string, CapabilityAppDataSource]) => {
        try {
          next[key] = source.call
            ? await fetchCallBinding(app.id, source.call, source.args)
            : await fetchBinding({
                path: source.path ?? '',
                ...(source.pick ? { pick: source.pick } : {}),
              })
        } catch (err) {
          const kind =
            typeof err === 'object' && err !== null && 'bindingKind' in err
              ? (err as { bindingKind: BindingFailureKind }).bindingKind
              : 'network'
          errors.push({
            source: key,
            kind,
            message: err instanceof Error ? err.message : '加载失败',
          })
        }
      }),
    )
    setValues(next)
    setFailures(errors)
    setLoading(false)
  }, [app.id, data])

  React.useEffect(() => {
    void load()
  }, [load])

  /** 动作结果写回:与已有数据源结果合并,块按 `from` 立即生效。 */
  const writeBinding = React.useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  return { values, loading, failures, reload: () => void load(), writeBinding }
}

function unwrapApiEnvelope(json: unknown): unknown {
  if (typeof json === 'object' && json !== null && 'data' in json) {
    const shape = json as { code?: unknown; data?: unknown }
    if (shape.code === 0) return shape.data
  }
  return json
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
      )
    : []
}

/**
 * 取绑定值:`valueKey` 用于从对象型结果里下钻一层。
 * 能力调用返回的常是 `{ total, items }` 这类包装对象,
 * 没有这一层就只能把应用写死成"正好返回数组"的接口形状。
 */
function boundValue(block: CapabilityAppBlock, bindings: Record<string, unknown>): unknown {
  const raw = block.from ? bindings[block.from] : undefined
  if (block.valueKey && typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return (raw as Record<string, unknown>)[block.valueKey]
  }
  return raw
}

// ===========================================================================
// 块渲染
// ===========================================================================

interface BlockProps {
  block: CapabilityAppBlock
  bindings: Record<string, unknown>
  /** 统一动作入口:渲染器注入(含 appId / 导航 / 重取 / 结果写回) */
  runAction: (action: CapabilityAppAction, values?: Record<string, string>) => Promise<void>
}

function HeadingBlock({ block }: BlockProps) {
  if (block.kind !== 'heading') return null
  const level = block.level ?? 2
  const Tag = `h${level}` as unknown as 'h1'
  return (
    <Tag
      className={cn(
        'font-semibold leading-tight',
        level === 1 ? 'text-2xl' : level === 2 ? 'text-lg' : 'text-base',
      )}
    >
      {block.text}
    </Tag>
  )
}

function TextBlock({ block }: BlockProps) {
  if (block.kind !== 'text') return null
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{block.text}</p>
  )
}

function CalloutBlock({ block }: BlockProps) {
  if (block.kind !== 'callout') return null
  const tone = block.tone ?? 'info'
  return (
    <div className={cn('rounded-lg border px-3 py-2 text-sm', TONE_CLASS[tone])}>
      {block.title ? <div className="mb-1 font-medium">{block.title}</div> : null}
      <div className="whitespace-pre-wrap leading-relaxed">{block.text}</div>
    </div>
  )
}

function BadgeBlock({ block }: BlockProps) {
  if (block.kind !== 'badge') return null
  const tone = block.tone ?? 'info'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
        TONE_CLASS[tone],
      )}
    >
      {block.text}
    </span>
  )
}

function DividerBlock() {
  return <hr className="border-border" />
}

function KeyValueBlock({ block, bindings }: BlockProps) {
  if (block.kind !== 'keyValue') return null
  const items =
    block.items && block.items.length > 0
      ? block.items
      : Object.entries(
          (boundValue(block, bindings) as Record<string, unknown> | undefined) ?? {},
        ).map(([label, value]) => ({ label, value: String(value) }))
  if (items.length === 0) return null
  return (
    <dl className="grid gap-1.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="font-medium tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function StatBlock({ block, bindings }: BlockProps) {
  if (block.kind !== 'stat') return null
  const items: Array<{ label: string; value: string; hint?: string }> =
    block.items && block.items.length > 0
      ? block.items
      : Object.entries(
          (boundValue(block, bindings) as Record<string, unknown> | undefined) ?? {},
        ).map(([label, value]) => ({ label, value: String(value) }))
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-border bg-card px-3 py-2">
          <div className="text-xs text-muted-foreground">{item.label}</div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums">{item.value}</div>
          {item.hint ? (
            <div className="mt-0.5 text-[11px] text-muted-foreground">{item.hint}</div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function ProgressBlock({ block }: BlockProps) {
  if (block.kind !== 'progress') return null
  const max = block.max && block.max > 0 ? block.max : 100
  const pct = Math.max(0, Math.min(100, (block.value / max) * 100))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{block.label}</span>
        <span className="tabular-nums">
          {block.value}/{max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ListBlock({ block, bindings }: BlockProps) {
  if (block.kind !== 'list') return null
  const fromRows = asRows(boundValue(block, bindings))
  const items =
    block.items && block.items.length > 0
      ? block.items
      : fromRows.map((row) => (block.labelKey ? String(row[block.labelKey] ?? '') : String(row)))
  if (items.length === 0) return null
  const Tag = block.ordered ? 'ol' : 'ul'
  return (
    <Tag className={cn('space-y-1 pl-5 text-sm', block.ordered ? 'list-decimal' : 'list-disc')}>
      {items.map((item, index) => (
        <li key={`${index}-${item}`} className="leading-relaxed">
          {item}
        </li>
      ))}
    </Tag>
  )
}

function TableBlock({ block, bindings }: BlockProps) {
  if (block.kind !== 'table') return null
  const rows =
    block.rows && block.rows.length > 0 ? block.rows : asRows(boundValue(block, bindings))
  if (rows.length === 0) return null
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/60">
          <tr>
            {block.columns.map((column) => (
              <th key={column.key} className="px-3 py-2 text-left font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border">
              {block.columns.map((column) => (
                <td key={column.key} className="px-3 py-2 align-top">
                  {formatCell((row as Record<string, unknown>)[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

function CodeBlock({ block }: BlockProps) {
  if (block.kind !== 'code') return null
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
      {block.language ? (
        <div className="border-b border-border px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          {block.language}
        </div>
      ) : null}
      <pre className="overflow-x-auto px-3 py-2 text-xs leading-relaxed">
        <code>{block.code}</code>
      </pre>
    </div>
  )
}

function ImageBlock({ block }: BlockProps) {
  if (block.kind !== 'image') return null
  return (
    <figure className="space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- 声明式应用的图片源是数据,不经 next/image 域名白名单 */}
      <img
        src={block.src}
        alt={block.alt}
        loading="lazy"
        className="max-h-80 w-auto rounded-lg border border-border"
      />
      {block.caption ? (
        <figcaption className="text-xs text-muted-foreground">{block.caption}</figcaption>
      ) : null}
    </figure>
  )
}

function ButtonBlock({ block, runAction }: BlockProps) {
  const [pending, setPending] = React.useState(false)
  if (block.kind !== 'button') return null
  const variant = block.variant ?? 'primary'
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (pending) return
        setPending(true)
        void runAction(block.action).finally(() => setPending(false))
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        pending && 'opacity-60',
        variant === 'primary'
          ? 'bg-cta text-cta-foreground hover:bg-cta/90'
          : variant === 'secondary'
            ? 'bg-muted text-foreground hover:bg-muted/80'
            : 'text-foreground hover:bg-muted',
      )}
    >
      {block.label}
    </button>
  )
}

function ChartBlock({ block, bindings }: BlockProps) {
  if (block.kind !== 'chart') return null
  const fromRows = asRows(boundValue(block, bindings))
  const items =
    block.items && block.items.length > 0
      ? block.items
      : fromRows.map((row) => ({
          label: String(row['label'] ?? row['name'] ?? ''),
          value: Number(row['value'] ?? row['count'] ?? 0),
        }))
  if (items.length === 0) return null
  const max = Math.max(...items.map((item) => item.value), 1)
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      {block.title ? <div className="text-sm font-medium">{block.title}</div> : null}
      {block.chartType === 'pie' ? (
        <div className="flex items-center gap-4">
          <PieChart items={items} />
          <Legend items={items} />
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 truncate text-muted-foreground">{item.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-primary"
                  style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right tabular-nums">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PieChart({ items }: { items: Array<{ label: string; value: number }> }) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7']
  let offset = 0
  const radius = 32
  const circumference = 2 * Math.PI * radius
  return (
    <svg viewBox="0 0 80 80" className="h-24 w-24 shrink-0" role="img" aria-label="饼图">
      {items.map((item, index) => {
        const ratio = Math.max(0, item.value) / total
        const dash = ratio * circumference
        const circle = (
          <circle
            key={item.label}
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={colors[index % colors.length]}
            strokeWidth="12"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 40 40)"
          />
        )
        offset += dash
        return circle
      })}
    </svg>
  )
}

function Legend({ items }: { items: Array<{ label: string; value: number }> }) {
  return (
    <ul className="space-y-1 text-xs">
      {items.map((item) => (
        <li key={item.label} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{item.label}</span>
          <span className="tabular-nums">{item.value}</span>
        </li>
      ))}
    </ul>
  )
}

function TabsBlock(props: BlockProps) {
  const { block } = props
  const [active, setActive] = React.useState(0)
  if (block.kind !== 'tabs') return null
  const current = block.tabs[active] ?? block.tabs[0]
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {block.tabs.map((tab, index) => (
          <button
            key={`${index}-${tab.label}`}
            type="button"
            onClick={() => setActive(index)}
            className={cn(
              '-mb-px border-b-2 px-3 py-1.5 text-sm',
              index === active
                ? 'border-stroke-selected font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {current ? (
        <BlockList blocks={current.blocks} bindings={props.bindings} runAction={props.runAction} />
      ) : null}
    </div>
  )
}

function ColumnsBlock(props: BlockProps) {
  const { block } = props
  if (block.kind !== 'columns') return null
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {block.columns.map((column, index) => (
        <div key={`${index}-${column.label ?? ''}`} className="space-y-2">
          {column.label ? (
            <div className="text-xs font-medium text-muted-foreground">{column.label}</div>
          ) : null}
          <BlockList blocks={column.blocks} bindings={props.bindings} runAction={props.runAction} />
        </div>
      ))}
    </div>
  )
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: CapabilityAppField
  value: string
  onChange: (value: string) => void
}) {
  const inputClass =
    'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:outline outline-2 outline-offset-2 outline-stroke-focus'
  if (field.kind === 'textarea') {
    return (
      <textarea
        id={field.name}
        className={cn(inputClass, 'min-h-20')}
        placeholder={field.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }
  if (field.kind === 'select') {
    return (
      <select
        id={field.name}
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">请选择</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }
  if (field.kind === 'toggle') {
    return (
      <input
        id={field.name}
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={value === 'true'}
        onChange={(event) => onChange(String(event.target.checked))}
      />
    )
  }
  return (
    <input
      id={field.name}
      className={inputClass}
      placeholder={field.placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function FormBlock({ block, runAction }: BlockProps) {
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    if (block.kind === 'form') {
      for (const field of block.fields) {
        if (field.kind === 'toggle') initial[field.name] = String(field.defaultChecked === true)
        else initial[field.name] = field.defaultValue ?? ''
      }
    }
    return initial
  })
  const [pending, setPending] = React.useState(false)
  if (block.kind !== 'form') return null
  return (
    <form
      className="space-y-3 rounded-lg border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        const missing = block.fields.find(
          (field) => field.required && !(values[field.name] ?? '').trim(),
        )
        if (missing) {
          toast.error(`请填写「${missing.label}」`)
          return
        }
        setPending(true)
        void runAction(block.action, values).finally(() => setPending(false))
      }}
    >
      {block.fields.map((field) => (
        <div key={field.name} className="space-y-1">
          <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
            {field.label}
            {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
          </label>
          <FieldControl
            field={field}
            value={values[field.name] ?? ''}
            onChange={(value) => setValues((prev) => ({ ...prev, [field.name]: value }))}
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-md bg-cta px-3 py-1.5 text-sm font-medium text-cta-foreground hover:bg-cta/90 disabled:opacity-60"
      >
        {block.submitLabel}
      </button>
    </form>
  )
}

/**
 * 块注册表:**唯一**的 kind → 组件映射。
 * `Record<CapabilityAppBlockKind, …>` 是刻意的:词表加一档而这里没跟上,编译期即红。
 */
const BLOCK_RENDERERS: Record<
  CapabilityAppBlock['kind'],
  (props: BlockProps) => React.ReactElement | null
> = {
  heading: HeadingBlock,
  text: TextBlock,
  callout: CalloutBlock,
  badge: BadgeBlock,
  divider: DividerBlock,
  keyValue: KeyValueBlock,
  stat: StatBlock,
  progress: ProgressBlock,
  list: ListBlock,
  table: TableBlock,
  code: CodeBlock,
  image: ImageBlock,
  button: ButtonBlock,
  chart: ChartBlock,
  tabs: TabsBlock,
  columns: ColumnsBlock,
  form: FormBlock,
}

function BlockList({
  blocks,
  bindings,
  runAction,
}: Omit<BlockProps, 'block'> & { blocks: CapabilityAppBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        const Renderer = BLOCK_RENDERERS[block.kind]
        if (!Renderer) return null
        return (
          <React.Fragment key={block.id ?? `${block.kind}-${index}`}>
            <Renderer block={block} bindings={bindings} runAction={runAction} />
          </React.Fragment>
        )
      })}
    </>
  )
}

// ===========================================================================
// 应用外壳
// ===========================================================================

export interface CapabilityAppRendererProps {
  app: CapabilityAppRecord
  className?: string
}

/** 渲染一份能力应用。这是「AI 生成 → 直接在本程序内显示」的唯一渲染入口。 */
export function CapabilityAppRenderer({ app, className }: CapabilityAppRendererProps) {
  const router = useRouter()
  const t = useTranslations('apps')
  const { values, loading, failures, reload, writeBinding } = useBindings(app)
  const navigate = React.useCallback((path: string) => router.push(path), [router])
  const runAction = React.useCallback(
    (action: CapabilityAppAction, formValues: Record<string, string> = {}) =>
      executeAction(action, formValues, {
        appId: app.id,
        navigate,
        refresh: reload,
        writeBinding,
      }),
    [app.id, navigate, reload, writeBinding],
  )
  const sourceCount = app.spec.data ? Object.keys(app.spec.data).length : 0
  const allFailed = failures.length > 0 && sourceCount > 0 && failures.length >= sourceCount

  return (
    <div className={cn('space-y-3', className)}>
      {app.description ? <p className="text-sm text-muted-foreground">{app.description}</p> : null}
      {loading ? <div className="text-xs text-muted-foreground">{t('dataLoading')}</div> : null}
      {failures.length > 0 && !loading ? (
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-xs',
            allFailed ? TONE_CLASS.error : TONE_CLASS.warn,
          )}
        >
          <div className="font-medium">{allFailed ? t('dataError') : t('dataPartial')}</div>
          <ul className="mt-1 space-y-0.5">
            {failures.map((item) => (
              <li key={item.source}>
                {item.source}({item.kind}):{item.message}
              </li>
            ))}
          </ul>
          <button type="button" onClick={reload} className="mt-1 underline">
            {t('retry')}
          </button>
        </div>
      ) : null}
      <div className="space-y-3">
        <BlockList blocks={app.spec.blocks} bindings={values} runAction={runAction} />
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
