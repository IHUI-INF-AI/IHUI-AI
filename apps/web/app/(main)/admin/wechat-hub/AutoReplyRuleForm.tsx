// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Save, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type {
  WechatAutoReplyMatchType,
  WechatAutoReplyRuleView,
  WechatAutoReplyScope,
} from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

interface RuleForm {
  name: string
  matchType: WechatAutoReplyMatchType
  keywords: string
  replyText: string
  scope: WechatAutoReplyScope
  cooldownSeconds: number
  enabled: boolean
}

export const EMPTY_RULE_FORM: RuleForm = {
  name: '',
  matchType: 'contains',
  keywords: '',
  replyText: '',
  scope: 'all',
  cooldownSeconds: 0,
  enabled: false,
}

export function ruleToForm(rule: WechatAutoReplyRuleView): RuleForm {
  return {
    name: rule.name,
    matchType: rule.matchType,
    keywords: rule.keywords.join(', '),
    replyText: rule.replyText,
    scope: rule.scope,
    cooldownSeconds: rule.cooldownSeconds,
    enabled: rule.enabled,
  }
}

interface Props {
  accountId: string
  rule: WechatAutoReplyRuleView | null
  visible: boolean
  onSaved: (rule: WechatAutoReplyRuleView) => void
  onDeleted: () => void
}

export default function AutoReplyRuleForm({ accountId, rule, visible, onSaved, onDeleted }: Props) {
  const [form, setForm] = React.useState<RuleForm>(EMPTY_RULE_FORM)

  React.useEffect(() => {
    setForm(rule ? ruleToForm(rule) : EMPTY_RULE_FORM)
  }, [rule])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        matchType: form.matchType,
        keywords: form.keywords
          .split(/[,，\s]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        replyText: form.replyText,
        scope: form.scope,
        cooldownSeconds: form.cooldownSeconds,
        enabled: form.enabled,
      }
      return rule
        ? wechatHubApi.updateAutoReplyRule(accountId, rule.id, payload)
        : wechatHubApi.createAutoReplyRule(accountId, payload)
    },
    onSuccess: (saved) => {
      setForm(ruleToForm(saved))
      onSaved(saved)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => wechatHubApi.deleteAutoReplyRule(accountId, rule?.id ?? ''),
    onSuccess: () => {
      setForm(EMPTY_RULE_FORM)
      onDeleted()
    },
  })
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-body">{rule ? '编辑规则' : '新建规则'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!visible ? (
          <p className="text-sm text-muted-foreground">从左侧选择规则，或点「新建规则」。</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="wechat-rule-name">规则名</Label>
                <Input
                  id="wechat-rule-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="例如：报价自动回"
                />
              </div>
              <div className="space-y-1">
                <Label>匹配方式</Label>
                <Select
                  value={form.matchType}
                  onValueChange={(value) =>
                    setForm({ ...form, matchType: value as WechatAutoReplyMatchType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">包含任一关键词</SelectItem>
                    <SelectItem value="exact">完全相等</SelectItem>
                    <SelectItem value="prefix">前缀匹配</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wechat-rule-keywords">关键词（逗号分隔）</Label>
              <Input
                id="wechat-rule-keywords"
                value={form.keywords}
                onChange={(event) => setForm({ ...form, keywords: event.target.value })}
                placeholder="报价, 价格, quote"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wechat-rule-reply">回复正文</Label>
              <textarea
                id="wechat-rule-reply"
                value={form.replyText}
                onChange={(event) => setForm({ ...form, replyText: event.target.value })}
                rows={4}
                maxLength={5000}
                className="w-full rounded-sm border border-stroke-field bg-transparent px-3 py-2 text-sm outline-none focus:border-stroke-focus"
                placeholder="收到，稍后发您报价单。"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-3">
              <div className="space-y-1">
                <Label>作用范围</Label>
                <Select
                  value={form.scope}
                  onValueChange={(value) =>
                    setForm({ ...form, scope: value as WechatAutoReplyScope })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="private">仅私聊</SelectItem>
                    <SelectItem value="group">仅群聊</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="wechat-rule-cooldown">冷却秒数</Label>
                <Input
                  id="wechat-rule-cooldown"
                  type="number"
                  min={0}
                  max={86_400}
                  value={form.cooldownSeconds}
                  onChange={(event) =>
                    setForm({ ...form, cooldownSeconds: Number(event.target.value) || 0 })
                  }
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  id="wechat-rule-enabled"
                  checked={form.enabled}
                  onCheckedChange={(enabled) => setForm({ ...form, enabled })}
                  size="sm"
                />
                <Label htmlFor="wechat-rule-enabled">立即启用</Label>
              </div>
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
            <div className="flex items-center gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.name.trim() || !form.replyText.trim()}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1 h-4 w-4" />
                )}
                保存
              </Button>
              {rule ? (
                <Button
                  variant="outline"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  删除
                </Button>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
