// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { fetchApi } from '@/lib/api'
import {
  Badge,
  Button,
  CalendarCheck,
  Checkbox,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Eye,
  EyeOff,
  FileText,
  Input,
  Label,
  Loader2,
  LogIn,
  PartyPopper,
  Pencil,
  Power,
  RefreshCw,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  ShieldAlert,
  ShieldCheck,
  Switch,
  Plus,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Trash2,
  TriangleAlert,
  Users,
  Wallet,
} from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'
import { BackButton } from '@/components/common'
import { Tooltip } from '@/components/feedback'
import { useConfirm } from '@/hooks/use-confirm'
import { useTauriIpcReady } from '@/hooks/use-desktop'
import { useWorkPanelStore } from '@/stores/work-panel'
import { closeDockedBrowser } from '@/lib/tauri-bridge'
import {
  RELAY_WEB_LOGIN,
  RELAY_WEB_LOGIN_PROVIDERS,
  normalizeTraeProbe,
  relayWebLoginAccountToImport,
  type RelayWebLoginProvider,
} from '@/lib/relay-web-login'

/** 平台 → 网页重登能力(未登记的平台返回 null:该平台没进注册表,按钮 Tooltip 如实说明) */
function relayWebLoginCap(providerCode: string) {
  if (!(RELAY_WEB_LOGIN_PROVIDERS as readonly string[]).includes(providerCode)) return null
  return RELAY_WEB_LOGIN[providerCode as RelayWebLoginProvider]
}

const PAGE_SIZE = 20
const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono text-xs'

// 账号级代理与代理池同口径:只接受 http(s)/socks5
const PROXY_PROTOCOLS = new Set(['http:', 'https:', 'socks5:'])

function isSupportedProxyUrl(raw: string): boolean {
  try {
    return PROXY_PROTOCOLS.has(new URL(raw).protocol)
  } catch {
    return false
  }
}

/** 代理池列表脱敏展示:只留协议+主机,账密不渲染、不进 title */
function maskProxyDisplay(raw?: string | null): string {
  if (!raw) return '-'
  try {
    const u = new URL(raw)
    return `${u.protocol}//${u.username || u.password ? '***@' : ''}${u.host}`
  } catch {
    return '已隐藏'
  }
}

const PROVIDER_OPTIONS = ['trae', 'workbuddy', 'codearts', 'qoder'] as const
type ProviderCode = (typeof PROVIDER_OPTIONS)[number]

// 24h 用量摘要。后端契约字段均为 number,但后端尚未合并时可能整体缺失,
// 故全部可选并做容错渲染(缺字段显示 "-",不阻塞 typecheck)。
interface UsageSummary {
  calls24h?: number | null
  tokens24h?: number | null
  failRate24h?: number | null
}
interface PoolHealth {
  expiredCount?: number | null
  availableCount?: number | null
  needRefill?: boolean | null
}
interface UsageDetailRow {
  [key: string]: unknown
}
interface UsageData {
  summary?: UsageSummary | null
  details?: UsageDetailRow[] | null
}
interface AccountRow {
  id: string
  providerCode: string
  uid: string | null
  name: string
  deviceId: string | null
  machineId: string | null
  tokenExpiresAt: string | null
  refreshExpiresAt: string | null
  priority: number
  weight: number
  isEnabled: boolean
  tempUnschedulable: boolean
  healthStatus: string
  healthCheckedAt: string | null
  lastErrorMessage: string | null
  lastUsedAt: string | null
  lastRefreshAt: string | null
  refreshFailureCount: number
  consecutiveFailures: number
  hasProxy: boolean
  /** 后端脱敏投影:scheme://***@host:port;明文账密/路径/查询串不返回前端 */
  proxyUrlMasked: string | null
  totalCalls: number
  extraMetadata: unknown
  createdAt: string
  updatedAt: string
  usageSummary?: UsageSummary | null
  circuitBreakReason?: string | null
  expiresSoon?: boolean | null
  /** 体检结论机器枚(判据单源 @ihui/shared,UI 只映射文案不重写判据) */
  verdict?: string | null
  tokenRemainingDays?: number | null
  idleDays?: number | null
  claimStatus?: string | null
  claimedBy?: string | null
  claimedAt?: string | null
  claimNote?: string | null
  /** O64:extraMetadata.checkinSync 子键投影(号池↔签到同步态;后端只回该子键,cosy 等不回) */
  checkinSync?: {
    pending?: boolean
    pendingKind?: 'cred' | 'state' | null
    pendingAt?: string | null
    lastError?: string | null
    attempts?: number
    lastSyncedAt?: string | null
  } | null
}
interface ListData {
  list: AccountRow[]
  total: number
  page: number
  pageSize: number
  poolHealth?: PoolHealth | null
}
/** O64 签到点查视图(端点 22 回显;found=false 的两种形态:noEngine 平台无签到引擎 / 未同步) */
interface CheckinStatusItem {
  ok?: boolean
  found: boolean
  noEngine?: boolean
  error?: string | null
  accountId?: number | null
  name?: string | null
  enabled?: boolean | null
  poolCredVersion?: number | null
  poolSyncedAt?: string | null
  poolDeletedAt?: string | null
  pendingCred?: boolean
  cooldownUntil?: string | null
  lastRecord?: {
    ok: boolean
    action: string | null
    credits: number | null
    createdAt: string | null
  } | null
}
interface ListEnvelope<T> {
  list?: T[] | null
  total?: number | null
}
type ProxyStatus = 'active' | 'dead' | 'exhausted'
interface ProxyPoolRow {
  id: string
  proxyUrl?: string | null
  providerCode?: string | null
  boundAccountId?: string | null
  status?: string | null
  failCount?: number | null
  lastPickedAt?: string | null
  lastCheckedAt?: string | null
}
interface ModelCatalogRow {
  id: string
  providerCode?: string | null
  alias?: string | null
  upstreamModel?: string | null
  displayName?: string | null
  enabled?: boolean | null
  createdAt?: string | null
  updatedAt?: string | null
}
type PoolTab = 'accounts' | 'proxy' | 'catalog'
interface ImportItem {
  index: number
  name: string | null
  uid: string | null
  status: 'imported' | 'updated' | 'skipped' | 'failed'
  reason?: string
}
interface ImportResult {
  providerCode: string
  total: number
  imported: number
  updated: number
  skipped: number
  failed: number
  items: ImportItem[]
}

const HEALTH_CLASS: Record<string, string> = {
  unknown: 'bg-muted text-muted-foreground',
  healthy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  degraded: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  down: 'bg-red-500/10 text-red-600 dark:text-red-400',
}
const HEALTH_LABEL: Record<string, string> = {
  unknown: '未知',
  healthy: '健康',
  degraded: '降级',
  down: '异常',
}

// 体检徽章(admin 面写死中文映射即可,门 70 排除 admin;i18n  parity 不涉)
const VERDICT_LABEL: Record<string, string> = {
  usable: '可用',
  'expiring-soon': '临期',
  'expired-renewable': '可救回',
  'expired-dead': '待重登',
  'envelope-only': '仅同机',
  indeterminate: '未知',
}
const VERDICT_CLASS: Record<string, string> = {
  usable: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  'expiring-soon': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'expired-renewable': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'expired-dead': 'bg-red-500/10 text-red-600 dark:text-red-400',
  'envelope-only': 'bg-muted text-muted-foreground',
  indeterminate: 'bg-muted text-muted-foreground',
}
const VERDICT_HINT: Record<string, string> = {
  'envelope-only': '信封凭据仅同机可解,号池无法代刷',
  'expired-dead': '无 refreshToken,调度救不回,需重新登录/导出',
  'expired-renewable': '过期但有票,临期/保活档会自动续',
  usable: '',
  'expiring-soon': '1 天内到期,保活档会兜住;本机用则开一次客户端',
  indeterminate: '读不到到期,以健康检查为准',
}

