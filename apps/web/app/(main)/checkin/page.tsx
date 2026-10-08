// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 签到助手(Phase1b,2026-10-03 立):账号服务端化管理页面。
// 后端:apps/ai-service /api/checkin/*(经 next.config.ts rewrites 同形转发到 8803);
// API 封装:@ihui/api-client(endpoints/checkin.ts,fetchAiServiceJson 裸 JSON);
// 类型契约:@ihui/types(checkin.ts,账号形态脱敏无 jwt 字段)。
// 结构:账号列表(分组徽章与筛选/启停开关/手动签到/更新JWT/删除/JWT与冷却徽章)
// + 调度状态徽章 + 一键全部签到(跳过今日已签 + 进度)
// + Tabs(签到记录 | 积分历史 | 积分看板,按账号过滤/加载更多)+ 录入/更新JWT/分组对话框。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  CalendarCheck,
  CheckCheck,
  FolderPen,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ihui/ui-react'
import {
  createCheckinAccount,
  deleteCheckinAccount,
  getCheckinSchedulerStatus,
  listCheckinAccounts,
  listCheckinCreditsHistory,
  listCheckinRecords,
  manualCheckinAccount,
  setCheckinAccountEnabled,
  updateCheckinAccountGroup,
  updateCheckinAccountJwt,
  type CheckinAccount,
  type CheckinCreditsHistoryItem,
  type CheckinRecord,
} from '@ihui/api-client'
import { EChart } from '@/components/charts/EChart'

// 分页步长与上限(records 后端 limit le=200,credits 后端 le=1000)。
const RECORDS_LIMIT_STEP = 100
const RECORDS_LIMIT_MAX = 200
const CREDITS_LIMIT_STEP = 200
const CREDITS_LIMIT_MAX = 1000
const DAY_MS = 86_400_000

