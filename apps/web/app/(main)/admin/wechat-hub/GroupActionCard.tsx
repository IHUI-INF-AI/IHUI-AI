// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 群管理：建群/邀请/移人/改名/公告，仅 bridge 后端。
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
import type { WechatActionResult, WechatGroupActionInput } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

const GROUP_ACTIONS: Array<{ value: WechatGroupActionInput['action']; label: string }> = [
  { value: 'create', label: '建群' },
  { value: 'invite', label: '邀请成员' },
  { value: 'kick', label: '移出成员' },
  { value: 'rename', label: '改群名' },
  { value: 'announce', label: '发群公告' },
]

export default function GroupActionCard({ accountId }: { accountId: string }) {
  const qc = useQueryClient()
  const [action, setAction] = React.useState<WechatGroupActionInput['action']>('create')
  const [conversationId, setConversationId] = React.useState('')
  const [memberIds, setMemberIds] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [text, setText] = React.useState('')
  const [result, setResult] = React.useState<WechatActionResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const conversationsQuery = useQuery({
    queryKey: ['wechat-hub', 'conversations', accountId, 100],
    queryFn: () => wechatHubApi.conversations(accountId, 100),
  })
  const groups = (conversationsQuery.data ?? []).filter((item) => item.kind === 'group')
  const selected = groups.find((item) => item.id === conversationId)

  const mutation = useMutation({
    mutationFn: () =>
      wechatHubApi.runGroupAction(accountId, {
        action,
        conversationId: action === 'create' ? undefined : conversationId,
        memberIds: memberIds
          .split(/[,，\s]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        title: title.trim() || undefined,
        text: text.trim() || undefined,
      }),
    onSuccess: (data) => {
      setError(null)
      setResult(data)
      if (data.ok) {
        void qc.invalidateQueries({ queryKey: ['wechat-hub', 'conversations', accountId] })
        void qc.invalidateQueries({ queryKey: ['wechat-hub', 'group-members', accountId] })
      }
    },
    onError: (e) => {
      setResult(null)
      setError(e instanceof Error ? e.message : '群动作失败')
    },
  })

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
        <div className="grid grid-cols-1 gap-3 min-[800px]:grid-cols-2">
          <div className="space-y-1">
            <Label>动作</Label>
            <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
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
              onValueChange={setConversationId}
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
              <p className="text-xs text-muted-foreground">
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
              onChange={(e) => setMemberIds(e.target.value)}
              placeholder="邀请/移人时填写；建群时作为初始成员"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wechat-group-title">群名 / 公告标题</Label>
            <Input
              id="wechat-group-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="改名或建群时填写"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="wechat-group-text">公告正文（可选）</Label>
          <textarea
            id="wechat-group-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-stroke-field bg-transparent px-3 py-2 text-sm outline-none focus:border-stroke-focus"
            placeholder="发群公告时填写；其余动作可留空。"
          />
        </div>
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
        {error ? <Alert variant="danger" title="请求失败" description={error} /> : null}
        <Button
          onClick={() => {
            setResult(null)
            setError(null)
            mutation.mutate()
          }}
          disabled={mutation.isPending || (action !== 'create' && !conversationId)}
        >
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          <span>执行群动作</span>
        </Button>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
