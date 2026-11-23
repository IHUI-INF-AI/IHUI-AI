// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  Brain,
  Clock,
  Contact,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'
import type { WechatAccountView } from '@ihui/types'
import AccountsPanel from './AccountsPanel'
import AnalysisPanel from './AnalysisPanel'
import AuditPanel from './AuditPanel'
import AutoReplyPanel from './AutoReplyPanel'
import CapabilitiesStrip from './CapabilitiesStrip'
import ContactsPanel from './ContactsPanel'
import ConversationsPanel from './ConversationsPanel'
import DigestPanel from './DigestPanel'
import SendPanel from './SendPanel'
import { wechatHubApi } from './wechat-hub-api'

type TabKey = 'conversations' | 'contacts' | 'send' | 'autoReply' | 'digest' | 'analysis' | 'audit'

export default function PageClient() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [tab, setTab] = React.useState<TabKey>('conversations')

  const accountsQuery = useQuery({
    queryKey: ['wechat-hub', 'accounts'],
    queryFn: wechatHubApi.accounts,
    refetchInterval: 15_000,
  })
  const capabilitiesQuery = useQuery({
    queryKey: ['wechat-hub', 'capabilities'],
    queryFn: wechatHubApi.capabilities,
    staleTime: 10 * 60 * 1000,
  })

  const accounts = React.useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  React.useEffect(() => {
    if (accounts.length === 0) {
      setSelectedId(null)
      return
    }
    const exists = accounts.some((item) => item.id === selectedId)
    if (!exists) setSelectedId(accounts[0]?.id ?? null)
  }, [accounts, selectedId])

  const selected: WechatAccountView | undefined = accounts.find((item) => item.id === selectedId)

  if (accountsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载微信账号…
      </div>
    )
  }

  return (
    <div className="space-y-4 px-1">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-display font-bold tracking-tight">
          <MessagesSquare className="h-6 w-6 text-primary" />
          <span>微信智联</span>
        </h1>
        <p className="mt-1 text-body text-muted-foreground">
          扫码登录 → 实时收消息 → 联系人/群成员 → 自动回复与定时日报 → AI 分析 →
          主动发送，全链路可审计。
        </p>
      </div>

      {accountsQuery.isError ? (
        <Alert
          variant="danger"
          title="加载微信账号失败"
          description={
            accountsQuery.error instanceof Error ? accountsQuery.error.message : '未知错误'
          }
        />
      ) : null}

      <CapabilitiesStrip capabilities={capabilitiesQuery.data ?? []} />

      <AccountsPanel
        accounts={accounts}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id)
          setTab('conversations')
        }}
        onChanged={() => {
          void qc.invalidateQueries({ queryKey: ['wechat-hub'] })
        }}
      />

      {selected ? (
        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
          <TabsList>
            <TabsTrigger value="conversations" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>会话与消息</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-1">
              <Contact className="h-3 w-3" />
              <span>联系人与群成员</span>
            </TabsTrigger>
            <TabsTrigger value="send" className="gap-1">
              <Send className="h-3 w-3" />
              <span>主动发送</span>
            </TabsTrigger>
            <TabsTrigger value="autoReply" className="gap-1">
              <Bot className="h-3 w-3" />
              <span>自动回复</span>
            </TabsTrigger>
            <TabsTrigger value="digest" className="gap-1">
              <Clock className="h-3 w-3" />
              <span>定时日报</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-1">
              <Brain className="h-3 w-3" />
              <span>AI 分析</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span>动作审计</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="conversations" className="mt-3">
            <ConversationsPanel accountId={selected.id} />
          </TabsContent>
          <TabsContent value="contacts" className="mt-3">
            <ContactsPanel accountId={selected.id} />
          </TabsContent>
          <TabsContent value="send" className="mt-3">
            <SendPanel accountId={selected.id} />
          </TabsContent>
          <TabsContent value="autoReply" className="mt-3">
            <AutoReplyPanel accountId={selected.id} />
          </TabsContent>
          <TabsContent value="digest" className="mt-3">
            <DigestPanel accountId={selected.id} />
          </TabsContent>
          <TabsContent value="analysis" className="mt-3">
            <AnalysisPanel accountId={selected.id} />
          </TabsContent>
          <TabsContent value="audit" className="mt-3">
            <AuditPanel accountId={selected.id} />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-body text-muted-foreground">
            先新增一个微信账号并连接，然后这里会出现会话、发送、AI 分析与审计面板。
          </CardContent>
        </Card>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
