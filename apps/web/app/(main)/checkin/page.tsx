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

import type { CheckinCreditsDailyResponse } from '@ihui/types'
import { rnRadius } from '@ihui/design-tokens'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  CalendarCheck,
  CheckCheck,
  FolderPen,
  KeyRound,
  Laptop,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Wrench,
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
  listCheckinCreditsDaily,
  listCheckinCreditsHistory,
  listCheckinRecords,
  manualCheckinAccount,
  queryCheckinAccountCredits,
  setCheckinAccountEnabled,
  updateCheckinAccountGroup,
  updateCheckinAccountJwt,
  type CheckinAccount,
  type CheckinCreditsHistoryItem,
  type CheckinRecord,
} from '@ihui/api-client'
import { EChart } from '@/components/charts/EChart'
import { useTauriIpcReady } from '@/hooks/use-desktop'
import {
  checkinAuditTraeResidual,
  checkinCaptureJwts,
  checkinDetectTraeDir,
  checkinGetPublicIp,
  checkinOneClickReset,
  checkinResetDeviceIds,
  checkinSnapshotBackup,
  checkinSnapshotDelete,
  checkinSnapshotList,
  checkinSnapshotRestore,
  type CapturedTraeAccount,
  type CheckinResidualAuditReport,
  type CheckinSnapshotSummary,
} from '@/lib/tauri-bridge'

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
  // 勾选批量:对齐参考项目「按分组/手动勾选」——勾选后可只签勾选账号(配合分组筛选即"按组签")
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set())

  // 积分每日快照(WP-B):三线趋势数据 + 手动刷新全部账号余额
  const [creditsDaily, setCreditsDaily] = React.useState<CheckinCreditsDailyResponse | null>(null)
  const [refreshingCredits, setRefreshingCredits] = React.useState(false)
  const [groupTarget, setGroupTarget] = React.useState<CheckinAccount | null>(null)
  const [groupValue, setGroupValue] = React.useState('')
  const [groupSubmitting, setGroupSubmitting] = React.useState(false)
  const [groupFormError, setGroupFormError] = React.useState<string | null>(null)

  // 本机捕获(桌面端专属,WP-C):useTauriIpcReady 抗 IPC 异步注入竞态 + 免水合不一致
  const desktop = useTauriIpcReady()
  const [captureOpen, setCaptureOpen] = React.useState(false)
  const [capturing, setCapturing] = React.useState(false)
  const [captured, setCaptured] = React.useState<CapturedTraeAccount[]>([])
  const [capturedSelected, setCapturedSelected] = React.useState<Set<string>>(new Set())
  const [captureError, setCaptureError] = React.useState<string | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [traeDir, setTraeDir] = React.useState<string | null>(null)

  // 本机 TRAE 维护(设备重置 + 快照管理,桌面端专属)
  const [maintOpen, setMaintOpen] = React.useState(false)
  const [maintBusy, setMaintBusy] = React.useState(false)
  const [maintIncludeGuid, setMaintIncludeGuid] = React.useState(false)
  const [maintIncludeBrowser, setMaintIncludeBrowser] = React.useState(false)
  const [maintDeepReset, setMaintDeepReset] = React.useState(false)
  const [maintIncludeMac, setMaintIncludeMac] = React.useState(false)

  // 一键解决风控向导(傻瓜式 3 步:重置 → 换网络 → 冷却提醒)
  const [wizardStep, setWizardStep] = React.useState<0 | 2 | 3>(0)
  const [wizardIpBefore, setWizardIpBefore] = React.useState('')
  const [wizardIpLoc, setWizardIpLoc] = React.useState('')
  const [wizardIpNow, setWizardIpNow] = React.useState('')
  const [wizardBusy, setWizardBusy] = React.useState(false)
  const [wizardMsg, setWizardMsg] = React.useState<string[]>([])
  // 残留指纹审计(2026-10-10 立):重置后拿旧身份黑名单回扫 TRAE 现场,把
  // "到底干净了没有"变成面板上可读的结论,而不是靠用户猜。
  const [wizardAudit, setWizardAudit] = React.useState<CheckinResidualAuditReport | null>(null)
  const [wizardAuditing, setWizardAuditing] = React.useState(false)
  // 是否出现"非可选层失败":用于动态判定下方提示语(可选层失败才说"不影响",否则警告)
  const [wizardCriticalFail, setWizardCriticalFail] = React.useState(false)
  // IP 验证连续失败次数(未变/获取失败都计):≥3 自动高亮引导走"直接完成"旁路
  const [wizardIpFailCount, setWizardIpFailCount] = React.useState(0)
  // 上次一键重置时间(冷却提醒用):24h 内再登录会续期风控
  const [lastResetAt, setLastResetAt] = React.useState<number | null>(null)
  React.useEffect(() => {
    try {
      const v = localStorage.getItem('checkin-oneclick-at')
      if (v) setLastResetAt(Number(v))
    } catch {
      /* 隐私模式降级:无提醒 */
    }
  }, [])
  const [maintReport, setMaintReport] = React.useState<string[]>([])
  const [maintError, setMaintError] = React.useState<string | null>(null)
  const [maintUserId, setMaintUserId] = React.useState('')
  const [snapshots, setSnapshots] = React.useState<CheckinSnapshotSummary[]>([])

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
      const [accountsRes, recordsRes, creditsRes, dailyRes] = await Promise.all([
        listCheckinAccounts(),
        listCheckinRecords({ accountId: recordFilter ?? undefined, limit: RECORDS_LIMIT_STEP }),
        listCheckinCreditsHistory({
          accountId: creditFilter ?? undefined,
          limit: CREDITS_LIMIT_STEP,
        }),
        // 三线序列非关键数据:失败静默降级为本地累计趋势
        listCheckinCreditsDaily({ days: 30 }).catch(() => null),
      ])
      setAccounts(accountsRes.accounts)
      setRecords(recordsRes.records)
      setRecordHasMore(recordsRes.records.length >= RECORDS_LIMIT_STEP)
      setCredits(creditsRes.history)
      setCreditHasMore(creditsRes.history.length >= CREDITS_LIMIT_STEP)
      setCreditsTotal(creditsRes.total_credits_delta)
      setCreditsDaily(dailyRes)
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [recordFilter, creditFilter])

  // 手动刷新全部启用账号的积分快照(逐个查询,单个失败不中断;WP-B)
  const refreshCreditsSnapshots = async () => {
    const targets = accounts.filter((a) => a.enabled)
    if (targets.length === 0 || refreshingCredits) return
    setRefreshingCredits(true)
    setActionError(null)
    try {
      for (const account of targets) {
        try {
          await queryCheckinAccountCredits(account.id)
        } catch {
          // 单账号查询失败(网络/JWT 失效)不阻断其余账号
        }
      }
      await loadAll()
    } finally {
      setRefreshingCredits(false)
    }
  }

  // ================== 本机捕获(桌面端专属,WP-C) ==================

  const openCapture = async () => {
    setCaptureOpen(true)
    setCaptureError(null)
    setCaptured([])
    setCapturedSelected(new Set())
    try {
      setTraeDir(await checkinDetectTraeDir())
    } catch (e) {
      setCaptureError((e as Error).message)
    }
  }

  const runCapture = async () => {
    setCapturing(true)
    setCaptureError(null)
    try {
      const found = await checkinCaptureJwts()
      setCaptured(found)
      setCapturedSelected(new Set(found.map((a) => a.user_id)))
      if (found.length === 0) setCaptureError(t('captureEmpty'))
    } catch (e) {
      setCaptureError((e as Error).message)
    } finally {
      setCapturing(false)
    }
  }

  // 逐个入库:勾选账号同步为服务端账号;group 沿用当前筛选(非 all 时)
  const importCaptured = async () => {
    const picked = captured.filter((a) => capturedSelected.has(a.user_id))
    if (picked.length === 0) return
    setImporting(true)
    setCaptureError(null)
    let okCount = 0
    const failures: string[] = []
    for (const item of picked) {
      try {
        await createCheckinAccount({
          name: `本机-${item.user_id}`,
          jwt: item.jwt,
          device_map: {},
          group: groupFilter !== 'all' ? groupFilter : '',
        })
        okCount += 1
      } catch (e) {
        failures.push(`${item.user_id}: ${(e as Error).message}`)
      }
    }
    setImporting(false)
    if (failures.length > 0) {
      setCaptureError(failures.join('；'))
    } else {
      setCaptureOpen(false)
      setBatchNotice(t('captureImported', { count: okCount }))
      await loadAll()
    }
  }

  // ================== 本机 TRAE 维护(桌面端专属,WP-C) ==================

  const refreshSnapshots = async () => {
    try {
      // 防御:后端异常通道返回 undefined 时按空数组处理,不让列表渲染崩整树
      setSnapshots((await checkinSnapshotList()) ?? [])
    } catch (e) {
      setMaintError((e as Error).message)
    }
  }

  const openMaint = async () => {
    setMaintOpen(true)
    setMaintError(null)
    setMaintReport([])
    setMaintUserId('')
    await refreshSnapshots()
  }

  // 统一 busy 闸门:动作抛错归一为 maintError,成功行进 maintReport
  const runMaintAction = async (action: () => Promise<string[]>) => {
    setMaintBusy(true)
    setMaintError(null)
    setMaintReport([])
    try {
      setMaintReport(await action())
    } catch (e) {
      setMaintError((e as Error).message)
    } finally {
      setMaintBusy(false)
    }
  }

  const resetDeviceIds = () =>
    runMaintAction(async () => {
      const report = await checkinResetDeviceIds(
        maintIncludeGuid,
        maintIncludeBrowser,
        maintDeepReset,
        maintIncludeMac,
      )
      return report.layers.map((l) => `[${l.ok ? 'OK' : 'FAIL'}] L${l.layer} ${l.name}: ${l.detail}`)
    })

  // 残留指纹审计:与"重置"解耦的独立动作,失败只在向导消息里落一行,不拦流程
  // (审计是**取证**不是**处置**,扫不动不代表重置没做)。
  const runResidualAudit = async () => {
    setWizardAuditing(true)
    try {
      const report = await checkinAuditTraeResidual()
      setWizardAudit(report)
      setWizardMsg((m) => [
        report.ok ? t('wizardAuditClean') : t('wizardAuditResidual', { n: report.hard_hits }),
        ...m,
      ])
    } catch {
      setWizardMsg((m) => [t('wizardAuditFail'), ...m])
    } finally {
      setWizardAuditing(false)
    }
  }

  // 一键解决风控 Step1:全 14 层彻底重置,成功即进 Step2(IP 采集失败不回退,
  // 防止"重置已完成却显示可再点按钮"引发二次重置;基准 IP 可在 Step2 内重取)
  const startOneClickReset = async () => {
    setWizardBusy(true)
    setWizardMsg([])
    try {
      const report = await checkinOneClickReset()
      const okCount = report.layers.filter((l) => l.ok).length
      const fails = report.layers.filter((l) => !l.ok)
      setWizardIpFailCount(0)
      // 可选层(需管理员 UAC 的 5、动浏览器的 7、动网卡的 13)失败属预期降级,不影响主体;
      // 其它层(如 1/2/3/4/6 文件级)失败才是真问题 —— 据此动态决定下方提示语,
      // 杜绝"非可选层挂了还说不影响"的误导(2026-10-11 UX 修正)。
      const critical = fails.some((l) => ![5, 7, 13].includes(l.layer))
      setWizardCriticalFail(critical)
      setWizardMsg([
        t('wizardResetDone', { ok: okCount, total: report.layers.length }),
        ...fails.map((l) => `${l.name}: ${l.detail}`),
      ])
      try {
        localStorage.setItem('checkin-oneclick-at', String(Date.now()))
        setLastResetAt(Date.now())
      } catch {
        /* 隐私模式下 localStorage 不可用,冷却提醒仅当次会话有效 */
      }
      setWizardStep(2)
      try {
        const before = await checkinGetPublicIp()
        setWizardIpBefore(before.ip)
        setWizardIpLoc(before.location)
        if (!before.location) {
          setWizardMsg((m) => [t('wizardNoLoc'), ...m])
        }
      } catch {
        setWizardMsg((m) => [t('wizardIpFetchFail'), ...m])
      }
      // 重置完就地验证:常态自动跑一次审计,用户不必另找入口确认"是否彻底"
      await runResidualAudit()
    } catch (e) {
      setMaintError((e as Error).message)
    } finally {
      setWizardBusy(false)
    }
  }

  // 一键解决风控 Step2:验证用户已换网络出口(IP 必须真的变了)
  const verifyIpChanged = async () => {
    setWizardBusy(true)
    try {
      // 基准 IP 缺失(Step1 采集失败)时,此次采集先补基准——重置本身不动网络,
      // 用户尚未换出口前采集到的仍是"重置前出口"
      if (!wizardIpBefore) {
        const base = await checkinGetPublicIp()
        setWizardIpBefore(base.ip)
        setWizardIpLoc(base.location)
        setWizardMsg((m) => [t('wizardRefetch', { ip: base.ip }), ...m])
        return
      }
      const now = await checkinGetPublicIp()
      setWizardIpNow(now.ip)
      if (now.ip !== wizardIpBefore) {
        setWizardIpFailCount(0)
        setWizardStep(3)
      } else {
        // IP 没变 ⇒ 计一次失败;连续 ≥3 次在界面自动高亮引导走"直接完成"旁路
        setWizardIpFailCount((c) => c + 1)
        setWizardMsg((m) => [t('wizardIpUnchanged'), ...m])
      }
    } catch (e) {
      setWizardIpFailCount((c) => c + 1)
      setWizardMsg((m) => [t('wizardIpFetchFail'), ...m])
      setMaintError((e as Error).message)
    } finally {
      setWizardBusy(false)
    }
  }

  // P0-1 旁路:用户确实无法更换网络时,允许直接跳到 Step3(进入 24h 冷却),避免单向死路
  const skipIpVerify = () => {
    setWizardIpFailCount(0)
    setWizardStep(3)
  }

  // 向导状态归零(Step3 完成后的重新开始入口)
  const restartWizard = () => {
    setWizardStep(0)
    setWizardIpBefore('')
    setWizardIpLoc('')
    setWizardIpNow('')
    setWizardMsg([])
    // P2-7:必须把上一轮审计结论也清掉,否则旧"残留/干净"结论会误导新一轮判断
    setWizardAudit(null)
    setWizardCriticalFail(false)
    setWizardIpFailCount(0)
  }

  const backupSnapshot = () =>
    runMaintAction(async () => {
      const uid = maintUserId.trim()
      if (!uid) throw new Error(t('maintUserIdRequired'))
      const report = await checkinSnapshotBackup(uid)
      await refreshSnapshots()
      return [
        t('maintBackupDone', { count: report.copied.length, missing: report.missing.length }),
        ...report.copied,
      ]
    })

  const restoreSnapshot = (uid: string) =>
    runMaintAction(async () => {
      const report = await checkinSnapshotRestore(uid)
      return [
        t('maintRestoreDone', {
          count: report.restored.length,
          missing: report.missing_in_backup.length,
        }),
        ...report.restored,
      ]
    })

  const deleteSnapshot = async (uid: string) => {
    setMaintBusy(true)
    setMaintError(null)
    try {
      await checkinSnapshotDelete(uid)
      await refreshSnapshots()
    } catch (e) {
      setMaintError((e as Error).message)
    } finally {
      setMaintBusy(false)
    }
  }

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
  const runCheckinAll = async (scope?: Set<number>) => {
    const today = localDateStr(new Date())
    const targets = accounts.filter(
      (account) => account.enabled && (!scope || scope.has(account.id)),
    )
    if (targets.length === 0) return
    // 对齐参考项目「跳过已签/过期」:JWT 已过期的账号直接跳过(带过期 JWT 签到只会中途 401 报错)
    const now = Date.now()
    const expiredCount = targets.filter(
      (account) => !!account.jwt_exp && new Date(account.jwt_exp).getTime() <= now,
    ).length
    const pending = targets.filter((account) => {
      if (account.jwt_exp && new Date(account.jwt_exp).getTime() <= now) return false
      const last = account.last_record
      if (!last || last.ok !== true || !last.created_at) return true
      return localDateStr(new Date(last.created_at)) !== today
    })
    const skipped = targets.length - expiredCount - pending.length
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
      const notices = [
        skipped > 0 ? t('skippedToday', { count: skipped }) : null,
        expiredCount > 0 ? t('skippedExpired', { count: expiredCount }) : null,
      ].filter((part): part is string => !!part)
      if (notices.length > 0) setBatchNotice(notices.join('；'))
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setAllChecking(false)
      setAllProgress(null)
      setSelectedIds(new Set())
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
      className="h-8 rounded-sm border bg-background px-2 text-xs"
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

  // 勾选辅助:单行勾选 + 表头全选当前列表(配合分组筛选 = 按组签)
  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allVisibleSelected =
    visibleAccounts.length > 0 && visibleAccounts.every((a) => selectedIds.has(a.id))
  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) visibleAccounts.forEach((a) => next.delete(a.id))
      else visibleAccounts.forEach((a) => next.add(a.id))
      return next
    })
  }

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

  // 是否有三线快照数据(任一日 total 非空即启用三线图,否则降级本地累计)
  const hasDailySeries =
    !!creditsDaily && creditsDaily.series.total.some((v) => v !== null)

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
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={allChecking || checkingId !== null}
              onClick={() => void runCheckinAll(selectedIds)}
            >
              {allChecking ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="mr-1 h-4 w-4" />
              )}
              {t('checkinSelected', { count: selectedIds.size })}
            </Button>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('addAccount')}
          </Button>
          {desktop && (
            <>
              <Button variant="outline" size="sm" onClick={() => void openCapture()}>
                <Laptop className="mr-1 h-4 w-4" />
                {t('captureTitle')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void openMaint()}>
                <Wrench className="mr-1 h-4 w-4" />
                {t('maintTitle')}
              </Button>
            </>
          )}
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
                    className="h-8 rounded-sm border bg-background px-2 text-xs"
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
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        aria-label={t('selectAllVisible')}
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                    </TableHead>
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
                        <input
                          type="checkbox"
                          aria-label={t('selectAccount', { name: account.name })}
                          checked={selectedIds.has(account.id)}
                          onChange={() => toggleSelected(account.id)}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                      </TableCell>
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
                              itemStyle: { borderRadius: rnRadius.sm },
                            },
                          ],
                        }}
                      />
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {hasDailySeries
                            ? t('boardTrendTitle')
                            : t('boardTodayGain', { delta: board.todayGain })}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={refreshingCredits || allChecking}
                          onClick={() => void refreshCreditsSnapshots()}
                          aria-label={t('refreshCredits')}
                        >
                          {refreshingCredits ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          {t('refreshCredits')}
                        </Button>
                      </div>
                      <EChart
                        height={260}
                        option={
                          hasDailySeries
                            ? {
                                // 三线:总数/获得/消耗(消耗=|今日总-获得-昨日总|,对齐参考项目)
                                tooltip: { trigger: 'axis' },
                                legend: { top: 0 },
                                grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
                                xAxis: { type: 'category', data: creditsDaily!.days },
                                yAxis: { type: 'value' },
                                series: [
                                  {
                                    name: t('boardLineTotal'),
                                    type: 'line',
                                    data: creditsDaily!.series.total,
                                    smooth: true,
                                    connectNulls: false,
                                  },
                                  {
                                    name: t('boardLineGained'),
                                    type: 'line',
                                    data: creditsDaily!.series.gained,
                                    smooth: true,
                                    areaStyle: { opacity: 0.15 },
                                  },
                                  {
                                    name: t('boardLineConsumed'),
                                    type: 'line',
                                    data: creditsDaily!.series.consumed,
                                    smooth: true,
                                    connectNulls: false,
                                  },
                                ],
                              }
                            : {
                                // 无快照数据时降级:本地签到记录累计趋势
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
                              }
                        }
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

      {/* 本机捕获对话框(桌面端专属,WP-C) */}
      {desktop && (
        <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('captureTitle')}</DialogTitle>
              <DialogDescription>
                {traeDir ? t('captureDirFound', { dir: traeDir }) : t('captureDirMissing')}
              </DialogDescription>
            </DialogHeader>
            {captureError && (
              <p role="alert" className="text-sm text-destructive">
                {captureError}
              </p>
            )}
            {captured.length > 0 && (
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {captured.map((item) => (
                  <label
                    key={item.user_id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      aria-label={`captureAccount:${item.user_id}`}
                      checked={capturedSelected.has(item.user_id)}
                      onChange={(e) => {
                        setCapturedSelected((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(item.user_id)
                          else next.delete(item.user_id)
                          return next
                        })
                      }}
                    />
                    <span className="font-mono">{item.user_id}</span>
                    <span className="truncate text-xs text-muted-foreground">{item.source}</span>
                  </label>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" disabled={capturing} onClick={() => void runCapture()}>
                {capturing ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-4 w-4" />
                )}
                {t('captureScan')}
              </Button>
              <Button
                size="sm"
                disabled={capturing || importing || capturedSelected.size === 0}
                onClick={() => void importCaptured()}
              >
                {importing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {t('captureImport', { count: capturedSelected.size })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 本机 TRAE 维护对话框(桌面端专属,WP-C);busy 中禁止关闭防中途失控 */}
      {desktop && (
        <Dialog
          open={maintOpen}
          onOpenChange={(open) => {
            if (!open && (maintBusy || wizardBusy)) return
            setMaintOpen(open)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('maintTitle')}</DialogTitle>
              <DialogDescription>{t('maintDescription')}</DialogDescription>
            </DialogHeader>
            {maintError && (
              <p role="alert" className="text-sm text-destructive">
                {maintError}
              </p>
            )}
            <div className="space-y-3">
              {/* 一键解决风控向导(傻瓜式主入口,2026-10-10) */}
              <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
                <p className="text-sm font-medium">{t('wizardTitle')}</p>
                {/* 24h 冷却常驻条:只要处于冷却期(无论哪个 Step)都显示,反复提醒"别登录" */}
                {lastResetAt && Date.now() - lastResetAt < 24 * 3600_000 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {t('wizardCooldownActive', {
                      hours: Math.max(
                        1,
                        Math.ceil((24 * 3600_000 - (Date.now() - lastResetAt)) / 3600_000),
                      ),
                    })}
                  </p>
                )}
                {wizardStep === 0 && (
                  <>
                    <p className="text-xs text-muted-foreground">{t('wizardIntro')}</p>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={wizardBusy || maintBusy}
                      onClick={() => void startOneClickReset()}
                    >
                      {wizardBusy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {t('wizardStart')}
                    </Button>
                  </>
                )}
                {wizardStep === 2 && (
                  <>
                    {wizardIpBefore ? (
                      <p className="text-xs text-muted-foreground">
                        {wizardIpLoc
                          ? t('wizardIpBefore', { ip: wizardIpBefore, location: wizardIpLoc })
                          : t('wizardIpBeforeNoLoc', { ip: wizardIpBefore })}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t('wizardRefetchHint')}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{t('wizardGuide')}</p>
                    {wizardIpFailCount >= 3 && (
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        {t('wizardIpFailMany')}
                      </p>
                    )}
                    <Button
                      size="sm"
                      disabled={wizardBusy || maintBusy}
                      onClick={() => void verifyIpChanged()}
                    >
                      {wizardBusy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {t('wizardVerify')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={wizardBusy || maintBusy}
                      onClick={skipIpVerify}
                    >
                      {t('wizardSkipIp')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={wizardBusy || wizardAuditing || maintBusy}
                      onClick={() => void runResidualAudit()}
                    >
                      {wizardAuditing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {t('wizardAuditRerun')}
                    </Button>
                  </>
                )}
                {wizardStep === 3 && (
                  <>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {t('wizardIpChanged', { ip: wizardIpNow })}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('wizardCooldown')}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={wizardBusy || wizardAuditing || maintBusy}
                      onClick={restartWizard}
                    >
                      {t('wizardRestart')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={wizardBusy || wizardAuditing || maintBusy}
                      onClick={() => void runResidualAudit()}
                    >
                      {wizardAuditing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {t('wizardAuditRerun')}
                    </Button>
                  </>
                )}
                {wizardMsg.length > 0 && (
                  <pre className="max-h-24 overflow-y-auto rounded bg-muted p-2 text-xs">
                    {wizardMsg.join('\n')}
                  </pre>
                )}
                {/* 残留指纹审计面板:只在真的扫过之后出现(未扫过时 wizardAudit 为 null) */}
                {wizardAudit && (
                  <div className="space-y-1 rounded border border-border/60 bg-background/40 p-2">
                    <p className="text-xs font-medium">{t('wizardAuditTitle')}</p>
                    {wizardAuditing && (
                      <p className="text-xs text-muted-foreground">{t('wizardAuditScanning')}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('wizardAuditScope', {
                        files: wizardAudit.scanned_files,
                        mb: Math.round(wizardAudit.scanned_mb * 10) / 10,
                        sites: wizardAudit.sites_present,
                      })}
                    </p>
                    {wizardAudit.blacklist_size === 0 ? (
                      <p className="text-xs text-muted-foreground">{t('wizardAuditNoHistory')}</p>
                    ) : wizardAudit.ok ? (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {t('wizardAuditClean')}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {t('wizardAuditResidual', { n: wizardAudit.hard_hits })}
                      </p>
                    )}
                    {!wizardAudit.ok && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={wizardBusy || wizardAuditing || maintBusy}
                        onClick={() => void startOneClickReset()}
                      >
                        {wizardBusy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        {t('wizardResidualReclean')}
                      </Button>
                    )}
                    {wizardAudit.hard_hit_files.length > 0 && (
                      <ul className="space-y-0.5 text-xs">
                        {wizardAudit.hard_hit_files.slice(0, 8).map((hit) => (
                          <li key={hit.file} className="truncate font-mono">
                            {hit.file} ×{hit.count} {hit.sample}
                          </li>
                        ))}
                      </ul>
                    )}
                    {wizardAudit.suspect_hits > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {t('wizardAuditSuspect', { n: wizardAudit.suspect_hits })}
                      </p>
                    )}
                    {wizardAudit.registry.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          {t('wizardAuditRegistry')}
                        </summary>
                        <pre className="max-h-24 overflow-y-auto rounded bg-muted p-2">
                          {wizardAudit.registry.join('\n')}
                        </pre>
                      </details>
                    )}
                    {wizardAudit.hardware.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          {t('wizardAuditHardware')}
                        </summary>
                        <pre className="max-h-24 overflow-y-auto rounded bg-muted p-2">
                          {wizardAudit.hardware.join('\n')}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
                {wizardStep === 2 && (
                  wizardCriticalFail ? (
                    <p className="text-xs font-medium text-destructive">{t('wizardCriticalFailNote')}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('wizardOptionalNote')}</p>
                  )
                )}
              </div>
              <div>
                <Label htmlFor="checkin-maint-user-id">{t('maintUserIdLabel')}</Label>
                <Input
                  id="checkin-maint-user-id"
                  value={maintUserId}
                  onChange={(e) => setMaintUserId(e.target.value)}
                  placeholder="user_id"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={maintBusy || wizardBusy}
                  onClick={() => void resetDeviceIds()}
                >
                  {t('maintReset')}
                </Button>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    disabled={maintBusy || wizardBusy}
                    checked={maintIncludeGuid}
                    onChange={(e) => setMaintIncludeGuid(e.target.checked)}
                  />
                  {t('maintIncludeGuid')}
                </label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    disabled={maintBusy || wizardBusy}
                    checked={maintIncludeBrowser}
                    onChange={(e) => setMaintIncludeBrowser(e.target.checked)}
                  />
                  {t('maintIncludeBrowser')}
                </label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    disabled={maintBusy || wizardBusy}
                    checked={maintDeepReset}
                    onChange={(e) => setMaintDeepReset(e.target.checked)}
                  />
                  {t('maintDeepReset')}
                </label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    disabled={maintBusy || wizardBusy}
                    checked={maintIncludeMac}
                    onChange={(e) => setMaintIncludeMac(e.target.checked)}
                  />
                  {t('maintIncludeMac')}
                </label>
                <Button variant="outline" size="sm" disabled={maintBusy} onClick={() => void backupSnapshot()}>
                  {t('maintBackup')}
                </Button>
              </div>
              {maintReport.length > 0 && (
                <pre className="max-h-40 overflow-y-auto rounded bg-muted p-2 text-xs">
                  {maintReport.join('\n')}
                </pre>
              )}
              <div>
                <p className="mb-1 text-sm font-medium">{t('snapshotsTitle')}</p>
                {snapshots.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('snapshotsEmpty')}</p>
                ) : (
                  <ul className="space-y-1">
                    {snapshots.map((s) => (
                      <li key={s.user_id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-mono text-xs">{s.user_id}</span>
                        <span className="text-xs text-muted-foreground">{s.kinds.length}</span>
                        <span className="flex shrink-0 gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={maintBusy}
                            onClick={() => void restoreSnapshot(s.user_id)}
                          >
                            {t('maintRestore')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={maintBusy}
                            onClick={() => void deleteSnapshot(s.user_id)}
                          >
                            {t('maintDelete')}
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setMaintOpen(false)}>
                {t('maintClose')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