const IMPORT_STATUS_LABEL: Record<string, string> = {
  imported: '新增',
  updated: '更新',
  skipped: '跳过',
  failed: '失败',
}

const PROXY_STATUS_LABEL: Record<ProxyStatus, string> = {
  active: '可用',
  dead: '失效',
  exhausted: '耗尽',
}
const PROXY_STATUS_CLASS: Record<ProxyStatus, string> = {
  active: 'border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  dead: 'border-transparent bg-red-500/10 text-red-600 dark:text-red-400',
  exhausted: 'border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

function toProxyStatus(v: string | null | undefined): ProxyStatus {
  return v === 'dead' || v === 'exhausted' ? v : 'active'
}

function pickList<T>(data: T[] | ListEnvelope<T> | null | undefined): T[] {
  if (!data) return []
  return Array.isArray(data) ? data : (data.list ?? [])
}

function pickTotal<T>(data: T[] | ListEnvelope<T> | null | undefined): number {
  if (!data) return 0
  return Array.isArray(data) ? data.length : (data.total ?? data.list?.length ?? 0)
}

const EXAMPLE_JSON = `[
  {
    "name": "账号A",
    "token": "eyJ...",
    "refreshToken": "eyJ...",
    "deviceId": "...",
    "machineId": "...",
    "enabled": true,
    "cookies": "..."
  }
]`

function fmtNum(v: number | null | undefined): string {
  return v === null || v === undefined ? '-' : v.toLocaleString()
}

/** POST /admin/relay/accounts/:id/quota 的 data 形状(平台给不到的字段一律留空,不兜 0) */
interface QuotaResult {
  id: string
  providerCode: string
  ok: boolean
  error: string | null
  quota: {
    used?: number
    total?: number
    remaining?: number
    ratio?: number
    unit?: string
    resetsAt?: string
    /** 订阅档名(workbuddy 实证:summary 的 SubscriptionPackageName,如"体验版") */
    subscriptionName?: string
    packs?: Array<{ name?: string; limit?: number; remaining?: number; endAt?: string }>
  } | null
  queriedAt: string
}

// 余额一行话:优先"剩余/总额";平台只给已用时按 total 换算,两者都给不到就不编数字。
function formatQuotaLine(q: NonNullable<QuotaResult['quota']>): string {
  const unit = q.unit ?? '额度'
  const sub = q.subscriptionName ? `(${q.subscriptionName}) ` : ''
  const remaining =
    q.remaining ?? (q.used !== undefined && q.total !== undefined ? q.total - q.used : undefined)
  const pct =
    q.ratio !== undefined && q.ratio >= 0 && q.ratio <= 1
      ? ` · 已用 ${(q.ratio * 100).toFixed(1)}%`
      : ''
  if (remaining !== undefined && q.total !== undefined) {
    return `${sub}余额 ${fmtNum(remaining)} / ${fmtNum(q.total)} ${unit}${pct}`
  }
  if (remaining !== undefined) return `${sub}余额 ${fmtNum(remaining)} ${unit}`
  if (q.used !== undefined) return `${sub}已用 ${fmtNum(q.used)} ${unit}`
  return '余额接口已应答,但字段未识别(未判定)'
}

// failRate24h 契约未指明是 0–1 比例还是 0–100 百分数:≤1 视为比例换算,否则按百分数直显。
function failRatePct(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  return v <= 1 ? v * 100 : v
}

function fmtDetailValue(v: unknown, f: Intl.DateTimeFormat): string {
  if (v === null || v === undefined) return '-'
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (typeof v === 'number') return v.toLocaleString()
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
      const d = new Date(v)
      if (!Number.isNaN(d.getTime())) return f.format(d)
    }
    return v
  }
  return JSON.stringify(v)
}

export default function AdminRelayAccountPoolPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [provider, setProvider] = React.useState('')
  const [enabled, setEnabled] = React.useState<'all' | 'true' | 'false'>('all')
  const [health, setHealth] = React.useState<'all' | 'unknown' | 'healthy' | 'degraded' | 'down'>(
    'all',
  )
  const [importOpen, setImportOpen] = React.useState(false)
  // 一键重登(2026-10-27 第 3 格):进行中的账号 id + 阶段;null = 空闲。
  // 能力登记在 @/lib/relay-web-login(单一源);trae 有实证链,其余明示未判定。
  const [relogin, setRelogin] = React.useState<{
    id: string
    phase: 'waiting' | 'importing'
  } | null>(null)
  const reloginDockTabRef = React.useRef<string | null>(null)
  const reloginDockSeenRef = React.useRef(false)
  const [importProvider, setImportProvider] = React.useState<ProviderCode | ''>('')
  const [importText, setImportText] = React.useState('')
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null)
  // ⑤ 拖拽/点选文件(2026-10-26,机主「更傻瓜」):第三方工具导出的备份 .json 拖进来即可
  const importFileRef = React.useRef<HTMLInputElement | null>(null)
  const [importDragOver, setImportDragOver] = React.useState(false)
  const [importFileName, setImportFileName] = React.useState('')
  // 读文件只填文本框,解析/入库仍走同一条 submitImport 通道(不另起第二份导入判据)
  const applyImportFile = (file: File | null | undefined): void => {
    if (!file) return
    const name = file.name || 'pasted.json'
    if (!/\.(json|txt)$/i.test(name)) {
      toast.error('只接受 .json / .txt 账号导出文件')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error(`文件过大(${Math.round(file.size / 1048576)}MB),单次上限 8MB`)
      return
    }
    file
      .text()
      .then((t) => {
        if (!t.trim()) {
          toast.error('文件是空的')
          return
        }
        setImportText(t)
        setImportFileName(name)
        toast.success(`已读取「${name}」,点「提交导入」入池`)
      })
      .catch(() => toast.error('读取文件失败,请改用「粘贴」'))
  }
  // 导出包顶层自带 providerCode 时自动选平台(用户手选过则尊重手选)
  const autofillProviderFromPayload = (parsed: unknown): void => {
    if (importProvider) return
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
    const raw = (parsed as { providerCode?: unknown }).providerCode
    const alt = (parsed as { provider?: unknown }).provider
    const v = typeof raw === 'string' ? raw : typeof alt === 'string' ? alt : ''
    if ((PROVIDER_OPTIONS as readonly string[]).includes(v)) setImportProvider(v as ProviderCode)
  }

  const [editing, setEditing] = React.useState<AccountRow | null>(null)
  const [editForm, setEditForm] = React.useState({
    name: '',
    priority: '0',
    weight: '1',
    tempUnschedulable: false,
  })
  // 代理:keep=不改动(默认),set=替换,clear=移除;避免打开编辑即把已有代理清空
  const [proxyMode, setProxyMode] = React.useState<'keep' | 'set' | 'clear'>('keep')
  const [proxyDraft, setProxyDraft] = React.useState('')
  const [proxyVisible, setProxyVisible] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [usageAccountId, setUsageAccountId] = React.useState<string | null>(null)
  const [tab, setTab] = React.useState<PoolTab>('accounts')

  const qs = React.useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search) p.set('search', search)
    if (provider) p.set('provider', provider)
    if (enabled !== 'all') p.set('enabled', enabled)
    if (health !== 'all') p.set('health', health)
    return p.toString()
  }, [page, search, provider, enabled, health])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'relay', 'account-pool', qs],
    queryFn: async () => {
      const r = await fetchApi<ListData>(`/api/admin/relay/accounts?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })
  const poolHealth = data?.poolHealth ?? null
  const showRefillBanner =
    poolHealth !== null && ((poolHealth.needRefill ?? false) || (poolHealth.expiredCount ?? 0) > 0)

  const usageQuery = useQuery({
    queryKey: ['admin', 'relay', 'account-pool', 'usage', usageAccountId],
    enabled: usageAccountId !== null,
    queryFn: async () => {
      const r = await fetchApi<UsageData>(
        `/api/admin/relay/account-pool/usage/${usageAccountId}?days=7`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const usageAccountName =
    usageAccountId === null ? null : (list.find((k) => k.id === usageAccountId)?.name ?? null)
  const usageDetailRows = usageQuery.data?.details ?? []
  const usageDetailCols = React.useMemo(() => {
    const rows = usageQuery.data?.details ?? []
    const cols: string[] = []
    const seen = new Set<string>()
    for (const row of rows.slice(0, 50)) {
      for (const key of Object.keys(row)) {
        if (!seen.has(key)) {
          seen.add(key)
          cols.push(key)
        }
      }
    }
    return cols
  }, [usageQuery.data])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'relay', 'account-pool'] })

  // ── O64 号池↔签到:页内 uid 批量点查(设计 §11 数据源;单页 ≤20,不做全表拉取) ──
  const pageIdsKey = list.map((k) => k.id).join(',')
  const checkinStatusQuery = useQuery({
    queryKey: ['admin', 'relay', 'account-pool', 'checkin-status', pageIdsKey],
    enabled: list.length > 0,
    queryFn: async () => {
      const r = await fetchApi<{ items: Record<string, CheckinStatusItem> }>(
        '/api/admin/relay/account-pool/checkin-status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: list.map((k) => k.id) }),
        },
      )
      if (!r.success) throw new Error(r.error)
      return r.data.items
    },
    staleTime: 30_000,
  })
  const checkinItems = checkinStatusQuery.data ?? {}

  const resyncMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi<{ pushed: number; skipped: number }>(
        `/api/admin/relay/accounts/${id}/checkin-resync`,
        { method: 'POST' },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      toast.success(`已重推签到同步(成功 ${d.pushed} 条)`)
      invalidate()
      void checkinStatusQuery.refetch()
    },
    onError: (e: Error) => toast.error(e.message || '重推签到同步失败'),
  })

  const checkinRunMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi<{ record: { ok?: boolean; credits?: number | null } | null }>(
        `/api/admin/relay/accounts/${id}/checkin-run`,
        { method: 'POST' },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      const credits = d.record?.credits
      toast.success(
        credits !== null && credits !== undefined ? `签到成功,积分 +${credits}` : '签到完成',
      )
      void checkinStatusQuery.refetch()
    },
    onError: (e: Error) => toast.error(e.message || '触发签到失败'),
  })

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const allOnPageSelected = list.length > 0 && list.every((k) => selectedIds.includes(k.id))
  const toggleSelectAllOnPage = () =>
    setSelectedIds((prev) =>
      allOnPageSelected
        ? prev.filter((id) => !list.some((k) => k.id === id))
        : [...new Set([...prev, ...list.map((k) => k.id)])],
    )

  const toggleMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi<{ id: string; isEnabled: boolean }>(
        `/api/admin/relay/accounts/${id}/toggle`,
        { method: 'POST' },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      toast.success(d.isEnabled ? '已启用' : '已禁用')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '操作失败'),
  })

  const healthMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi<{ id: string; ok: boolean; error: string | null }>(
        `/api/admin/relay/accounts/${id}/health`,
        { method: 'POST' },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      if (d.ok) toast.success('健康检查通过')
      else toast.error(`健康检查异常:${d.error ?? '未知错误'}`)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '健康检查失败'),
  })

  const quotaMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi<QuotaResult>(`/api/admin/relay/accounts/${id}/quota`, {
        method: 'POST',
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      if (d.ok && d.quota) toast.success(formatQuotaLine(d.quota))
      else toast.error(`余额查询失败:${d.error ?? '未判定'}`)
    },
    onError: (e: Error) => toast.error(e.message || '余额查询失败'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi<{ id: string }>(`/api/admin/relay/accounts/${id}`, {
        method: 'DELETE',
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('已删除')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '删除失败'),
  })

  const editMut = useMutation({
    mutationFn: async (vars: { id: string; body: Record<string, unknown> }) => {
      const r = await fetchApi<{ id: string }>(`/api/admin/relay/accounts/${vars.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars.body),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('已保存')
      setEditing(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '保存失败'),
  })

  const importMut = useMutation({
    mutationFn: async (body: {
      providerCode: string
      accounts: unknown[]
      /** 一键重登专用:本批未带 refreshToken 时保留库内旧票(重登只换得到 access) */
      preserveMissingRefresh?: boolean
    }) => {
      const r = await fetchApi<ImportResult>('/api/admin/relay/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      setImportResult(d)
      setImportFileName('')
      setRelogin(null)
      toast.success(
        `导入完成:新增 ${d.imported} / 更新 ${d.updated} / 跳过 ${d.skipped} / 失败 ${d.failed}`,
      )
      invalidate()
    },
    onError: (e: Error) => {
      setRelogin(null)
      toast.error(e.message || '导入失败')
    },
  })

  const sweepMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const r = await fetchApi<unknown>('/api/admin/relay/account-pool/sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (_d, ids) => {
      toast.success(`已提交 ${ids.length} 个账号的巡检`)
      setSelectedIds([])
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '巡检失败'),
  })

  const claimMut = useMutation({
    mutationFn: async (vars: { ids: string[]; action: 'claim' | 'release' }) => {
      const results = await Promise.allSettled(
        vars.ids.map(async (id) => {
          const r = await fetchApi<unknown>(`/api/admin/relay/accounts/${id}/${vars.action}`, {
            method: 'POST',
          })
          if (!r.success) throw new Error(r.error)
        }),
      )
      const failed = results.filter((x) => x.status === 'rejected').length
      return { total: vars.ids.length, failed }
    },
    onSuccess: (d, vars) => {
      const label = vars.action === 'claim' ? '认领' : '释放'
      if (d.failed === 0) toast.success(`已${label} ${d.total} 个账号`)
      else toast.error(`${label}:成功 ${d.total - d.failed} / 失败 ${d.failed}`)
      setSelectedIds([])
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '操作失败'),
  })

  const openEdit = (k: AccountRow) => {
    setEditing(k)
    setEditForm({
      name: k.name,
      priority: String(k.priority),
      weight: String(k.weight),
      tempUnschedulable: k.tempUnschedulable,
    })
    setProxyMode('keep')
    setProxyDraft('')
    setProxyVisible(false)
  }

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    if (!editForm.name.trim()) {
      toast.error('名称必填')
      return
    }
    const body: Record<string, unknown> = {
      name: editForm.name.trim(),
      priority: Number(editForm.priority) || 0,
      weight: Number(editForm.weight) || 1,
      tempUnschedulable: editForm.tempUnschedulable,
    }
    // 只有显式更换/清除才带 proxyUrl;keep 状态绝不提交,防止覆盖已有代理
    if (proxyMode === 'set') {
      const proxy = proxyDraft.trim()
      if (!proxy) {
        toast.error('请输入代理地址')
        return
      }
      if (!isSupportedProxyUrl(proxy)) {
        toast.error('代理地址必须是 http(s)/socks5 协议')
        return
      }
      body.proxyUrl = proxy
    } else if (proxyMode === 'clear') {
      body.proxyUrl = null
    }
    editMut.mutate({ id: editing.id, body })
  }

  const submitImport = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = importText.trim()
    if (!raw) {
      toast.error('把 .json 拖进来、点「选文件」,或直接粘贴账号导出 JSON')
      return
    }
    let accounts: unknown[]
    let parsedTop: unknown
    try {
      parsedTop = JSON.parse(raw)
      if (Array.isArray(parsedTop)) {
        accounts = parsedTop
      } else if (
        parsedTop &&
        typeof parsedTop === 'object' &&
        Array.isArray((parsedTop as { accounts?: unknown }).accounts)
      ) {
        accounts = (parsedTop as { accounts: unknown[] }).accounts
      } else if (parsedTop && typeof parsedTop === 'object' && !Array.isArray(parsedTop)) {
        // 单条账号对象也吃(最傻瓜:workbuddy-switch 等工具常一文件一号)
        accounts = [parsedTop]
      } else {
        toast.error('JSON 需为账号数组、{ accounts: [...] } 整包或单条对象')
        return
      }
    } catch {
      toast.error('JSON 解析失败,请检查格式')
      return
    }
    autofillProviderFromPayload(parsedTop)
    if (!importProvider) {
      toast.error('请选择平台(或让导出 JSON 顶层带 providerCode)')
      return
    }
    if (accounts.length === 0) {
      toast.error('accounts 为空')
      return
    }
    if (accounts.length > 500) {
      toast.error(`单次最多导入 500 条,当前 ${accounts.length} 条`)
      return
    }
    importMut.mutate({ providerCode: importProvider, accounts })
  }

  // ── 一键重登(第 3 格):凭据死了在页内直接唤起网页登录换票,走同一条导入通道覆盖凭证 ──
  const desktop = useTauriIpcReady()
  // 嵌入页检测(与签到页同判据:内嵌浏览器工具条注入脚本定义 window.__ihuiNav;
  // 内容页没有 IPC,probe 全被 capability 拒,入口必须只在桌面主窗可用)
  const [embedBrowser, setEmbedBrowser] = React.useState(false)
  React.useEffect(() => {
    if (typeof (window as unknown as { __ihuiNav?: unknown }).__ihuiNav === 'function') {
      setEmbedBrowser(true)
    }
  }, [])

  // 收尾共用:关登录 Tab(没别的 Tab 时面板一并收)+ 销毁原生 webview。
  const endReloginDock = React.useCallback(() => {
    const store = useWorkPanelStore.getState()
    const tabId = reloginDockTabRef.current
    reloginDockTabRef.current = null
    reloginDockSeenRef.current = false
    if (tabId) store.closeTab(tabId)
    if (useWorkPanelStore.getState().tabs.length === 0) store.closePanel()
    void closeDockedBrowser()
  }, [])

  const startRelogin = (k: AccountRow) => {
    const cap = relayWebLoginCap(k.providerCode)
    if (!cap) return
    if (cap.kind === 'none') {
      toast.error(cap.reason)
      return
    }
    if (!desktop || embedBrowser) {
      toast.error('一键重登要在桌面主窗里用:内嵌浏览器内容页没有 IPC,读不到登录 Cookie')
      return
    }
    reloginDockSeenRef.current = false
    setRelogin({ id: k.id, phase: 'waiting' })
    reloginDockTabRef.current = useWorkPanelStore
      .getState()
      .openDockedTab(cap.loginUrl, cap.tabTitle)
  }

  // 轮询探测(2.5s):ok ⇒ 关登录 Tab + 走导入通道覆盖凭证(preserveMissingRefresh 保住
  // 库内旧 refreshToken —— 重登只换得到 access,不保留就把能自续的号抹成待重登死号);
  // 见过窗口之后又没了 = 用户关窗 ⇒ 复位;waiting/error 继续等,6.5min 超时兜底。
  React.useEffect(() => {
    if (!relogin || relogin.phase !== 'waiting') return
    const row = list.find((k) => k.id === relogin.id)
    const cap = row ? relayWebLoginCap(row.providerCode) : null
    if (!cap || cap.kind !== 'ipc-trae') return
    let stopped = false
    const poll = async () => {
      if (stopped) return
      try {
        const probe = normalizeTraeProbe(await cap.probe())
        if (stopped) return
        if (probe.status === 'waiting' && !probe.windowGone) reloginDockSeenRef.current = true
        if (probe.status === 'ok') {
          stopped = true
          endReloginDock()
          setRelogin({ id: relogin.id, phase: 'importing' })
          importMut.mutate({
            providerCode: 'trae',
            accounts: [relayWebLoginAccountToImport(probe.account)],
            preserveMissingRefresh: true,
          })
        } else if (probe.status === 'waiting' && probe.windowGone && reloginDockSeenRef.current) {
          stopped = true
          endReloginDock()
          setRelogin(null)
          toast.error('登录窗已关闭,重登未完成')
        }
      } catch {
        // 瞬态(窗口未建好/IPC 注入竞态):下一轮再试
      }
    }
    const timer = setInterval(() => void poll(), 2500)
    return () => {
      stopped = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- importMut 是稳定引用,进依赖只会空转
  }, [relogin, list, desktop, embedBrowser, endReloginDock])

  React.useEffect(() => {
    if (!relogin || relogin.phase !== 'waiting') return
    const timer = setTimeout(() => {
      endReloginDock()
      setRelogin(null)
      toast.error('等了 6 分半还没等到登录完成,已退出;确认网络后可再点一次重试')
    }, 390_000)
    return () => clearTimeout(timer)
  }, [relogin, endReloginDock])

  const copyUid = (uid: string) => {
    navigator.clipboard?.writeText(uid).then(
      () => toast.success('已复制 uid'),
      () => toast.error('复制失败'),
    )
  }

  const closeImport = () => {
    setImportOpen(false)
    setImportResult(null)
    setImportText('')
    setImportProvider('')
    setImportFileName('')
    setImportDragOver(false)
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6 text-primary" />
            账号池管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            第三方 AI IDE 账号导入、调度与健康检查
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={() => setImportOpen(true)}>
            <Plus className="h-4 w-4" />
            导入账号
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as PoolTab)}>
        <TabsList>
          <TabsTrigger value="accounts">账号池</TabsTrigger>
          <TabsTrigger value="proxy">代理池</TabsTrigger>
          <TabsTrigger value="catalog">模型目录</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          {showRefillBanner && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              <span>
                已过期 {poolHealth?.expiredCount ?? 0} 个,可用 {poolHealth?.availableCount ?? 0}{' '}
                个,建议补池
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
              placeholder="搜索 name / uid / deviceId"
              wrapperClassName="max-w-xs flex-1"
            />
            <Select
              value={provider || 'all'}
              onValueChange={(v) => {
                setPage(1)
                setProvider(v === 'all' ? '' : v)
              }}
            >
              <SelectTrigger className={selectClass} aria-label="平台">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部平台</SelectItem>
                {PROVIDER_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={enabled}
              onValueChange={(v) => {
                setPage(1)
                setEnabled(v as 'all' | 'true' | 'false')
              }}
            >
              <SelectTrigger className={selectClass} aria-label="启用状态">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="true">已启用</SelectItem>
                <SelectItem value="false">已禁用</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={health}
              onValueChange={(v) => {
                setPage(1)
                setHealth(v as typeof health)
              }}
            >
              <SelectTrigger className={selectClass} aria-label="健康状态">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部健康</SelectItem>
                <SelectItem value="unknown">未知</SelectItem>
                <SelectItem value="healthy">健康</SelectItem>
                <SelectItem value="degraded">降级</SelectItem>
                <SelectItem value="down">异常</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <span className="text-muted-foreground">已选 {selectedIds.length} 项</span>
              <Button
                size="sm"
                variant="outline"
                disabled={sweepMut.isPending}
                onClick={() => sweepMut.mutate(selectedIds)}
              >
                {sweepMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                批量巡检
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={claimMut.isPending}
                onClick={() => claimMut.mutate({ ids: selectedIds, action: 'claim' })}
              >
                批量认领
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={claimMut.isPending}
                onClick={() => claimMut.mutate({ ids: selectedIds, action: 'release' })}
              >
                批量释放
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                取消选择
              </Button>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground [&>tr>th]:whitespace-nowrap">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={toggleSelectAllOnPage}
                        aria-label="全选本页"
                      />
                    </th>
                    <th className="px-3 py-2 text-left">名称</th>
                    <th className="px-3 py-2 text-left">平台</th>
                    <th className="px-3 py-2 text-left">uid</th>
                    <th className="px-3 py-2 text-left">健康</th>
                    <th className="px-3 py-2 text-left">体检</th>
                    <th className="px-3 py-2 text-left">熔断</th>
                    <th className="px-3 py-2 text-left">签到</th>
                    <th className="px-3 py-2 text-right">24h 用量</th>
                    <th className="px-3 py-2 text-left">token 到期</th>
                    <th className="px-3 py-2 text-right">优先级</th>
                    <th className="px-3 py-2 text-right">权重</th>
                    <th className="px-3 py-2 text-right">累计调用</th>
                    <th className="px-3 py-2 text-right">连续失败</th>
                    <th className="px-3 py-2 text-right">刷新失败</th>
                    <th className="px-3 py-2 text-left">代理</th>
                    <th className="px-3 py-2 text-left">最近使用</th>
                    <th className="px-3 py-2 text-left">认领</th>
                    <th className="px-3 py-2 text-left">启用</th>
                    <th className="px-3 py-2 text-left">摘除</th>
                    <th className="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={`sk-${i}`}>
                        <td colSpan={21} className="px-3 py-2">
                          <Skeleton className="h-6 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : isError ? (
                    <tr>
                      <td colSpan={21} className="px-3 py-8 text-center text-red-500">
                        加载失败:{error instanceof Error ? error.message : '未知错误'}
                      </td>
                    </tr>
                  ) : list.length === 0 ? (
                    <tr>
                      <td colSpan={21} className="px-3 py-8 text-center text-muted-foreground">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    list.map((k) => {
                      const expMs = k.tokenExpiresAt ? new Date(k.tokenExpiresAt).getTime() : null
                      const now = Date.now()
                      const expiringSoon = expMs !== null && expMs - now < 24 * 3600 * 1000
                      const expired = expMs !== null && expMs <= now
                      const soon = k.expiresSoon === true || expiringSoon
                      const claimed = k.claimStatus === 'claimed'
                      const failPct = failRatePct(k.usageSummary?.failRate24h)
                      const ci = checkinItems[k.id]
                      const relCap = relayWebLoginCap(k.providerCode)
                      return (
                        <tr key={k.id} className={soon ? 'bg-amber-500/5' : undefined}>
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={selectedIds.includes(k.id)}
                              onCheckedChange={() => toggleSelect(k.id)}
                              aria-label={`选择 ${k.name}`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-1 font-medium">
                              {k.name}
                              {k.expiresSoon === true && (
                                <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-normal text-amber-600 dark:text-amber-400">
                                  即将过期
                                </span>
                              )}
                            </div>
                            {k.lastErrorMessage && (
                              <div
                                className="max-w-[16rem] truncate text-xs text-red-500"
                                title={k.lastErrorMessage}
                              >
                                {k.lastErrorMessage}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">{k.providerCode}</td>
                          <td className="px-3 py-2">
                            {k.uid ? (
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs" title={k.uid}>
                                  {k.uid.length > 12 ? `${k.uid.slice(0, 8)}…` : k.uid}
                                </span>
                                <Tooltip content="复制 uid">
                                  <span className="inline-flex">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={() => copyUid(k.uid!)}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </span>
                                </Tooltip>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs ${
                                HEALTH_CLASS[k.healthStatus] ?? HEALTH_CLASS.unknown
                              }`}
                            >
                              {HEALTH_LABEL[k.healthStatus] ?? k.healthStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {k.verdict ? (
                              <Tooltip
                                content={
                                  VERDICT_HINT[k.verdict]
                                    ? `${k.verdict}：${VERDICT_HINT[k.verdict]}`
                                    : `剩余 ${k.tokenRemainingDays ?? '?'} 天`
                                }
                              >
                                <span className="inline-flex items-center gap-1">
                                  <span
                                    className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs ${
                                      VERDICT_CLASS[k.verdict] ?? VERDICT_CLASS.indeterminate
                                    }`}
                                  >
                                    {VERDICT_LABEL[k.verdict] ?? k.verdict}
                                  </span>
                                  {typeof k.idleDays === 'number' && (
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                      闲置{Math.round(k.idleDays)}天
                                    </span>
                                  )}
                                </span>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {k.circuitBreakReason ? (
                              <Tooltip content={k.circuitBreakReason}>
                                <span className="inline-flex">
                                  <span className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">
                                    <ShieldAlert className="h-3 w-3" />
                                    熔断
                                  </span>
                                </span>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {k.checkinSync?.pending === true ? (
                              <Tooltip
                                content={`${
                                  k.checkinSync.pendingKind === 'state' ? '状态' : '凭证'
                                }同步待重试(第 ${k.checkinSync.attempts ?? 0} 次)${
                                  k.checkinSync.lastError ? `:${k.checkinSync.lastError}` : ''
                                }`}
                              >
                                <span className="inline-flex">
                                  <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                                    待同步
                                  </span>
                                </span>
                              </Tooltip>
                            ) : ci && ci.found ? (
                              <div className="flex flex-col gap-0.5 text-xs">
                                <span
                                  className={
                                    ci.lastRecord?.ok
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-muted-foreground'
                                  }
                                >
                                  {ci.lastRecord?.ok ? '已签' : '未签'}
                                </span>
                                {ci.lastRecord?.credits !== null &&
                                  ci.lastRecord?.credits !== undefined && (
                                    <span className="tabular-nums text-muted-foreground">
                                      积分 {ci.lastRecord.credits}
                                    </span>
                                  )}
                                {ci.cooldownUntil && (
                                  <span className="text-amber-600 dark:text-amber-400">
                                    冷却至 {fmt.format(new Date(ci.cooldownUntil))}
                                  </span>
                                )}
                              </div>
                            ) : ci?.noEngine === true ? (
                              <span className="text-xs text-muted-foreground">无签到引擎</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">未同步</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {k.usageSummary ? (
                              <div className="flex flex-col items-end gap-0.5 text-xs tabular-nums">
                                <span>{fmtNum(k.usageSummary.calls24h)} 次</span>
                                <span className="text-muted-foreground">
                                  {fmtNum(k.usageSummary.tokens24h)} tok
                                </span>
                                <span
                                  className={
                                    failPct !== null && failPct > 30
                                      ? 'font-medium text-red-600 dark:text-red-400'
                                      : 'text-muted-foreground'
                                  }
                                >
                                  {failPct === null ? '-' : `${failPct.toFixed(1)}%`}
                                </span>
                              </div>
                            ) : (
                              <span className="block text-right text-xs text-muted-foreground">
                                -
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {expMs !== null ? (
                              <span
                                className={
                                  expired
                                    ? 'font-medium text-red-600 dark:text-red-400'
                                    : expiringSoon
                                      ? 'font-medium text-amber-600 dark:text-amber-400'
                                      : 'text-muted-foreground'
                                }
                              >
                                {fmt.format(new Date(k.tokenExpiresAt!))}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{k.priority}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{k.weight}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{k.totalCalls}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {k.consecutiveFailures}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {k.refreshFailureCount}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {k.hasProxy ? (
                              <Tooltip content={`代理：${k.proxyUrlMasked ?? '已配置（脱敏）'}`}>
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                                  <ShieldCheck className="h-3 w-3" />
                                  私有
                                </span>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground">直连</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {k.lastUsedAt ? fmt.format(new Date(k.lastUsedAt)) : '-'}
                          </td>
                          <td className="px-3 py-2">
                            {claimed ? (
                              <Tooltip
                                content={`认领人:${k.claimedBy ?? '-'} 时间:${
                                  k.claimedAt ? fmt.format(new Date(k.claimedAt)) : '-'
                                } 备注:${k.claimNote ?? '-'}`}
                              >
                                <span className="inline-flex">
                                  <span className="max-w-[10rem] truncate rounded-md bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400">
                                    已认领{k.claimedBy ? ` · ${k.claimedBy}` : ''}
                                  </span>
                                </span>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Switch
                              checked={k.isEnabled}
                              disabled={toggleMut.isPending}
                              onCheckedChange={() => toggleMut.mutate(k.id)}
                              aria-label={`${k.name} 启用开关`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {k.tempUnschedulable ? (
                              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                                已摘除
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip content="健康检查">
                                <span className="inline-flex">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={healthMut.isPending}
                                    onClick={() => healthMut.mutate(k.id)}
                                  >
                                    {healthMut.isPending && healthMut.variables === k.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </Button>
                                </span>
                              </Tooltip>
                              <Tooltip content="重推签到同步">
                                <span className="inline-flex">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label="重推签到同步"
                                    disabled={resyncMut.isPending}
                                    onClick={() => resyncMut.mutate(k.id)}
                                  >
                                    {resyncMut.isPending && resyncMut.variables === k.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CalendarCheck className="h-4 w-4" />
                                    )}
                                  </Button>
                                </span>
                              </Tooltip>
                              <Tooltip content="立即签到">
                                <span className="inline-flex">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label="立即签到"
                                    disabled={checkinRunMut.isPending}
                                    onClick={() => checkinRunMut.mutate(k.id)}
                                  >
                                    {checkinRunMut.isPending && checkinRunMut.variables === k.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <PartyPopper className="h-4 w-4" />
                                    )}
                                  </Button>
                                </span>
                              </Tooltip>
                              <Tooltip
                                content={
                                  relCap
                                    ? relCap.kind === 'ipc-trae'
                                      ? '一键重登:停靠浏览器打开登录页,换新票自动覆盖凭证(保留原 refreshToken)'
                                      : relCap.reason
                                    : '该平台未登记网页重登链(出路见告警话术:导入账号 JSON)'
                                }
                              >
                                <span className="inline-flex">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label="一键重登"
                                    disabled={relogin !== null || !desktop}
                                    onClick={() => startRelogin(k)}
                                  >
                                    {relogin?.id === k.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <LogIn className="h-4 w-4" />
                                    )}
                                  </Button>
                                </span>
                              </Tooltip>
                              <Tooltip content="查余额">
                                <span className="inline-flex">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={quotaMut.isPending}
                                    onClick={() => quotaMut.mutate(k.id)}
                                  >
                                    {quotaMut.isPending && quotaMut.variables === k.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Wallet className="h-4 w-4" />
                                    )}
                                  </Button>
                                </span>
                              </Tooltip>
                              <Tooltip content="调用日志">
                                <span className="inline-flex">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setUsageAccountId(k.id)}
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                </span>
                              </Tooltip>
                              <Tooltip content="切换启用">
                                <span className="inline-flex">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={toggleMut.isPending}
                                    onClick={() => toggleMut.mutate(k.id)}
                                  >
                                    <Power className="h-4 w-4" />
                                  </Button>
                                </span>
                              </Tooltip>
                              <Button
                                size="xs"
                                variant="ghost"
                                className="px-2 text-xs"
                                disabled={claimMut.isPending}
                                onClick={() =>
                                  claimMut.mutate({
                                    ids: [k.id],
                                    action: claimed ? 'release' : 'claim',
                                  })
                                }
                              >
                                {claimed ? '释放' : '认领'}
                              </Button>
                              <Tooltip content="编辑">
                                <span className="inline-flex">
                                  <Button size="sm" variant="ghost" onClick={() => openEdit(k)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </span>
                              </Tooltip>
                              <Tooltip content="删除">
                                <span className="inline-flex">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={deleteMut.isPending}
                                    onClick={() => {
                                      void confirm({
                                        title: `删除账号 "${k.name}"?`,
                                        variant: 'destructive',
                                      }).then((ok) => {
                                        if (ok) deleteMut.mutate(k.id)
                                      })
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </span>
                              </Tooltip>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">共 {total} 条</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="proxy" className="space-y-4">
          <ProxyPoolPanel />
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4">
          <ModelCatalogPanel />
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <form onSubmit={submitEdit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>编辑账号{editing ? `:${editing.name}` : ''}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="a-name">名称</Label>
              <Input
                id="a-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="a-priority">优先级</Label>
                <Input
                  id="a-priority"
                  type="number"
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-weight">权重</Label>
                <Input
                  id="a-weight"
                  type="number"
                  min="1"
                  value={editForm.weight}
                  onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="a-temp"
                checked={editForm.tempUnschedulable}
                onCheckedChange={(v) => setEditForm({ ...editForm, tempUnschedulable: v })}
              />
              <Label htmlFor="a-temp" className="text-sm text-muted-foreground">
                临时摘除(暂不参与调度)
              </Label>
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-none">账号代理</div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      仅对该账号生效，不进入共享代理池
                    </p>
                  </div>
                </div>
                <span
                  className={
                    editing?.hasProxy
                      ? 'shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400'
                      : 'shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground'
                  }
                >
                  {editing?.hasProxy ? '已配置' : '直连'}
                </span>
              </div>

              {editing?.hasProxy && proxyMode === 'keep' ? (
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs">
                    {editing.proxyUrlMasked ?? '已配置（脱敏）'}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setProxyMode('set')
                      setProxyDraft('')
                      setProxyVisible(false)
                    }}
                  >
                    更换
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => setProxyMode('clear')}
                  >
                    清除
                  </Button>
                </div>
              ) : null}

              {!editing?.hasProxy && proxyMode === 'keep' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setProxyMode('set')
                    setProxyVisible(false)
                  }}
                >
                  设置代理
                </Button>
              ) : null}

              {proxyMode === 'set' ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      id="a-proxy"
                      type={proxyVisible ? 'text' : 'password'}
                      value={proxyDraft}
                      onChange={(e) => setProxyDraft(e.target.value)}
                      placeholder="http://user:pass@host:port 或 socks5://host:port"
                      autoComplete="off"
                      spellCheck={false}
                      className="pr-9 font-mono text-xs"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setProxyVisible((v) => !v)}
                      aria-label={proxyVisible ? '隐藏代理地址' : '显示代理地址'}
                    >
                      {proxyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    支持 http(s):// 与 socks5://，保存后聊天、换票、巡检都走该出口。
                  </p>
                  {editing?.hasProxy ? (
                    <p className="text-[11px] text-muted-foreground">
                      当前：{editing.proxyUrlMasked ?? '已配置（脱敏）'}
                    </p>
                  ) : null}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setProxyMode('keep')
                        setProxyDraft('')
                        setProxyVisible(false)
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : null}

              {proxyMode === 'clear' ? (
                <div className="space-y-2">
                  <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                    保存后将移除该账号的代理，回落到共享代理池或直连。
                  </p>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setProxyMode('keep')}
                    >
                      撤销
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button type="submit" disabled={editMut.isPending}>
                {editMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(o) => !o && closeImport()}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={submitImport} className="space-y-4">
            <DialogHeader>
              <DialogTitle>导入账号</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>平台</Label>
                <Select
                  value={importProvider || 'none'}
                  onValueChange={(v) => v !== 'none' && setImportProvider(v as ProviderCode)}
                >
                  <SelectTrigger aria-label="导入平台">
                    <SelectValue placeholder="选择平台" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>
                      选择平台
                    </SelectItem>
                    {PROVIDER_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="a-import-json">账号导出 JSON</Label>
                <div className="flex items-center gap-1">
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".json,.txt,application/json,text/plain"
                    className="hidden"
                    onChange={(e) => applyImportFile(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="px-2 text-xs"
                    onClick={() => importFileRef.current?.click()}
                  >
                    <FileText className="mr-1 h-3 w-3" />
                    选文件
                  </Button>
                </div>
              </div>
              <textarea
                id="a-import-json"
                rows={10}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setImportDragOver(true)
                }}
                onDragLeave={() => setImportDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setImportDragOver(false)
                  applyImportFile(e.dataTransfer.files?.[0])
                }}
                placeholder='把 .json 备份文件拖进来 / 点「选文件」;也支持粘贴整包 { "accounts": [...] }、裸数组、单条,以及 workbuddy-switch 等第三方导出(access_token 形状由服务端自动归一)'
                className={
                  textareaClass +
                  ' transition-colors' +
                  (importDragOver ? ' border-primary bg-primary/5 ring-1 ring-primary/40' : '')
                }
              />
              <p className="text-xs text-muted-foreground">
                {importFileName
                  ? `已载入文件 ${importFileName}（点「提交导入」才写进号池）`
                  : '字段:name / token / refreshToken / deviceId / machineId / enabled / cookies(proxyUrl 可选);第三方导出自动识别。示例:'}
              </p>
              <pre className="max-h-40 overflow-auto rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                {EXAMPLE_JSON}
              </pre>
            </div>
            {importResult && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    导入结果(共 {importResult.total} 条):
                  </span>
                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                    新增 {importResult.imported}
                  </span>
                  <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-400">
                    更新 {importResult.updated}
                  </span>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                    跳过 {importResult.skipped}
                  </span>
                  <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-red-600 dark:text-red-400">
                    失败 {importResult.failed}
                  </span>
                </div>
                <div className="max-h-60 overflow-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1 text-left">#</th>
                        <th className="px-2 py-1 text-left">名称</th>
                        <th className="px-2 py-1 text-left">uid</th>
                        <th className="px-2 py-1 text-left">状态</th>
                        <th className="px-2 py-1 text-left">原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.items.map((it) => (
                        <tr
                          key={it.index}
                          className={
                            it.status === 'failed'
                              ? 'bg-red-500/5 text-red-600 dark:text-red-400'
                              : ''
                          }
                        >
                          <td className="px-2 py-1 tabular-nums">{it.index}</td>
                          <td className="px-2 py-1">{it.name ?? '-'}</td>
                          <td className="px-2 py-1 font-mono">{it.uid ?? '-'}</td>
                          <td className="px-2 py-1">
                            {IMPORT_STATUS_LABEL[it.status] ?? it.status}
                          </td>
                          <td
                            className="max-w-[16rem] truncate px-2 py-1"
                            title={it.reason ?? undefined}
                          >
                            {it.reason ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeImport}>
                关闭
              </Button>
              <Button type="submit" disabled={importMut.isPending}>
                {importMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                提交导入
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={usageAccountId !== null} onOpenChange={(o) => !o && setUsageAccountId(null)}>
        <SheetContent side="right" className="w-full gap-4 sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>调用日志{usageAccountName ? `:${usageAccountName}` : ''}</SheetTitle>
            <SheetDescription>近 7 天调用用量与明细</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-auto pb-2">
            {usageQuery.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : usageQuery.isError ? (
              <p className="text-sm text-red-500">
                加载失败:{usageQuery.error instanceof Error ? usageQuery.error.message : '未知错误'}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-muted px-2 py-1 tabular-nums text-muted-foreground">
                    调用 {fmtNum(usageQuery.data?.summary?.calls24h)} 次
                  </span>
                  <span className="rounded-md bg-muted px-2 py-1 tabular-nums text-muted-foreground">
                    Tokens {fmtNum(usageQuery.data?.summary?.tokens24h)}
                  </span>
                  <span
                    className={`whitespace-nowrap rounded-md px-2 py-1 tabular-nums ${
                      failRatePct(usageQuery.data?.summary?.failRate24h) !== null &&
                      (failRatePct(usageQuery.data?.summary?.failRate24h) ?? 0) > 30
                        ? 'bg-red-500/10 font-medium text-red-600 dark:text-red-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    失败率{' '}
                    {failRatePct(usageQuery.data?.summary?.failRate24h) === null
                      ? '-'
                      : `${failRatePct(usageQuery.data?.summary?.failRate24h)?.toFixed(1)}%`}
                  </span>
                </div>
                {usageDetailRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">暂无调用明细</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground [&>tr>th]:whitespace-nowrap">
                        <tr>
                          {usageDetailCols.map((c) => (
                            <th key={c} className="px-2 py-1 text-left">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {usageDetailRows.map((row, i) => (
                          <tr key={i}>
                            {usageDetailCols.map((c) => {
                              const text = fmtDetailValue(row[c], fmt)
                              return (
                                <td
                                  key={c}
                                  className="max-w-[12rem] truncate px-2 py-1"
                                  title={text}
                                >
                                  {text}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialogRenderer />
    </div>
  )
}

function ProxyPoolPanel() {
  const locale = useLocale()
  const qc = useQueryClient()
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState<'all' | ProxyStatus>('all')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState({ proxyUrl: '', providerCode: '', boundAccountId: '' })

  const qs = React.useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (status !== 'all') p.set('status', status)
    return p.toString()
  }, [page, status])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'relay', 'proxy-pool', qs],
    queryFn: async () => {
      const r = await fetchApi<ListEnvelope<ProxyPoolRow> | ProxyPoolRow[]>(
        `/api/admin/relay/proxy-pool?${qs}`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  React.useEffect(() => {
    if (isError && error) {
      toast.error(`代理池加载失败:${error instanceof Error ? error.message : '未知错误'}`)
    }
  }, [isError, error])

  const rows = pickList(data)
  const total = pickTotal(data)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'relay', 'proxy-pool'] })

  const createMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetchApi<ProxyPoolRow>('/api/admin/relay/proxy-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('已新增代理')
      setCreateOpen(false)
      setForm({ proxyUrl: '', providerCode: '', boundAccountId: '' })
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '新增代理失败'),
  })

  const statusMut = useMutation({
    mutationFn: async (vars: { id: string; status: ProxyStatus }) => {
      const r = await fetchApi<unknown>(`/api/admin/relay/proxy-pool/${vars.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: vars.status }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('代理状态已更新')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '更新代理状态失败'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi<unknown>(`/api/admin/relay/proxy-pool/${id}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('代理已删除')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '删除代理失败'),
  })

  const checkMut = useMutation({
    mutationFn: async (vars: { id: string; alive: boolean }) => {
      const r = await fetchApi<unknown>(`/api/admin/relay/proxy-pool/${vars.id}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alive: vars.alive }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.alive ? '已标记为存活' : '已标记为失效')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '活性标记失败'),
  })

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const proxyUrl = form.proxyUrl.trim()
    if (!proxyUrl) {
      toast.error('代理地址必填')
      return
    }
    const body: Record<string, unknown> = { proxyUrl }
    if (form.providerCode) body.providerCode = form.providerCode
    const boundAccountId = form.boundAccountId.trim()
    if (boundAccountId) body.boundAccountId = boundAccountId
    createMut.mutate(body)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1)
            setStatus(v as 'all' | ProxyStatus)
          }}
        >
          <SelectTrigger className={selectClass} aria-label="代理状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">可用</SelectItem>
            <SelectItem value="dead">失效</SelectItem>
            <SelectItem value="exhausted">耗尽</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          刷新
        </Button>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          新增代理
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground [&>tr>th]:whitespace-nowrap">
              <tr>
                <th className="px-3 py-2 text-left">代理地址</th>
                <th className="px-3 py-2 text-left">平台</th>
                <th className="px-3 py-2 text-left">绑定账号</th>
                <th className="px-3 py-2 text-left">状态</th>
                <th className="px-3 py-2 text-right">失败次数</th>
                <th className="px-3 py-2 text-left">最近取用</th>
                <th className="px-3 py-2 text-left">最近检测</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`proxy-sk-${i}`}>
                    <td colSpan={8} className="px-3 py-2">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-red-500">
                    加载失败:{error instanceof Error ? error.message : '未知错误'}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    暂无代理
                  </td>
                </tr>
              ) : (
                rows.map((p) => {
                  const rowStatus = toProxyStatus(p.status)
                  return (
                    <tr key={p.id}>
                      <td
                        className="max-w-[18rem] truncate px-3 py-2 font-mono text-xs"
                        title={p.proxyUrl ? maskProxyDisplay(p.proxyUrl) : undefined}
                      >
                        {maskProxyDisplay(p.proxyUrl)}
                      </td>
                      <td className="px-3 py-2 text-xs">{p.providerCode ?? '-'}</td>
                      <td
                        className="max-w-[12rem] truncate px-3 py-2 font-mono text-xs"
                        title={p.boundAccountId ?? undefined}
                      >
                        {p.boundAccountId ?? '-'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={PROXY_STATUS_CLASS[rowStatus]}>
                          {PROXY_STATUS_LABEL[rowStatus]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.failCount ?? 0}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {p.lastPickedAt ? fmt.format(new Date(p.lastPickedAt)) : '-'}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {p.lastCheckedAt ? fmt.format(new Date(p.lastCheckedAt)) : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Select
                            value={rowStatus}
                            onValueChange={(v) =>
                              statusMut.mutate({ id: p.id, status: v as ProxyStatus })
                            }
                          >
                            <SelectTrigger className={selectClass} aria-label="修改代理状态">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">可用</SelectItem>
                              <SelectItem value="dead">失效</SelectItem>
                              <SelectItem value="exhausted">耗尽</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="xs"
                            variant="ghost"
                            className="px-2 text-xs"
                            disabled={checkMut.isPending}
                            onClick={() => checkMut.mutate({ id: p.id, alive: true })}
                          >
                            有效
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            className="px-2 text-xs"
                            disabled={checkMut.isPending}
                            onClick={() => checkMut.mutate({ id: p.id, alive: false })}
                          >
                            失效
                          </Button>
                          <Tooltip content="删除代理">
                            <span className="inline-flex">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={deleteMut.isPending}
                                onClick={() => {
                                  void confirm({
                                    title: `删除代理 "${p.proxyUrl ?? p.id}"?`,
                                    variant: 'destructive',
                                  }).then((ok) => {
                                    if (ok) deleteMut.mutate(p.id)
                                  })
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </span>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent>
          <form onSubmit={submitCreate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>新增代理</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="p-url">代理地址</Label>
              <Input
                id="p-url"
                value={form.proxyUrl}
                onChange={(e) => setForm({ ...form, proxyUrl: e.target.value })}
                placeholder="http://127.0.0.1:7890"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-provider">平台(可选)</Label>
              <Select
                value={form.providerCode || 'none'}
                onValueChange={(v) => setForm({ ...form, providerCode: v === 'none' ? '' : v })}
              >
                <SelectTrigger id="p-provider" aria-label="代理平台">
                  <SelectValue placeholder="不限平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不限平台</SelectItem>
                  {PROVIDER_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-bound">绑定账号 id(可选)</Label>
              <Input
                id="p-bound"
                value={form.boundAccountId}
                onChange={(e) => setForm({ ...form, boundAccountId: e.target.value })}
                placeholder="留空则作为共享代理轮换"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialogRenderer />
    </>
  )
}

function ModelCatalogPanel() {
  const locale = useLocale()
  const qc = useQueryClient()
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const [provider, setProvider] = React.useState('')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState({
    providerCode: '',
    alias: '',
    upstreamModel: '',
    displayName: '',
  })

  const qs = React.useMemo(() => {
    const p = new URLSearchParams()
    if (provider) p.set('provider', provider)
    return p.toString()
  }, [provider])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'relay', 'model-catalog', qs],
    queryFn: async () => {
      const r = await fetchApi<ListEnvelope<ModelCatalogRow> | ModelCatalogRow[]>(
        `/api/admin/relay/model-catalog${qs ? `?${qs}` : ''}`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  React.useEffect(() => {
    if (isError && error) {
      toast.error(`模型目录加载失败:${error instanceof Error ? error.message : '未知错误'}`)
    }
  }, [isError, error])

  const rows = pickList(data)
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'relay', 'model-catalog'] })

  const createMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetchApi<ModelCatalogRow>('/api/admin/relay/model-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('已新增模型别名')
      setCreateOpen(false)
      setForm({ providerCode: '', alias: '', upstreamModel: '', displayName: '' })
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '新增模型别名失败'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi<unknown>(`/api/admin/relay/model-catalog/${id}`, {
        method: 'DELETE',
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('已删除模型别名')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '删除模型别名失败'),
  })

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.providerCode) {
      toast.error('请选择平台')
      return
    }
    const alias = form.alias.trim()
    const upstreamModel = form.upstreamModel.trim()
    if (!alias || !upstreamModel) {
      toast.error('别名与上游模型必填')
      return
    }
    const body: Record<string, unknown> = {
      providerCode: form.providerCode,
      alias,
      upstreamModel,
    }
    const displayName = form.displayName.trim()
    if (displayName) body.displayName = displayName
    createMut.mutate(body)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={provider || 'all'} onValueChange={(v) => setProvider(v === 'all' ? '' : v)}>
          <SelectTrigger className={selectClass} aria-label="平台">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部平台</SelectItem>
            {PROVIDER_OPTIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          刷新
        </Button>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          新增别名
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground [&>tr>th]:whitespace-nowrap">
              <tr>
                <th className="px-3 py-2 text-left">平台</th>
                <th className="px-3 py-2 text-left">别名</th>
                <th className="px-3 py-2 text-left">上游模型</th>
                <th className="px-3 py-2 text-left">显示名</th>
                <th className="px-3 py-2 text-left">启用</th>
                <th className="px-3 py-2 text-left">创建时间</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`catalog-sk-${i}`}>
                    <td colSpan={7} className="px-3 py-2">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-red-500">
                    加载失败:{error instanceof Error ? error.message : '未知错误'}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    暂无模型别名
                  </td>
                </tr>
              ) : (
                rows.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2 text-xs">{m.providerCode ?? '-'}</td>
                    <td
                      className="max-w-[14rem] truncate px-3 py-2 font-mono text-xs"
                      title={m.alias ?? undefined}
                    >
                      {m.alias ?? '-'}
                    </td>
                    <td
                      className="max-w-[16rem] truncate px-3 py-2 font-mono text-xs"
                      title={m.upstreamModel ?? undefined}
                    >
                      {m.upstreamModel ?? '-'}
                    </td>
                    <td
                      className="max-w-[14rem] truncate px-3 py-2 text-xs"
                      title={m.displayName ?? undefined}
                    >
                      {m.displayName ?? '-'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={
                          m.enabled === false
                            ? 'border-transparent bg-muted text-muted-foreground'
                            : 'border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {m.enabled === false ? '已停用' : '已启用'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {m.createdAt ? fmt.format(new Date(m.createdAt)) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip content="删除别名">
                          <span className="inline-flex">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={deleteMut.isPending}
                              onClick={() => {
                                void confirm({
                                  title: `删除别名 "${m.alias ?? m.id}"?`,
                                  variant: 'destructive',
                                }).then((ok) => {
                                  if (ok) deleteMut.mutate(m.id)
                                })
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </span>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent>
          <form onSubmit={submitCreate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>新增模型别名</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>平台</Label>
              <Select
                value={form.providerCode || 'none'}
                onValueChange={(v) => v !== 'none' && setForm({ ...form, providerCode: v })}
              >
                <SelectTrigger aria-label="模型平台">
                  <SelectValue placeholder="选择平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>
                    选择平台
                  </SelectItem>
                  {PROVIDER_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="m-alias">对外别名</Label>
                <Input
                  id="m-alias"
                  value={form.alias}
                  onChange={(e) => setForm({ ...form, alias: e.target.value })}
                  placeholder="如 kimi-k2"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-upstream">上游模型</Label>
                <Input
                  id="m-upstream"
                  value={form.upstreamModel}
                  onChange={(e) => setForm({ ...form, upstreamModel: e.target.value })}
                  placeholder="如 kimi-k2-0905-preview"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-display">显示名(可选)</Label>
              <Input
                id="m-display"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="管理面/目录回显名称"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialogRenderer />
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
