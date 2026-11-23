// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
} from '@ihui/ui-react'
import type { WechatAutoReplyRuleView } from '@ihui/types'
import { cn } from '@/lib/utils'
import AutoReplyRuleForm from './AutoReplyRuleForm'
import { wechatHubApi } from './wechat-hub-api'

export default function AutoReplyPanel({ accountId }: { accountId: string }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(false)

  const rulesQuery = useQuery({
    queryKey: ['wechat-hub', 'auto-reply-rules', accountId],
    queryFn: () => wechatHubApi.autoReplyRules(accountId),
    refetchInterval: 30_000,
  })
  const rules = rulesQuery.data ?? []
  const selected = rules.find((item) => item.id === selectedId) ?? null

  const toggleMutation = useMutation({
    mutationFn: (input: { rule: WechatAutoReplyRuleView; enabled: boolean }) =>
      wechatHubApi.updateAutoReplyRule(accountId, input.rule.id, { enabled: input.enabled }),
    onSuccess: () => void rulesQuery.refetch(),
  })

  return (
    <div className="grid grid-cols-1 gap-3 min-[1100px]:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-body">自动回复规则</CardTitle>
          <CardDescription>默认关闭；启用后只对入站消息触发，并走同一套出站策略。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => {
              setSelectedId(null)
              setShowForm(true)
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            新建规则
          </Button>
          {rulesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载规则…
            </div>
          ) : rules.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">还没有规则。</p>
          ) : (
            <div className="max-h-[520px] space-y-1 overflow-y-auto pr-1">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 transition-colors',
                    selectedId === rule.id ? 'bg-muted text-foreground' : 'hover:bg-muted/60',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(rule.id)
                      setShowForm(true)
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium">{rule.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {rule.matchType} · {rule.keywords.join(' / ') || '无关键词'}
                    </span>
                  </button>
                  <Switch
                    checked={rule.enabled}
                    size="sm"
                    onCheckedChange={(enabled) => toggleMutation.mutate({ rule, enabled })}
                    aria-label={`启用 ${rule.name}`}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AutoReplyRuleForm
        accountId={accountId}
        rule={selected}
        visible={showForm}
        onSaved={(rule) => {
          setSelectedId(rule.id)
          setShowForm(true)
          void rulesQuery.refetch()
        }}
        onDeleted={() => {
          setSelectedId(null)
          setShowForm(false)
          void rulesQuery.refetch()
        }}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
