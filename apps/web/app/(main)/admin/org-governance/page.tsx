// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * G6 企业治理控制台(2026-10-30 立,管理端 Web 面)
 *
 * 消费后端已挂载的 /api/org/* 契约(org-billing.ts,组织管理员守卫):
 *   - GET /api/org/billing/summary?from=&to=  组织统账:按成员 / 按模型 / 按日 + agent_billings 参考汇总
 *   - GET /api/org/policies                   本组织策略行(含停用行)
 *   - PUT /api/org/policies/:key              策略 upsert(version+1)
 *
 * 五个区块(纵向卡片):
 *   1. 组织概览 —— 组织 id + 统计周期(默认最近 30 天,可改后点「查询」重新取数)
 *   2. 成员用量 —— byMember 表(userId / cost / tokens / calls)
 *   3. 模型用量 —— byModel 表 + 折叠的 byDay 明细 + agentBillings(平台级,仅参考)
 *   4. 策略编辑 —— 四键各一块,policyValue 逐键构造以对齐后端 zod 严格校验
 *   5. 策略留痕 —— **没有独立审计端点**(已 grep apps/api/src/routes 确认),故用策略行自身字段
 *      (policyKey / version / enabled / updatedAt)按 updatedAt 倒序呈现,并如实标注来源。
 *
 * 数据获取一律 fetchApi 直调(不新增 api-client 端点,与 settings/billing 同姿势);
 * 401/403 渲染整页权限空态,不发 toast 噪音。
 */

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Building2, Coins, Database, Layers, ScrollText, ShieldCheck } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui-react'
import { AuthGatePrompt } from '@/components/common'
import { fetchApi } from '@/lib/api'
import { useAuthGate } from '@/hooks/use-auth-gate'

/** 四个策略键(与后端 isOrgPolicyKey / policyValueSchemas 完全同集合) */
const POLICY_KEYS = [
  'model_allowlist',
  'feature_flags',
  'spend_budget_daily',
  'data_retention_days',
] as const

type PolicyKey = (typeof POLICY_KEYS)[number]

/** 策略键 → i18n 标题键(静态映射,避免模板串拼 key) */
const POLICY_TITLE_KEY: Record<PolicyKey, string> = {
  model_allowlist: 'policyModelAllowlist',
  feature_flags: 'policyFeatureFlags',
  spend_budget_daily: 'policySpendBudgetDaily',
  data_retention_days: 'policyDataRetentionDays',
}

interface OrgMemberUsage {
  userId: string
  cost: string
  tokens: number
  calls: number
}

interface OrgModelUsage {
  model: string
  cost: string
  tokens: number
  calls: number
}

interface OrgDayUsage {
  date: string
  cost: string
  tokens: number
  calls: number
}

interface OrgAgentBillingModel {
  modelId: string
  balance: string
  tokens: number
  calls: number
}

/** GET /api/org/billing/summary 的 data 精确形状 */
interface OrgBillingSummary {
  orgId: string
  period: { from: string; to: string }
  byMember: OrgMemberUsage[]
  byModel: OrgModelUsage[]
  byDay: OrgDayUsage[]
  agentBillings: { note: string; byModel: OrgAgentBillingModel[] }
}

/** GET /api/org/policies 的行形状(policyValue 为 jsonb,逐键解析) */
interface OrgPolicyRow {
  id: string
  orgId: string
  policyKey: PolicyKey
  policyValue: unknown
  enabled: boolean
  version: number
  createdAt: string
  updatedAt: string
}

// 稳定的空数组常量:避免 `?? []` 每次渲染产生新引用(useMemo 依赖与空态判断都要稳定)
const EMPTY_MEMBERS: OrgMemberUsage[] = []
const EMPTY_MODELS: OrgModelUsage[] = []
const EMPTY_DAYS: OrgDayUsage[] = []
const EMPTY_AGENT_MODELS: OrgAgentBillingModel[] = []
const EMPTY_POLICIES: OrgPolicyRow[] = []

/** 相对今天偏移 days 天的 YYYY-MM-DD(UTC 口径,与后端 ISO 入参对齐) */
function dateInputValue(offsetDays: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - offsetDays)
  return d.toISOString().slice(0, 10)
}