export default function CheckinPage() {
  const t = useTranslations('checkin')

  const [accounts, setAccounts] = React.useState<CheckinAccount[]>([])
  const [records, setRecords] = React.useState<CheckinRecord[]>([])
  const [credits, setCredits] = React.useState<CheckinCreditsHistoryItem[]>([])
  const [creditsTotal, setCreditsTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  // 录入表单
  const [addOpen, setAddOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [jwt, setJwt] = React.useState('')
  const [deviceMapText, setDeviceMapText] = React.useState('')
  const [groupText, setGroupText] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  // 行内操作态
  const [checkingId, setCheckingId] = React.useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<CheckinAccount | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  // 一键全部签到(顺序执行 enabled 账号,跳过今日已签,实时进度)
  const [allChecking, setAllChecking] = React.useState(false)
  const [allProgress, setAllProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [batchNotice, setBatchNotice] = React.useState<string | null>(null)

  // 分组(Phase1d):账号表筛选 + 分组编辑对话框
  const [groupFilter, setGroupFilter] = React.useState<string>('all')
  const [groupTarget, setGroupTarget] = React.useState<CheckinAccount | null>(null)
  const [groupValue, setGroupValue] = React.useState('')
  const [groupSubmitting, setGroupSubmitting] = React.useState(false)
  const [groupFormError, setGroupFormError] = React.useState<string | null>(null)

  // 更新 JWT 对话框
  const [jwtTarget, setJwtTarget] = React.useState<CheckinAccount | null>(null)
  const [jwtText, setJwtText] = React.useState('')
  const [jwtSubmitting, setJwtSubmitting] = React.useState(false)
  const [jwtFormError, setJwtFormError] = React.useState<string | null>(null)
  const [jwtNotice, setJwtNotice] = React.useState<string | null>(null)

  // 调度状态(拉取失败静默不显示)
  const [scheduler, setScheduler] = React.useState<{
    enabled: boolean
    started: boolean
    next_run: string | null
  } | null>(null)

  // 按账号过滤 + 加载更多(返回条数 < 请求量即无更多)
  const [recordFilter, setRecordFilter] = React.useState<number | null>(null)
  const [creditFilter, setCreditFilter] = React.useState<number | null>(null)
  const [recordHasMore, setRecordHasMore] = React.useState(false)
  const [creditHasMore, setCreditHasMore] = React.useState(false)
  const [loadingMoreRecords, setLoadingMoreRecords] = React.useState(false)
  const [loadingMoreCredits, setLoadingMoreCredits] = React.useState(false)

  const loadAll = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [accountsRes, recordsRes, creditsRes] = await Promise.all([
        listCheckinAccounts(),
        listCheckinRecords({ accountId: recordFilter ?? undefined, limit: RECORDS_LIMIT_STEP }),
        listCheckinCreditsHistory({
          accountId: creditFilter ?? undefined,
          limit: CREDITS_LIMIT_STEP,
        }),
      ])
      setAccounts(accountsRes.accounts)
      setRecords(recordsRes.records)
      setRecordHasMore(recordsRes.records.length >= RECORDS_LIMIT_STEP)
      setCredits(creditsRes.history)
      setCreditHasMore(creditsRes.history.length >= CREDITS_LIMIT_STEP)
      setCreditsTotal(creditsRes.total_credits_delta)
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [recordFilter, creditFilter])

  React.useEffect(() => {
    void loadAll()
  }, [loadAll])

  // 调度状态:失败静默,不阻塞页面
  React.useEffect(() => {
    let cancelled = false
    getCheckinSchedulerStatus()
      .then((status) => {
        if (!cancelled) setScheduler(status)
      })
      .catch(() => {
        // 静默:调度徽章缺失不影响主流程
      })
    return () => {
      cancelled = true
    }
  }, [])

  const submitAdd = async () => {
    const trimmedName = name.trim()
    const trimmedJwt = jwt.trim()
    if (!trimmedName || !trimmedJwt) return
    let deviceMap: Record<string, unknown> = {}
    if (deviceMapText.trim()) {
      try {
        const parsed: unknown = JSON.parse(deviceMapText)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setFormError(t('deviceMapInvalid'))
          return
        }
        deviceMap = parsed as Record<string, unknown>
      } catch {
        setFormError(t('deviceMapInvalid'))
        return
      }
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await createCheckinAccount({
        name: trimmedName,
        jwt: trimmedJwt,
        device_map: deviceMap,
        group: groupText.trim(),
      })
      setAddOpen(false)
      setName('')
      setJwt('')
      setDeviceMapText('')
      setGroupText('')
      await loadAll()
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleEnabled = async (account: CheckinAccount, enabled: boolean) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === account.id ? { ...a, enabled } : a)),
    )
    try {
      await setCheckinAccountEnabled(account.id, enabled)
    } catch (e) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, enabled: account.enabled } : a)),
      )
      setActionError((e as Error).message)
    }
  }

  const runManualCheckin = async (account: CheckinAccount) => {
    setCheckingId(account.id)
    setActionError(null)
    try {
      await manualCheckinAccount(account.id)
      await loadAll()
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setCheckingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteCheckinAccount(deleteTarget.id)
      setDeleteTarget(null)
      await loadAll()
    } catch (e) {
      setActionError((e as Error).message)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  // 本地时区的 YYYY-MM-DD(后端 created_at 是 UTC ISO,签到「今天」按本地日历日算)
  const localDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // 一键全部签到:对 enabled 账号顺序执行(不并发轰炸);
  // 跳过今日已成功签到(last_record 为今日且 ok)的账号,实时汇报进度,结束后统一刷新
  const runCheckinAll = async () => {
    const today = localDateStr(new Date())
    const targets = accounts.filter((account) => account.enabled)
    if (targets.length === 0) return
    const pending = targets.filter((account) => {
      const last = account.last_record
      if (!last || last.ok !== true || !last.created_at) return true
      return localDateStr(new Date(last.created_at)) !== today
    })
    const skipped = targets.length - pending.length
    setAllChecking(true)
    setActionError(null)
    setBatchNotice(null)
    setAllProgress({ done: 0, total: pending.length })
    try {
      let done = 0
      for (const account of pending) {
        await manualCheckinAccount(account.id)
        done += 1
        setAllProgress({ done, total: pending.length })
      }
      if (skipped > 0) setBatchNotice(t('skippedToday', { count: skipped }))
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setAllChecking(false)
      setAllProgress(null)
      await loadAll()
    }
  }

  const openGroupDialog = (account: CheckinAccount) => {
    setGroupTarget(account)
    setGroupValue(account.group ?? '')
    setGroupFormError(null)
  }

  const submitGroup = async () => {
    if (!groupTarget) return
    setGroupSubmitting(true)
    setGroupFormError(null)
    try {
      await updateCheckinAccountGroup(groupTarget.id, groupValue.trim())
      setGroupTarget(null)
      setBatchNotice(t('groupUpdated'))
      await loadAll()
    } catch (e) {
      setGroupFormError((e as Error).message)
    } finally {
      setGroupSubmitting(false)
    }
  }

  const openJwtDialog = (account: CheckinAccount) => {
    setJwtTarget(account)
    setJwtText('')
    setJwtFormError(null)
  }

  const submitJwt = async () => {
    if (!jwtTarget) return
    const trimmedJwt = jwtText.trim()
    if (!trimmedJwt) return
    setJwtSubmitting(true)
    setJwtFormError(null)
    try {
      await updateCheckinAccountJwt(jwtTarget.id, trimmedJwt)
      setJwtTarget(null)
      setJwtNotice(t('jwtUpdated'))
      await loadAll()
    } catch (e) {
      setJwtFormError((e as Error).message)
    } finally {
      setJwtSubmitting(false)
    }
  }

  // 加载更多:limit 增量重拉,按 id 去重追加;返回不足请求量即无更多
  const loadMoreRecords = async () => {
    const requested = Math.min(records.length + RECORDS_LIMIT_STEP, RECORDS_LIMIT_MAX)
    if (requested <= records.length) return
    setLoadingMoreRecords(true)
    setActionError(null)
    try {
      const res = await listCheckinRecords({ accountId: recordFilter ?? undefined, limit: requested })
      setRecords((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...res.records.filter((r) => !seen.has(r.id))]
      })
      setRecordHasMore(res.records.length >= requested && requested < RECORDS_LIMIT_MAX)
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setLoadingMoreRecords(false)
    }
  }

  const loadMoreCredits = async () => {
    const requested = Math.min(credits.length + CREDITS_LIMIT_STEP, CREDITS_LIMIT_MAX)
    if (requested <= credits.length) return
    setLoadingMoreCredits(true)
    setActionError(null)
    try {
      const res = await listCheckinCreditsHistory({
        accountId: creditFilter ?? undefined,
        limit: requested,
      })
      setCredits((prev) => {
        const seen = new Set(prev.map((c) => c.id))
        return [...prev, ...res.history.filter((c) => !seen.has(c.id))]
      })
      setCreditHasMore(res.history.length >= requested && requested < CREDITS_LIMIT_MAX)
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setLoadingMoreCredits(false)
    }
  }

  const formatTime = (iso: string | null) => (iso ? iso.replace('T', ' ').slice(0, 19) : t('none'))

  // 短时间:MM-DD HH:mm
  const formatShortTime = (iso: string) => iso.slice(5, 16).replace('T', ' ')

  const truncate = (text: string, max: number) =>
    text.length > max ? `${text.slice(0, max)}…` : text

  // JWT 到期徽章:过期红色 / 7 天内琥珀(含剩余天数) / 正常灰色小字到期日 / null 不显示
  const renderJwtBadge = (jwtExp: string | null) => {
    if (!jwtExp) return null
    const expMs = Date.parse(jwtExp)
    if (Number.isNaN(expMs)) return null
    const remainingMs = expMs - Date.now()
    if (remainingMs <= 0) {
      return (
        <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
          {t('jwtExpired')}
        </span>
      )
    }
    const days = Math.ceil(remainingMs / DAY_MS)
    if (days <= 7) {
      return (
        <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
          {t('jwtExpiresSoon', { days })}
        </span>
      )
    }
    return <span className="text-[10px] text-muted-foreground">{jwtExp.slice(0, 10)}</span>
  }

  // 冷却徽章:cooldown_until 为未来时间时显示琥珀色到期时刻
  const renderCooldownBadge = (cooldownUntil: string | null) => {
    if (!cooldownUntil) return null
    const untilMs = Date.parse(cooldownUntil)
    if (Number.isNaN(untilMs) || untilMs <= Date.now()) return null
    return (
      <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
        {t('cooldownUntil', { time: formatShortTime(cooldownUntil) })}
      </span>
    )
  }

  // 记录/积分 tab 的按账号过滤下拉
  const renderAccountFilter = (
    testId: string,
    value: number | null,
    onChange: (value: number | null) => void,
  ) => (
    <select
      data-testid={testId}
      aria-label={t('filterAll')}
      value={value ?? 'all'}
      onChange={(e) => onChange(e.target.value === 'all' ? null : Number(e.target.value))}
      className="h-8 rounded-md border bg-background px-2 text-xs"
    >
      <option value="all">{t('filterAll')}</option>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
    </select>
  )

  const renderResult = (ok: boolean | null) =>
    ok === true ? t('resultOk') : ok === false ? t('resultFail') : t('resultUnknown')

  // 分组筛选:去重分组名(未分组 = 空串),客户端过滤账号表
  const distinctGroups = React.useMemo(
    () => Array.from(new Set(accounts.map((a) => a.group ?? '').filter((g) => g !== ''))).sort(),
    [accounts],
  )
  const visibleAccounts = React.useMemo(
    () =>
      groupFilter === 'all'
        ? accounts
        : accounts.filter((a) => (a.group ?? '') === groupFilter),
    [accounts, groupFilter],
  )

  // 积分看板:排行(按最近积分)+ 累计趋势 + 今日新增
  const board = React.useMemo(() => {
    const ranked = visibleAccounts
      .map((a) => ({ name: a.name, credits: a.last_record?.credits ?? null }))
      .filter((r): r is { name: string; credits: number } => r.credits !== null)
      .sort((x, y) => y.credits - x.credits)
    const today = localDateStr(new Date())
    const asc = [...credits].sort(
      (x, y) => Date.parse(x.created_at ?? '') - Date.parse(y.created_at ?? ''),
    )
    const byDay = new Map<string, number>()
    let todayGain = 0
    for (const item of asc) {
      if (!item.created_at) continue
      const day = localDateStr(new Date(item.created_at))
      byDay.set(day, (byDay.get(day) ?? 0) + item.credits_delta)
      if (day === today) todayGain += item.credits_delta
    }
    let running = 0
    const trend = Array.from(byDay.entries()).map(([day, delta]) => {
      running += delta
      return { day, cumulative: running }
    })
    return { ranked, trend, todayGain, hasData: ranked.length > 0 || trend.length > 0 }
  }, [visibleAccounts, credits])

  const renderGroupBadge = (group: string) =>
    group ? (
      <span className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600">
        {group}
      </span>
    ) : null

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          {scheduler && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                scheduler.enabled && scheduler.started
                  ? 'border-green-500/40 bg-green-500/10 text-green-600'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-600'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  scheduler.enabled && scheduler.started ? 'bg-green-500' : 'bg-amber-500'
                }`}
              />
              {scheduler.enabled && scheduler.started
                ? t('schedulerEnabled')
                : t('schedulerDisabled')}
              {scheduler.enabled && scheduler.started && scheduler.next_run && (
                <span className="font-normal text-muted-foreground">
                  {t('schedulerNextRun', { time: formatShortTime(scheduler.next_run) })}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void loadAll()} aria-label={t('refresh')}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={allChecking || checkingId !== null}
            onClick={() => void runCheckinAll()}
          >
            {allChecking ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <CheckCheck className="mr-1 h-4 w-4" />
            )}
            {allChecking
              ? t('checkinAllProgress', {
                  done: allProgress?.done ?? 0,
                  total: allProgress?.total ?? 0,
                })
              : t('checkinAll')}
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('addAccount')}
          </Button>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {jwtNotice && (
        <div role="status" className="mb-4 rounded-md border border-green-600 bg-green-500/10 p-3 text-sm text-green-600">
          {jwtNotice}
        </div>
      )}

      {batchNotice && (
        <div role="status" className="mb-4 rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-600">
          {batchNotice}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : loadError ? (
        <div className="py-16 text-center">
          <p className="mb-3 text-sm text-destructive">{t('loadFailed')}{loadError ? `: ${loadError}` : ''}</p>
          <Button variant="outline" size="sm" onClick={() => void loadAll()}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <>
          {/* 账号列表 */}
          {accounts.length === 0 ? (
            <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
              {t('emptyAccounts')}
            </div>
          ) : (
            <>
              {/* 分组筛选(有分组才显示) */}
              {distinctGroups.length > 0 && (
                <div className="mb-3">
                  <select
                    data-testid="group-filter"
                    aria-label={t('filterGroupAll')}
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="all">{t('filterGroupAll')}</option>
                    {distinctGroups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                    <option value="">{t('groupUngrouped')}</option>
                  </select>
                </div>
              )}
              <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colName')}</TableHead>
                    <TableHead>{t('colEnabled')}</TableHead>
                    <TableHead>{t('colLastCheckin')}</TableHead>
                    <TableHead>{t('colCredits')}</TableHead>
                    <TableHead className="text-right">{t('colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="font-medium">{account.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {renderGroupBadge(account.group)}
                          {renderJwtBadge(account.jwt_exp)}
                          {renderCooldownBadge(account.cooldown_until)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={account.enabled}
                          onCheckedChange={(checked) => void toggleEnabled(account, checked)}
                          aria-label={t('colEnabled')}
                        />
                      </TableCell>
                      <TableCell>
                        {account.last_record ? (
                          <div className="text-xs">
                            <div>{renderResult(account.last_record.ok)}</div>
                            <div className="text-muted-foreground">
                              {formatTime(account.last_record.created_at)}
                            </div>
                            {account.last_record.ok === false && account.last_record.message && (
                              <div
                                className="mt-0.5 text-[10px] text-muted-foreground"
                                title={account.last_record.message}
                              >
                                {truncate(account.last_record.message, 40)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('none')}</span>
                        )}
                      </TableCell>
                      <TableCell>{account.last_record?.credits ?? t('none')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={checkingId !== null || allChecking}
                            onClick={() => void runManualCheckin(account)}
                          >
                            {checkingId === account.id && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            {checkingId === account.id ? t('checking') : t('manualCheckin')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t('editJwt')}
                            onClick={() => openJwtDialog(account)}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t('editGroup')}
                            onClick={() => openGroupDialog(account)}
                          >
                            <FolderPen className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t('delete')}
                            onClick={() => setDeleteTarget(account)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </>
          )}

          {/* 记录 / 积分历史 */}
          <Tabs defaultValue="records" className="mt-6">
            <TabsList>
              <TabsTrigger value="records">{t('recordsTab')}</TabsTrigger>
              <TabsTrigger value="credits">{t('creditsTab')}</TabsTrigger>
              <TabsTrigger value="board">{t('boardTab')}</TabsTrigger>
            </TabsList>

            <TabsContent value="records" className="mt-3">
              <div className="mb-3">
                {renderAccountFilter('record-filter', recordFilter, setRecordFilter)}
              </div>
              {records.length === 0 ? (
                <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
                  {t('emptyRecords')}
                </div>
              ) : (
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('colTime')}</TableHead>
                        <TableHead>{t('colResult')}</TableHead>
                        <TableHead>{t('colAction')}</TableHead>
                        <TableHead>{t('colMessage')}</TableHead>
                        <TableHead>{t('colCreditsDelta')}</TableHead>
                        <TableHead>{t('colErrorClass')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="text-xs">{formatTime(record.created_at)}</TableCell>
                          <TableCell>
                            <span
                              className={
                                record.ok === true
                                  ? 'text-green-600'
                                  : record.ok === false
                                    ? 'text-destructive'
                                    : 'text-muted-foreground'
                              }
                            >
                              {renderResult(record.ok)}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{record.action ?? '-'}</TableCell>
                          <TableCell className="text-xs">
                            {record.message ? (
                              <span title={record.message}>{truncate(record.message, 60)}</span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {record.credits_delta === null ? '-' : record.credits_delta}
                          </TableCell>
                          <TableCell className="text-xs">
                            {record.classified_error ?? '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {recordHasMore && (
                <div className="mt-3 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingMoreRecords}
                    onClick={() => void loadMoreRecords()}
                  >
                    {loadingMoreRecords && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    {t('loadMore')}
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="credits" className="mt-3">
              <div className="mb-3">
                {renderAccountFilter('credit-filter', creditFilter, setCreditFilter)}
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                {t('totalCreditsDelta', { delta: creditsTotal })}
              </p>
              {credits.length === 0 ? (
                <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
                  {t('emptyCredits')}
                </div>
              ) : (
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('colTime')}</TableHead>
                        <TableHead>{t('colAction')}</TableHead>
                        <TableHead>{t('colCreditsDelta')}</TableHead>
                        <TableHead>{t('colCurrentCredits')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credits.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">{formatTime(item.created_at)}</TableCell>
                          <TableCell className="text-xs">{item.action}</TableCell>
                          <TableCell className="text-xs">
                            <span className={item.credits_delta >= 0 ? 'text-green-600' : 'text-destructive'}>
                              {item.credits_delta >= 0 ? `+${item.credits_delta}` : item.credits_delta}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{item.credits ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {creditHasMore && (
                <div className="mt-3 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingMoreCredits}
                    onClick={() => void loadMoreCredits()}
                  >
                    {loadingMoreCredits && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    {t('loadMore')}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* 积分看板(Phase1d,对标参考项目:排行 + 趋势 + 今日新增) */}
            <TabsContent value="board" className="mt-3">
              {!board.hasData ? (
                <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
                  {t('boardEmpty')}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border p-3">
                      <p className="mb-2 text-sm font-medium">{t('boardRankingTitle')}</p>
                      <EChart
                        height={260}
                        option={{
                          tooltip: { trigger: 'axis' },
                          grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
                          xAxis: { type: 'value' },
                          yAxis: {
                            type: 'category',
                            data: board.ranked.map((r) => r.name),
                            inverse: true,
                          },
                          series: [
                            {
                              type: 'bar',
                              data: board.ranked.map((r) => r.credits),
                              itemStyle: { borderRadius: 4 },
                            },
                          ],
                        }}
                      />
                    </div>
                    <div className="rounded-xl border p-3">
                      <p className="mb-2 text-sm font-medium">
                        {t('boardTodayGain', { delta: board.todayGain })}
                      </p>
                      <EChart
                        height={260}
                        option={{
                          tooltip: { trigger: 'axis' },
                          grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
                          xAxis: { type: 'category', data: board.trend.map((p) => p.day) },
                          yAxis: { type: 'value' },
                          series: [
                            {
                              type: 'line',
                              data: board.trend.map((p) => p.cumulative),
                              smooth: true,
                              areaStyle: { opacity: 0.15 },
                            },
                          ],
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* 录入对话框 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addAccountTitle')}</DialogTitle>
            <DialogDescription>{t('addAccountDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="checkin-name">{t('name')}</Label>
              <Input
                id="checkin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkin-jwt">{t('jwt')}</Label>
              <textarea
                id="checkin-jwt"
                value={jwt}
                onChange={(e) => setJwt(e.target.value)}
                rows={4}
                placeholder={t('jwtPlaceholder')}
                className="w-full resize-y rounded-sm border bg-background p-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkin-device-map">{t('deviceMap')}</Label>
              <textarea
                id="checkin-device-map"
                value={deviceMapText}
                onChange={(e) => setDeviceMapText(e.target.value)}
                rows={3}
                placeholder={t('deviceMapPlaceholder')}
                className="w-full resize-y rounded-sm border bg-background p-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkin-group">{t('groupLabel')}</Label>
              <Input
                id="checkin-group"
                value={groupText}
                onChange={(e) => setGroupText(e.target.value)}
                placeholder={t('groupPlaceholder')}
                maxLength={50}
              />
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>
              {t('cancel')}
            </Button>
            <Button onClick={() => void submitAdd()} disabled={submitting || !name.trim() || !jwt.trim()}>
              {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {submitting ? t('submitting') : t('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 更新 JWT 对话框 */}
      <Dialog open={jwtTarget !== null} onOpenChange={(open) => !open && setJwtTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editJwtTitle')}</DialogTitle>
            <DialogDescription>{t('editJwtDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="checkin-jwt-update">{t('jwt')}</Label>
              <textarea
                id="checkin-jwt-update"
                value={jwtText}
                onChange={(e) => setJwtText(e.target.value)}
                rows={4}
                placeholder={t('jwtPlaceholder')}
                className="w-full resize-y rounded-sm border bg-background p-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {jwtFormError && (
              <p role="alert" className="text-sm text-destructive">
                {jwtFormError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJwtTarget(null)} disabled={jwtSubmitting}>
              {t('cancel')}
            </Button>
            <Button onClick={() => void submitJwt()} disabled={jwtSubmitting || !jwtText.trim()}>
              {jwtSubmitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {jwtSubmitting ? t('submitting') : t('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 更新分组对话框(空串 = 移出分组) */}
      <Dialog open={groupTarget !== null} onOpenChange={(open) => !open && setGroupTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editGroupTitle')}</DialogTitle>
            <DialogDescription>{t('editGroupDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="checkin-group-update">{t('colGroup')}</Label>
              <Input
                id="checkin-group-update"
                value={groupValue}
                onChange={(e) => setGroupValue(e.target.value)}
                placeholder={t('groupPlaceholder')}
                maxLength={50}
              />
            </div>
            {groupFormError && (
              <p role="alert" className="text-sm text-destructive">
                {groupFormError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupTarget(null)} disabled={groupSubmitting}>
              {t('cancel')}
            </Button>
            <Button onClick={() => void submitGroup()} disabled={groupSubmitting}>
              {groupSubmitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {groupSubmitting ? t('submitting') : t('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteDescription', { name: deleteTarget?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {t('confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
