// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, MessageCircleQuestion, Search } from 'lucide-react'
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
import type { WechatAskResult, WechatAskSqlResult } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

const EXAMPLES = ['上周关于预算聊了什么', '最近3天客户投诉了哪些问题', '这个月谁最活跃']

export default function AskPanel({ accountId }: { accountId: string }) {
  const [question, setQuestion] = React.useState('')
  const [conversationId, setConversationId] = React.useState('all')
  const [useSql, setUseSql] = React.useState(false)
  const [result, setResult] = React.useState<WechatAskResult | null>(null)
  const [sqlResult, setSqlResult] = React.useState<WechatAskSqlResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [rowsOpen, setRowsOpen] = React.useState(false)

  const conversationsQuery = useQuery({
    queryKey: ['wechat-hub', 'conversations', accountId],
    queryFn: () => wechatHubApi.conversations(accountId, 100),
  })
  const conversations = conversationsQuery.data ?? []

  const askMutation = useMutation({
    mutationFn: () =>
      wechatHubApi.ask(accountId, {
        question,
        conversationId: conversationId === 'all' ? undefined : conversationId,
      }),
    onSuccess: (data) => {
      setResult(data)
      setSqlResult(null)
      setError(null)
      setRowsOpen(false)
    },
    onError: (e) => {
      setResult(null)
      setSqlResult(null)
      setError(e instanceof Error ? e.message : '问聊天记录失败')
      setRowsOpen(false)
    },
  })

  /** 只读查询：SQL 由服务端生成、校验、执行，前端只展示模型写了什么。 */
  const sqlMutation = useMutation({
    mutationFn: () => wechatHubApi.askSql(accountId, { question }),
    onSuccess: (data) => {
      setSqlResult(data)
      setResult(null)
      setError(null)
      setRowsOpen(false)
    },
    onError: (e) => {
      setSqlResult(null)
      setResult(null)
      setError(e instanceof Error ? e.message : '生成查询失败')
      setRowsOpen(false)
    },
  })

  const submit = () => {
    if (question.trim().length === 0) return
    if (useSql) sqlMutation.mutate()
    else askMutation.mutate()
  }
  const pending = askMutation.isPending || sqlMutation.isPending
  const sqlRows: Record<string, unknown>[] =
    sqlResult && Array.isArray(sqlResult.rows) ? sqlResult.rows : []
  const rowsAvailable = sqlResult !== null && Array.isArray(sqlResult.rows)
  const sqlColumns = sqlRows.length > 0 ? Object.keys(sqlRows[0] ?? {}) : []
  const cellText = (value: unknown) => (value === null || value === undefined ? '' : String(value))

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-body">
            <MessageCircleQuestion className="h-4 w-4 text-primary" />
            用一句话问聊天记录
          </CardTitle>
          <CardDescription>
            先把问题解析成时间窗 +
            关键词检索真实消息，再交给模型归纳；引用都指向具体消息，模型看不到列表以外的内容。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <Alert variant="danger" title="查询失败" description={error} /> : null}
          <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-[2fr_1fr]">
            <div className="space-y-1">
              <Label>问题</Label>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="例如：上周关于预算聊了什么"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && question.trim().length > 0) submit()
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>限定会话</Label>
              <Select value={conversationId} onValueChange={setConversationId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部会话</SelectItem>
                  {conversations.map((conversation) => (
                    <SelectItem key={conversation.id} value={conversation.id}>
                      {conversation.title || conversation.platformChatId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={submit} disabled={pending || question.trim().length === 0}>
              {pending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="mr-1.5 h-3.5 w-3.5" />
              )}
              提问
            </Button>
            <Button
              variant={useSql ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUseSql((value) => !value)}
              title="让模型写一条只读查询：只能读本账号消息，不能写库，最多回 50 行"
            >
              {useSql ? '已开启：让 AI 写查询（只读）' : '让 AI 写查询（只读）'}
            </Button>
            {EXAMPLES.map((example) => (
              <Button key={example} variant="ghost" size="sm" onClick={() => setQuestion(example)}>
                {example}
              </Button>
            ))}
          </div>

          {sqlResult ? (
            <div className="space-y-2">
              <div className="rounded-md border border-stroke-subtle bg-muted/10 p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {sqlResult.rowCount > 0 ? `查询返回 ${sqlResult.rowCount} 行` : '查询无结果'}
                  </span>
                </div>
                <p className="text-body whitespace-pre-wrap">{sqlResult.answer}</p>
              </div>
              {sqlResult.note ? <Alert variant="warning" title="这次没走查询" description={sqlResult.note} /> : null}
              {sqlResult.sql ? (
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">
                    模型写的查询（已由服务端加上本账号隔离与行数上限后执行）
                  </p>
                  <p className="rounded-md border border-stroke-subtle p-2 text-[12px] text-muted-foreground whitespace-pre-wrap break-words">
                    {sqlResult.sql}
                  </p>
                </div>
              ) : null}
              {sqlRows.length > 0 ? (
                <div className="space-y-1">
                  <Button variant="ghost" size="sm" onClick={() => setRowsOpen((open) => !open)}>
                    {rowsOpen ? '收起结果明细' : '查看结果明细'}
                  </Button>
                  {rowsOpen ? (
                    <div className="space-y-1">
                      {sqlResult.rowCount >= 50 ? (
                        <p className="text-[11px] text-muted-foreground">已达 50 行上限，结果已截断</p>
                      ) : null}
                      <div className="overflow-x-auto rounded-md border border-stroke-subtle">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="border-b border-stroke-subtle text-left text-muted-foreground">
                              {sqlColumns.map((column) => (
                                <th
                                  key={column}
                                  className="max-w-[240px] px-2 py-1.5 font-medium break-all"
                                >
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sqlRows.slice(0, 10).map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b border-stroke-subtle last:border-b-0">
                                {sqlColumns.map((column) => (
                                  <td
                                    key={column}
                                    className="max-w-[240px] px-2 py-1.5 align-top break-all"
                                  >
                                    {cellText(row[column])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {sqlRows.length > 10 ? (
                        <p className="text-[11px] text-muted-foreground">表格仅展示前 10 行</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : rowsAvailable && sqlRows.length === 0 && sqlResult.sql ? (
                <p className="text-[12px] text-muted-foreground">查询没有返回行</p>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <div className="space-y-3">
              <div className="rounded-md border border-stroke-subtle bg-muted/10 p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {result.generatedBy === 'llm' ? '模型归纳' : '本地检索（模型不可用）'}
                  </span>
                  {result.plan.keywords.length > 0 ? (
                    <span className="text-[11px] text-muted-foreground">
                      关键词：{result.plan.keywords.join('、')}
                    </span>
                  ) : null}
                  {result.plan.senderName ? (
                    <span className="text-[11px] text-muted-foreground">
                      发送人：{result.plan.senderName}
                    </span>
                  ) : null}
                </div>
                <p className="text-body whitespace-pre-wrap">{result.answer}</p>
              </div>

              {result.citations.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">
                    参考了 {result.citations.length} 条消息
                  </p>
                  <ul className="max-h-[280px] space-y-1 overflow-auto rounded-md border border-stroke-subtle p-2">
                    {result.citations.slice(0, 20).map((citation) => (
                      <li key={citation.messageId} className="text-[12px] text-muted-foreground">
                        <span className="text-foreground">{citation.senderName ?? '对方'}</span>
                        {' · '}
                        {new Date(citation.sentAt).toLocaleString()}
                        {'：'}
                        {citation.snippet}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
