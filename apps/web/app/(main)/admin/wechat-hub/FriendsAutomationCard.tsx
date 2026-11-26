// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 新朋友自动化卡：扫描待处理的好友申请 / 进群邀请，逐条二次确认后通过。
 *
 * 四道闸：账号策略默认关、写动作必须显式 confirmed、每小时频次上限、审计留痕。
 * 扫描是只读路径；通过是写动作，会点微信客户端，策略关闭时前端先拦一道，后端再拦一道。
 */

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, ShieldCheck, UserPlus } from 'lucide-react'
import { Button, Card, CardContent, Input, Label, Switch } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { ApiError } from '@ihui/api-client'
// AGENTS §4:原生 confirm() 禁用，二次确认走项目自有 useConfirm 弹窗出口
import { useConfirm } from '@/hooks/use-confirm'
import type { WechatFriendRequestKind } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

const MIN_LIMIT = 1
const MAX_LIMIT = 10

const KIND_LABELS: Record<WechatFriendRequestKind, string> = {
  friend: '加好友',
  'group-invite': '群邀请',
}

/** 好友自动化错误码中文标题，与后端 WECHAT_FRIENDS_* / CONFIRM_REQUIRED 等取值一一对应。 */
const FRIEND_ERROR_TITLES: Record<string, string> = {
  WECHAT_FRIENDS_DISABLED: '好友自动化未开启，请先打开本卡片的策略开关',
  CONFIRM_REQUIRED: '缺少显式确认，请重新点击通过并确认',
  RATE_LIMITED: '每小时通过数量已达上限，请稍后再试',
  REQUEST_NOT_FOUND: '申请已失效或已被处理，请刷新后再看',
}

interface FriendErrorView {
  title: string
  detail: string
}

function describeFriendError(e: unknown): FriendErrorView {
  const errorCode = e instanceof ApiError ? e.errorCode : undefined
  const rawMessage = e instanceof Error ? e.message : ''
  const mappedTitle = errorCode ? FRIEND_ERROR_TITLES[errorCode] : undefined
  if (mappedTitle) {
    return { title: mappedTitle, detail: rawMessage && rawMessage !== mappedTitle ? rawMessage : '' }
  }
  return { title: rawMessage || '操作失败', detail: '' }
}

