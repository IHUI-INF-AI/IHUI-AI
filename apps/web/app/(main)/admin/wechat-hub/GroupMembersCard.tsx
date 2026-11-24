// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Users } from 'lucide-react'
import {
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

/** 群成员快照：只对 bridge 后端推送过 members 的群有数据。 */
export default function GroupMembersCard({ accountId }: { accountId: string }) {
  const [conversationId, setConversationId] = React.useState('none')
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
  const groups = (conversationsQuery.data ?? []).filter((item) => item.kind === 'group')

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-body">
          <Users className="h-4 w-4" />
          群成员
        </CardTitle>
        <CardDescription>仅 bridge 后端推送成员快照的群可用；iLink 不支持群聊。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
        {conversationId === 'none' ? (
          <p className="text-sm text-muted-foreground">先选择一个群。</p>
        ) : membersQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载成员…
          </div>
        ) : (membersQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无成员快照。桥推送 members 后自动同步。</p>
        ) : (
          <div className="max-h-[220px] space-y-1 overflow-y-auto pr-1">
            {(membersQuery.data ?? []).map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm"
              >
                <span className="truncate">
                  {member.nickname || member.memberId}
                  <span className="ml-2 text-xs text-muted-foreground">{member.role}</span>
                </span>
                <span className="ml-2 shrink-0 text-xs text-muted-foreground">
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