/** 日期输入值 → ISO 起点(当日 00:00:00.000Z) */
function toIsoStart(date: string): string {
  return `${date}T00:00:00.000Z`
}

/** 日期输入值 → ISO 终点(当日 23:59:59.999Z) */
function toIsoEnd(date: string): string {
  return `${date}T23:59:59.999Z`
}

/** fetchApi 失败 → 携带 HTTP status 的 Error,供 401/403 判定 */
function toHttpError(res: { error: string; status?: number }): Error {
  const err = new Error(res.error)
  ;(err as Error & { status?: number }).status = res.status
  return err
}

/** 401/403 → 整页权限空态(不弹 toast) */
function isForbiddenError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  return status === 401 || status === 403
}

/** 时间戳展示:UTC 到秒;非法值原样回显(不造「Invalid Date」) */
function formatTs(value: string): string {
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return value
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19)
}

/** 指标单元格:cost 为 numeric 字符串,原样展示(避免精度二次截断) */
function UsageCells({ cost, tokens, calls }: { cost: string; tokens: number; calls: number }) {
  return (
    <>
      <TableCell className="text-xs">{cost}</TableCell>
      <TableCell className="text-xs">{tokens}</TableCell>
      <TableCell className="text-xs">{calls}</TableCell>
    </>
  )
}

/**
 * 单键策略编辑块。
 *
 * 每次策略行版本变化时由父级用 key 重新挂载 ⇒ 表单回到服务端最新值,
 * 不需要在组件内写「props → state 同步」的 effect(那是无限重渲染的来源)。
 */
