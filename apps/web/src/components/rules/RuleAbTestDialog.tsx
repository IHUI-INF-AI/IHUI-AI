// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { FlaskConical, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rulesApi } from './rules-api'
import type { RuleAbTestResult } from './types'
import type { Rule } from '@ihui/types'
import { Button } from '@ihui/ui-react'

interface RuleAbTestDialogProps {
  rules: Rule[]
  onClose: () => void
}

function AbTestSide({
  label,
  data,
}: {
  label: string
  data: { id: string; name: string; matched: boolean; output: string }
}) {
  return (
    <div className="space-y-1.5 rounded-md border border-border bg-background p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="truncate text-xs font-medium">{data.name}</span>
        <span
          className={cn(
            'shrink-0 rounded-sm px-1 py-0 text-[10px]',
            data.matched ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground',
          )}
        >
          {data.matched ? '命中' : '未命中'}
        </span>
      </div>
      {data.output ? (
        <pre className="thin-scroll max-h-40 overflow-auto rounded-sm bg-muted/50 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
          {data.output}
        </pre>
      ) : (
        <p className="text-[10px] text-muted-foreground">(未命中,无输出)</p>
      )}
    </div>
  )
}

function RuleAbTestDialog({ rules, onClose }: RuleAbTestDialogProps) {
  const [ruleIdA, setRuleIdA] = React.useState('')
  const [ruleIdB, setRuleIdB] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [result, setResult] = React.useState<RuleAbTestResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleRun = async () => {
    if (!ruleIdA || !ruleIdB || !message.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await rulesApi<RuleAbTestResult>('/api/rules/ab-test', {
        method: 'POST',
        body: JSON.stringify({ ruleIdA, ruleIdB, message }),
      })
      setResult(res)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 模态遮罩点击外部关闭;键盘用户通过关闭按钮(X)提供等价交互
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-white/40 p-4 dark:bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            <FlaskConical className="mr-1 inline h-3.5 w-3.5" />
            A/B 测试
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor="rule-cmp-a" className="text-[10px] text-muted-foreground">
              规则 A
            </label>
            <select
              id="rule-cmp-a"
              value={ruleIdA}
              onChange={(e) => setRuleIdA(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
            >
              <option value="">选择规则 A</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="rule-cmp-b" className="text-[10px] text-muted-foreground">
              规则 B
            </label>
            <select
              id="rule-cmp-b"
              value={ruleIdB}
              onChange={(e) => setRuleIdB(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
            >
              <option value="">选择规则 B</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="rule-cmp-msg" className="text-[10px] text-muted-foreground">
            测试消息
          </label>
          <textarea
            id="rule-cmp-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="输入测试消息..."
            rows={3}
            className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-foreground/20"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={loading || !ruleIdA || !ruleIdB || !message.trim()}
          >
            {loading ? '测试中...' : '运行测试'}
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="grid grid-cols-2 gap-2">
            <AbTestSide label="规则 A" data={result.ruleA} />
            <AbTestSide label="规则 B" data={result.ruleB} />
          </div>
        )}
      </div>
    </div>
  )
}

export { RuleAbTestDialog }
export type { RuleAbTestDialogProps }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
