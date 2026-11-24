// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plug, Radar, RefreshCw, Unplug } from 'lucide-react'

import {
  getConnectorCoverage,
  getConnectorCoveragePlan,
  probeConnectorCoverage,
  saveConnectorConfig,
  type ConnectorEntry,
  type CoveragePlanResponse,
} from '@ihui/api-client/endpoints/connectors'
import { Button } from '@ihui/ui-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ihui/ui-react'

import type { CoveragePlatform, CoverageProbeItem } from './types'
import { COVERAGE_PLATFORMS } from './types'
import { CoverageProbeSummary } from './probe-summary'
import { CoverageDomainTree } from './domain-tree'

interface CoveragePanelProps {
  connectors: ConnectorEntry[]
  onRefresh: () => void
}

interface PlanDialogState {
  open: boolean
  domain: string | null
  plan: CoveragePlanResponse | null
  saving: boolean
}

const IDLE_PLAN: PlanDialogState = { open: false, domain: null, plan: null, saving: false }

/** 探测条数合法区间(后端 1..200,越界返回 400 `limit 须在 1..200 之间`),前端先拦一道 */
const PROBE_LIMIT_MIN = 1
const PROBE_LIMIT_MAX = 200
const PROBE_LIMIT_DEFAULT = 50

/**
 * "探测全量"分批翻页硬上限(防后端 nextOffset 异常导致前端死循环)。
 * 60 批 × 每批 200 = 12000,已远超当前最大台账(飞书 1768 条),触顶即停并提示。
 */
const PROBE_MAX_BATCHES = 60

/** 校验探测条数是否落在后端合法区间;越界返回 false,不发请求 */
export function isProbeLimitValid(limit: number): boolean {
  return Number.isFinite(limit) && limit >= PROBE_LIMIT_MIN && limit <= PROBE_LIMIT_MAX
}

