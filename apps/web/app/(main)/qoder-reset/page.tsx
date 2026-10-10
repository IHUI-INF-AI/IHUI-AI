// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
// Qoder 程序一键重置(2026-10-10 立,与 WorkBuddy 重置同架构):维护清理/登出重置/出厂重置(双根隔离区搬移可逆)。
// 目标=~/.qoder-cn + %APPDATA%/com.qodercn.app.stable 双根本地状态;边界:只做本地清理,服务端解绑走官方渠道,不做指纹伪造。
import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Archive,
  Eraser,
  Factory,
  History,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Trash2,
  TriangleAlert,
  Undo2,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Label,
} from '@ihui/ui-react'
import { useTauriIpcReady } from '@/hooks/use-desktop'
import {
  checkinAuditQoderResidual,
  checkinGetPublicIp,
  qoderQuarantineDelete,
  qoderQuarantineList,
  qoderQuarantineRestore,
  qoderResetFactory,
  qoderResetHistory,
  qoderResetLogout,
  qoderResetMaintenance,
  qoderResetPlan,
  qoderResetProbe,
  type WbHistoryItem,
  type WbPlanReport,
  type WbProgressEvent,
  type WbProbeReport,
  type QoderResidualAuditReport,
  type WbQuarantineInfo,
  type WbResetReport,
} from '@/lib/tauri-bridge'

type Mode = 'maintenance' | 'logout' | 'factory'

const TIER_BADGE: Record<string, string> = {
  maintenance: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  webview_logout: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  device_identity: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  user_asset: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  never: 'bg-zinc-500/15 text-zinc-500',
}

/** 向导事后自检的残留判据:这五类坐标仍存在=旧设备身份/登录态未清干净
 *  (chat_db/local_state 属用户资产,不在判据内)。 */
const WIZARD_RESIDUAL_KINDS = new Set([
  'auth_credential',
  'machine_id',
  'device_identity',
  'runtime_info',
  'webview_login',
])

