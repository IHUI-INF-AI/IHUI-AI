// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 教育食堂采购记账(2026-09-19 立) — Web 端四 Tab 管理页。
 *
 * - 拍照记账:小票图 base64 直传 → AI 三轮核对(抽取→交叉核对→差异仲裁) → 自动落台账
 * - 采购台账:筛选/分页/详情(含核对全记录+小票图)/编辑(含明细行)/记账/作废/删除
 *   + 手动重核对(ai-verify)与手动仲裁(ai-arbitrate)
 * - 供应商:CRUD + 软删除
 * - 统计:汇总卡片 + 品类/供应商/月度榜单 + CSV 导出(UTF-8 BOM,Excel 友好)
 *
 * 状态机: draft → ai_extracted → ai_verified / ai_conflict → confirmed → voided。
 * API 前缀 /api/edu-canteen,与 apps/api/src/routes/edu-canteen.ts 契约对齐。
 */

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  ScanLine,
  Camera,
  Plus,
  Trash2,
  Search,
  RotateCcw,
  FileDown,
  Eye,
  Pencil,
  Ban,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Scale,
  Truck,
  BarChart3,
  Receipt,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi, fetchRaw } from '@/lib/api'
import { BackButton, toast } from '@/components/common'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui-react'
import { ConfirmDialog, Tooltip } from '@/components/feedback'
import { DataTable, StatCard, type Column } from '@/components/data'
import { Checkbox } from '@/components/form'

/* ─── Types(与 API 响应对齐) ─── */

interface VerificationSummary {
  round: number
  type: string
  model: string | null
  at: string
  confidence: number | null
  ok: boolean
  differences: number
}

