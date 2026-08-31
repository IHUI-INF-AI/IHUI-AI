// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useRules } from '@/hooks/use-rules'
import { useRulesStore } from '@/stores/rules'
import { Button } from '@ihui/ui-react'

function RuleTestDialog() {
  const {
    testDialogRule,
    closeTestDialog,
    testMessage,
    setTestMessage,
    testResult,
    setTestResult,
  } = useRulesStore()
  const { testRule, isPending } = useRules()

  if (!testDialogRule) return null

  const handleTest = async () => {
    if (!testMessage.trim()) return
    setTestResult(null)
    const result = await testRule({
      id: testDialogRule.id,
      message: testMessage,
    })
    setTestResult(result)
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 模态遮罩点击外部关闭;键盘用户通过关闭按钮(X)提供等价交互
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-white/40 p-4 dark:bg-black/40"
      onClick={(e) => e.target === e.currentTarget && closeTestDialog()}
    >
      <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">测试规则:{testDialogRule.name}</span>
          <button
            type="button"
            onClick={closeTestDialog}
            aria-label="关闭"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rule-test-msg" className="text-xs text-muted-foreground">
            输入消息
          </label>
          <textarea
            id="rule-test-msg"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="输入测试消息..."
            rows={4}
            className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-foreground/20"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={closeTestDialog}>
            关闭
          </Button>
          <Button size="sm" onClick={handleTest} disabled={isPending.test || !testMessage.trim()}>
            {isPending.test ? '测试中...' : '测试'}
          </Button>
        </div>
        {testResult && (
          <div
            className={cn(
              'rounded-md px-3 py-2 text-xs',
              testResult.matched
                ? 'bg-green-500/10 text-green-600'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {testResult.matched ? '匹配命中' : '未命中'} — {testResult.reason}
          </div>
        )}
      </div>
    </div>
  )
}

export { RuleTestDialog }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
