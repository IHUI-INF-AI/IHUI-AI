// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 群管理：建群/邀请/移人/改名/公告，仅 bridge 后端。
 * 两段式：先预览影响面拿一次性令牌，再在有效期内确认执行；输入改动即作废旧预览单。
 */

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Users } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type {
  WechatActionResult,
  WechatGroupActionInput,
  WechatGroupActionPlan,
} from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'
import GroupActionPlanCard from './GroupActionPlanCard'
import { describeGroupActionError, type GroupActionErrorView } from './group-action-errors'

const GROUP_ACTIONS: Array<{ value: WechatGroupActionInput['action']; label: string }> = [
  { value: 'create', label: '建群' },
  { value: 'invite', label: '邀请成员' },
  { value: 'kick', label: '移出成员' },
  { value: 'rename', label: '改群名' },
  { value: 'announce', label: '发群公告' },
]

export default function GroupActionCard({
  accountId,
  writeEnabled = true,
}: {
  accountId: string
  writeEnabled?: boolean
}) {
  const qc = useQueryClient()
  const [action, setAction] = React.useState<WechatGroupActionInput['action']>('create')
  const [conversationId, setConversationId] = React.useState('')
  const [memberIds, setMemberIds] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [text, setText] = React.useState('')
  const [plan, setPlan] = React.useState<WechatGroupActionPlan | null>(null)
  const [result, setResult] = React.useState<WechatActionResult | null>(null)
  const [error, setError] = React.useState<GroupActionErrorView | null>(null)

  const conversationsQuery = useQuery({
    queryKey: ['wechat-hub', 'conversations', accountId, 100],
    queryFn: () => wechatHubApi.conversations(accountId, 100),
  })
  const groups = (conversationsQuery.data ?? []).filter((item) => item.kind === 'group')
  const selected = groups.find((item) => item.id === conversationId)

  // 输入一旦改动，旧预览单绑定的「动作 + 群 + 目标集合」已经失配，必须作废，不能拿旧令牌执行新内容
  const discardPlan = React.useCallback(() => {
    setPlan(null)
    setResult(null)
    setError(null)
  }, [])

  const parsedMemberIds = React.useMemo(
    () =>
      memberIds
        .split(/[,，\s]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    [memberIds],
  )

  const planMutation = useMutation({
    mutationFn: () =>
      wechatHubApi.groupPlan(accountId, {
        action,
        conversationId: action === 'create' ? undefined : conversationId,
        memberIds: parsedMemberIds,
        title: title.trim() || undefined,
        text: text.trim() || undefined,
      }),
    onSuccess: (data) => {
      setError(null)
      setResult(null)
      setPlan(data)
    },
    onError: (e) => {
      setPlan(null)
      setError(describeGroupActionError(e))
    },
  })

  const actionMutation = useMutation({
    mutationFn: () =>
      wechatHubApi.runGroupAction(accountId, {
        action,
        conversationId: action === 'create' ? undefined : conversationId,
        memberIds: parsedMemberIds,
        title: title.trim() || undefined,
        text: text.trim() || undefined,
        confirmToken: plan?.confirmToken,
      }),
    onSuccess: (data) => {
      setError(null)
      setResult(data)
      setPlan(null)
      // 审计卡无论成败都会多一条，执行完就刷新，别让用户以为没记上
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'group-write-audit', accountId] })
      if (data.ok) {
        void qc.invalidateQueries({ queryKey: ['wechat-hub', 'conversations', accountId] })
        void qc.invalidateQueries({ queryKey: ['wechat-hub', 'group-members', accountId] })
      }
    },
    onError: (e) => {
      setResult(null)
      setError(describeGroupActionError(e))
      // 被闸拦下也会记一条审计（带错误码），这里同样刷新
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'group-write-audit', accountId] })
    },
  })

  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!plan) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [plan])
  const expiresAt = plan ? new Date(plan.expiresAt).getTime() : NaN
  const remainingMs = Number.isFinite(expiresAt) ? expiresAt - now : 0
  const expired = plan !== null && remainingMs <= 0
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))

  const previewDisabled = planMutation.isPending || (action !== 'create' && !conversationId)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-body">
          <Users className="h-4 w-4" />
          <span>群管理</span>
        </CardTitle>
        <CardDescription>
          建群/邀请/移人/改名/公告只对 bridge 后端实现；iLink 官方通道会返回 unsupported。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <>
            <div className="grid grid-cols-1 gap-3 min-[800px]:grid-cols-2">
              <div className="space-y-1">
                <Label>动作</Label>
                <Select
                  value={action}
                  onValueChange={(v) => {
                    discardPlan()
                    setAction(v as typeof action)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_ACTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>目标群</Label>
                <Select
                  value={conversationId}
                  onValueChange={(v) => {
                    discardPlan()
                    setConversationId(v)
                  }}
                  disabled={action === 'create' || groups.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        action === 'create'
                          ? '建群不需要选群'
                          : groups.length === 0
                            ? '暂无群会话'
                            : '选择已同步的群'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title || item.platformChatId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selected ? (
                  <p className="font-[weight:inherit] text-label text-muted-foreground">
                    chatId：{selected.platformChatId} · 成员 {selected.memberCount}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[800px]:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="wechat-group-members">成员 ID（逗号分隔）</Label>
                <Input
                  id="wechat-group-members"
                  value={memberIds}
                  onChange={(e) => {
                    discardPlan()
                    setMemberIds(e.target.value)
                  }}
                  placeholder="邀请/移人时填写；建群时作为初始成员"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wechat-group-title">群名 / 公告标题</Label>
                <Input
                  id="wechat-group-title"
                  value={title}
                  onChange={(e) => {
                    discardPlan()
                    setTitle(e.target.value)
                  }}
                  placeholder="改名或建群时填写"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wechat-group-text">公告正文（可选）</Label>
              <textarea
                id="wechat-group-text"
                value={text}
                onChange={(e) => {
                  discardPlan()
                  setText(e.target.value)
                }}
                rows={3}
                className="font-[weight:inherit] w-full rounded-md border border-stroke-field bg-transparent px-3 py-2 text-body outline-none focus:border-stroke-focus"
                placeholder="发群公告时填写；其余动作可留空。"
              />
            </div>
            <Button
              onClick={() => {
                setResult(null)
                setError(null)
                planMutation.mutate()
              }}
              disabled={previewDisabled}
            >
              {planMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              <span>预览影响面</span>
            </Button>
            {plan ? (
              <GroupActionPlanCard
                plan={plan}
                remainingSeconds={remainingSeconds}
                expired={expired}
                confirming={actionMutation.isPending}
                writeEnabled={writeEnabled}
                onConfirm={() => actionMutation.mutate()}
              />
            ) : null}
            {result ? (
              <Alert
                variant={result.ok ? 'success' : result.status === 'unsupported' ? 'warning' : 'danger'}
                title={
                  result.ok
                    ? '桥已接受'
                    : result.status === 'unsupported'
                      ? '当前后端不支持'
                      : '动作失败'
                }
                description={result.reason ?? (result.ok ? '动作已交给桥执行。' : '桥未返回原因')}
              />
            ) : null}
            {error ? (
              <Alert variant="danger" title={error.title} description={error.detail || undefined} />
            ) : null}
        </>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