export default function QoderResetPage() {
  const t = useTranslations('qoderReset')
  // 桌面端专属:useTauriIpcReady 抗 IPC 异步注入竞态 + 免水合不一致(与 checkin 页同纪律)
  const desktop = useTauriIpcReady()
  const [probe, setProbe] = React.useState<WbProbeReport | null>(null)
  const [probing, setProbing] = React.useState(false)
  const [probeError, setProbeError] = React.useState('')
  const [busy, setBusy] = React.useState<'' | Mode>('')
  const [killRunning] = React.useState(true)
  const [includeDeviceId, setIncludeDeviceId] = React.useState(false)
  const [factoryConfirm, setFactoryConfirm] = React.useState(false)
  const [result, setResult] = React.useState<{ mode: Mode; rep: WbResetReport } | null>(null)
  const [runError, setRunError] = React.useState('')
  // 执行进度(逐条目 Channel 回传)
  const [progress, setProgress] = React.useState<WbProgressEvent | null>(null)
  // 隔离区管理(列表/恢复/删除)与历史台账
  const [quarantines, setQuarantines] = React.useState<WbQuarantineInfo[]>([])
  const [history, setHistory] = React.useState<WbHistoryItem[]>([])
  const [qBusy, setQBusy] = React.useState(false)
  const [qDeleteConfirm, setQDeleteConfirm] = React.useState<string | null>(null)
  const [qNotice, setQNotice] = React.useState('')
  // 计划预览(执行前"会动什么/多大"逐条披露;与执行层共用后端同一份判据)
  const [plans, setPlans] = React.useState<Partial<Record<Mode, WbPlanReport>>>({})
  const [planLoading, setPlanLoading] = React.useState(false)
  const [planOpen, setPlanOpen] = React.useState<Mode | null>(null)
  // 探针条目展开/收起(默认只显前 12 条)
  const [showAllEntries, setShowAllEntries] = React.useState(false)
  // 风控向导(2026-10-11 镜像 WorkBuddy 打卡页一键风控向导,2026-10-10 立):傻瓜式 3 步
  // 登出+设备身份重置 → 换网络出口验证 → 24h 冷却提醒
  const [wizardStep, setWizardStep] = React.useState<0 | 2 | 3>(0)
  const [wizardIpBefore, setWizardIpBefore] = React.useState('')
  const [wizardIpLoc, setWizardIpLoc] = React.useState('')
  const [wizardIpNow, setWizardIpNow] = React.useState('')
  const [wizardBusy, setWizardBusy] = React.useState(false)
  const [wizardMsg, setWizardMsg] = React.useState<string[]>([])
  // 事后自检(2026-10-11 立):重置后用双根残留审计桥只读清点,把"到底干净了没有"
  // 变成面板上可读的结论,而不是靠用户猜。
  const [wizardAudit, setWizardAudit] = React.useState<QoderResidualAuditReport | null>(null)
  const [wizardAuditing, setWizardAuditing] = React.useState(false)
  // 是否出现"非可选层失败":用于动态判定下方提示语(可选层失败才说"不影响",否则警告)
  const [wizardCriticalFail, setWizardCriticalFail] = React.useState(false)
  // IP 验证连续失败次数(未变/获取失败都计):≥3 自动高亮引导走"直接完成"旁路
  const [wizardIpFailCount, setWizardIpFailCount] = React.useState(0)
  // 上次向导重置时间(冷却提醒用):24h 内再登录会续期风控
  const [lastResetAt, setLastResetAt] = React.useState<number | null>(null)
  React.useEffect(() => {
    try {
      const v = localStorage.getItem('qoder-reset-wizard-at')
      if (v) setLastResetAt(Number(v))
    } catch {
      /* 隐私模式降级:无提醒 */
    }
  }, [])

  const runProbe = React.useCallback(async () => {
    setProbing(true)
    setProbeError('')
    try {
      const rep = await qoderResetProbe()
      setProbe(rep)
    } catch (e) {
      setProbeError(e instanceof Error ? e.message : String(e))
    } finally {
      setProbing(false)
    }
  }, [])

  /** 隔离区 + 历史台账侧载(探针后/操作后刷新;失败静默——两卡属辅助信息,不阻断主流程)。 */
  const refreshSide = React.useCallback(async () => {
    try {
      const [qs, hs] = await Promise.all([qoderQuarantineList(), qoderResetHistory()])
      setQuarantines(qs)
      setHistory(hs)
    } catch {
      // 列表读不到时保留旧值;不设错误态避免淹没主探针错误
    }
  }, [])

  React.useEffect(() => {
    if (!desktop) return
    void runProbe()
    void refreshSide()
  }, [desktop, runProbe, refreshSide])

  const onProgress = React.useCallback((ev: WbProgressEvent) => {
    setProgress(ev)
  }, [])

  const execute = React.useCallback(
    async (mode: Mode) => {
      if (mode === 'factory' && !factoryConfirm) {
        setFactoryConfirm(true)
        return
      }
      setFactoryConfirm(false)
      setBusy(mode)
      setRunError('')
      setProgress(null)
      try {
        const rep =
          mode === 'maintenance'
            ? await qoderResetMaintenance(killRunning, onProgress)
            : mode === 'logout'
              ? await qoderResetLogout(killRunning, includeDeviceId, onProgress)
              : await qoderResetFactory(killRunning, onProgress)
        setResult({ mode, rep })
        void refreshSide()
      } catch (e) {
        setRunError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy('')
        setProgress(null)
      }
    },
    [factoryConfirm, killRunning, includeDeviceId, onProgress, refreshSide],
  )

  // 事后自检:与"重置"解耦的独立动作——双根残留审计只读清点,凡设备身份/登录态
  // 坐标仍存在即残留;失败只在向导消息里落一行,不拦流程(取证不是处置)。
  const runWizardAudit = async () => {
    setWizardAuditing(true)
    try {
      const rep = await checkinAuditQoderResidual()
      setWizardAudit(rep)
      const residual = rep.entries.filter(
        (e) => e.exists && WIZARD_RESIDUAL_KINDS.has(e.kind),
      )
      setWizardMsg((m) => [
        residual.length === 0
          ? t('wizardAuditClean')
          : t('wizardAuditResidual', { n: residual.length }),
        ...m,
      ])
    } catch {
      setWizardMsg((m) => [t('wizardAuditFail'), ...m])
    } finally {
      setWizardAuditing(false)
    }
  }

  // 向导 Step1:Qoder 版"一键风控重置"=登出重置档全开(登录态 .auth + Partitions webview +
  // 设备身份 installation_id/umid-cache.json 一并隔离,应用下次启动自行重注册)。
  // 进程强杀层失败属可选降级,其余层失败才算 critical(镜像 WorkBuddy 向导动态提示)。
  const startWizardReset = async () => {
    setWizardBusy(true)
    setWizardMsg([])
    try {
      const report = await qoderResetLogout(true, true)
      const okCount = report.layers.filter((l) => l.ok).length
      const fails = report.layers.filter((l) => !l.ok)
      setWizardIpFailCount(0)
      const critical = fails.some((l) => !l.name.includes('kill'))
      setWizardCriticalFail(critical)
      setWizardMsg([
        t('wizardResetDone', { ok: okCount, total: report.layers.length }),
        ...fails.map((l) => `${l.name}: ${l.detail}`),
      ])
      try {
        localStorage.setItem('qoder-reset-wizard-at', String(Date.now()))
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
      // 重置完就地自检:自动跑一次探针复核,用户不必另找入口确认"是否彻底"
      await runWizardAudit()
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e))
    } finally {
      setWizardBusy(false)
    }
  }

  // 向导 Step2:验证用户已换网络出口(IP 必须真的变了)
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
        setWizardIpFailCount((c) => c + 1)
        setWizardMsg((m) => [t('wizardIpUnchanged'), ...m])
      }
    } catch {
      setWizardIpFailCount((c) => c + 1)
      setWizardMsg((m) => [t('wizardIpFetchFail'), ...m])
    } finally {
      setWizardBusy(false)
    }
  }

  // P0-1 旁路:用户确实无法更换网络时,允许直接跳到 Step3(进入 24h 冷却),避免单向死路
  const skipIpVerify = () => {
    setWizardIpFailCount(0)
    setWizardStep(3)
  }

  // 向导状态归零(Step3 完成后的重新开始入口;上一轮审计结论必须清掉,防误导新一轮)
  const restartWizard = () => {
    setWizardStep(0)
    setWizardIpBefore('')
    setWizardIpLoc('')
    setWizardIpNow('')
    setWizardMsg([])
    setWizardAudit(null)
    setWizardCriticalFail(false)
    setWizardIpFailCount(0)
  }

  const togglePlan = React.useCallback(
    async (mode: Mode) => {
      if (planOpen === mode) {
        setPlanOpen(null)
        return
      }
      setPlanOpen(mode)
      setPlanLoading(true)
      try {
        const rep = await qoderResetPlan(mode, mode === 'logout' ? includeDeviceId : false)
        setPlans((p) => ({ ...p, [mode]: rep }))
      } catch {
        setPlans((p) => ({ ...p, [mode]: undefined }))
      } finally {
        setPlanLoading(false)
      }
    },
    [planOpen, includeDeviceId],
  )

  const restoreQuarantine = React.useCallback(
    async (path: string) => {
      setQBusy(true)
      setQNotice('')
      try {
        const rep = await qoderQuarantineRestore(path)
        setQNotice(
          rep.layers.every((l) => l.ok)
            ? t('qRestored')
            : `${t('errPrefix')}: ${rep.layers.map((l) => l.detail).join('; ')}`,
        )
        void refreshSide()
        void runProbe()
      } catch (e) {
        setQNotice(`${t('errPrefix')}: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setQBusy(false)
      }
    },
    [refreshSide, runProbe, t],
  )

  const deleteQuarantine = React.useCallback(
    async (path: string) => {
      setQBusy(true)
      setQNotice('')
      try {
        const rep = await qoderQuarantineDelete(path)
        setQNotice(
          rep.layers.every((l) => l.ok)
            ? t('qDeleted')
            : `${t('errPrefix')}: ${rep.layers.map((l) => l.detail).join('; ')}`,
        )
        setQDeleteConfirm(null)
        void refreshSide()
      } catch (e) {
        setQNotice(`${t('errPrefix')}: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setQBusy(false)
      }
    },
    [refreshSide, t],
  )

  if (!desktop) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('nonDesktop')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const tierLabel = (tier: string) => {
    const map: Record<string, string> = {
      maintenance: t('tierMaintenance'),
      webview_logout: t('tierWebviewLogout'),
      device_identity: t('tierDeviceIdentity'),
      user_asset: t('tierUserAsset'),
      never: t('tierNever'),
    }
    return map[tier] ?? tier
  }

  const actLabel = (action: string) => {
    const map: Record<string, string> = {
      delete_dir: t('planActDeleteDir'),
      delete_file: t('planActDeleteFile'),
      quarantine: t('planActQuarantine'),
    }
    return map[action] ?? action
  }

  const renderPlan = (mode: Mode) => {
    if (planOpen !== mode) return null
    if (planLoading) {
      return (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('probeScanning')}
        </p>
      )
    }
    const rep = plans[mode]
    if (!rep || rep.actions.length === 0) {
      return <p className="text-muted-foreground text-xs">{t('planEmpty')}</p>
    }
    return (
      <div className="space-y-1 rounded-md border p-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">{t('planTitle')}</span>
          <span className="text-muted-foreground font-mono">
            {rep.total_mb.toFixed(1)} MB · {rep.actions.length}
          </span>
        </div>
        {rep.actions.slice(0, 8).map((a) => (
          <div key={a.path} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-mono">{a.path}</span>
            <span className="text-muted-foreground shrink-0">
              {actLabel(a.action)} · {a.size_mb.toFixed(1)} MB
            </span>
          </div>
        ))}
        {rep.actions.length > 8 ? (
          <p className="text-muted-foreground text-xs">{t('planTruncated')}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('subtitle')}</p>
      </div>

      {/* 探针报告 */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{t('probeTitle')}</CardTitle>
            <CardDescription>
              {probe ? `${t('probeRoot')}: ${probe.root}` : t('probeScanning')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {probe && (
              <Badge variant="secondary">
                {probe.workbuddy_running ? t('wbRunning') : t('wbNotRunning')}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => void runProbe()} disabled={probing}>
              {probing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('probeRefresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {probeError ? (
            <p className="text-destructive text-sm">
              {t('errPrefix')}: {probeError}
            </p>
          ) : probe ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('probeTotal')}: </span>
                  <span className="font-medium">{probe.total_mb.toFixed(1)} MB</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('probeReclaimable')}: </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {probe.reclaimable_mb.toFixed(1)} MB
                  </span>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {probe.entries.slice(0, showAllEntries ? undefined : 12).map((e) => (
                  <div key={e.path} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${TIER_BADGE[e.tier] ?? ''}`}>
                        {tierLabel(e.tier)}
                      </span>
                      <span className="truncate font-mono text-xs">{e.path}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {e.size_mb.toFixed(1)} MB
                    </span>
                  </div>
                ))}
                {probe.entries.length > 12 ? (
                  <button
                    type="button"
                    className="text-primary text-xs"
                    onClick={() => setShowAllEntries((v) => !v)}
                  >
                    {showAllEntries ? t('entriesShowLess') : t('entriesShowAll')}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('probeScanning')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 风控向导(2026-10-11 镜像 WorkBuddy 打卡页一键风控向导):傻瓜式 3 步
          登出重置全开设备身份 → 换网络出口验证 → 24h 冷却提醒;事后自检用探针复扫双根 */}
      <Card className="border-amber-500/50 bg-amber-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" /> {t('wizardTitle')}
          </CardTitle>
          <CardDescription>{t('wizardSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
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
              <p className="text-muted-foreground text-xs">{t('wizardIntro')}</p>
              <Button
                variant="destructive"
                size="sm"
                disabled={wizardBusy}
                onClick={() => void startWizardReset()}
              >
                {wizardBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                {t('wizardStart')}
              </Button>
            </>
          )}
          {wizardStep === 2 && (
            <>
              {wizardIpBefore ? (
                <p className="text-muted-foreground text-xs">
                  {wizardIpLoc
                    ? t('wizardIpBefore', { ip: wizardIpBefore, location: wizardIpLoc })
                    : t('wizardIpBeforeNoLoc', { ip: wizardIpBefore })}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">{t('wizardRefetchHint')}</p>
              )}
              <p className="text-muted-foreground text-xs">{t('wizardGuide')}</p>
              {wizardIpFailCount >= 3 && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {t('wizardIpFailMany')}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={wizardBusy} onClick={() => void verifyIpChanged()}>
                  {wizardBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t('wizardVerify')}
                </Button>
                <Button size="sm" variant="ghost" disabled={wizardBusy} onClick={skipIpVerify}>
                  {t('wizardSkipIp')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={wizardBusy || wizardAuditing}
                  onClick={() => void runWizardAudit()}
                >
                  {wizardAuditing && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t('wizardAuditRerun')}
                </Button>
              </div>
            </>
          )}
          {wizardStep === 3 && (
            <>
              <p className="text-xs text-green-600 dark:text-green-400">
                {t('wizardIpChanged', { ip: wizardIpNow })}
              </p>
              <p className="text-muted-foreground text-xs">{t('wizardCooldown')}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={wizardBusy || wizardAuditing}
                  onClick={restartWizard}
                >
                  {t('wizardRestart')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={wizardBusy || wizardAuditing}
                  onClick={() => void runWizardAudit()}
                >
                  {wizardAuditing && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t('wizardAuditRerun')}
                </Button>
              </div>
            </>
          )}
          {wizardMsg.length > 0 && (
            <pre className="max-h-24 overflow-y-auto rounded bg-muted p-2 text-xs">
              {wizardMsg.join('\n')}
            </pre>
          )}
          {/* 事后自检面板:只在真的扫过之后出现(未扫过时 wizardAudit 为 null) */}
          {wizardAudit && (
            <div className="space-y-1 rounded border border-border/60 bg-background/40 p-2">
              <p className="text-xs font-medium">{t('wizardAuditTitle')}</p>
              {wizardAuditing && (
                <p className="text-muted-foreground text-xs">{t('wizardAuditScanning')}</p>
              )}
              <p className="text-muted-foreground text-xs">
                {t('wizardAuditScope', {
                  cn: wizardAudit.cn_root,
                  roaming: wizardAudit.roaming_root,
                  files: wizardAudit.entries.length,
                })}
              </p>
              {wizardAudit.entries.filter((e) => e.exists && WIZARD_RESIDUAL_KINDS.has(e.kind))
                .length === 0 ? (
                <p className="text-xs text-green-600 dark:text-green-400">
                  {t('wizardAuditClean')}
                </p>
              ) : (
                <>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t('wizardAuditResidual', {
                      n: wizardAudit.entries.filter(
                        (e) => e.exists && WIZARD_RESIDUAL_KINDS.has(e.kind),
                      ).length,
                    })}
                  </p>
                  <ul className="space-y-0.5 text-xs">
                    {wizardAudit.entries
                      .filter((e) => e.exists && WIZARD_RESIDUAL_KINDS.has(e.kind))
                      .slice(0, 8)
                      .map((e) => (
                        <li key={`${e.root}:${e.path}`} className="truncate font-mono">
                          {e.root}:{e.path}
                        </li>
                      ))}
                  </ul>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={wizardBusy || wizardAuditing}
                    onClick={() => void startWizardReset()}
                  >
                    {wizardBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                    {t('wizardResidualReclean')}
                  </Button>
                </>
              )}
              {/* 全量条目折叠(镜像 WorkBuddy 向导的 details 展开收起模式) */}
              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer">
                  {t('wizardAuditEntries')}
                </summary>
                <pre className="max-h-24 overflow-y-auto rounded bg-muted p-2">
                  {wizardAudit.entries.map((e) => `${e.kind}  ${e.root}:${e.path}`).join('\n')}
                </pre>
              </details>
            </div>
          )}
          {wizardStep === 2 &&
            (wizardCriticalFail ? (
              <p className="text-xs font-medium text-destructive">
                {t('wizardCriticalFailNote')}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">{t('wizardOptionalNote')}</p>
            ))}
        </CardContent>
      </Card>

      {/* 三档操作 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eraser className="h-4 w-4" /> {t('maintTitle')}
            </CardTitle>
            <CardDescription>{t('maintDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => void execute('maintenance')}
              disabled={busy !== ''}
            >
              {busy === 'maintenance' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('maintCta')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={planLoading}
              onClick={() => void togglePlan('maintenance')}
            >
              {t('planPreview')}
            </Button>
            {renderPlan('maintenance')}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LogOut className="h-4 w-4" /> {t('logoutTitle')}
            </CardTitle>
            <CardDescription>{t('logoutDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="wb-device-id"
                checked={includeDeviceId}
                onCheckedChange={(v) => setIncludeDeviceId(v === true)}
              />
              <Label htmlFor="wb-device-id" className="text-sm">
                {t('logoutDeviceIdOpt')}
              </Label>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => void execute('logout')}
              disabled={busy !== ''}
            >
              {busy === 'logout' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('logoutCta')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={planLoading}
              onClick={() => void togglePlan('logout')}
            >
              {t('planPreview')}
            </Button>
            {renderPlan('logout')}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Factory className="h-4 w-4" /> {t('factoryTitle')}
            </CardTitle>
            <CardDescription>{t('factoryDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {factoryConfirm ? (
              <div className="space-y-2">
                <p className="text-destructive flex items-start gap-1 text-xs">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('factoryConfirm')}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => void execute('factory')}
                    disabled={busy !== ''}
                  >
                    {busy === 'factory' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t('factoryConfirmYes')}
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setFactoryConfirm(false)}
                  >
                    {t('factoryConfirmNo')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => void execute('factory')}
                disabled={busy !== ''}
              >
                {t('factoryCta')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={planLoading}
              onClick={() => void togglePlan('factory')}
            >
              {t('planPreview')}
            </Button>
            {renderPlan('factory')}
          </CardContent>
        </Card>
      </div>

      {/* 提示与边界 */}
      <div className="text-muted-foreground space-y-1 text-xs">
        <p className="flex items-start gap-1">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('killNote')}
        </p>
        <p className="flex items-start gap-1">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('boundaryNote')}
        </p>
      </div>

      {runError ? (
        <p className="text-destructive text-sm">
          {t('errPrefix')}: {runError}
        </p>
      ) : null}

      {/* 执行进度(逐条目回传) */}
      {busy && progress ? (
        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> {t('progressLabel')}
              </span>
              <span className="font-mono text-xs">
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="bg-secondary h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all"
                style={{
                  width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%',
                }}
              />
            </div>
            <p className="text-muted-foreground truncate font-mono text-xs">{progress.item}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* 执行结果 */}
      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('resultTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.rep.layers.map((l) => (
              <div key={l.layer} className="flex items-start justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-start gap-2">
                  <Badge
                    className={
                      l.ok
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400'
                    }
                  >
                    {l.ok ? t('resultOk') : t('resultFail')}
                  </Badge>
                  <span className="font-mono text-xs">{l.name}</span>
                </div>
                <span className="text-muted-foreground min-w-0 flex-1 break-all text-right text-xs">
                  {l.detail}
                </span>
              </div>
            ))}
            <p className="text-muted-foreground pt-1 text-xs">{t('restartHint')}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* 隔离区管理(恢复/删除) */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="h-4 w-4" /> {t('quarantineTitle')}
            </CardTitle>
            <CardDescription>{qNotice || t('quarantineDesc')}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshSide()} disabled={qBusy}>
            {qBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t('quarantineRefresh')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {quarantines.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('quarantineEmpty')}</p>
          ) : (
            quarantines.map((q) => (
              <div
                key={q.path}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge variant="secondary">{q.mode}</Badge>
                  <span className="truncate font-mono text-xs">{q.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {t('qEntriesLabel')}: {q.entries} · {q.size_mb.toFixed(1)} MB ·{' '}
                    {new Date(q.created_unix * 1000).toLocaleString()}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={qBusy}
                    onClick={() => void restoreQuarantine(q.path)}
                  >
                    <Undo2 className="h-3.5 w-3.5" /> {t('qRestore')}
                  </Button>
                  {qDeleteConfirm === q.path ? (
                    <>
                      <span className="text-destructive flex items-center gap-1 text-xs">
                        <TriangleAlert className="h-3.5 w-3.5" /> {t('qDeleteConfirm')}
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={qBusy}
                        onClick={() => void deleteQuarantine(q.path)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t('qDelete')}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setQDeleteConfirm(null)}>
                        {t('factoryConfirmNo')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={qBusy}
                      onClick={() => setQDeleteConfirm(q.path)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t('qDelete')}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 历史台账 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> {t('historyTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('historyEmpty')}</p>
          ) : (
            history.slice(0, 10).map((h) => (
              <div key={h.file} className="flex items-start justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge
                    className={
                      h.ok
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400'
                    }
                  >
                    {h.ok ? t('resultOk') : t('resultFail')}
                  </Badge>
                  <span className="shrink-0 font-mono text-xs">{h.mode}</span>
                </div>
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-xs">
                  {new Date(h.ts_unix * 1000).toLocaleString()} · {h.summary}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
