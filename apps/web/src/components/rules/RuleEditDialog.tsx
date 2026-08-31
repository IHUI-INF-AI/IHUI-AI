// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import { useRules } from '@/hooks/use-rules'
import { useRulesStore } from '@/stores/rules'
import type { RuleInput, RuleMatchType, RuleScope } from '@ihui/types'
import { Button, Input } from '@ihui/ui-react'

function RuleEditDialog() {
  const { editingRule, isCreating, closeEditor } = useRulesStore()
  const { createRule, updateRule, isPending } = useRules()
  const open = isCreating || editingRule !== null

  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [content, setContent] = React.useState('')
  const [scope, setScope] = React.useState<RuleScope>('global')
  const [priority, setPriority] = React.useState(50)
  const [matchType, setMatchType] = React.useState<RuleMatchType>('always')
  const [matchPattern, setMatchPattern] = React.useState('')

  React.useEffect(() => {
    if (editingRule) {
      setName(editingRule.name)
      setDescription(editingRule.description ?? '')
      setContent(editingRule.content)
      setScope(editingRule.scope)
      setPriority(editingRule.priority)
      setMatchType(editingRule.matchType)
      setMatchPattern(editingRule.matchPattern ?? '')
    } else if (isCreating) {
      setName('')
      setDescription('')
      setContent('')
      setScope('global')
      setPriority(50)
      setMatchType('always')
      setMatchPattern('')
    }
  }, [editingRule, isCreating])

  if (!open) return null

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) return
    const input: RuleInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      content: content.trim(),
      scope,
      priority,
      matchType,
      matchPattern: matchPattern.trim() || undefined,
    }
    if (editingRule) {
      await updateRule({ id: editingRule.id, patch: input })
    } else {
      await createRule(input)
    }
    closeEditor()
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 模态遮罩点击外部关闭;键盘用户通过关闭按钮(X)提供等价交互
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-white/40 p-4 dark:bg-black/40"
      onClick={(e) => e.target === e.currentTarget && closeEditor()}
    >
      <div className="w-full max-w-lg space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{editingRule ? '编辑规则' : '新建规则'}</span>
          <button
            type="button"
            onClick={closeEditor}
            aria-label="关闭"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          <label htmlFor="rule-name" className="text-xs text-muted-foreground">
            名称
          </label>
          <Input
            id="rule-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 128))}
            placeholder="规则名称"
            className="h-8 text-sm"
          />
          <label htmlFor="rule-desc" className="text-xs text-muted-foreground">
            描述(可选)
          </label>
          <Input
            id="rule-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 256))}
            placeholder="简短描述"
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label htmlFor="rule-scope" className="text-xs text-muted-foreground">
                作用域
              </label>
              <select
                id="rule-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as RuleScope)}
                className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
              >
                <option value="global">全局</option>
                <option value="workspace">工作区</option>
                <option value="agent">Agent</option>
              </select>
            </div>
            <div className="w-24">
              <label htmlFor="rule-priority" className="text-xs text-muted-foreground">
                优先级
              </label>
              <Input
                id="rule-priority"
                type="number"
                min={0}
                max={100}
                value={priority}
                onChange={(e) =>
                  setPriority(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                }
                className="mt-0.5 h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label htmlFor="rule-match-type" className="text-xs text-muted-foreground">
                匹配类型
              </label>
              <select
                id="rule-match-type"
                value={matchType}
                onChange={(e) => setMatchType(e.target.value as RuleMatchType)}
                className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
              >
                <option value="always">始终注入</option>
                <option value="keyword">关键词</option>
                <option value="regex">正则</option>
                <option value="semantic">语义</option>
              </select>
            </div>
            {matchType !== 'always' && (
              <div className="flex-1 min-w-0">
                <label htmlFor="rule-match-pattern" className="text-xs text-muted-foreground">
                  匹配模式
                </label>
                <Input
                  id="rule-match-pattern"
                  value={matchPattern}
                  onChange={(e) => setMatchPattern(e.target.value)}
                  placeholder={
                    matchType === 'keyword'
                      ? '关键词1,关键词2'
                      : matchType === 'regex'
                        ? '正则表达式'
                        : '自然语言描述'
                  }
                  className="mt-0.5 h-8 text-sm"
                />
              </div>
            )}
          </div>
          <label htmlFor="rule-content" className="text-xs text-muted-foreground">
            规则正文
          </label>
          <textarea
            id="rule-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="规则正文(markdown,作为 prompt 注入到 agent)..."
            rows={6}
            className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-foreground/20"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={closeEditor}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending.create || isPending.update || !name.trim() || !content.trim()}
          >
            {isPending.create || isPending.update ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export { RuleEditDialog }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