function PolicyEditor({
  policyKey,
  row,
  saving,
  disabled,
  onSave,
  t,
}: {
  policyKey: PolicyKey
  row?: OrgPolicyRow
  saving: boolean
  disabled: boolean
  onSave: (input: { key: PolicyKey; policyValue: unknown; enabled: boolean }) => void
  t: (key: string) => string
}) {
  const raw = (row?.policyValue ?? {}) as Record<string, unknown>
  const enabledNow = row?.enabled ?? true

  const [modelIdsText, setModelIdsText] = React.useState(() =>
    policyKey === 'model_allowlist' && Array.isArray(raw.modelIds)
      ? (raw.modelIds as string[]).join('\n')
      : '',
  )
  const [mode, setMode] = React.useState<'allow' | 'block'>(
    policyKey === 'model_allowlist' && raw.mode === 'block' ? 'block' : 'allow',
  )
  const [flagsText, setFlagsText] = React.useState(() =>
    policyKey === 'feature_flags'
      ? Object.entries(raw)
          .map(([k, v]) => `${k}=${v === true ? 'true' : 'false'}`)
          .join('\n')
      : '',
  )
  const [credits, setCredits] = React.useState(() =>
    policyKey === 'spend_budget_daily' && typeof raw.credits === 'number'
      ? String(raw.credits)
      : '0',
  )
  const [days, setDays] = React.useState(() =>
    policyKey === 'data_retention_days' && typeof raw.days === 'number' ? String(raw.days) : '7',
  )

  // feature_flags 文本域逐行 `flagName=true|false`:非法行给出可见提示(不静默丢弃)
  const flagLines = flagsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const flagsInvalid = flagLines.some((line) => {
    const eq = line.indexOf('=')
    if (eq <= 0) return true
    const v = line.slice(eq + 1).trim().toLowerCase()
    return v !== 'true' && v !== 'false'
  })

  const handleSave = () => {
    let policyValue: unknown
    if (policyKey === 'model_allowlist') {
      policyValue = {
        modelIds: modelIdsText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        mode,
      }
    } else if (policyKey === 'feature_flags') {
      const flags: Record<string, boolean> = {}
      for (const line of flagLines) {
        const eq = line.indexOf('=')
        if (eq <= 0) continue
        flags[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().toLowerCase() === 'true'
      }
      policyValue = flags
    } else if (policyKey === 'spend_budget_daily') {
      const n = Number(credits)
      policyValue = { credits: Number.isFinite(n) ? n : 0 }
    } else {
      const n = Number(days)
      policyValue = { days: Number.isFinite(n) ? n : 1 }
    }
    onSave({ key: policyKey, policyValue, enabled: enabledNow })
  }

  return (
    <div
      data-testid={`org-policy-${policyKey}`}
      className="space-y-2 rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t(POLICY_TITLE_KEY[policyKey])}</span>
        <span className="text-xs text-muted-foreground">
          {t('version')}: v{row?.version ?? '—'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span data-testid={`policy-${policyKey}-version`}>
          {t('version')}: {row?.version ?? '—'}
        </span>
        <span data-testid={`policy-${policyKey}-enabled`}>
          {t('status')}: {enabledNow ? t('enabled') : t('disabled')}
        </span>
        <span data-testid={`policy-${policyKey}-updated-at`}>
          {t('updatedAt')}: {row ? formatTs(row.updatedAt) : '—'}
        </span>
      </div>

      {policyKey === 'model_allowlist' ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('allowlistHint')}</p>
          <textarea
            data-testid={`policy-${policyKey}-input`}
            value={modelIdsText}
            onChange={(e) => setModelIdsText(e.target.value)}
            rows={4}
            className="w-full rounded-sm border border-input bg-transparent p-2 text-sm shadow-sm focus-visible:border-primary focus-visible:outline-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('allowlistMode')}</span>
            <select
              data-testid={`policy-${policyKey}-mode`}
              value={mode}
              onChange={(e) => setMode(e.target.value === 'block' ? 'block' : 'allow')}
              className="rounded-sm border border-input bg-transparent px-2 py-1 text-xs"
            >
              <option value="allow">{t('modeAllow')}</option>
              <option value="block">{t('modeBlock')}</option>
            </select>
          </div>
        </div>
      ) : null}

      {policyKey === 'feature_flags' ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('flagsHint')}</p>
          <textarea
            data-testid={`policy-${policyKey}-input`}
            value={flagsText}
            onChange={(e) => setFlagsText(e.target.value)}
            rows={4}
            className="w-full rounded-sm border border-input bg-transparent p-2 text-sm shadow-sm focus-visible:border-primary focus-visible:outline-none"
          />
          {flagsInvalid ? (
            <p data-testid={`policy-${policyKey}-invalid`} className="text-xs text-destructive">
              {t('flagsInvalid')}
            </p>
          ) : null}
        </div>
      ) : null}

      {policyKey === 'spend_budget_daily' ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('spendBudgetHint')}</p>
          <Input
            data-testid={`policy-${policyKey}-input`}
            type="number"
            min={0}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            className="max-w-[200px]"
          />
        </div>
      ) : null}

      {policyKey === 'data_retention_days' ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('retentionHint')}</p>
          <Input
            data-testid={`policy-${policyKey}-input`}
            type="number"
            min={1}
            step={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="max-w-[200px]"
          />
        </div>
      ) : null}

      <Button
        type="button"
        size="sm"
        data-testid={`policy-${policyKey}-save`}
        disabled={disabled}
        onClick={handleSave}
      >
        {saving ? t('saving') : t('save')}
      </Button>
    </div>
  )
}

