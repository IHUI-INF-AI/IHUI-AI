// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Save, Search } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatBackend, WechatContactView } from '@ihui/types'
import GroupMembersCard from './GroupMembersCard'
import ContactPlatformActions from './ContactPlatformActions'
import { wechatHubApi } from './wechat-hub-api'

function formatTime(value: string | null): string {
  if (!value) return '从未'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function ContactsPanel({
  accountId,
  backend,
  readOnly = false,
}: {
  accountId: string
  backend: WechatBackend
  readOnly?: boolean
}) {
  const [query, setQuery] = React.useState('')
  const [contactId, setContactId] = React.useState<string | null>(null)
  const [remark, setRemark] = React.useState('')
  const [tags, setTags] = React.useState('')
  const [blocked, setBlocked] = React.useState(false)

  const contactsQuery = useQuery({
    queryKey: ['wechat-hub', 'contacts', accountId, query],
    queryFn: () => wechatHubApi.contacts(accountId, query),
    refetchInterval: 30_000,
  })
  const saveMutation = useMutation({
    mutationFn: () =>
      wechatHubApi.updateContact(accountId, contactId ?? '', {
        remark: remark.trim(),
        tags: tags
          .split(/[,，\s]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        blocked,
      }),
    onSuccess: () => void contactsQuery.refetch(),
  })

  const contacts = contactsQuery.data ?? []
  const selected: WechatContactView | undefined = contacts.find((item) => item.id === contactId)

  React.useEffect(() => {
    if (contacts.length === 0) {
      setContactId(null)
      return
    }
    if (!contactId || !contacts.some((item) => item.id === contactId)) {
      setContactId(contacts[0]?.id ?? null)
    }
  }, [contacts, contactId])

  React.useEffect(() => {
    if (!selected) return
    setRemark(selected.remark)
    setTags(selected.tags.join(', '))
    setBlocked(selected.blocked)
  }, [selected])

  return (
    <div className="grid grid-cols-1 gap-3 min-[1100px]:grid-cols-[340px_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-body">联系人</CardTitle>
          <CardDescription>入站发送者自动归档；备注、标签只存本地。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜昵称 / 备注 / 微信号"
            />
            <Button size="sm" variant="outline" onClick={() => void contactsQuery.refetch()}>
              <Search className="h-3.5 w-3.5" />
            </Button>
          </div>
          {backend === 'ilink' || readOnly ? (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {readOnly
                ? '截图 OCR 只读接入不提供平台联系人同步/删除；备注、标签与屏蔽只存本地，入站时自动归档。'
                : 'iLink 官方通道不提供平台联系人同步/删除；备注、标签与屏蔽只存本地，入站时自动归档。'}
            </p>
          ) : (
            <ContactPlatformActions
              accountId={accountId}
              contactId={contactId}
              contactUserId={selected?.platformUserId}
              onChanged={() => void contactsQuery.refetch()}
            />
          )}
          {contactsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载联系人…
            </div>
          ) : contacts.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">暂无联系人。</p>
          ) : (
            <div className="max-h-[520px] space-y-1 overflow-y-auto pr-1">
              {contacts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setContactId(item.id)}
                  className={`w-full rounded-md px-2 py-2 text-left transition-colors ${
                    contactId === item.id ? 'bg-muted text-foreground' : 'hover:bg-muted/60'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">
                      {item.remark || item.displayName || item.platformUserId}
                    </span>
                    {item.blocked ? (
                      <span className="ml-auto rounded-md bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger">
                        已屏蔽
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {item.platformUserId} · 最近 {formatTime(item.lastSeenAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body">联系人详情</CardTitle>
            <CardDescription>备注会优先展示；标签用于后续筛选与群发分组。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selected ? (
              <p className="text-sm text-muted-foreground">先从左侧选择一位联系人。</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="wechat-contact-remark">备注名</Label>
                    <Input
                      id="wechat-contact-remark"
                      value={remark}
                      onChange={(event) => setRemark(event.target.value)}
                      placeholder="例如：A 客户-采购"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="wechat-contact-tags">标签（逗号分隔）</Label>
                    <Input
                      id="wechat-contact-tags"
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="客户, 待跟进"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="wechat-contact-blocked"
                    checked={blocked}
                    onCheckedChange={setBlocked}
                    size="sm"
                  />
                  <Label htmlFor="wechat-contact-blocked">屏蔽此人（仅本地标记，不自动回复）</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !contactId}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-4 w-4" />
                    )}
                    保存
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    微信号：{selected.platformUserId}
                  </span>
                </div>
                {saveMutation.isError ? (
                  <Alert
                    variant="danger"
                    title="保存失败"
                    description={
                      saveMutation.error instanceof Error ? saveMutation.error.message : '未知错误'
                    }
                  />
                ) : null}
                {saveMutation.isSuccess ? (
                  <Alert
                    variant="success"
                    title="已保存"
                    description="备注/标签/屏蔽状态已落库。"
                  />
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <GroupMembersCard accountId={accountId} />
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