export function CoveragePanel({ connectors, onRefresh }: CoveragePanelProps) {
  const [platform, setPlatform] = React.useState<CoveragePlatform>('feishu')
  const [overrides, setOverrides] = React.useState<Record<string, CoverageProbeItem>>({})
  const [probing, setProbing] = React.useState(false)
  const [planning, setPlanning] = React.useState(false)
  const [planState, setPlanState] = React.useState<PlanDialogState>(IDLE_PLAN)

  /** 当前平台已接入的连接器实例 key;未接入为 null(probe 后端要求实例存在且启用) */
  const activeKey = React.useMemo(
    () => connectors.find((c) => c.type === platform)?.key ?? null,
    [connectors, platform],
  )

  const { data: catalog, isLoading, error, refetch } = useQuery({
    queryKey: ['connectors', 'coverage', platform],
    queryFn: async () => {
      const r = await getConnectorCoverage(platform)
      if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
      return r.data
    },
  })

  React.useEffect(() => {
    setOverrides({})
  }, [platform])

  const runProbe = React.useCallback(
    async (domains: string[]) => {
      if (probing) return
      if (!activeKey) {
        toast.error('请先在上方一键接入该平台连接器,再发起探测')
        return
      }
      if (!isProbeLimitValid(PROBE_LIMIT_DEFAULT)) {
        toast.error(`探测条数须在 ${PROBE_LIMIT_MIN}..${PROBE_LIMIT_MAX} 之间`)
        return
      }
      setProbing(true)
      try {
        // "探测全量"必须真翻页:后端单批上限 200,此前固定 limit:50 且不传游标,
        // 第 51 条之后永远 unprobed(机主点的"造好没装车")。按 nextOffset 循环拉完。
        // 首批不传 offset(走后端缺省 0,兼容旧契约/测试),后续批显式带游标。
        let offset: number | undefined
        let totalProbed = 0
        let totalSkipped = 0
        let batches = 0
        let hitCap = false
        const collected: CoverageProbeItem[] = []
        while (batches < PROBE_MAX_BATCHES) {
          const r = await probeConnectorCoverage(activeKey, {
            api_ids: [],
            domains,
            limit: PROBE_LIMIT_DEFAULT,
            ...(offset === undefined ? {} : { offset }),
            read_only: true,
          })
          if (!r.success || !r.data) {
            if (batches === 0) {
              toast.error(`探测失败:${r.error ?? '未知错误'}`)
              return
            }
            // 后续批失败:保留已拿到批次的结果,如实提示部分完成,不冒充全量对齐
            break
          }
          batches += 1
          totalProbed += r.data.probed ?? 0
          totalSkipped += r.data.skipped ?? 0
          for (const item of r.data.results ?? []) collected.push(item)
          const next = r.data.nextOffset ?? null
          if (next === null) break
          // 防御:游标未前进则停,避免后端异常导致重复拉同一批死循环
          if (offset !== undefined && next <= offset) {
            hitCap = true
            break
          }
          offset = next
          if (batches >= PROBE_MAX_BATCHES) hitCap = true
        }
        if (collected.length > 0) {
          setOverrides((prev) => {
            const next = { ...prev }
            for (const item of collected) next[item.api_id] = item
            return next
          })
        }
        toast.success(
          hitCap
            ? `探测完成:已探测 ${totalProbed} 条(达分批上限 ${PROBE_MAX_BATCHES},可能仍有未探接口)`
            : `探测完成:共 ${batches} 批,已探测 ${totalProbed} 条,跳过 ${totalSkipped} 条`,
        )
      } catch (err) {
        toast.error(`探测失败:${err instanceof Error ? err.message : '网络异常'}`)
      } finally {
        setProbing(false)
      }
    },
    [activeKey, probing],
  )

  const openPlan = React.useCallback(
    async (domain: string | null) => {
      if (planning) return
      setPlanning(true)
      try {
        const r = await getConnectorCoveragePlan(activeKey ?? platform, {
          platform,
          domains: domain ? [domain] : [],
          api_ids: [],
        })
        if (r.success && r.data) {
          setPlanState({ open: true, domain, plan: r.data, saving: false })
        } else {
          toast.error(`规划失败:${r.error ?? '未知错误'}`)
        }
      } catch (err) {
        toast.error(`规划失败:${err instanceof Error ? err.message : '网络异常'}`)
      } finally {
        setPlanning(false)
      }
    },
    [activeKey, platform, planning],
  )

  const confirmPlan = async () => {
    const plan = planState.plan
    if (!plan || planState.saving) return
    setPlanState((s) => ({ ...s, saving: true }))
    let okCount = 0
    for (const piece of plan.connectors) {
      // 保存路径取舍:plan 每片已带 `operation_defs`(可直接落库的完整定义,长度与
      // `operations` 计数一致),优先直传 operations 落库 —— 一次成型,不依赖保存时
      // 后端再次读台账二次展开,往返更少。直传时**不带** platform/api_ids/domains:
      // 后端只要识别到展开字段,resolve_expansion 就会用台账结果覆盖这里直传的 operations。
      // 兜底:老台账/旧片缺 operation_defs 时,退回展开路径传 platform + api_ids,由后端展开。
      const hasDefs = Array.isArray(piece.operation_defs) && piece.operation_defs.length > 0
      const r = await saveConnectorConfig({
        key: piece.key,
        type: platform,
        name: piece.label,
        app_id: '',
        app_secret: '',
        extra: { domain: piece.domain, api_ids: piece.api_ids.join(',') },
        managed: true,
        spec: { allow_write: false, allow_private_hosts: false },
        operations: hasDefs ? piece.operation_defs : [],
        ...(hasDefs ? {} : { platform, api_ids: piece.api_ids }),
      })
      if (r.success) okCount += 1
    }
    toast.success(`已创建 ${okCount}/${plan.connectors.length} 个分域连接器`)
    setPlanState({ ...IDLE_PLAN })
    onRefresh()
  }

  const totalOperations = catalog ? catalog.totals.apis : 0

  return (
    <section className="space-y-3 rounded-lg border border-stroke-subtle bg-card p-4">
      <header className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold text-foreground">平台 API 目录覆盖</h2>
          <p className="text-[11px] text-muted-foreground">
            按业务域查看目录与真实能力状态,只读探测,写操作需手动勾选开启
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COVERAGE_PLATFORMS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={platform === option.value ? 'default' : 'outline'}
              onClick={() => setPlatform(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={probing || !activeKey || catalog?.catalog_state !== 'ok'}
          onClick={() => void runProbe([])}
        >
          {probing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Radar className="mr-1.5 h-3.5 w-3.5" />
          )}
          探测全量
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={planning || catalog?.catalog_state !== 'ok'}
          onClick={() => void openPlan(null)}
        >
          <Plug className="mr-1.5 h-3.5 w-3.5" />
          按域接入
        </Button>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-label text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载目录…
        </div>
      ) : error ? (
        <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-label text-destructive">目录加载失败,请稍后重试</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            重试
          </Button>
        </div>
      ) : catalog?.catalog_state === 'unjudged' ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-stroke-subtle bg-muted/20 py-10 text-center">
          <Unplug className="h-7 w-7 text-muted-foreground" />
          <p className="text-body font-medium text-foreground">目录台账未就绪(未判定)</p>
          <p className="max-w-md text-[11px] text-muted-foreground">
            该平台的接口目录台账尚未完成抓取与判定,暂时无法展示 API 清单。
            {catalog.source.enumeration_method ? ` 枚举方式:${catalog.source.enumeration_method}` : ''}
            {catalog.source.fetched_at ? ` 更新于:${catalog.source.fetched_at}` : ''}
          </p>
          {catalog.unjudged_reason ? (
            <p className="max-w-md text-[11px] text-muted-foreground">原因:{catalog.unjudged_reason}</p>
          ) : null}
        </div>
      ) : catalog ? (
        <>
          <CoverageProbeSummary catalog={catalog} />
          {(catalog.unenumerated_domains ?? []).length > 0 ? (
            <div className="space-y-1.5 rounded-md border border-stroke-subtle bg-muted/20 p-2.5">
              <p className="text-[11px] font-medium text-foreground">
                未展开域 {catalog.unenumerated_domains.length} 个(台账遗留,未纳入下方分组)
              </p>
              <ul className="space-y-1">
                {catalog.unenumerated_domains.map((domain) => (
                  <li key={domain.key || domain.label} className="text-[11px] text-muted-foreground">
                    {domain.label || domain.key}
                    {domain.reason ? ` · ${domain.reason}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-2">
            {catalog.domains.map((domain) => (
              <CoverageDomainTree
                key={domain.key}
                domain={domain}
                apis={catalog.apis}
                overrides={overrides}
                probing={probing}
                probeDisabled={!activeKey}
                onProbeDomain={(key) => void runProbe([key])}
                onPlanDomain={(key) => void openPlan(key)}
              />
            ))}
            {catalog.domains.length === 0 ? (
              <p className="py-6 text-center text-label text-muted-foreground">
                共 {totalOperations} 条 API,暂无业务域分组
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <Dialog open={planState.open} onOpenChange={(v) => !v && !planState.saving && setPlanState(IDLE_PLAN)}>
        <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>按域接入预览</DialogTitle>
            <DialogDescription>
              将按目录分片创建连接器,每片操作不超过 200 个;写操作默认关闭,需在连接器内手动勾选开启。
            </DialogDescription>
          </DialogHeader>
          {planState.plan ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md bg-muted px-2.5 py-1.5 text-label">
                  创建 <strong className="tabular-nums">{planState.plan.connectors.length}</strong> 个分域连接器
                </span>
                <span className="rounded-md bg-muted px-2.5 py-1.5 text-label">
                  共 <strong className="tabular-nums">{planState.plan.selected}</strong> 个操作
                </span>
                <span className="rounded-md bg-muted px-2.5 py-1.5 text-label">
                  丢弃 <strong className="tabular-nums">{planState.plan.dropped}</strong> 条
                </span>
              </div>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                {planState.plan.connectors.map((piece) => (
                  <li
                    key={piece.key}
                    className="flex items-center justify-between gap-2 rounded-md border border-stroke-subtle px-2.5 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-label font-medium text-foreground">{piece.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {piece.domain} · {piece.api_ids.length} 个 API
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {piece.operations} 操作
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" disabled={planState.saving} onClick={() => setPlanState(IDLE_PLAN)}>
              取消
            </Button>
            <Button size="sm" disabled={planState.saving} onClick={() => void confirmPlan()}>
              {planState.saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              确认创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