export default function OrgGovernancePage() {
  const t = useTranslations('adminOrgGovernance')
  // 登录态门(与 settings/billing 同型):未就绪/未登录不发注定 401 的挂载请求
  const { allow } = useAuthGate()
  const qc = useQueryClient()

  const [fromInput, setFromInput] = React.useState(() => dateInputValue(30))
  const [toInput, setToInput] = React.useState(() => dateInputValue(0))
  // 已生效的统计周期(点「查询」才切换,避免打字过程疯狂取数)
  const [range, setRange] = React.useState(() => ({
    from: dateInputValue(30),
    to: dateInputValue(0),
  }))

  const summaryQuery = useQuery({
    queryKey: ['admin', 'org-governance', 'summary', range.from, range.to],
    queryFn: async () => {
      const res = await fetchApi<OrgBillingSummary>(
        `/api/org/billing/summary?from=${encodeURIComponent(toIsoStart(range.from))}&to=${encodeURIComponent(
          toIsoEnd(range.to),
        )}`,
      )
      if (!res.success) throw toHttpError(res)
      return res.data
    },
    enabled: allow,
  })

  const policiesQuery = useQuery({
    queryKey: ['admin', 'org-governance', 'policies'],
    queryFn: async () => {
      const res = await fetchApi<OrgPolicyRow[]>('/api/org/policies')
      if (!res.success) throw toHttpError(res)
      return res.data
    },
    enabled: allow,
  })

  const saveMutation = useMutation({
    mutationFn: async (input: { key: PolicyKey; policyValue: unknown; enabled: boolean }) => {
      // body 严格为 { policyValue, enabled };policyValue 由各键编辑块逐键构造
      const res = await fetchApi<OrgPolicyRow>(`/api/org/policies/${input.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyValue: input.policyValue, enabled: input.enabled }),
      })
      if (!res.success) throw toHttpError(res)
      return res.data
    },
    onSuccess: () => {
      toast.success(t('saveSuccess'))
      // 保存成功刷新策略列表(策略行 version/updatedAt 随之更新)
      qc.invalidateQueries({ queryKey: ['admin', 'org-governance', 'policies'] })
    },
    onError: (err: Error) => {
      // 失败 toast 带服务端原文
      toast.error(err.message)
    },
  })

  const summary = summaryQuery.data
  const byMember = summary?.byMember ?? EMPTY_MEMBERS
  const byModel = summary?.byModel ?? EMPTY_MODELS
  const byDay = summary?.byDay ?? EMPTY_DAYS
  const agentModels = summary?.agentBillings?.byModel ?? EMPTY_AGENT_MODELS
  const agentNote = summary?.agentBillings?.note

  const policyRows = policiesQuery.data ?? EMPTY_POLICIES
  const policyByKey = React.useMemo(() => {
    const map = new Map<PolicyKey, OrgPolicyRow>()
    for (const row of policyRows) map.set(row.policyKey, row)
    return map
  }, [policyRows])
  // 留痕 = 策略行自身字段按 updatedAt 倒序(无独立审计端点,见区块说明)
  const trail = React.useMemo(
    () => [...policyRows].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [policyRows],
  )

  const pendingKey = saveMutation.isPending ? saveMutation.variables?.key : undefined
  const forbidden =
    isForbiddenError(summaryQuery.error) || isForbiddenError(policiesQuery.error)

  if (!allow) return <AuthGatePrompt message={t('loginRequired')} />

  if (forbidden) {
    return (
      <div className="px-4 py-4">
        <div
          data-testid="org-forbidden"
          className="rounded-lg border border-dashed p-10 text-center"
        >
          <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">{t('forbidden')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('forbiddenHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {summaryQuery.error || policiesQuery.error ? (
        <p data-testid="org-load-failed" className="text-xs text-destructive">
          {t('loadFailed')}
        </p>
      ) : null}

      {/* ===== 1. 组织概览 ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            {t('overview')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="org-overview" className="space-y-3">
            <p className="text-sm">
              {t('orgId')}:{' '}
              <span data-testid="org-overview-org-id" className="font-medium">
                {summary?.orgId ?? (summaryQuery.isLoading ? t('loading') : '—')}
              </span>
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                <span className="block">{t('periodFrom')}</span>
                <Input
                  data-testid="org-period-from"
                  type="date"
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  className="w-[160px]"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span className="block">{t('periodTo')}</span>
                <Input
                  data-testid="org-period-to"
                  type="date"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  className="w-[160px]"
                />
              </label>
              <Button
                type="button"
                size="sm"
                data-testid="org-query"
                onClick={() => setRange({ from: fromInput, to: toInput })}
              >
                {t('query')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== 2. 成员用量 ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            {t('members')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="org-members" className="space-y-2">
            {summaryQuery.isLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t('loading')}</p>
            ) : byMember.length === 0 ? (
              <p
                data-testid="org-members-empty"
                className="py-4 text-center text-sm text-muted-foreground"
              >
                {t('emptyMembers')}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('memberUser')}</TableHead>
                      <TableHead>{t('cost')}</TableHead>
                      <TableHead>{t('tokens')}</TableHead>
                      <TableHead>{t('calls')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byMember.map((m) => (
                      <TableRow key={m.userId} data-testid={`org-member-row-${m.userId}`}>
                        <TableCell className="text-xs">{m.userId}</TableCell>
                        <UsageCells cost={m.cost} tokens={m.tokens} calls={m.calls} />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== 3. 模型用量 ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4" />
            {t('models')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="org-models" className="space-y-4">
            {summaryQuery.isLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t('loading')}</p>
            ) : byModel.length === 0 ? (
              <p
                data-testid="org-models-empty"
                className="py-4 text-center text-sm text-muted-foreground"
              >
                {t('emptyModels')}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('modelName')}</TableHead>
                      <TableHead>{t('cost')}</TableHead>
                      <TableHead>{t('tokens')}</TableHead>
                      <TableHead>{t('calls')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byModel.map((m) => (
                      <TableRow key={m.model} data-testid={`org-model-row-${m.model}`}>
                        <TableCell className="max-w-[220px] truncate text-xs">{m.model}</TableCell>
                        <UsageCells cost={m.cost} tokens={m.tokens} calls={m.calls} />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* agent_billings:平台级账单无组织归属列,按模型汇总仅作参考(说明文案取自服务端) */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('agentBillings')}</p>
              {agentNote ? (
                <p data-testid="org-agent-note" className="text-xs text-muted-foreground">
                  {agentNote}
                </p>
              ) : null}
              {agentModels.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('modelName')}</TableHead>
                        <TableHead>{t('balance')}</TableHead>
                        <TableHead>{t('tokens')}</TableHead>
                        <TableHead>{t('calls')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentModels.map((a) => (
                        <TableRow key={a.modelId} data-testid={`org-agent-row-${a.modelId}`}>
                          <TableCell className="max-w-[220px] truncate text-xs">
                            {a.modelId}
                          </TableCell>
                          <UsageCells cost={a.balance} tokens={a.tokens} calls={a.calls} />
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>

            {/* 按日明细:默认折叠(原生 details,不额外引入交互件) */}
            <details data-testid="org-byday">
              <summary className="cursor-pointer text-sm font-medium">{t('byDay')}</summary>
              {byDay.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">{t('emptyModels')}</p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('date')}</TableHead>
                        <TableHead>{t('cost')}</TableHead>
                        <TableHead>{t('tokens')}</TableHead>
                        <TableHead>{t('calls')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byDay.map((d) => (
                        <TableRow key={d.date} data-testid={`org-day-row-${d.date}`}>
                          <TableCell className="text-xs">{d.date}</TableCell>
                          <UsageCells cost={d.cost} tokens={d.tokens} calls={d.calls} />
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </details>
          </div>
        </CardContent>
      </Card>

      {/* ===== 4. 策略编辑(四键各一块) ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" />
            {t('policies')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="org-policies" className="space-y-3">
            {POLICY_KEYS.map((key) => {
              const row = policyByKey.get(key)
              return (
                <PolicyEditor
                  // 版本或更新时间变化 ⇒ 重新挂载,表单回到服务端最新值
                  key={`${key}:${row?.version ?? 0}:${row?.updatedAt ?? 'none'}`}
                  policyKey={key}
                  row={row}
                  saving={pendingKey === key}
                  disabled={saveMutation.isPending}
                  onSave={(input) => saveMutation.mutate(input)}
                  t={t}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ===== 5. 策略留痕(策略行版本留痕,非独立审计流) ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            {t('policyTrail')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="org-policy-trail" className="space-y-2">
            {/* 诚实说明:后端无独立审计查询端点,本表来源是 org_policies 行自身 */}
            <p data-testid="org-trail-note" className="text-xs text-muted-foreground">
              {t('trailNote')}
            </p>
            {policiesQuery.isLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t('loading')}</p>
            ) : trail.length === 0 ? (
              <p
                data-testid="org-trail-empty"
                className="py-4 text-center text-sm text-muted-foreground"
              >
                {t('emptyTrail')}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('policyKey')}</TableHead>
                      <TableHead>{t('version')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead>{t('updatedAt')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trail.map((row) => (
                      <TableRow
                        key={row.id}
                        data-testid={`trail-row-${row.policyKey}-${row.version}`}
                      >
                        <TableCell className="text-xs">{row.policyKey}</TableCell>
                        <TableCell className="text-xs">{row.version}</TableCell>
                        <TableCell className="text-xs">
                          {row.enabled ? t('enabled') : t('disabled')}
                        </TableCell>
                        <TableCell className="text-xs">{formatTs(row.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
