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

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-muted text-muted-foreground' },
  ai_extracted: {
    label: 'AI已识别',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  ai_verified: {
    label: 'AI已核对',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  ai_conflict: {
    label: 'AI存疑',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  confirmed: { label: '已记账', className: 'bg-green-600 text-white' },
  voided: { label: '已作废', className: 'bg-zinc-200 text-zinc-500 line-through' },
}

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'ai_extracted', label: 'AI已识别' },
  { value: 'ai_verified', label: 'AI已核对' },
  { value: 'ai_conflict', label: 'AI存疑' },
  { value: 'confirmed', label: '已记账' },
  { value: 'voided', label: '已作废' },
]

const SUPPLIER_CATEGORIES = ['蔬菜', '肉禽', '水产', '粮油', '调味', '冻品', '其他']

const VERIFY_TYPE_LABEL: Record<string, string> = {
  extract: '第1轮 · 结构化抽取',
  verify: '第2轮 · 独立交叉核对',
  arbitrate: '第3轮 · 差异仲裁',
}

const PAGE_SIZE = 20

/* ─── Helpers ─── */

function statusLabel(status: string): string {
  return STATUS_META[status]?.label ?? status
}

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
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        meta?.className ?? 'bg-muted text-muted-foreground',
      )}
    >
      {statusLabel(status)}
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
  if (rows.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">暂无数据</p>
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
      toast.success(format === 'xlsx' ? 'Excel 已导出' : 'CSV 已导出(UTF-8 BOM,Excel 可直接打开)')
    } catch {
      toast.error('导出失败,请重试')
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
            <Label>统计口径</Label>
            <Select
              value={filters.scope}
              onValueChange={(v) => setFilters({ ...filters, scope: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">仅已记账(财务口径)</SelectItem>
                <SelectItem value="all">全部单据(含草稿/存疑)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>开始日期</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>结束日期</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <Button onClick={apply}>
            <Search className="h-4 w-4" />
            统计
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            重置
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
            导出 Excel(按明细行)
          </Button>
          <Button variant="outline" disabled={exporting} onClick={() => exportData('csv')}>
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            导出 CSV
          </Button>
        </CardContent>
      </Card>

      {/* 汇总卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="采购总额"
          value={s ? fmtAmount(s.summary.totalAmount) : '—'}
          icon={Receipt}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title="单据数"
          value={s ? String(s.summary.procurementCount) : '—'}
          icon={BarChart3}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title="明细条目"
          value={s ? String(s.summary.itemCount) : '—'}
          icon={Truck}
          loading={statsQuery.isLoading}
        />
        <StatCard
          title="单均金额"
          value={s ? fmtAmount(s.summary.avgAmount) : '—'}
          icon={CheckCircle2}
          loading={statsQuery.isLoading}
        />
      </div>

      {/* 榜单 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">品类支出排行</CardTitle>
          </CardHeader>
          <CardContent>
            <RankList
              rows={(s?.byCategory ?? []) as unknown as Array<Record<string, unknown>>}
              amountKey="amount"
              countKey="itemCount"
              countLabel="条目"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">供应商支出 Top10</CardTitle>
          </CardHeader>
          <CardContent>
            <RankList
              rows={(s?.bySupplier ?? []) as unknown as Array<Record<string, unknown>>}
              amountKey="amount"
              countKey="procurementCount"
              countLabel="单"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">月度趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <RankList
              rows={(s?.byMonth ?? []) as unknown as Array<Record<string, unknown>>}
              amountKey="amount"
              countKey="procurementCount"
              countLabel="单"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ═══════════════════════ Tab 1 · AI 拍照记账 ═══════════════════════ */

function AiCaptureTab({ onGoLedger }: { onGoLedger: (id: string) => void }) {
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
      toast.success(`小票识别完成:${statusLabel(data.procurement.status)}`)
      qc.invalidateQueries({ queryKey: [PROC_KEY] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('图片不能超过 9MB,请压缩后重试')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImageUrl(String(reader.result ?? ''))
      setResult(null)
    }
    reader.onerror = () => toast.error('图片读取失败')
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
            拍照/上传采购小票
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
                <img src={imageUrl} alt="采购小票预览" className="max-h-80 w-full object-contain" />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{(imageUrl.length / 1024 / 1024).toFixed(2)} MB(data URI)</span>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={analyzing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  重新选择
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
              <span className="text-sm font-medium">点击选择小票照片</span>
              <span className="text-xs">支持拍照或相册,JPG/PNG/WEBP,≤9MB</span>
            </button>
          )}

          <div className="grid gap-1.5">
            <Label>识别提示(可选)</Label>
            <Input
              value={hint}
              maxLength={200}
              placeholder="如:日期是 9 月 18 日;供应商是 XX 农贸"
              onChange={(e) => setHint(e.target.value)}
              disabled={analyzing}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>备注(可选)</Label>
            <Input
              value={notes}
              maxLength={1000}
              placeholder="如:本周蔬菜批量采购"
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
              label={<span>保留小票图到台账(可事后重核对/仲裁;不勾则省存储)</span>}
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
                  AI 三轮核对中…
                </>
              ) : (
                <>
                  <ScanLine className="h-4 w-4" />
                  开始识别记账
                </>
              )}
            </Button>
            {(imageUrl || result) && !analyzing && (
              <Button variant="outline" onClick={resetAll}>
                <RotateCcw className="h-4 w-4" />
                清空
              </Button>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            流水线:第 1 轮结构化抽取 → 第 2 轮独立重识别交叉核对(防锚定 + 数学自检) → 有差异时第 3
            轮带图差异仲裁 → 自动落台账草稿,人工确认后方计账。
          </p>
        </CardContent>
      </Card>

      {/* 右:识别结果 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            识别结果
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analyzing && (
            <div className="space-y-3 py-8">
              {['第 1 轮 · 结构化抽取', '第 2 轮 · 独立交叉核对', '第 3 轮 · 差异仲裁(如有)'].map(
                (step) => (
                  <div
                    key={step}
                    className="flex items-center gap-3 rounded-md border bg-muted/30 px-4 py-3 text-sm"
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    {step}
                  </div>
                ),
              )}
              <p className="text-center text-xs text-muted-foreground">
                图片越大识别越慢,通常 10~40 秒,请勿关闭页面
              </p>
            </div>
          )}

          {!analyzing && !p && (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
              <ScanLine className="h-10 w-10 opacity-30" />
              <p className="text-sm">上传小票并点击"开始识别记账"</p>
              <p className="text-xs">识别结果将在此展示,可人工修正后计入台账</p>
            </div>
          )}

          {!analyzing && p && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={p.status} />
                <span className="text-xs text-muted-foreground">
                  共 {p.aiRounds} 轮核对 · 置信度{' '}
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
                  在台账中处理
                </Button>
              </div>

              {p.status === 'ai_conflict' && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  三轮核对后仍有分歧:请对照左侧原图人工核对明细,修正后在台账中"记账"。
                </div>
              )}
              {p.status === 'ai_verified' && (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  两轮独立识别一致且数学自检通过,可在台账中一键记账。
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border bg-muted/30 p-4 text-sm">
                <div>
                  <span className="text-muted-foreground">供应商:</span> {p.supplierName ?? '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">采购日期:</span> {p.procurementDate}
                </div>
                <div>
                  <span className="text-muted-foreground">单号:</span> {p.receiptNo ?? '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">单据总额:</span>{' '}
                  <span className="font-semibold tabular-nums">{fmtAmount(p.totalAmount)}</span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">品名</th>
                      <th className="px-3 py-2 text-left font-medium">类别</th>
                      <th className="px-3 py-2 text-right font-medium">数量</th>
                      <th className="px-3 py-2 text-left font-medium">单位</th>
                      <th className="px-3 py-2 text-right font-medium">单价</th>
                      <th className="px-3 py-2 text-right font-medium">小计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-5 text-center text-muted-foreground">
                          未识别到明细,请在台账编辑中手工补录
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

              {p.notes && <p className="text-xs text-muted-foreground">备注:{p.notes}</p>}
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
    }) => {
      if (kind === 'delete') {
        await api<{ deleted: boolean }>(`/api/edu-canteen/procurement/${row.id}`, {
          method: 'DELETE',
        })
        return '已删除'
      }
      const map = { confirm: '记账', void: '作废' } as const
      await api<{ procurement: ProcurementRow }>(`/api/edu-canteen/procurement/${row.id}/${kind}`, {
        method: 'POST',
      })
      return `${map[kind]}成功`
    },
    onSuccess: (msg) => {
      toast.success(msg)
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
    { key: 'procurementDate', title: '日期', width: 'w-28' },
    {
      key: 'supplierName',
      title: '供应商',
      render: (r) => r.supplierName ?? '—',
    },
    { key: 'receiptNo', title: '单号', render: (r) => r.receiptNo ?? '—' },
    {
      key: 'totalAmount',
      title: '总额',
      align: 'right',
      render: (r) => <span className="font-semibold tabular-nums">{fmtAmount(r.totalAmount)}</span>,
    },
    { key: 'itemCount', title: '明细', align: 'center' },
    {
      key: 'status',
      title: '状态',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'aiRounds',
      title: 'AI轮次',
      align: 'center',
      render: (r) => (
        <span className="tabular-nums">
          {r.aiRounds} 轮
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
      title: '操作',
      align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip content="详情">
            <Button variant="ghost" size="icon-xs" onClick={() => setDetailId(r.id)}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          {r.status !== 'confirmed' && r.status !== 'voided' && (
            <Tooltip content="编辑">
              <Button variant="ghost" size="icon-xs" onClick={() => setEditId(r.id)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          {r.status !== 'confirmed' && r.status !== 'voided' && (
            <Tooltip content="记账">
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
            <Tooltip content="作废">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setConfirmAction({ kind: 'void', row: r })}
              >
                <Ban className="h-3.5 w-3.5 text-amber-600" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content="删除">
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

  const pendingRow = confirmAction?.row
  const confirmTextMap = {
    confirm: '确认记账',
    void: '确认作废',
    delete: '确认删除',
  } as const
  const confirmDescMap = {
    confirm: `记账后将计入统计口径(总额 ${fmtAmount(pendingRow?.totalAmount)}),仍可作废。`,
    void: `作废后不再计入统计,单据保留可查。`,
    delete: '删除为软删除,后台可恢复,前端不再显示。',
  } as const

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <Card>
        <CardContent className="grid gap-3 py-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="grid gap-1.5">
            <Label>开始日期</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => update('startDate', e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>结束日期</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => update('endDate', e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>状态</Label>
            <Select value={filters.status} onValueChange={(v) => update('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>供应商</Label>
            <Select value={filters.supplierId} onValueChange={(v) => update('supplierId', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部供应商</SelectItem>
                {(supplierOptions.data?.options ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>关键字</Label>
            <Input
              value={filters.keyword}
              placeholder="供应商/单号"
              onChange={(e) => update('keyword', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters()
              }}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} className="flex-1">
              <Search className="h-4 w-4" />
              查询
            </Button>
            <Button variant="outline" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4" />
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 台账表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            采购台账
            {data && (
              <span className="text-xs font-normal text-muted-foreground">共 {data.total} 单</span>
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
        title={confirmAction ? confirmTextMap[confirmAction.kind] : ''}
        content={confirmAction ? confirmDescMap[confirmAction.kind] : null}
        confirmText="确认"
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
          ? '重核对通过:两轮结果一致'
          : `重核对发现 ${data.verification.differences?.length ?? 0} 处差异,可仲裁或人工修正`,
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
        data.verification.ok ? '仲裁完成:已按图采信并更新明细' : '仲裁仍有分歧,请人工核对',
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
            <span>采购单详情</span>
            {p && <StatusBadge status={p.status} />}
          </DialogTitle>
        </DialogHeader>

        {detail.isLoading || !p ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中…
          </div>
        ) : (
          <div className="space-y-5">
            {/* 主信息 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border bg-muted/30 p-4 text-sm md:grid-cols-3">
              <div>
                <span className="text-muted-foreground">采购日期:</span> {p.procurementDate}
              </div>
              <div>
                <span className="text-muted-foreground">供应商:</span> {p.supplierName ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">单号:</span> {p.receiptNo ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">总额:</span>{' '}
                <span className="font-semibold tabular-nums">{fmtAmount(p.totalAmount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">明细:</span> {p.itemCount} 条
              </div>
              <div>
                <span className="text-muted-foreground">AI:</span> {p.aiRounds} 轮 ·{' '}
                {p.aiConfidence !== null && p.aiConfidence !== undefined
                  ? `${Math.round(p.aiConfidence)}%`
                  : '—'}
              </div>
              {p.confirmedAt && (
                <div>
                  <span className="text-muted-foreground">记账时间:</span> {fmtTime(p.confirmedAt)}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">创建:</span> {fmtTime(p.createdAt)}
              </div>
              {p.notes && (
                <div className="col-span-2 md:col-span-3">
                  <span className="text-muted-foreground">备注:</span> {p.notes}
                </div>
              )}
            </div>

            {/* 明细 */}
            <div>
              <h4 className="mb-2 text-sm font-semibold">采购明细</h4>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">品名</th>
                      <th className="px-3 py-2 text-left font-medium">类别</th>
                      <th className="px-3 py-2 text-right font-medium">数量</th>
                      <th className="px-3 py-2 text-left font-medium">单位</th>
                      <th className="px-3 py-2 text-right font-medium">单价</th>
                      <th className="px-3 py-2 text-right font-medium">小计</th>
                      <th className="px-3 py-2 text-center font-medium">核对</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-5 text-center text-muted-foreground">
                          无明细
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
                              <Badge variant="outline">人工</Badge>
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
                  AI 核对记录({verifications.length} 轮)
                </h4>
                <div className="space-y-2">
                  {verifications.map((v) => (
                    <div key={`${v.round}-${v.at}`} className="rounded-md border p-3 text-sm">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-medium">{VERIFY_TYPE_LABEL[v.type] ?? v.type}</span>
                        {v.ok ? (
                          <Badge className="bg-emerald-600">通过</Badge>
                        ) : (
                          <Badge variant="destructive">{v.error ? '失败' : '差异'}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {v.model ?? '—'} · {fmtTime(v.at)} · 置信度{' '}
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
                              {d.resolution && <span className="ml-1">(仲裁:{d.resolution})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 小票原图 */}
            {hasImage && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">小票原图</h4>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.receiptImageUrl ?? undefined}
                  alt="采购小票"
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
                    重新核对
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !hasImage}
                    onClick={() => arbitrateMut.mutate()}
                  >
                    <Scale className="h-4 w-4" />
                    差异仲裁
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onEdit(p.id)}>
                    <Pencil className="h-4 w-4" />
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    disabled={p.itemCount === 0}
                    onClick={() => onAction('confirm', p)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    记账
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onAction('void', p)}>
                    <Ban className="h-4 w-4" />
                    作废
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
                删除
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
      toast.success('保存成功')
      qc.invalidateQueries({ queryKey: [PROC_KEY] })
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败')
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
          <DialogTitle>编辑采购单</DialogTitle>
        </DialogHeader>
        {!form ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>采购日期</Label>
                <Input
                  type="date"
                  value={form.procurementDate}
                  onChange={(e) => setForm({ ...form, procurementDate: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>单号</Label>
                <Input
                  value={form.receiptNo}
                  onChange={(e) => setForm({ ...form, receiptNo: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>关联供应商</Label>
                <Select value={form.supplierId || 'none'} onValueChange={supplierChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="不关联" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联</SelectItem>
                    {(supplierOptions.data?.options ?? []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>供应商名称(AI 识别)</Label>
                <Input
                  value={form.supplierName}
                  placeholder="可手改"
                  onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>单据总额(元)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.totalAmount}
                  placeholder="留空按明细合计"
                  onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>备注</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">采购明细(可增删改)</h4>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  加一行
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
                      placeholder="品名"
                      onChange={(e) => updateItem(idx, 'itemName', e.target.value)}
                    />
                    <Input
                      value={it.quantity}
                      placeholder="数量"
                      inputMode="decimal"
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    />
                    <Input
                      value={it.unit}
                      placeholder="单位"
                      onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                    />
                    <Input
                      value={it.unitPrice}
                      placeholder="单价"
                      inputMode="decimal"
                      onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                    />
                    <Input
                      value={it.amount}
                      placeholder="小计"
                      inputMode="decimal"
                      onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                    />
                    <Input
                      value={it.category}
                      placeholder="类别"
                      onChange={(e) => updateItem(idx, 'category', e.target.value)}
                    />
                    <Tooltip content="删除该行">
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
              <p className="mt-1 text-xs text-muted-foreground">
                品名留空的行保存时自动忽略;数量×单价会自动算小计;总额留空按明细合计。
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
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
      toast.success('供应商已删除')
      setDeleting(null)
      qc.invalidateQueries({ queryKey: [SUP_KEY] })
      qc.invalidateQueries({ queryKey: [OPT_KEY] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const data = listQuery.data
  const rows = data?.list ?? []

  const columns: Column<SupplierRow>[] = [
    { key: 'name', title: '名称' },
    { key: 'category', title: '分类', render: (r) => r.category ?? '—' },
    { key: 'contactPerson', title: '联系人', render: (r) => r.contactPerson ?? '—' },
    { key: 'phone', title: '电话', render: (r) => r.phone ?? '—' },
    {
      key: 'status',
      title: '状态',
      render: (r) =>
        r.status === 'active' ? (
          <Badge className="bg-emerald-600">合作中</Badge>
        ) : (
          <Badge variant="secondary">停用</Badge>
        ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip content="编辑">
            <Button variant="ghost" size="icon-xs" onClick={() => setEditing(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content="删除">
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
            <Label>搜索供应商</Label>
            <Input
              value={keyword}
              placeholder="名称关键字"
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
            查询
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
            重置
          </Button>
          <Button className="ml-auto" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            新建供应商
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" />
            供应商档案
            {data && (
              <span className="text-xs font-normal text-muted-foreground">共 {data.total} 家</span>
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
        title="删除供应商"
        variant="danger"
        content={deleting ? `确认删除「${deleting.name}」?软删除,历史采购台账保留不受影响。` : null}
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
      toast.error('供应商名称不能为空')
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
      toast.success(initial ? '供应商已更新' : '供应商已创建')
      qc.invalidateQueries({ queryKey: [SUP_KEY] })
      qc.invalidateQueries({ queryKey: [OPT_KEY] })
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? '编辑供应商' : '新建供应商'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>名称 *</Label>
              <Input value={form.name} onChange={(e) => update('name', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>分类</Label>
              <Select
                value={form.category || 'none'}
                onValueChange={(v) => update('category', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未分类</SelectItem>
                  {SUPPLIER_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>联系人</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => update('contactPerson', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>电话</Label>
              <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>状态</Label>
              <Select value={form.status} onValueChange={(v) => update('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">合作中</SelectItem>
                  <SelectItem value="inactive">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>资质证照</Label>
              <Input
                value={form.licenseInfo}
                placeholder="营业执照/食品经营许可"
                onChange={(e) => update('licenseInfo', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>地址</Label>
            <Input value={form.address} onChange={(e) => update('address', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>备注</Label>
            <Input value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════ 页面入口 ═══════════════════════ */

export default function CanteenProcurementPage() {
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
        <h1 className="text-2xl font-bold tracking-tight">食堂采购记账</h1>
        <p className="text-sm text-muted-foreground">
          AI 拍照识别小票 · 三轮交叉核对(抽取→比对→仲裁)· 台账 / 供应商 / 统计一站式管理,移动端同步
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="ai">
            <ScanLine className="mr-1.5 h-4 w-4" />
            拍照记账
          </TabsTrigger>
          <TabsTrigger value="ledger">
            <Receipt className="mr-1.5 h-4 w-4" />
            采购台账
          </TabsTrigger>
          <TabsTrigger value="supplier">
            <Truck className="mr-1.5 h-4 w-4" />
            供应商
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            统计分析
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