function formatAt(ts: number): string {
  if (!Number.isFinite(ts)) return '—'
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function FriendsAutomationCard({ accountId }: { accountId: string }) {
  const qc = useQueryClient()
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const forceNextScan = React.useRef(false)
  const overviewQuery = useQuery({
    queryKey: ['wechat-hub', 'friends', accountId],
    // 桥侧每 3 分钟后台巡检一次、请求默认读缓存；卡片 30 秒自动刷一次即可秒显新申请。
    // 「立即扫描」把 forceNextScan 置 true，下一次请求会要求桥做一次实时采集。
    queryFn: async () => {
      const force = forceNextScan.current
      forceNextScan.current = false
      return wechatHubApi.friendsOverview(accountId, force)
    },
    refetchInterval: 30_000,
  })
  const overview = overviewQuery.data
  const policy = overview?.policy
  const scan = overview?.scan
  const audit = overview?.audit ?? []

  const [limitDraft, setLimitDraft] = React.useState('')
  const [draftTouched, setDraftTouched] = React.useState(false)
  const [policyError, setPolicyError] = React.useState<FriendErrorView | null>(null)
  const [acceptError, setAcceptError] = React.useState<FriendErrorView | null>(null)
  const [pendingRequestId, setPendingRequestId] = React.useState<string | null>(null)
  const [exporting, setExporting] = React.useState(false)
  // 通过后回执里的剩余额度：让用户直接看到「今天还能通过几个」，不用自己算。
  const [lastQuota, setLastQuota] = React.useState<{ today: number; hour: number } | null>(null)
  const [exportError, setExportError] = React.useState<string | null>(null)

  // 后端策略刷新后，未手动改过的草稿跟随最新值，避免输入框显示旧上限
  React.useEffect(() => {
    if (policy && !draftTouched) setLimitDraft(String(policy.maxAcceptsPerHour))
  }, [policy, draftTouched])

  const policyMutation = useMutation({
    mutationFn: (patch: { enabled?: boolean; maxAcceptsPerHour?: number }) =>
      wechatHubApi.updateFriendsPolicy(accountId, patch),
    onSuccess: () => {
      setPolicyError(null)
      setDraftTouched(false)
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'friends', accountId] })
    },
    onError: (e) => setPolicyError(describeFriendError(e)),
  })

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => wechatHubApi.acceptFriend(accountId, requestId, true),
    onSuccess: (view) => {
      setAcceptError(null)
      setPendingRequestId(null)
      if (typeof view.remainingToday === 'number' || typeof view.remainingThisHour === 'number') {
        setLastQuota({
          today: view.remainingToday ?? 0,
          hour: view.remainingThisHour ?? 0,
        })
      }
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'friends', accountId] })
    },
    onError: (e) => {
      setPendingRequestId(null)
      setAcceptError(describeFriendError(e))
      // 被闸拦下也会记一条审计，刷新后跟着更新
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'friends', accountId] })
    },
  })

  const parsedLimit = Number(limitDraft)
  const limitValid =
    Number.isInteger(parsedLimit) && parsedLimit >= MIN_LIMIT && parsedLimit <= MAX_LIMIT
  const canSaveLimit =
    policy !== undefined && limitValid && parsedLimit !== policy.maxAcceptsPerHour

  const handleAccept = async (request: {
    requestId: string
    nickname: string
    kind: WechatFriendRequestKind
  }) => {
    // 策略关闭时前端先拦一道，不给后端送写请求
    if (!policy?.enabled) {
      setAcceptError({ title: '策略已关闭，开启后才会点客户端', detail: '' })
      return
    }
    const kindLabel = KIND_LABELS[request.kind]
    const ok = await confirm({
      title: '通过好友申请',
      description: `确认通过「${request.nickname}」的${kindLabel}申请？此操作会点击微信客户端，请核对昵称后再确认。`,
      confirmText: '通过',
    })
    if (!ok) return
    setAcceptError(null)
    setPendingRequestId(request.requestId)
    acceptMutation.mutate(request.requestId)
  }

  const auditEntries = audit.slice(-5).reverse()

  // 审计导出走带鉴权的 Blob 下载：接口要 Bearer token，直接给 <a href> 会被 401 挡掉。
  const handleExportAudit = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const blob = await wechatHubApi.friendsAuditCsv(accountId)
      const stamp = new Date().toISOString().slice(0, 10)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `friends-audit-${stamp}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : '导出审计失败')
    } finally {
      setExporting(false)
    }
  }

  if (overviewQuery.isLoading && !overview) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>读取新朋友申请…</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            <p className="text-sm font-medium">新朋友</p>
            {policy?.enabled ? (
              <span className="text-xs text-muted-foreground">
                已开启，每小时最多 {policy.maxAcceptsPerHour} 个
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">已关闭，开启后才会点客户端</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={exporting || overviewQuery.isLoading}
              onClick={() => void handleExportAudit()}
            >
              {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              <span>导出审计</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={overviewQuery.isFetching}
              onClick={() => {
                // 手动刷新走实时采集：桥在后台用消息点击读一次，不会把微信拉到前台
                forceNextScan.current = true
                void overviewQuery.refetch()
              }}
            >
              {overviewQuery.isFetching ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : null}
              <span>立即扫描</span>
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-stroke-field p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-sm font-medium">自动化策略</p>
            </div>
            <Switch
              checked={policy?.enabled ?? false}
              onCheckedChange={(enabled) => policyMutation.mutate({ enabled })}
              aria-label="好友自动化开关"
              disabled={policyMutation.isPending}
            />
          </div>
          {policy?.enabled ? (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="wechat-friends-max-per-hour" className="text-xs text-muted-foreground">
                    每小时上限
                  </Label>
                  <Input
                    id="wechat-friends-max-per-hour"
                    type="number"
                    min={MIN_LIMIT}
                    max={MAX_LIMIT}
                    value={limitDraft}
                    onChange={(event) => {
                      setLimitDraft(event.target.value)
                      setDraftTouched(true)
                    }}
                    className="h-8 w-24 px-2 text-sm"
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canSaveLimit || policyMutation.isPending}
                  onClick={() => {
                    if (!limitValid) return
                    policyMutation.mutate({ maxAcceptsPerHour: parsedLimit })
                  }}
                >
                  {policyMutation.isPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  <span>保存上限</span>
                </Button>
              </div>
              {limitDraft && !limitValid ? (
                <span className="text-xs text-red-500">
                  每小时上限需为 {MIN_LIMIT}–{MAX_LIMIT} 的整数
                </span>
              ) : null}
              <p className="text-xs text-muted-foreground">
                另有两道固定闸：每 24 小时最多 {policy.maxAcceptsPerDay ?? 10} 个、两次通过至少间隔{' '}
                {policy.minGapSeconds ?? 60} 秒，防止连点触发风控。
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              写动作默认关闭，开启后仍受每小时 {policy?.maxAcceptsPerHour ?? MAX_LIMIT} 个上限约束。
            </p>
          )}
          {policyError ? (
            <Alert variant="danger" title={policyError.title} description={policyError.detail || undefined} />
          ) : null}
        </div>

        {scan?.status === 'disabled' ? (
          <Alert
            variant="info"
            title="桥未开启好友自动化（BRIDGE_FRIENDS_AUTOMATION），扫描不可用"
          />
        ) : scan?.status === 'failed' ? (
          <Alert variant="danger" title="申请扫描失败" description={scan.reason || '桥未返回原因'} />
        ) : scan ? (
          <div className="space-y-2">
            {scan.stale ? (
              <p className="text-xs text-amber-600">
                微信窗口已收起，界面读不到实时数据；下面是 {Math.round((scan.cacheAgeMs ?? 0) / 1000)} 秒前采集的快照，打开微信后会自动更新。
              </p>
            ) : null}
            {scan.requests.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                暂无待处理申请（本次扫描枚举 {scan.rawCount} 个界面元素，入口与历史行已排除）。
              </p>
            ) : (
              <ul className="space-y-2">
                {scan.requests.map((request) => {
                  const cannotClick = !request.clickable
                  const buttonDisabled =
                    !policy?.enabled ||
                    cannotClick ||
                    pendingRequestId === request.requestId ||
                    acceptMutation.isPending
                  return (
                    <li
                      key={request.requestId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-stroke-subtle px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="truncate text-sm">
                            {request.nickname || '（昵称未读到）'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {KIND_LABELS[request.kind]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatAt(request.seenAt)}
                          </span>
                        </div>
                        {request.source ? (
                          <p className="text-xs text-muted-foreground">来源：{request.source}</p>
                        ) : null}
                        {cannotClick ? (
                          <p className="text-xs text-amber-600">控件不可点，请人工处理</p>
                        ) : null}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={buttonDisabled}
                        onClick={() => handleAccept(request)}
                      >
                        {pendingRequestId === request.requestId ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        <span>通过</span>
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">暂无扫描结果。</p>
        )}

        {acceptError ? (
          <Alert variant="danger" title={acceptError.title} description={acceptError.detail || undefined} />
        ) : null}

        {exportError ? <Alert variant="danger" title="导出审计失败" description={exportError} /> : null}

        {lastQuota ? (
          <p className="text-xs text-muted-foreground">
            刚才那次通过之后：本小时还能通过 {lastQuota.hour} 个，24 小时内还能通过 {lastQuota.today} 个。
          </p>
        ) : null}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">最近操作</span>
            <span className="text-xs text-muted-foreground">最近 5 条</span>
          </div>
          {auditEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无操作记录</p>
          ) : (
            <ul className="space-y-0.5 text-xs">
              {auditEntries.map((entry, index) => (
                <li
                  key={`${entry.at}-${entry.requestId}-${index}`}
                  className="flex flex-wrap items-baseline gap-x-2"
                >
                  <span className="text-muted-foreground">{formatAt(entry.at)}</span>
                  <span className="truncate">{entry.nickname || '（未命名）'}</span>
                  {entry.ok ? (
                    <span className="text-emerald-600">成功</span>
                  ) : (
                    <span className="text-red-600">失败</span>
                  )}
                  {entry.errorCode ? (
                    <span className="text-muted-foreground">{entry.errorCode}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {overviewQuery.isError ? (
          <Alert
            variant="danger"
            title="读取新朋友数据失败"
            description={overviewQuery.error instanceof Error ? overviewQuery.error.message : undefined}
          />
        ) : null}
        {/* useConfirm 的弹窗必须挂进组件树，否则二次确认点了没反应 */}
        <ConfirmDialogRenderer />
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