interface ProcurementRow {
  id: string
  procurementDate: string
  supplierId: string | null
  supplierName: string | null
  receiptNo: string | null
  totalAmount: number | null
  itemCount: number
  /** 列表端点返回 '__stored__' 占位(省流量);详情端点返回完整 data URI。 */
  receiptImageUrl: string | null
  status: string
  aiRounds: number
  aiVerifications: VerificationSummary[]
  aiConfidence: number | null
  confirmedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface ProcurementItem {
  id: string
  procurementId: string
  itemName: string
  category: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  amount: number | null
  verifyStatus: string | null
  sortOrder: number
}

interface ReceiptCheck {
  name: string
  passed: boolean
  detail: string
}

interface ReceiptDifference {
  field: string
  previous: string
  current: string
  resolution: string | null
}

interface VerificationFull {
  round: number
  type: string
  model: string | null
  at: string
  confidence: number | null
  ok: boolean
  receipt: {
    supplierName: string | null
    receiptDate: string | null
    receiptNo: string | null
    totalAmount: number | null
    items: Array<{
      name: string
      category: string | null
      quantity: number | null
      unit: string | null
      unitPrice: number | null
      amount: number | null
    }> | null
  } | null
  checks: ReceiptCheck[] | null
  differences: ReceiptDifference[] | null
  error: string | null
}

interface SupplierRow {
  id: string
  name: string
  category: string | null
  contactPerson: string | null
  phone: string | null
  address: string | null
  licenseInfo: string | null
  status: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface SupplierOption {
  id: string
  name: string
  category: string | null
  phone: string | null
}

interface StatsResp {
  scope: string
  dateRange: { startDate: string | null; endDate: string | null }
  summary: {
    totalAmount: number
    procurementCount: number
    itemCount: number
    avgAmount: number
  }
  byCategory: Array<{ category: string; amount: number; itemCount: number }>
  bySupplier: Array<{ supplierName: string; amount: number; procurementCount: number }>
  byMonth: Array<{ month: string; amount: number; procurementCount: number }>
}

interface Paged<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/* ─── API helper ─── */

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/* ─── Constants ─── */

const PROC_KEY = 'edu-canteen-procurement'
const SUP_KEY = 'edu-canteen-supplier'
const OPT_KEY = 'edu-canteen-supplier-options'

/** 服务端 image 字段上限 13MB 字符(data URI);base64 膨胀 4/3,原图限 9MB 留余量。 */
const MAX_IMAGE_SIZE = 9 * 1024 * 1024

const STATUS_META: Record<string, { labelKey: string; className: string }> = {
  draft: { labelKey: 'status.draft', className: 'bg-muted text-muted-foreground' },
  ai_extracted: {
    labelKey: 'status.aiExtracted',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  ai_verified: {
    labelKey: 'status.aiVerified',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  ai_conflict: {
    labelKey: 'status.aiConflict',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  confirmed: { labelKey: 'status.confirmed', className: 'bg-green-600 text-white' },
  voided: { labelKey: 'status.voided', className: 'bg-zinc-200 text-zinc-500 line-through' },
}

const STATUS_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: 'all', labelKey: 'statusFilter.all' },
  { value: 'ai_extracted', labelKey: 'status.aiExtracted' },
  { value: 'ai_verified', labelKey: 'status.aiVerified' },
  { value: 'ai_conflict', labelKey: 'status.aiConflict' },
  { value: 'confirmed', labelKey: 'status.confirmed' },
  { value: 'voided', labelKey: 'status.voided' },
]

/** 供应商分类: value 为后端存储/CSV 导出的字面值(不翻译), labelKey 仅用于取显示词。 */
const SUPPLIER_CATEGORIES: Array<{ value: string; labelKey: string }> = [
  { value: '蔬菜', labelKey: 'supplierCategory.vegetable' },
  { value: '肉禽', labelKey: 'supplierCategory.meatPoultry' },
  { value: '水产', labelKey: 'supplierCategory.aquatic' },
  { value: '粮油', labelKey: 'supplierCategory.grainOil' },
  { value: '调味', labelKey: 'supplierCategory.seasoning' },
  { value: '冻品', labelKey: 'supplierCategory.frozen' },
  { value: '其他', labelKey: 'supplierCategory.other' },
]

const VERIFY_TYPE_KEYS: Record<string, string> = {
  extract: 'verifyType.extract',
  verify: 'verifyType.verify',
  arbitrate: 'verifyType.arbitrate',
}

const AI_STEP_KEYS = ['ai.step1', 'ai.step2', 'ai.step3'] as const

const CONFIRM_TITLE_KEYS: Record<'confirm' | 'void' | 'delete', string> = {
  confirm: 'confirm.titleConfirm',
  void: 'confirm.titleVoid',
  delete: 'confirm.titleDelete',
}

const CONFIRM_DESC_KEYS: Record<'void' | 'delete', string> = {
  void: 'confirm.descVoid',
  delete: 'confirm.descDelete',
}

const PAGE_SIZE = 20

/* ─── Helpers ─── */

function fmtAmount(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `¥${v.toFixed(2)}`
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Select 组件不接受空串 value,用哨兵 'all' 表达"不过滤"。 */
function selAll(v: string): string | undefined {
  return v && v !== 'all' ? v : undefined
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

/* ─── 状态徽章 ─── */

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('eduProcurement')
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        meta?.className ?? 'bg-muted text-muted-foreground',
      )}
    >
      {meta?.labelKey ? t(meta?.labelKey) : status}
    </span>
  )
}

/* ═══════════════════════ Tab 4 · 统计分析 ═══════════════════════ */

interface StatsFilters {
  scope: string
  startDate: string
  endDate: string
}

const emptyStatsFilters: StatsFilters = { scope: 'confirmed', startDate: '', endDate: '' }

/** 榜单行:label + 金额 + 次数 + 占比条。 */
function RankList({
  rows,
  amountKey,
  countKey,
  countLabel,
}: {
  rows: Array<Record<string, unknown>>
  amountKey: string
  countKey: string
  countLabel: string
}) {
  const t = useTranslations('eduProcurement')
  if (rows.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">{t('common.noData')}</p>
    )
  }
  const max = Math.max(...rows.map((r) => Number(r[amountKey] ?? 0)), 1)
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => {
        const amount = Number(r[amountKey] ?? 0)
        const count = Number(r[countKey] ?? 0)
        const pct = Math.round((amount / max) * 100)
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">
                {String(r.category ?? r.supplierName ?? r.month ?? '—')}
              </span>
              <span className="shrink-0 tabular-nums font-medium">
                {fmtAmount(amount)}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {countLabel} {count}
                </span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
              <div
                className="h-full rounded-sm bg-primary/70"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatsTab() {
  const [filters, setFilters] = React.useState<StatsFilters>(emptyStatsFilters)
  const [applied, setApplied] = React.useState<StatsFilters>(emptyStatsFilters)
  const t = useTranslations('eduProcurement')
  const [exporting, setExporting] = React.useState(false)

  const statsQuery = useQuery({
    queryKey: ['edu-canteen-stats', applied],
    queryFn: () =>
      api<StatsResp>(
        `/api/edu-canteen/statistics${buildQuery({
          scope: applied.scope,
          startDate: applied.startDate || undefined,
          endDate: applied.endDate || undefined,
        })}`,
      ),
  })

  const s = statsQuery.data

  const apply = () => setApplied(filters)

  const reset = () => {
    setFilters(emptyStatsFilters)
    setApplied(emptyStatsFilters)
  }

  // 导出台账(xlsx 真 Excel / CSV),按明细行展开
  const exportData = async (format: 'xlsx' | 'csv') => {
    setExporting(true)
    try {
      const qs = buildQuery({
        scope: applied.scope,
        startDate: applied.startDate || undefined,
        endDate: applied.endDate || undefined,
        format,
      })
      const blob = await fetchRaw(`/api/edu-canteen/export${qs}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `canteen-procurement-${todayStr()}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(format === 'xlsx' ? t('stats.exportXlsx') : t('stats.exportCsv'))
    } catch {
      toast.error(t('stats.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 口径与日期 */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="grid w-48 gap-1.5">
            <Label>{t('stats.scope')}</Label>
            <Select
              value={filters.scope}
              onValueChange={(v) => setFilters({ ...filters, scope: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">{t('stats.scopeConfirmed')}</SelectItem>
                <SelectItem value="all">{t('stats.scopeAll')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('common.startDate')}</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('common.endDate')}</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <Button onClick={apply}>
            <Search className="h-4 w-4" />
            {t('stats.apply')}
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            {t('common.reset')}
          </Button>
          <Button
            variant="outline"
            className="ml-auto"
            disabled={exporting}
            onClick={() => exportData('xlsx')}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {t('stats.exportExcel')}
          </Button>
          <Button variant="outline" disabled={exporting} onClick={() => exportData('csv')}>
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {t('stats.exportCsvBtn')}
          </Button>
        </CardContent>
      </Card>

      {/* 汇总卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('stats.totalAmount')}
          value={s ? fmtAmount(s.summary.totalAmount) : '—'}
          icon={Receipt}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title={t('stats.docCount')}
          value={s ? String(s.summary.procurementCount) : '—'}
          icon={BarChart3}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title={t('stats.itemCount')}
          value={s ? String(s.summary.itemCount) : '—'}
          icon={Truck}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title={t('stats.avgAmount')}
          value={s ? fmtAmount(s.summary.avgAmount) : '—'}
          icon={CheckCircle2}
          loading={statsQuery.isLoading}
        />
      </div>

      {/* 榜单 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('stats.categoryRank')}</CardTitle>
          </CardHeader>
          <CardContent>
            <RankList
              rows={(s?.byCategory ?? []) as unknown as Array<Record<string, unknown>>}
              amountKey="amount"
              countKey="itemCount"
              countLabel={t('stats.countItem')}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('stats.supplierRank')}</CardTitle>
          </CardHeader>
          <CardContent>
            <RankList
              rows={(s?.bySupplier ?? []) as unknown as Array<Record<string, unknown>>}
              amountKey="amount"
              countKey="procurementCount"
              countLabel={t('stats.countDoc')}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('stats.monthlyTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <RankList
              rows={(s?.byMonth ?? []) as unknown as Array<Record<string, unknown>>}
              amountKey="amount"
              countKey="procurementCount"
              countLabel={t('stats.countDoc')}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ═══════════════════════ Tab 1 · AI 拍照记账 ═══════════════════════ */

function AiCaptureTab({ onGoLedger }: { onGoLedger: (id: string) => void }) {
  const t = useTranslations('eduProcurement')
  const qc = useQueryClient()
  const [imageUrl, setImageUrl] = React.useState('')
  const [hint, setHint] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [saveImage, setSaveImage] = React.useState(true)
  const [result, setResult] = React.useState<{
    procurement: ProcurementRow
    items: ProcurementItem[]
  } | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const analyze = useMutation({
    mutationFn: () =>
      api<{ procurement: ProcurementRow; items: ProcurementItem[] }>(
        '/api/edu-canteen/procurement/ai-analyze',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageUrl,
            hint: hint.trim() || undefined,
            saveImage,
            notes: notes.trim() || undefined,
          }),
        },
      ),
    onSuccess: (data) => {
      setResult(data)
      const st = STATUS_META[data.procurement.status]
      toast.success(
        t('ai.doneToast', {
          status: st?.labelKey ? t(st?.labelKey) : data.procurement.status,
        }),
      )
      qc.invalidateQueries({ queryKey: [PROC_KEY] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('ai.errNotImage'))
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(t('ai.errTooLarge'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImageUrl(String(reader.result ?? ''))
      setResult(null)
    }
    reader.onerror = () => toast.error(t('ai.errReadFailed'))
    reader.readAsDataURL(file)
  }

  const resetAll = () => {
    setImageUrl('')
    setHint('')
    setNotes('')
    setResult(null)
  }

  const analyzing = analyze.isPending
  const p = result?.procurement
  const items = result?.items ?? []

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* 左:上传与参数 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            {t('ai.uploadTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />

          {imageUrl ? (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-md border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={t('ai.previewAlt')}
                  className="max-h-80 w-full object-contain"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{(imageUrl.length / 1024 / 1024).toFixed(2)} MB(data URI)</span>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={analyzing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t('ai.reselect')}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
              className="flex h-56 w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              <Camera className="h-10 w-10" />
              <span className="text-sm font-medium">{t('ai.clickToSelect')}</span>
              <span className="text-xs">{t('ai.supportedFormats')}</span>
            </button>
          )}

          <div className="grid gap-1.5">
            <Label>{t('ai.hintLabel')}</Label>
            <Input
              value={hint}
              maxLength={200}
              placeholder={t('ai.hintPlaceholder')}
              onChange={(e) => setHint(e.target.value)}
              disabled={analyzing}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>{t('ai.notesLabel')}</Label>
            <Input
              value={notes}
              maxLength={1000}
              placeholder={t('ai.notesPlaceholder')}
              onChange={(e) => setNotes(e.target.value)}
              disabled={analyzing}
            />
          </div>

          {/* Checkbox 组件内部已渲染 <label> 包裹,外层不可再嵌 label(嵌套 label 无效 HTML 且触发 a11y 守门) */}
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={saveImage}
              onChange={(v) => setSaveImage(v)}
              disabled={analyzing}
              label={<span>{t('ai.keepImage')}</span>}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => analyze.mutate()}
              disabled={!imageUrl || analyzing}
              className="flex-1"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('ai.analyzing')}
                </>
              ) : (
                <>
                  <ScanLine className="h-4 w-4" />
                  {t('ai.start')}
                </>
              )}
            </Button>
            {(imageUrl || result) && !analyzing && (
              <Button variant="outline" onClick={resetAll}>
                <RotateCcw className="h-4 w-4" />
                {t('ai.clear')}
              </Button>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">{t('ai.pipeline')}</p>
        </CardContent>
      </Card>

      {/* 右:识别结果 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            {t('ai.resultTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analyzing && (
            <div className="space-y-3 py-8">
              {AI_STEP_KEYS.map((stepKey) => (
                <div
                  key={stepKey}
                  className="flex items-center gap-3 rounded-md border bg-muted/30 px-4 py-3 text-sm"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {t(stepKey)}
                </div>
              ))}
              <p className="text-center text-xs text-muted-foreground">{t('ai.slowNotice')}</p>
            </div>
          )}

          {!analyzing && !p && (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
              <ScanLine className="h-10 w-10 opacity-30" />
              <p className="text-sm">{t('ai.emptyHint1')}</p>
              <p className="text-xs">{t('ai.emptyHint2')}</p>
            </div>
          )}

          {!analyzing && p && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={p.status} />
                <span className="text-xs text-muted-foreground">
                  {t('ai.roundsConfidence', { rounds: String(p.aiRounds) })}{' '}
                  {p.aiConfidence !== null && p.aiConfidence !== undefined
                    ? `${Math.round(p.aiConfidence)}%`
                    : '—'}
                </span>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onGoLedger(p.id)}
                  className="ml-auto"
                >
                  {t('ai.goLedger')}
                </Button>
              </div>

              {p.status === 'ai_conflict' && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {t('ai.conflictNote')}
                </div>
              )}
              {p.status === 'ai_verified' && (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  {t('ai.verifiedNote')}
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border bg-muted/30 p-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('detail.supplierLabel')}</span>{' '}
                  {p.supplierName ?? '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">{t('detail.dateLabel')}</span>{' '}
                  {p.procurementDate}
                </div>
                <div>
                  <span className="text-muted-foreground">{t('detail.receiptNoLabel')}</span>{' '}
                  {p.receiptNo ?? '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">{t('detail.docTotalLabel')}</span>{' '}
                  <span className="font-semibold tabular-nums">{fmtAmount(p.totalAmount)}</span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t('table.itemName')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('table.category')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('table.quantity')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('table.unit')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('table.unitPrice')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('table.subtotal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-5 text-center text-muted-foreground">
                          {t('ai.noItems')}
                        </td>
                      </tr>
                    ) : (
                      items.map((it) => (
                        <tr key={it.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2">{it.itemName}</td>
                          <td className="px-3 py-2 text-muted-foreground">{it.category ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {it.quantity ?? '—'}
                          </td>
                          <td className="px-3 py-2">{it.unit ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {it.unitPrice !== null && it.unitPrice !== undefined
                              ? it.unitPrice.toFixed(2)
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {fmtAmount(it.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {p.notes && (
                <p className="text-xs text-muted-foreground">
                  {t('detail.notesLabel')}
                  {p.notes}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ═══════════════════════ Tab 2 · 采购台账 ═══════════════════════ */

interface LedgerFilters {
  startDate: string
  endDate: string
  status: string
  supplierId: string
  keyword: string
}

const emptyFilters: LedgerFilters = {
  startDate: '',
  endDate: '',
  status: 'all',
  supplierId: 'all',
  keyword: '',
}

function LedgerTab({ focusId }: { focusId: string | null }) {
  const t = useTranslations('eduProcurement')
  const [filters, setFilters] = React.useState<LedgerFilters>(emptyFilters)
  const [applied, setApplied] = React.useState<LedgerFilters>(emptyFilters)
  const [page, setPage] = React.useState(1)
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [confirmAction, setConfirmAction] = React.useState<{
    kind: 'confirm' | 'void' | 'delete'
    row: ProcurementRow
  } | null>(null)

  // AI 录入完成后从"在台账中处理"跳转:自动打开详情
  React.useEffect(() => {
    if (focusId) setDetailId(focusId)
  }, [focusId])

  const supplierOptions = useQuery({
    queryKey: [OPT_KEY],
    queryFn: () => api<{ options: SupplierOption[] }>('/api/edu-canteen/supplier/options'),
    staleTime: 60_000,
  })

  const listQuery = useQuery({
    queryKey: [PROC_KEY, 'list', applied, page],
    queryFn: () =>
      api<Paged<ProcurementRow>>(
        `/api/edu-canteen/procurement${buildQuery({
          startDate: applied.startDate || undefined,
          endDate: applied.endDate || undefined,
          status: selAll(applied.status),
          supplierId: selAll(applied.supplierId),
          keyword: applied.keyword.trim() || undefined,
          page,
          pageSize: PAGE_SIZE,
        })}`,
      ),
    placeholderData: (prev) => prev,
  })

  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [PROC_KEY] })
  }

  const actionMut = useMutation({
    mutationFn: async ({
      kind,
      row,
    }: {
      kind: 'confirm' | 'void' | 'delete'
      row: ProcurementRow
    }): Promise<'confirm' | 'void' | 'delete'> => {
      if (kind === 'delete') {
        await api<{ deleted: boolean }>(`/api/edu-canteen/procurement/${row.id}`, {
          method: 'DELETE',
        })
        return kind
      }
      await api<{ procurement: ProcurementRow }>(`/api/edu-canteen/procurement/${row.id}/${kind}`, {
        method: 'POST',
      })
      return kind
    },
    onSuccess: (done) => {
      toast.success(
        done === 'delete'
          ? t('toast.deleted')
          : done === 'confirm'
            ? t('toast.confirmSuccess')
            : t('toast.voidSuccess'),
      )
      invalidate()
      setConfirmAction(null)
      setDetailId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const applyFilters = () => {
    setPage(1)
    setApplied(filters)
  }

  const resetFilters = () => {
    setFilters(emptyFilters)
    setApplied(emptyFilters)
    setPage(1)
  }

  const update = (key: keyof LedgerFilters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const data = listQuery.data
  const rows = data?.list ?? []

  const columns: Column<ProcurementRow>[] = [
    { key: 'procurementDate', title: t('col.date'), width: 'w-28' },
    {
      key: 'supplierName',
      title: t('col.supplier'),
      render: (r) => r.supplierName ?? '—',
    },
    { key: 'receiptNo', title: t('col.receiptNo'), render: (r) => r.receiptNo ?? '—' },
    {
      key: 'totalAmount',
      title: t('col.total'),
      align: 'right',
      render: (r) => <span className="font-semibold tabular-nums">{fmtAmount(r.totalAmount)}</span>,
    },
    { key: 'itemCount', title: t('col.items'), align: 'center' },
    {
      key: 'status',
      title: t('col.status'),
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'aiRounds',
      title: t('col.aiRounds'),
      align: 'center',
      render: (r) => (
        <span className="tabular-nums">
          {t('unit.rounds', { rounds: String(r.aiRounds) })}
          {r.aiConfidence !== null && r.aiConfidence !== undefined && (
            <span className="ml-1 text-xs text-muted-foreground">
              {Math.round(r.aiConfidence)}%
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      title: t('col.actions'),
      align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip content={t('action.detail')}>
            <Button variant="ghost" size="icon-xs" onClick={() => setDetailId(r.id)}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          {r.status !== 'confirmed' && r.status !== 'voided' && (
            <Tooltip content={t('action.edit')}>
              <Button variant="ghost" size="icon-xs" onClick={() => setEditId(r.id)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          {r.status !== 'confirmed' && r.status !== 'voided' && (
            <Tooltip content={t('action.confirm')}>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setConfirmAction({ kind: 'confirm', row: r })}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </Button>
            </Tooltip>
          )}
          {r.status !== 'voided' && r.status !== 'confirmed' && (
            <Tooltip content={t('action.void')}>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setConfirmAction({ kind: 'void', row: r })}
              >
                <Ban className="h-3.5 w-3.5 text-amber-600" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t('action.delete')}>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setConfirmAction({ kind: 'delete', row: r })}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ]

  const confirmTitle = confirmAction ? t(CONFIRM_TITLE_KEYS[confirmAction.kind]) : ''
  const confirmContent = !confirmAction
    ? null
    : confirmAction.kind === 'confirm'
      ? t('confirm.descConfirm', { amount: fmtAmount(confirmAction.row.totalAmount) })
      : t(CONFIRM_DESC_KEYS[confirmAction.kind])

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <Card>
        <CardContent className="grid gap-3 py-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="grid gap-1.5">
            <Label>{t('common.startDate')}</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => update('startDate', e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('common.endDate')}</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => update('endDate', e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('col.status')}</Label>
            <Select value={filters.status} onValueChange={(v) => update('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {t(s.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('col.supplier')}</Label>
            <Select value={filters.supplierId} onValueChange={(v) => update('supplierId', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filter.allSuppliers')}</SelectItem>
                {(supplierOptions.data?.options ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('filter.keyword')}</Label>
            <Input
              value={filters.keyword}
              placeholder={t('filter.keywordPlaceholder')}
              onChange={(e) => update('keyword', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters()
              }}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} className="flex-1">
              <Search className="h-4 w-4" />
              {t('common.query')}
            </Button>
            <Button variant="outline" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4" />
              {t('common.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 台账表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            {t('tabs.ledger')}
            {data && (
              <span className="text-xs font-normal text-muted-foreground">
                {t('ledger.totalCount', { total: String(data.total) })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.id}
            loading={listQuery.isLoading}
            pagination={
              data && {
                page: data.page,
                pageSize: data.pageSize,
                total: data.total,
              }
            }
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* 详情 Dialog */}
      {detailId && (
        <ReceiptDetailDialog
          id={detailId}
          open
          onOpenChange={(v) => {
            if (!v) setDetailId(null)
          }}
          onEdit={(id) => {
            setDetailId(null)
            setEditId(id)
          }}
          onAction={(kind, row) => {
            setDetailId(null)
            setConfirmAction({ kind, row })
          }}
        />
      )}

      {/* 编辑 Dialog */}
      {editId && (
        <ProcurementEditDialog
          id={editId}
          open
          onOpenChange={(v) => {
            if (!v) setEditId(null)
          }}
        />
      )}

      {/* 记账/作废/删除确认 */}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmTitle}
        content={confirmContent}
        confirmText={t('common.confirm')}
        variant={confirmAction?.kind === 'delete' ? 'danger' : 'default'}
        loading={actionMut.isPending}
        onConfirm={() => {
          if (confirmAction) actionMut.mutate(confirmAction)
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}

/* ─── 台账详情 Dialog(含核对全记录 + 小票图) ─── */

function ReceiptDetailDialog({
  id,
  open,
  onOpenChange,
  onEdit,
  onAction,
}: {
  id: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onEdit: (id: string) => void
  onAction: (kind: 'confirm' | 'void' | 'delete', row: ProcurementRow) => void
}) {
  const t = useTranslations('eduProcurement')
  const qc = useQueryClient()
  const detail = useQuery({
    queryKey: [PROC_KEY, 'detail', id],
    queryFn: () =>
      api<{ procurement: ProcurementRow; items: ProcurementItem[] }>(
        `/api/edu-canteen/procurement/${id}`,
      ),
    enabled: open,
  })

  const verifyMut = useMutation({
    mutationFn: () =>
      api<{ procurement: ProcurementRow; verification: VerificationFull }>(
        `/api/edu-canteen/procurement/${id}/ai-verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      ),
    onSuccess: (data) => {
      toast.success(
        data.verification.ok
          ? t('detail.reverifyPassed')
          : t('detail.reverifyDiff', {
              count: String(data.verification.differences?.length ?? 0),
            }),
      )
      qc.invalidateQueries({ queryKey: [PROC_KEY] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const arbitrateMut = useMutation({
    mutationFn: () =>
      api<{ procurement: ProcurementRow; verification: VerificationFull }>(
        `/api/edu-canteen/procurement/${id}/ai-arbitrate`,
        { method: 'POST' },
      ),
    onSuccess: (data) => {
      toast.success(
        data.verification.ok ? t('detail.arbitrateDone') : t('detail.arbitrateConflict'),
      )
      qc.invalidateQueries({ queryKey: [PROC_KEY] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const p = detail.data?.procurement
  const items = detail.data?.items ?? []
  const verifications = (p?.aiVerifications ?? []) as unknown as VerificationFull[]
  const editable = p ? p.status !== 'confirmed' && p.status !== 'voided' : false
  const hasImage = p?.receiptImageUrl && p.receiptImageUrl !== '__stored__'
  const busy = verifyMut.isPending || arbitrateMut.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            <span>{t('detail.title')}</span>
            {p && <StatusBadge status={p.status} />}
          </DialogTitle>
        </DialogHeader>

        {detail.isLoading || !p ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('common.loading')}
          </div>
        ) : (
          <div className="space-y-5">
            {/* 主信息 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border bg-muted/30 p-4 text-sm md:grid-cols-3">
              <div>
                <span className="text-muted-foreground">{t('detail.dateLabel')}</span>{' '}
                {p.procurementDate}
              </div>
              <div>
                <span className="text-muted-foreground">{t('detail.supplierLabel')}</span>{' '}
                {p.supplierName ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">{t('detail.receiptNoLabel')}</span>{' '}
                {p.receiptNo ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">{t('detail.totalLabel')}</span>{' '}
                <span className="font-semibold tabular-nums">{fmtAmount(p.totalAmount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('detail.itemsLabel')}</span>{' '}
                {t('unit.items', { count: String(p.itemCount) })}
              </div>
              <div>
                <span className="text-muted-foreground">{t('detail.aiLabel')}</span>{' '}
                {t('unit.rounds', { rounds: String(p.aiRounds) })} ·{' '}
                {p.aiConfidence !== null && p.aiConfidence !== undefined
                  ? `${Math.round(p.aiConfidence)}%`
                  : '—'}
              </div>
              {p.confirmedAt && (
                <div>
                  <span className="text-muted-foreground">{t('detail.confirmedAtLabel')}</span>{' '}
                  {fmtTime(p.confirmedAt)}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">{t('detail.createdAtLabel')}</span>{' '}
                {fmtTime(p.createdAt)}
              </div>
              {p.notes && (
                <div className="col-span-2 md:col-span-3">
                  <span className="text-muted-foreground">{t('detail.notesLabel')}</span> {p.notes}
                </div>
              )}
            </div>

            {/* 明细 */}
            <div>
              <h4 className="mb-2 text-sm font-semibold">{t('detail.itemsTitle')}</h4>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t('table.itemName')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('table.category')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('table.quantity')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('table.unit')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('table.unitPrice')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('table.subtotal')}</th>
                      <th className="px-3 py-2 text-center font-medium">{t('table.check')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-5 text-center text-muted-foreground">
                          {t('detail.noItems')}
                        </td>
                      </tr>
                    ) : (
                      items.map((it) => (
                        <tr key={it.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2">{it.itemName}</td>
                          <td className="px-3 py-2 text-muted-foreground">{it.category ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {it.quantity ?? '—'}
                          </td>
                          <td className="px-3 py-2">{it.unit ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {it.unitPrice !== null && it.unitPrice !== undefined
                              ? it.unitPrice.toFixed(2)
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {fmtAmount(it.amount)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {it.verifyStatus === 'edited' ? (
                              <Badge variant="outline">{t('badge.manual')}</Badge>
                            ) : (
                              <Badge variant="secondary">AI</Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI 核对记录 */}
            {verifications.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  {t('detail.verifyRecordsTitle', { count: String(verifications.length) })}
                </h4>
                <div className="space-y-2">
                  {verifications.map((v) => {
                    const typeKey = VERIFY_TYPE_KEYS[v.type]
                    return (
                      <div key={`${v.round}-${v.at}`} className="rounded-md border p-3 text-sm">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-medium">{typeKey ? t(typeKey) : v.type}</span>
                          {v.ok ? (
                            <Badge className="bg-emerald-600">{t('badge.passed')}</Badge>
                          ) : (
                            <Badge variant="destructive">
                              {v.error ? t('badge.failed') : t('badge.differed')}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {v.model ?? '—'} · {fmtTime(v.at)} · {t('common.confidence')}{' '}
                            {v.confidence !== null && v.confidence !== undefined
                              ? `${Math.round(v.confidence)}%`
                              : '—'}
                          </span>
                        </div>
                        {v.error && <p className="text-xs text-destructive">{v.error}</p>}
                        {v.checks && v.checks.length > 0 && (
                          <ul className="space-y-0.5 text-xs text-muted-foreground">
                            {v.checks.map((c) => (
                              <li key={c.name} className="flex items-center gap-1.5">
                                {c.passed ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Ban className="h-3 w-3 text-destructive" />
                                )}
                                {c.name}:{c.detail}
                              </li>
                            ))}
                          </ul>
                        )}
                        {v.differences && v.differences.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {v.differences.map((d) => (
                              <div
                                key={d.field}
                                className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                              >
                                <span className="font-medium">{d.field}</span>: 「{d.previous}」→「
                                {d.current}」
                                {d.resolution && (
                                  <span className="ml-1">
                                    {t('detail.arbitrationNote', { resolution: d.resolution })}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 小票原图 */}
            {hasImage && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">{t('detail.imageTitle')}</h4>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.receiptImageUrl ?? undefined}
                  alt={t('detail.imageAlt')}
                  className="max-h-96 w-full rounded-md border object-contain"
                />
              </div>
            )}

            {/* 操作 */}
            <DialogFooter className="flex-wrap gap-2">
              {editable && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !hasImage}
                    onClick={() => verifyMut.mutate()}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t('detail.reverify')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !hasImage}
                    onClick={() => arbitrateMut.mutate()}
                  >
                    <Scale className="h-4 w-4" />
                    {t('detail.arbitrateBtn')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onEdit(p.id)}>
                    <Pencil className="h-4 w-4" />
                    {t('action.edit')}
                  </Button>
                  <Button
                    size="sm"
                    disabled={p.itemCount === 0}
                    onClick={() => onAction('confirm', p)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t('action.confirm')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onAction('void', p)}>
                    <Ban className="h-4 w-4" />
                    {t('action.void')}
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => onAction('delete', p)}
              >
                <Trash2 className="h-4 w-4" />
                {t('action.delete')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ─── 台账编辑 Dialog(主信息 + 明细行编辑) ─── */

interface EditableItem {
  itemName: string
  category: string
  quantity: string
  unit: string
  unitPrice: string
  amount: string
}

interface ProcurementForm {
  procurementDate: string
  supplierId: string
  supplierName: string
  receiptNo: string
  totalAmount: string
  notes: string
  items: EditableItem[]
}

const emptyItem: EditableItem = {
  itemName: '',
  category: '',
  quantity: '',
  unit: '',
  unitPrice: '',
  amount: '',
}

function ProcurementEditDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const t = useTranslations('eduProcurement')
  const qc = useQueryClient()
  const [form, setForm] = React.useState<ProcurementForm | null>(null)
  const [saving, setSaving] = React.useState(false)

  const supplierOptions = useQuery({
    queryKey: [OPT_KEY],
    queryFn: () => api<{ options: SupplierOption[] }>('/api/edu-canteen/supplier/options'),
    staleTime: 60_000,
  })

  const detail = useQuery({
    queryKey: [PROC_KEY, 'detail', id],
    queryFn: () =>
      api<{ procurement: ProcurementRow; items: ProcurementItem[] }>(
        `/api/edu-canteen/procurement/${id}`,
      ),
    enabled: open,
  })

  React.useEffect(() => {
    if (!detail.data) return
    const { procurement: p, items } = detail.data
    setForm({
      procurementDate: p.procurementDate ?? todayStr(),
      supplierId: p.supplierId ?? '',
      supplierName: p.supplierName ?? '',
      receiptNo: p.receiptNo ?? '',
      totalAmount:
        p.totalAmount !== null && p.totalAmount !== undefined ? String(p.totalAmount) : '',
      notes: p.notes ?? '',
      items:
        items.length > 0
          ? items.map((it) => ({
              itemName: it.itemName,
              category: it.category ?? '',
              quantity:
                it.quantity !== null && it.quantity !== undefined ? String(it.quantity) : '',
              unit: it.unit ?? '',
              unitPrice:
                it.unitPrice !== null && it.unitPrice !== undefined ? String(it.unitPrice) : '',
              amount: it.amount !== null && it.amount !== undefined ? String(it.amount) : '',
            }))
          : [{ ...emptyItem }],
    })
  }, [detail.data])

  const updateItem = (idx: number, key: keyof EditableItem, value: string) => {
    setForm((prev) => {
      if (!prev) return prev
      const items = prev.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it))
      // 数量/单价变更时联动重算小计(仅当三者可解析)
      const row = items[idx]
      if (row && (key === 'quantity' || key === 'unitPrice')) {
        const q = Number(row.quantity)
        const up = Number(row.unitPrice)
        if (
          row.quantity !== '' &&
          row.unitPrice !== '' &&
          Number.isFinite(q) &&
          Number.isFinite(up)
        ) {
          items[idx] = { ...row, amount: String(Number((q * up).toFixed(2))) }
        }
      }
      return { ...prev, items }
    })
  }

  const handleSave = async () => {
    if (!form) return
    const items = form.items
      .filter((it) => it.itemName.trim())
      .map((it) => ({
        itemName: it.itemName.trim(),
        category: it.category.trim() || null,
        quantity:
          it.quantity !== '' && Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : null,
        unit: it.unit.trim() || null,
        unitPrice:
          it.unitPrice !== '' && Number.isFinite(Number(it.unitPrice))
            ? Number(it.unitPrice)
            : null,
        amount: it.amount !== '' && Number.isFinite(Number(it.amount)) ? Number(it.amount) : 0,
      }))
    const sum = items.reduce((acc, it) => acc + (it.amount ?? 0), 0)
    setSaving(true)
    try {
      await api<{ procurement: ProcurementRow }>(`/api/edu-canteen/procurement/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procurementDate: form.procurementDate || undefined,
          supplierId: form.supplierId || null,
          supplierName: form.supplierName.trim() || null,
          receiptNo: form.receiptNo.trim() || null,
          totalAmount:
            form.totalAmount !== '' && Number.isFinite(Number(form.totalAmount))
              ? Number(form.totalAmount)
              : Number(sum.toFixed(2)),
          notes: form.notes.trim() || null,
          items,
        }),
      })
      toast.success(t('toast.saveSuccess'))
      qc.invalidateQueries({ queryKey: [PROC_KEY] })
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const supplierChange = (val: string) => {
    setForm((prev) => {
      if (!prev) return prev
      if (val === 'none') return { ...prev, supplierId: '', supplierName: '' }
      const opt = (supplierOptions.data?.options ?? []).find((o) => o.id === val)
      return { ...prev, supplierId: val, supplierName: opt?.name ?? prev.supplierName }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('edit.title')}</DialogTitle>
        </DialogHeader>
        {!form ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('common.loading')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('edit.dateLabel')}</Label>
                <Input
                  type="date"
                  value={form.procurementDate}
                  onChange={(e) => setForm({ ...form, procurementDate: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('col.receiptNo')}</Label>
                <Input
                  value={form.receiptNo}
                  onChange={(e) => setForm({ ...form, receiptNo: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('edit.linkSupplier')}</Label>
                <Select value={form.supplierId || 'none'} onValueChange={supplierChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('edit.supplierNone')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('edit.supplierNone')}</SelectItem>
                    {(supplierOptions.data?.options ?? []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t('edit.supplierName')}</Label>
                <Input
                  value={form.supplierName}
                  placeholder={t('edit.supplierNamePlaceholder')}
                  onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('edit.totalAmount')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.totalAmount}
                  placeholder={t('edit.totalAmountPlaceholder')}
                  onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('common.notes')}</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">{t('edit.itemsTitle')}</h4>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('edit.addRow')}
                </Button>
              </div>
              <div className="space-y-2">
                {form.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_repeat(4,minmax(0,72px))_minmax(0,84px)_32px] items-center gap-1.5"
                  >
                    <Input
                      value={it.itemName}
                      placeholder={t('table.itemName')}
                      onChange={(e) => updateItem(idx, 'itemName', e.target.value)}
                    />
                    <Input
                      value={it.quantity}
                      placeholder={t('table.quantity')}
                      inputMode="decimal"
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    />
                    <Input
                      value={it.unit}
                      placeholder={t('table.unit')}
                      onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                    />
                    <Input
                      value={it.unitPrice}
                      placeholder={t('table.unitPrice')}
                      inputMode="decimal"
                      onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                    />
                    <Input
                      value={it.amount}
                      placeholder={t('table.subtotal')}
                      inputMode="decimal"
                      onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                    />
                    <Input
                      value={it.category}
                      placeholder={t('table.category')}
                      onChange={(e) => updateItem(idx, 'category', e.target.value)}
                    />
                    <Tooltip content={t('edit.deleteRow')}>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          setForm({
                            ...form,
                            items:
                              form.items.length > 1
                                ? form.items.filter((_, i) => i !== idx)
                                : [{ ...emptyItem }],
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </Tooltip>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t('edit.itemsHint')}</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════ Tab 3 · 供应商 ═══════════════════════ */

function SupplierTab() {
  const t = useTranslations('eduProcurement')
  const [keyword, setKeyword] = React.useState('')
  const [applied, setApplied] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [editing, setEditing] = React.useState<SupplierRow | 'new' | null>(null)
  const [deleting, setDeleting] = React.useState<SupplierRow | null>(null)

  const listQuery = useQuery({
    queryKey: [SUP_KEY, 'list', applied, page],
    queryFn: () =>
      api<Paged<SupplierRow>>(
        `/api/edu-canteen/supplier${buildQuery({
          keyword: applied || undefined,
          page,
          pageSize: PAGE_SIZE,
        })}`,
      ),
    placeholderData: (prev) => prev,
  })

  const qc = useQueryClient()

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api<{ deleted: boolean }>(`/api/edu-canteen/supplier/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('toast.supplierDeleted'))
      setDeleting(null)
      qc.invalidateQueries({ queryKey: [SUP_KEY] })
      qc.invalidateQueries({ queryKey: [OPT_KEY] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const data = listQuery.data
  const rows = data?.list ?? []

  const columns: Column<SupplierRow>[] = [
    { key: 'name', title: t('supplier.colName') },
    { key: 'category', title: t('supplier.colCategory'), render: (r) => r.category ?? '—' },
    {
      key: 'contactPerson',
      title: t('supplier.colContact'),
      render: (r) => r.contactPerson ?? '—',
    },
    { key: 'phone', title: t('supplier.colPhone'), render: (r) => r.phone ?? '—' },
    {
      key: 'status',
      title: t('col.status'),
      render: (r) =>
        r.status === 'active' ? (
          <Badge className="bg-emerald-600">{t('supplier.active')}</Badge>
        ) : (
          <Badge variant="secondary">{t('supplier.inactive')}</Badge>
        ),
    },
    {
      key: 'actions',
      title: t('col.actions'),
      align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip content={t('action.edit')}>
            <Button variant="ghost" size="icon-xs" onClick={() => setEditing(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={t('action.delete')}>
            <Button variant="ghost" size="icon-xs" onClick={() => setDeleting(r)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="grid w-64 gap-1.5">
            <Label>{t('supplier.searchLabel')}</Label>
            <Input
              value={keyword}
              placeholder={t('supplier.searchPlaceholder')}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1)
                  setApplied(keyword.trim())
                }
              }}
            />
          </div>
          <Button
            onClick={() => {
              setPage(1)
              setApplied(keyword.trim())
            }}
          >
            <Search className="h-4 w-4" />
            {t('common.query')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setKeyword('')
              setApplied('')
              setPage(1)
            }}
          >
            <RotateCcw className="h-4 w-4" />
            {t('common.reset')}
          </Button>
          <Button className="ml-auto" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            {t('supplier.create')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" />
            {t('supplier.profile')}
            {data && (
              <span className="text-xs font-normal text-muted-foreground">
                {t('supplier.totalCount', { total: String(data.total) })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.id}
            loading={listQuery.isLoading}
            pagination={data && { page: data.page, pageSize: data.pageSize, total: data.total }}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {editing && (
        <SupplierEditDialog
          initial={editing === 'new' ? null : editing}
          open
          onOpenChange={(v) => {
            if (!v) setEditing(null)
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('supplier.deleteTitle')}
        variant="danger"
        content={deleting ? t('supplier.deleteConfirm', { name: deleting.name }) : null}
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (deleting) deleteMut.mutate(deleting.id)
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function SupplierEditDialog({
  initial,
  open,
  onOpenChange,
}: {
  initial: SupplierRow | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const t = useTranslations('eduProcurement')
  const qc = useQueryClient()
  const [form, setForm] = React.useState({
    name: '',
    category: '',
    contactPerson: '',
    phone: '',
    address: '',
    licenseInfo: '',
    status: 'active',
    notes: '',
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        category: initial.category ?? '',
        contactPerson: initial.contactPerson ?? '',
        phone: initial.phone ?? '',
        address: initial.address ?? '',
        licenseInfo: initial.licenseInfo ?? '',
        status: initial.status ?? 'active',
        notes: initial.notes ?? '',
      })
    } else {
      setForm({
        name: '',
        category: '',
        contactPerson: '',
        phone: '',
        address: '',
        licenseInfo: '',
        status: 'active',
        notes: '',
      })
    }
  }, [initial, open])

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('supplier.nameRequired'))
      return
    }
    const body = {
      name: form.name.trim(),
      category: form.category.trim() || undefined,
      contactPerson: form.contactPerson.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      licenseInfo: form.licenseInfo.trim() || undefined,
      status: form.status as 'active' | 'inactive',
      notes: form.notes.trim() || undefined,
    }
    setSaving(true)
    try {
      if (initial) {
        await api(`/api/edu-canteen/supplier/${initial.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        await api('/api/edu-canteen/supplier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      toast.success(initial ? t('toast.supplierUpdated') : t('toast.supplierCreated'))
      qc.invalidateQueries({ queryKey: [SUP_KEY] })
      qc.invalidateQueries({ queryKey: [OPT_KEY] })
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? t('supplier.editTitle') : t('supplier.create')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('supplier.nameLabel')}</Label>
              <Input value={form.name} onChange={(e) => update('name', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('supplier.colCategory')}</Label>
              <Select
                value={form.category || 'none'}
                onValueChange={(v) => update('category', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.pleaseSelect')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('supplier.uncategorized')}</SelectItem>
                  {SUPPLIER_CATEGORIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {t(item.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('supplier.colContact')}</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => update('contactPerson', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('supplier.colPhone')}</Label>
              <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('col.status')}</Label>
              <Select value={form.status} onValueChange={(v) => update('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('supplier.active')}</SelectItem>
                  <SelectItem value="inactive">{t('supplier.inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('supplier.license')}</Label>
              <Input
                value={form.licenseInfo}
                placeholder={t('supplier.licensePlaceholder')}
                onChange={(e) => update('licenseInfo', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('supplier.address')}</Label>
            <Input value={form.address} onChange={(e) => update('address', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('common.notes')}</Label>
            <Input value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════ 页面入口 ═══════════════════════ */

export default function CanteenProcurementPage() {
  const t = useTranslations('eduProcurement')
  const [tab, setTab] = React.useState('ai')
  const [focusId, setFocusId] = React.useState<string | null>(null)

  /** AI 录入完成 → 跳台账并自动打开该单详情。 */
  const goLedger = (id: string) => {
    setFocusId(id)
    setTab('ledger')
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <BackButton />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('pageDescription')}</p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="ai">
            <ScanLine className="mr-1.5 h-4 w-4" />
            <span>{t('tabs.capture')}</span>
          </TabsTrigger>
          <TabsTrigger value="ledger">
            <Receipt className="mr-1.5 h-4 w-4" />
            <span>{t('tabs.ledger')}</span>
          </TabsTrigger>
          <TabsTrigger value="supplier">
            <Truck className="mr-1.5 h-4 w-4" />
            <span>{t('tabs.supplier')}</span>
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            <span>{t('tabs.stats')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-4">
          <AiCaptureTab onGoLedger={goLedger} />
        </TabsContent>
        <TabsContent value="ledger" className="mt-4">
          <LedgerTab focusId={focusId} />
        </TabsContent>
        <TabsContent value="supplier" className="mt-4">
          <SupplierTab />
        </TabsContent>
        <TabsContent value="stats" className="mt-4">
          <StatsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
