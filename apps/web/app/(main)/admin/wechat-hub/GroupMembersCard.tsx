// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, Users } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { wechatHubApi } from './wechat-hub-api'

/** 群成员快照：bridge 后端可主动拉取；iLink 不支持群聊。 */
export default function GroupMembersCard({ accountId }: { accountId: string }) {
  const [conversationId, setConversationId] = React.useState('none')
  const queryClient = useQueryClient()
  const conversationsQuery = useQuery({
    queryKey: ['wechat-hub', 'conversations', accountId],
    queryFn: () => wechatHubApi.conversations(accountId, 100),
    refetchInterval: 30_000,
  })
  const membersQuery = useQuery({
    queryKey: ['wechat-hub', 'group-members', accountId, conversationId],
    queryFn: () => wechatHubApi.groupMembers(accountId, conversationId),
    enabled: conversationId !== 'none',
  })
  const syncMutation = useMutation({
    mutationFn: () => wechatHubApi.syncGroupMembers(accountId, conversationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['wechat-hub', 'group-members', accountId, conversationId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['wechat-hub', 'conversations', accountId],
      })
    },
  })
  const groups = (conversationsQuery.data ?? []).filter((item) => item.kind === 'group')
  const resetSyncMutation = syncMutation.reset
  React.useEffect(() => {
    resetSyncMutation()
    // 切换群后清掉上一个群的同步结果，避免误导。
  }, [conversationId, resetSyncMutation])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-body">
          <Users className="h-4 w-4" />
          群成员
        </CardTitle>
        <CardDescription>bridge 后端支持主动拉取成员快照；iLink 不支持群聊。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Select value={conversationId} onValueChange={setConversationId}>
            <SelectTrigger>
              <SelectValue placeholder="选择群聊" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">不选择</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.title || group.platformChatId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={conversationId === 'none' || syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            拉取成员
          </Button>
        </div>
        {syncMutation.isError ? (
          <p className="font-[weight:inherit] text-body text-destructive">
            {syncMutation.error instanceof Error ? syncMutation.error.message : '同步群成员失败'}
          </p>
        ) : syncMutation.data && !syncMutation.data.result.ok ? (
          <p className="font-[weight:inherit] text-body text-destructive">
            {syncMutation.data.result.reason ||
              (syncMutation.data.result.status === 'unsupported'
                ? '当前后端不支持主动拉群成员'
                : '同步群成员失败')}
          </p>
        ) : syncMutation.data ? (
          <p className="font-[weight:inherit] text-body text-muted-foreground">
            已同步 {syncMutation.data.synced} 人，移除 {syncMutation.data.removed} 人。
          </p>
        ) : null}
        {conversationId === 'none' ? (
          <p className="font-[weight:inherit] text-body text-muted-foreground">先选择一个群。</p>
        ) : membersQuery.isLoading ? (
          <div className="font-[weight:inherit] flex items-center gap-2 text-body text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载成员…
          </div>
        ) : (membersQuery.data ?? []).length === 0 ? (
          <p className="font-[weight:inherit] text-body text-muted-foreground">
            暂无成员快照。点「拉取成员」从桥同步，或等入站消息自动补。
          </p>
        ) : (
          <div className="max-h-[220px] space-y-1 overflow-y-auto pr-1">
            {(membersQuery.data ?? []).map((member) => (
              <div
                key={member.id}
                className="font-[weight:inherit] flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-body"
              >
                <span className="truncate">
                  {member.nickname || member.memberId}
                  <span className="font-[weight:inherit] ml-2 text-label text-muted-foreground">{member.role}</span>
                </span>
                <span className="font-[weight:inherit] ml-2 shrink-0 text-label text-muted-foreground">
                  @{member.memberId}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
