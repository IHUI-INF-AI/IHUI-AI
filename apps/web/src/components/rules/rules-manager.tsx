'use client'

import * as React from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  FlaskConical,
  History,
  LayoutTemplate,
  Loader2,
  Pencil,
  Plus,
  ScrollText,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useRules } from '@/hooks/use-rules'
import {
  matchTypeLabel,
  priorityVariant,
  scopeLabel,
  useRulesStore,
} from '@/stores/rules'
import type { Rule, RuleInput, RuleMatchType, RuleScope } from '@ihui/types'
import { Badge, Button, Input } from '@ihui/ui'

/**
 * Rules 管理器 — 规则列表 + 编辑器 + 启用/禁用 + 优先级 + 测试 + 冲突检测 + 模板库。
 *
 * 对标 Trae IDE Rules:用户可编辑的规则集,约束 agent 运行时行为。
 * 数据流:react-query(useRules)↔ /api/rules ↔ ai-service rules_engine。
 */

// ── 冲突检测 + 模板库本地类型(与 api rules-service.ts DTO 对齐)──────────

interface RuleConflict {
  type: 'name_conflict' | 'semantic_duplicate' | 'priority_collision'
  ruleIds: string[]
  detail: string
}

interface RuleConflictsResponse {
  conflicts: RuleConflict[]
}

interface RuleTemplate {
  name: string
  description: string
  matchType: 'always' | 'keyword' | 'regex' | 'semantic'
  pattern: string
  priority: number
  scope: 'global' | 'workspace' | 'agent'
  content: string
}

interface RuleTemplatesResponse {
  templates: RuleTemplate[]
}

// ── 深化功能本地类型(与 api rules-service.ts DTO 对齐)──────────

interface RuleHistoryEntry {
  timestamp: string
  action: string
  content: string
}

interface RuleHistoryResponse {
  history: RuleHistoryEntry[]
}

interface RuleDiffResponse {
  diff: string
}

interface RuleStats {
  ruleId: string
  hits7d: number
  hits30d: number
  avgTokenDelta: number
  totalFeedback: number
  positiveFeedback: number
  satisfactionRate: number
  matchCount: number
}

interface RuleAbTestResult {
  ruleA: { id: string; name: string; matched: boolean; output: string }
  ruleB: { id: string; name: string; matched: boolean; output: string }
  message: string
  error?: string
}

interface RuleGlobalStats {
  totalRules: number
  activeRules7d: number
  topRules: Array<{ id: string; name: string; matchCount: number }>
}

// ── 超越创新本地类型(与 api rules-service.ts DTO 对齐)──────────

interface RuleCandidate {
  name: string
  description: string
  content: string
  matchType: 'always' | 'keyword' | 'regex' | 'semantic'
  scope: 'global' | 'workspace' | 'agent'
  confidence: number
}

interface RuleAutoGenerateResult {
  candidates: RuleCandidate[]
  behaviorCount: number
  degraded: boolean
  message?: string
}

interface RuleResolveConflictsResult {
  winningRule: Rule | null
  reason: string
  alternative: string | null
  degraded: boolean
  message?: string
}

interface RulePredictEffectResult {
  withRule: string
  withoutRule: string
  tokenDelta: number
  similarityDelta: number
  qualityScore: number
  recommendation: '启用' | '不启用' | '中性'
  degraded: boolean
  message?: string
}

interface RuleKnowledgeGraph {
  nodes: Array<{
    ruleId: string
    name: string
    scope: 'global' | 'workspace' | 'agent'
    matchCount: number
  }>
  edges: Array<{
    source: string
    target: string
    type: 'duplicate' | 'complementary' | 'conflict'
    similarity: number
  }>
}

async function rulesApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 冲突类型中文标签 */
function conflictTypeLabel(type: RuleConflict['type']): string {
  switch (type) {
    case 'name_conflict':
      return '同名冲突'
    case 'semantic_duplicate':
      return '语义重复'
    case 'priority_collision':
      return '优先级碰撞'
    default:
      return type
  }
}

/** 冲突类型徽章样式 */
function conflictBadgeClass(type: RuleConflict['type']): string {
  switch (type) {
    case 'name_conflict':
      return 'bg-yellow-500/10 text-yellow-600'
    case 'semantic_duplicate':
      return 'bg-orange-500/10 text-orange-600'
    case 'priority_collision':
      return 'bg-red-500/10 text-red-600'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function RulesManager() {
  const { rules, loading, error, refresh, deleteRule, toggleEnabled } =
    useRules()
  const { startCreate, startEdit } = useRulesStore()
  const [showConflicts, setShowConflicts] = React.useState(false)
  const [showTemplates, setShowTemplates] = React.useState(false)
  const [showAbTest, setShowAbTest] = React.useState(false)
  const [showGlobalStats, setShowGlobalStats] = React.useState(false)
  const [showAutoGenerate, setShowAutoGenerate] = React.useState(false)
  const [showKnowledgeGraph, setShowKnowledgeGraph] = React.useState(false)
  const [detailRule, setDetailRule] = React.useState<Rule | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {rules.length} 条规则,按优先级降序排列
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAutoGenerate(true)}
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            <span>自动生成</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConflicts(true)}
          >
            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            <span>检测冲突</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowKnowledgeGraph(true)}
          >
            <TrendingUp className="mr-1 h-3.5 w-3.5" />
            <span>知识图谱</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAbTest(true)}
          >
            <FlaskConical className="mr-1 h-3.5 w-3.5" />
            <span>A/B 测试</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGlobalStats(true)}
          >
            <BarChart3 className="mr-1 h-3.5 w-3.5" />
            <span>全局统计</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplates(true)}
          >
            <LayoutTemplate className="mr-1 h-3.5 w-3.5" />
            <span>模板库</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            刷新
          </Button>
          <Button size="sm" onClick={startCreate}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            <span>新建规则</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <ScrollText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            暂无规则,点击「新建规则」创建
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, idx) => (
            <RuleItem
              key={rule.id}
              rule={rule}
              index={idx + 1}
              onEdit={() => startEdit(rule)}
              onDelete={() => deleteRule(rule.id)}
              onToggle={(enabled) =>
                toggleEnabled({ id: rule.id, enabled })
              }
              onShowDetail={() => setDetailRule(rule)}
            />
          ))}
        </div>
      )}

      <RuleEditDialog />
      <RuleTestDialog />
      {showConflicts && (
        <RuleConflictDialog
          rules={rules}
          onClose={() => setShowConflicts(false)}
        />
      )}
      {showTemplates && (
        <RuleTemplateDialog onClose={() => setShowTemplates(false)} />
      )}
      {showAbTest && (
        <RuleAbTestDialog rules={rules} onClose={() => setShowAbTest(false)} />
      )}
      {showGlobalStats && (
        <RuleGlobalStatsDialog onClose={() => setShowGlobalStats(false)} />
      )}
      {showAutoGenerate && (
        <RuleAutoGenerateDialog
          onClose={() => setShowAutoGenerate(false)}
          onCreated={() => {
            refresh()
            setShowAutoGenerate(false)
          }}
        />
      )}
      {showKnowledgeGraph && (
        <RuleKnowledgeGraphDialog
          rules={rules}
          onClose={() => setShowKnowledgeGraph(false)}
        />
      )}
      {detailRule && (
        <RuleDetailDialog
          rule={detailRule}
          onClose={() => setDetailRule(null)}
        />
      )}
    </div>
  )
}

interface RuleItemProps {
  rule: Rule
  index: number
  onEdit: () => void
  onDelete: () => Promise<unknown>
  onToggle: (enabled: boolean) => Promise<unknown>
  onShowDetail: () => void
}

function RuleItem({
  rule,
  index,
  onEdit,
  onDelete,
  onToggle,
  onShowDetail,
}: RuleItemProps) {
  const [confirmDel, setConfirmDel] = React.useState(false)
  const { testDialogRule, openTestDialog } = useRulesStore()
  const isActive = testDialogRule?.id === rule.id
  const matchCount = (rule as Rule & { matchCount?: number }).matchCount ?? 0

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors',
        !rule.enabled && 'opacity-60',
        isActive && 'ring-1 ring-foreground/10',
      )}
    >
      <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{rule.name}</span>
          {!rule.enabled && (
            <span className="rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">
              禁用
            </span>
          )}
          {matchCount > 0 && (
            <span className="shrink-0 rounded-sm bg-blue-500/10 px-1 text-[10px] text-blue-600">
              命中 {matchCount} 次
            </span>
          )}
        </div>
        {rule.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {rule.description}
          </p>
        )}
      </div>
      <Badge
        variant={priorityVariant(rule.priority)}
        className={cn(
          'shrink-0 px-1.5 py-0 text-[10px]',
          rule.priority >= 70 &&
            'border-transparent bg-green-500/10 text-green-600',
          rule.priority >= 30 &&
            rule.priority < 70 &&
            'border-transparent bg-yellow-500/10 text-yellow-600',
          rule.priority < 30 &&
            'border-transparent bg-muted text-muted-foreground',
        )}
      >
        P{rule.priority}
      </Badge>
      <span className="hidden shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
        {scopeLabel(rule.scope)}
      </span>
      <span className="hidden shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">
        {matchTypeLabel(rule.matchType)}
      </span>
      <button
        type="button"
        onClick={() => onToggle(!rule.enabled)}
        aria-label={rule.enabled ? '禁用' : '启用'}
        className={cn(
          'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] transition-colors',
          rule.enabled
            ? 'border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20'
            : 'border-border bg-muted text-muted-foreground hover:bg-accent',
        )}
      >
        {rule.enabled ? '启用' : '禁用'}
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onShowDetail}
          aria-label="详情"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => openTestDialog(rule)}
          aria-label="测试"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <FlaskConical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label="编辑"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {confirmDel ? (
          <button
            type="button"
            onClick={async () => {
              await onDelete()
              setConfirmDel(false)
            }}
            aria-label="确认删除"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            aria-label="删除"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {confirmDel && (
          <button
            type="button"
            onClick={() => setConfirmDel(false)}
            aria-label="取消删除"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {editingRule ? '编辑规则' : '新建规则'}
          </span>
          <button
            type="button"
            onClick={closeEditor}
            aria-label="关闭"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          <label htmlFor="rule-name" className="text-xs text-muted-foreground">名称</label>
          <Input
            id="rule-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 128))}
            placeholder="规则名称"
            className="h-8 text-sm"
          />
          <label htmlFor="rule-desc" className="text-xs text-muted-foreground">描述(可选)</label>
          <Input
            id="rule-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 256))}
            placeholder="简短描述"
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="rule-scope" className="text-xs text-muted-foreground">作用域</label>
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
              <label htmlFor="rule-priority" className="text-xs text-muted-foreground">优先级</label>
              <Input
                id="rule-priority"
                type="number"
                min={0}
                max={100}
                value={priority}
                onChange={(e) =>
                  setPriority(
                    Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  )
                }
                className="mt-0.5 h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="rule-match-type" className="text-xs text-muted-foreground">匹配类型</label>
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
              <div className="flex-1">
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
          <label htmlFor="rule-content" className="text-xs text-muted-foreground">规则正文</label>
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
            disabled={
              isPending.create ||
              isPending.update ||
              !name.trim() ||
              !content.trim()
            }
          >
            {isPending.create || isPending.update ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            测试规则:{testDialogRule.name}
          </span>
          <button
            type="button"
            onClick={closeTestDialog}
            aria-label="关闭"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rule-test-msg" className="text-xs text-muted-foreground">输入消息</label>
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
          <Button
            size="sm"
            onClick={handleTest}
            disabled={isPending.test || !testMessage.trim()}
          >
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

// ── 冲突检测对话框 ──────────────────────────────────────

interface RuleConflictDialogProps {
  rules: Rule[]
  onClose: () => void
}

function RuleConflictDialog({ rules, onClose }: RuleConflictDialogProps) {
  const [conflicts, setConflicts] = React.useState<RuleConflict[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [arbitrationContext, setArbitrationContext] = React.useState('')
  const [arbitrating, setArbitrating] = React.useState<number | null>(null)
  const [arbitrationResults, setArbitrationResults] = React.useState<
    Record<number, RuleResolveConflictsResult>
  >({})

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    rulesApi<RuleConflictsResponse>('/api/rules/conflicts')
      .then((res) => {
        if (!cancelled) {
          setConflicts(res.conflicts)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 规则 ID → 名称映射(用于在冲突详情中显示可读名称)
  const ruleNameMap = React.useMemo(
    () => new Map(rules.map((r) => [r.id, r.name])),
    [rules],
  )

  const handleArbitrate = async (idx: number, ruleIds: string[]) => {
    if (!arbitrationContext.trim() || ruleIds.length < 2) return
    setArbitrating(idx)
    try {
      const res = await rulesApi<RuleResolveConflictsResult>(
        '/api/rules/resolve-conflicts',
        {
          method: 'POST',
          body: JSON.stringify({
            context: arbitrationContext,
            conflictingRules: ruleIds,
          }),
        },
      )
      setArbitrationResults((prev) => ({ ...prev, [idx]: res }))
    } catch (e) {
      setArbitrationResults((prev) => ({
        ...prev,
        [idx]: {
          winningRule: null,
          reason: `协商失败:${(e as Error).message}`,
          alternative: null,
          degraded: true,
        },
      }))
    } finally {
      setArbitrating(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">规则冲突检测</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            检测中...
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : conflicts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-500/10 text-green-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <p className="text-sm text-muted-foreground">
              未检测到冲突,规则集状态良好
            </p>
          </div>
        ) : (
          <div className="thin-scroll space-y-2 overflow-y-auto">
            <p className="text-xs text-muted-foreground">
              检测到 {conflicts.length} 处冲突,输入上下文后可 LLM 协商
            </p>
            <div className="space-y-1">
              <label htmlFor="rule-arb-ctx" className="text-[10px] text-muted-foreground">
                协商上下文(当前对话/代码片段)
              </label>
              <textarea
                id="rule-arb-ctx"
                value={arbitrationContext}
                onChange={(e) => setArbitrationContext(e.target.value)}
                placeholder="输入上下文供 LLM 仲裁..."
                rows={2}
                className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-foreground/20"
              />
            </div>
            {conflicts.map((conflict, idx) => (
              <div
                key={`${conflict.type}-${idx}`}
                className="space-y-1.5 rounded-md border border-border bg-background px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'shrink-0 rounded-sm px-1.5 py-0 text-[10px]',
                      conflictBadgeClass(conflict.type),
                    )}
                  >
                    {conflictTypeLabel(conflict.type)}
                  </span>
                  <span className="flex-1 text-xs text-muted-foreground">
                    {conflict.detail}
                  </span>
                  {conflict.ruleIds.length >= 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleArbitrate(idx, conflict.ruleIds)
                      }
                      disabled={
                        arbitrating !== null ||
                        !arbitrationContext.trim()
                      }
                      className="shrink-0 rounded-sm border border-border px-1.5 py-0 text-[10px] text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {arbitrating === idx ? '协商中...' : 'LLM 协商'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {conflict.ruleIds.map((rid) => (
                    <span
                      key={rid}
                      className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {ruleNameMap.get(rid) ?? rid}
                    </span>
                  ))}
                </div>
                {arbitrationResults[idx] && (
                  <div className="space-y-1 rounded-sm bg-muted/50 p-2 text-[10px]">
                    <div className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-green-600" />
                      <span className="font-medium">
                        仲裁结果:
                        {arbitrationResults[idx].winningRule
                          ? arbitrationResults[idx].winningRule.name
                          : '无'}
                      </span>
                      {arbitrationResults[idx].degraded && (
                        <span className="rounded-sm bg-yellow-500/10 px-1 text-yellow-600">
                          降级
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      {arbitrationResults[idx].reason}
                    </p>
                    {arbitrationResults[idx].alternative && (
                      <p className="text-muted-foreground">
                        合并建议:{arbitrationResults[idx].alternative}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── 模板库对话框 ────────────────────────────────────────

interface RuleTemplateDialogProps {
  onClose: () => void
}

function RuleTemplateDialog({ onClose }: RuleTemplateDialogProps) {
  const [templates, setTemplates] = React.useState<RuleTemplate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [creatingName, setCreatingName] = React.useState<string | null>(null)
  const { createRule } = useRules()

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    rulesApi<RuleTemplatesResponse>('/api/rules/templates')
      .then((res) => {
        if (!cancelled) {
          setTemplates(res.templates)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleUseTemplate = async (template: RuleTemplate) => {
    setCreatingName(template.name)
    try {
      const input: RuleInput = {
        name: template.name,
        description: template.description,
        content: template.content,
        scope: template.scope,
        priority: template.priority,
        matchType: template.matchType,
        matchPattern: template.pattern,
      }
      await createRule(input)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreatingName(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">规则模板库</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载模板...
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : (
          <div className="thin-scroll space-y-2 overflow-y-auto">
            <p className="text-xs text-muted-foreground">
              共 {templates.length} 个预置模板,点击「使用」快速创建规则
            </p>
            {templates.map((template) => (
              <div
                key={template.name}
                className="space-y-1.5 rounded-md border border-border bg-background px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {template.name}
                  </span>
                  <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0 text-[10px] text-muted-foreground">
                    {matchTypeLabel(template.matchType)}
                  </span>
                  <Badge
                    variant={priorityVariant(template.priority)}
                    className={cn(
                      'shrink-0 px-1.5 py-0 text-[10px]',
                      template.priority >= 70 &&
                        'border-transparent bg-green-500/10 text-green-600',
                      template.priority >= 30 &&
                        template.priority < 70 &&
                        'border-transparent bg-yellow-500/10 text-yellow-600',
                      template.priority < 30 &&
                        'border-transparent bg-muted text-muted-foreground',
                    )}
                  >
                    P{template.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {template.description}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <code className="truncate rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {template.pattern}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={creatingName !== null}
                    onClick={() => handleUseTemplate(template)}
                  >
                    {creatingName === template.name
                      ? '创建中...'
                      : '使用'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── 规则详情对话框(版本历史 + 效果统计)──────────────────────

interface RuleDetailDialogProps {
  rule: Rule
  onClose: () => void
}

function RuleDetailDialog({ rule, onClose }: RuleDetailDialogProps) {
  const [tab, setTab] = React.useState<'stats' | 'history' | 'predict'>(
    'stats',
  )
  const [stats, setStats] = React.useState<RuleStats | null>(null)
  const [history, setHistory] = React.useState<RuleHistoryEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [diff, setDiff] = React.useState<string | null>(null)
  const [diffPair, setDiffPair] = React.useState<[string, string] | null>(null)
  const [rollingBack, setRollingBack] = React.useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = React.useState<string>('')
  // ── 效果预测 state(超越创新)──
  const [predictPrompt, setPredictPrompt] = React.useState('')
  const [predictResult, setPredictResult] =
    React.useState<RulePredictEffectResult | null>(null)
  const [predictLoading, setPredictLoading] = React.useState(false)
  const [learnFeedbackMsg, setLearnFeedbackMsg] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      rulesApi<RuleStats>(`/api/rules/${encodeURIComponent(rule.id)}/stats`),
      rulesApi<RuleHistoryResponse>(
        `/api/rules/${encodeURIComponent(rule.id)}/history`,
      ),
    ])
      .then(([s, h]) => {
        if (!cancelled) {
          setStats(s)
          setHistory(h.history)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [rule.id])

  const handleDiff = async (from: string, to: string) => {
    setDiffPair([from, to])
    setDiff(null)
    try {
      const res = await rulesApi<RuleDiffResponse>(
        `/api/rules/${encodeURIComponent(rule.id)}/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      )
      setDiff(res.diff || '(无差异)')
    } catch {
      setDiff('加载失败')
    }
  }

  const handleRollback = async (version: string) => {
    setRollingBack(version)
    try {
      await rulesApi<unknown>(
        `/api/rules/${encodeURIComponent(rule.id)}/rollback?version=${encodeURIComponent(version)}`,
        { method: 'POST' },
      )
      setFeedbackMsg('回滚成功')
    } catch (e) {
      setFeedbackMsg(`回滚失败:${(e as Error).message}`)
    } finally {
      setRollingBack(null)
    }
  }

  const handleFeedback = async (feedback: 'thumbs_up' | 'thumbs_down') => {
    try {
      await rulesApi<{ success: boolean }>(
        `/api/rules/${encodeURIComponent(rule.id)}/feedback`,
        {
          method: 'POST',
          body: JSON.stringify({ feedback }),
        },
      )
      setFeedbackMsg('反馈已记录')
    } catch (e) {
      setFeedbackMsg(`反馈失败:${(e as Error).message}`)
    }
  }

  const handlePredict = async () => {
    if (!predictPrompt.trim()) return
    setPredictLoading(true)
    setPredictResult(null)
    try {
      const res = await rulesApi<RulePredictEffectResult>(
        `/api/rules/${encodeURIComponent(rule.id)}/predict-effect`,
        {
          method: 'POST',
          body: JSON.stringify({ testPrompt: predictPrompt }),
        },
      )
      setPredictResult(res)
    } catch (e) {
      setPredictResult({
        withRule: '',
        withoutRule: '',
        tokenDelta: 0,
        similarityDelta: 0,
        qualityScore: 0,
        recommendation: '中性',
        degraded: true,
        message: `预测失败:${(e as Error).message}`,
      })
    } finally {
      setPredictLoading(false)
    }
  }

  const handleLearnFeedback = async (
    feedback: 'helpful' | 'unhelpful' | 'harmful',
  ) => {
    try {
      await rulesApi<{ success: boolean }>(
        `/api/rules/${encodeURIComponent(rule.id)}/learn-feedback`,
        {
          method: 'POST',
          body: JSON.stringify({ feedback, context: predictPrompt.slice(0, 200) }),
        },
      )
      setLearnFeedbackMsg('学习反馈已记录')
    } catch (e) {
      setLearnFeedbackMsg(`反馈失败:${(e as Error).message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">规则详情:{rule.name}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('stats')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs transition-colors',
              tab === 'stats'
                ? 'bg-foreground/5 text-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <Activity className="mr-1 inline h-3 w-3" />
            效果统计
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs transition-colors',
              tab === 'history'
                ? 'bg-foreground/5 text-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <History className="mr-1 inline h-3 w-3" />
            版本历史({history.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('predict')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs transition-colors',
              tab === 'predict'
                ? 'bg-foreground/5 text-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <TrendingUp className="mr-1 inline h-3 w-3" />
            效果预测
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : tab === 'stats' ? (
          stats && (
            <div className="thin-scroll space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCard label="命中次数" value={String(stats.matchCount)} />
                <StatCard label="7天命中" value={String(stats.hits7d)} />
                <StatCard label="30天命中" value={String(stats.hits30d)} />
                <StatCard
                  label="平均 token"
                  value={stats.avgTokenDelta.toFixed(1)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 rounded-md border border-border bg-background p-2.5">
                  <p className="text-[10px] text-muted-foreground">命中率对比</p>
                  <HitsBarChart hits7d={stats.hits7d} hits30d={stats.hits30d} />
                </div>
                <div className="space-y-1.5 rounded-md border border-border bg-background p-2.5">
                  <p className="text-[10px] text-muted-foreground">
                    满意度({stats.satisfactionRate.toFixed(0)}%)
                  </p>
                  <SatisfactionPie
                    positive={stats.positiveFeedback}
                    total={stats.totalFeedback}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  反馈:
                </span>
                <button
                  type="button"
                  onClick={() => handleFeedback('thumbs_up')}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                >
                  <ThumbsUp className="h-3 w-3" />
                  有用
                </button>
                <button
                  type="button"
                  onClick={() => handleFeedback('thumbs_down')}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                >
                  <ThumbsDown className="h-3 w-3" />
                  无用
                </button>
                {feedbackMsg && (
                  <span className="text-[10px] text-muted-foreground">
                    {feedbackMsg}
                  </span>
                )}
              </div>
            </div>
          )
        ) : tab === 'history' ? (
          <div className="thin-scroll space-y-2 overflow-y-auto">
            {history.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                暂无版本历史
              </p>
            ) : (
              history.map((entry, idx) => (
                <div
                  key={entry.timestamp}
                  className="space-y-1 rounded-md border border-border bg-background px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-sm bg-muted px-1 py-0 text-[10px] text-muted-foreground">
                        {entry.action}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {entry.timestamp}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {idx > 0 && history[idx - 1] && (
                        <button
                          type="button"
                          onClick={() =>
                            handleDiff(
                              history[idx - 1]!.timestamp,
                              entry.timestamp,
                            )
                          }
                          className="rounded-sm border border-border px-1.5 py-0 text-[10px] text-muted-foreground transition-colors hover:bg-accent"
                        >
                          对比上一版
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRollback(entry.timestamp)}
                        disabled={rollingBack !== null}
                        className="rounded-sm border border-border px-1.5 py-0 text-[10px] text-muted-foreground transition-colors hover:bg-accent"
                      >
                        {rollingBack === entry.timestamp
                          ? '回滚中...'
                          : '回滚'}
                      </button>
                    </div>
                  </div>
                  {diffPair &&
                    diffPair[1] === entry.timestamp &&
                    diff !== null && (
                      <pre className="thin-scroll max-h-32 overflow-auto rounded-sm bg-muted/50 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
                        {diff}
                      </pre>
                    )}
                </div>
              ))
            )}
            {feedbackMsg && tab === 'history' && (
              <p className="text-[10px] text-muted-foreground">
                {feedbackMsg}
              </p>
            )}
          </div>
        ) : (
          <div className="thin-scroll space-y-3 overflow-y-auto">
            <p className="text-[10px] text-muted-foreground">
              输入测试 prompt,dry-run 对比应用规则 vs 不应用规则的 LLM 输出
            </p>
            <textarea
              value={predictPrompt}
              onChange={(e) => setPredictPrompt(e.target.value)}
              placeholder="输入测试 prompt..."
              rows={3}
              className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-foreground/20"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                onClick={handlePredict}
                disabled={predictLoading || !predictPrompt.trim()}
              >
                {predictLoading ? '预测中...' : '运行预测'}
              </Button>
            </div>
            {predictResult && (
              <div className="space-y-2">
                {predictResult.message && (
                  <p className="text-[10px] text-muted-foreground">
                    {predictResult.message}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <StatCard
                    label="Token 差异"
                    value={
                      predictResult.tokenDelta > 0
                        ? `+${predictResult.tokenDelta}`
                        : String(predictResult.tokenDelta)
                    }
                  />
                  <StatCard
                    label="输出差异度"
                    value={predictResult.similarityDelta.toFixed(3)}
                  />
                  <StatCard
                    label="质量评分"
                    value={predictResult.qualityScore.toFixed(3)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    建议:
                  </span>
                  <span
                    className={cn(
                      'rounded-sm px-1.5 py-0 text-[10px]',
                      predictResult.recommendation === '启用'
                        ? 'bg-green-500/10 text-green-600'
                        : predictResult.recommendation === '不启用'
                          ? 'bg-red-500/10 text-red-600'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {predictResult.recommendation}
                  </span>
                  {predictResult.degraded && (
                    <span className="rounded-sm bg-yellow-500/10 px-1 text-[10px] text-yellow-600">
                      降级模式
                    </span>
                  )}
                </div>
                {predictResult.withRule && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1 rounded-md border border-border bg-background p-2">
                      <p className="text-[10px] text-muted-foreground">
                        不应用规则
                      </p>
                      <pre className="thin-scroll max-h-32 overflow-auto rounded-sm bg-muted/50 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
                        {predictResult.withoutRule}
                      </pre>
                    </div>
                    <div className="space-y-1 rounded-md border border-border bg-background p-2">
                      <p className="text-[10px] text-muted-foreground">
                        应用规则
                      </p>
                      <pre className="thin-scroll max-h-32 overflow-auto rounded-sm bg-muted/50 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
                        {predictResult.withRule}
                      </pre>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    学习反馈:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLearnFeedback('helpful')}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    有帮助
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLearnFeedback('unhelpful')}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                  >
                    <ThumbsDown className="h-3 w-3" />
                    无帮助
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLearnFeedback('harmful')}
                    className="flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-0.5 text-[10px] text-destructive transition-colors hover:bg-destructive/10"
                  >
                    有害
                  </button>
                  {learnFeedbackMsg && (
                    <span className="text-[10px] text-muted-foreground">
                      {learnFeedbackMsg}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

/** 命中率柱状图(纯 SVG) */
function HitsBarChart({
  hits7d,
  hits30d,
}: {
  hits7d: number
  hits30d: number
}) {
  const maxVal = Math.max(hits7d, hits30d, 1)
  const barH = (v: number) => (v / maxVal) * 50
  return (
    <svg viewBox="0 0 120 64" className="h-16 w-full">
      <rect x="10" y={60 - barH(hits30d)} width="30" height={barH(hits30d)} rx="2" className="fill-foreground/20" />
      <rect x="60" y={60 - barH(hits7d)} width="30" height={barH(hits7d)} rx="2" className="fill-green-500/40" />
      <text x="25" y="62" textAnchor="middle" className="fill-muted-foreground text-[8px]">
        30天
      </text>
      <text x="75" y="62" textAnchor="middle" className="fill-muted-foreground text-[8px]">
        7天
      </text>
      <text x="25" y={56 - barH(hits30d)} textAnchor="middle" className="fill-muted-foreground text-[8px]">
        {hits30d}
      </text>
      <text x="75" y={56 - barH(hits7d)} textAnchor="middle" className="fill-muted-foreground text-[8px]">
        {hits7d}
      </text>
    </svg>
  )
}

/** 满意度饼图(纯 SVG) */
function SatisfactionPie({
  positive,
  total,
}: {
  positive: number
  total: number
}) {
  const negative = total - positive
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const positiveRatio = total > 0 ? positive / total : 0
  const positiveArc = circumference * positiveRatio

  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 48 48" className="h-12 w-12">
        <circle cx="24" cy="24" r={radius} className="fill-none stroke-red-500/30" strokeWidth="6" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          className="fill-none stroke-green-500/50 transition-all"
          strokeWidth="6"
          strokeDasharray={`${positiveArc} ${circumference}`}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div className="space-y-0.5 text-[10px]">
        <p className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-green-500/50" />
          正面 {positive}
        </p>
        <p className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-500/30" />
          负面 {negative}
        </p>
        <p className="text-muted-foreground">共 {total} 条</p>
      </div>
    </div>
  )
}

// ── A/B 测试对话框 ────────────────────────────────────────

interface RuleAbTestDialogProps {
  rules: Rule[]
  onClose: () => void
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
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
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor="rule-cmp-a" className="text-[10px] text-muted-foreground">规则 A</label>
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
            <label htmlFor="rule-cmp-b" className="text-[10px] text-muted-foreground">规则 B</label>
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
          <label htmlFor="rule-cmp-msg" className="text-[10px] text-muted-foreground">测试消息</label>
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
            <AbTestSide
              label="规则 A"
              data={result.ruleA}
            />
            <AbTestSide
              label="规则 B"
              data={result.ruleB}
            />
          </div>
        )}
      </div>
    </div>
  )
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
            data.matched
              ? 'bg-green-500/10 text-green-600'
              : 'bg-muted text-muted-foreground',
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

// ── 全局统计对话框 ────────────────────────────────────────

interface RuleGlobalStatsDialogProps {
  onClose: () => void
}

function RuleGlobalStatsDialog({ onClose }: RuleGlobalStatsDialogProps) {
  const [stats, setStats] = React.useState<RuleGlobalStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    rulesApi<RuleGlobalStats>('/api/rules/stats')
      .then((res) => {
        if (!cancelled) {
          setStats(res)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            <BarChart3 className="mr-1 inline h-3.5 w-3.5" />
            全局统计
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : stats ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="总规则数" value={String(stats.totalRules)} />
              <StatCard
                label="7天活跃规则"
                value={String(stats.activeRules7d)}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground">
                最常用规则 Top {stats.topRules.length}
              </p>
              <TopRulesChart topRules={stats.topRules} />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">规则列表</p>
              <div className="thin-scroll max-h-48 space-y-1 overflow-y-auto">
                {stats.topRules.length === 0 ? (
                  <p className="py-2 text-center text-[10px] text-muted-foreground">
                    暂无命中记录
                  </p>
                ) : (
                  stats.topRules.map((r, idx) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1"
                    >
                      <span className="w-4 text-right text-[10px] text-muted-foreground">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {r.name}
                      </span>
                      <span className="shrink-0 rounded-sm bg-blue-500/10 px-1 text-[10px] text-blue-600">
                        {r.matchCount} 次
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Top 规则横向柱状图(纯 SVG) */
function TopRulesChart({
  topRules,
}: {
  topRules: Array<{ id: string; name: string; matchCount: number }>
}) {
  const maxCount = Math.max(...topRules.map((r) => r.matchCount), 1)
  const barW = (count: number) => (count / maxCount) * 140
  return (
    <svg viewBox="0 0 200 80" className="h-20 w-full">
      {topRules.slice(0, 5).map((r, idx) => {
        const y = idx * 14 + 2
        const w = barW(r.matchCount)
        return (
          <g key={r.id}>
            <text x="0" y={y + 9} className="fill-muted-foreground text-[7px]">
              {r.name.slice(0, 8)}
            </text>
            <rect x="50" y={y} width={w} height="10" rx="2" className="fill-foreground/20" />
            <text x={54 + w} y={y + 9} className="fill-muted-foreground text-[7px]">
              {r.matchCount}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── 自动生成规则对话框(超越创新,LLM 行为模式提炼)──────────

interface RuleAutoGenerateDialogProps {
  onClose: () => void
  onCreated: () => void
}

function RuleAutoGenerateDialog({
  onClose,
  onCreated,
}: RuleAutoGenerateDialogProps) {
  const [result, setResult] = React.useState<RuleAutoGenerateResult | null>(
    null,
  )
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<Set<number>>(new Set())
  const [creating, setCreating] = React.useState(false)
  const { createRule } = useRules()

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setSelected(new Set())
    try {
      const res = await rulesApi<RuleAutoGenerateResult>(
        '/api/rules/auto-generate',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      )
      setResult(res)
      // 默认全选 confidence >= 0.6 的候选
      setSelected(
        new Set(
          res.candidates
            .map((_, idx) => idx)
            .filter((idx) => res.candidates[idx]!.confidence >= 0.6),
        ),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchCreate = async () => {
    if (!result || selected.size === 0) return
    setCreating(true)
    try {
      for (const idx of selected) {
        const candidate = result.candidates[idx]
        if (!candidate) continue
        await createRule({
          name: candidate.name,
          description: candidate.description,
          content: candidate.content,
          scope: candidate.scope,
          matchType: candidate.matchType,
          priority: Math.round(candidate.confidence * 100),
        })
      }
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            自动生成规则
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          从最近 7 天用户行为模式 LLM 提炼候选规则,勾选后批量创建
        </p>

        {!result && !loading && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
            <Button size="sm" onClick={handleGenerate}>
              开始分析行为模式
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            LLM 分析行为模式中...
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="thin-scroll space-y-2 overflow-y-auto">
            {result.degraded && (
              <div className="rounded-sm bg-yellow-500/10 px-2 py-1 text-[10px] text-yellow-600">
                {result.message ?? '降级模式:LLM 不可用,返回空候选列表'}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              分析了 {result.behaviorCount} 条行为记录,生成{' '}
              {result.candidates.length} 条候选规则
            </p>
            {result.candidates.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                无候选规则(行为数据不足或 LLM 不可用)
              </p>
            ) : (
              result.candidates.map((candidate, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'space-y-1.5 rounded-md border bg-background px-3 py-2',
                    selected.has(idx)
                      ? 'border-foreground/20'
                      : 'border-border',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(idx)}
                      onChange={() => toggleSelect(idx)}
                      className="h-3 w-3 shrink-0"
                    />
                    <span className="flex-1 truncate text-sm font-medium">
                      {candidate.name}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-sm px-1.5 py-0 text-[10px]',
                        candidate.confidence >= 0.8
                          ? 'bg-green-500/10 text-green-600'
                          : candidate.confidence >= 0.6
                            ? 'bg-yellow-500/10 text-yellow-600'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      置信度 {(candidate.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {candidate.description && (
                    <p className="text-[10px] text-muted-foreground">
                      {candidate.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="rounded-sm bg-muted px-1 py-0 text-[10px] text-muted-foreground">
                      {matchTypeLabel(candidate.matchType)}
                    </span>
                    <span className="rounded-sm bg-muted px-1 py-0 text-[10px] text-muted-foreground">
                      {scopeLabel(candidate.scope)}
                    </span>
                  </div>
                  <pre className="thin-scroll max-h-20 overflow-auto rounded-sm bg-muted/50 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    {candidate.content}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}

        {result && result.candidates.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              已选 {selected.size} / {result.candidates.length} 条
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleBatchCreate}
                disabled={creating || selected.size === 0}
              >
                {creating ? '创建中...' : `批量创建(${selected.size})`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 知识图谱对话框(超越创新,SVG 关系图)──────────────────────

interface RuleKnowledgeGraphDialogProps {
  rules: Rule[]
  onClose: () => void
}

function RuleKnowledgeGraphDialog({
  rules,
  onClose,
}: RuleKnowledgeGraphDialogProps) {
  const [graph, setGraph] = React.useState<RuleKnowledgeGraph | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    rulesApi<RuleKnowledgeGraph>('/api/rules/knowledge-graph')
      .then((res) => {
        if (!cancelled) {
          setGraph(res)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const ruleNameMap = React.useMemo(
    () => new Map(rules.map((r) => [r.id, r.name])),
    [rules],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
            规则知识图谱
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            构建图谱中...
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : graph ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-red-500/50" />
                冲突
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-yellow-500/50" />
                重复
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-green-500/50" />
                互补
              </span>
              <span className="ml-auto">
                {graph.nodes.length} 节点 / {graph.edges.length} 边
              </span>
            </div>
            {graph.nodes.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                暂无规则,无法构建图谱
              </p>
            ) : (
              <KnowledgeGraphSvg
                graph={graph}
                ruleNameMap={ruleNameMap}
              />
            )}
            {graph.edges.length > 0 && (
              <div className="thin-scroll max-h-32 space-y-1 overflow-y-auto">
                <p className="text-[10px] text-muted-foreground">关系列表</p>
                {graph.edges.map((edge, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-[10px]"
                  >
                    <span className="truncate">
                      {ruleNameMap.get(edge.source) ?? edge.source}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-sm px-1 py-0',
                        edge.type === 'duplicate'
                          ? 'bg-yellow-500/10 text-yellow-600'
                          : edge.type === 'complementary'
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-red-500/10 text-red-600',
                      )}
                    >
                      {edge.type === 'duplicate'
                        ? '重复'
                        : edge.type === 'complementary'
                          ? '互补'
                          : '冲突'}
                    </span>
                    <span className="truncate">
                      {ruleNameMap.get(edge.target) ?? edge.target}
                    </span>
                    <span className="ml-auto shrink-0 text-muted-foreground">
                      {edge.similarity.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 知识图谱 SVG(圆形布局,节点=规则,边=关系) */
function KnowledgeGraphSvg({
  graph,
  ruleNameMap,
}: {
  graph: RuleKnowledgeGraph
  ruleNameMap: Map<string, string>
}) {
  const W = 400
  const H = 300
  const cx = W / 2
  const cy = H / 2
  const radius = Math.min(W, H) / 2 - 40

  const nodeCount = graph.nodes.length
  // 圆形布局:每个节点均匀分布在圆周上
  const nodePositions = new Map<
    string,
    { x: number; y: number }
  >()
  graph.nodes.forEach((node, idx) => {
    const angle = (idx / Math.max(nodeCount, 1)) * 2 * Math.PI - Math.PI / 2
    nodePositions.set(node.ruleId, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    })
  })

  const edgeColor = (type: string) => {
    if (type === 'duplicate') return 'stroke-yellow-500/50'
    if (type === 'complementary') return 'stroke-green-500/50'
    return 'stroke-red-500/50'
  }

  const nodeColor = (scope: string) => {
    if (scope === 'agent') return 'fill-blue-500/40'
    if (scope === 'workspace') return 'fill-purple-500/40'
    return 'fill-foreground/30'
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-72 w-full">
      {/* 边 */}
      {graph.edges.map((edge, idx) => {
        const s = nodePositions.get(edge.source)
        const t = nodePositions.get(edge.target)
        if (!s || !t) return null
        return (
          <line
            key={`edge-${idx}`}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            className={edgeColor(edge.type)}
            strokeWidth="1.5"
          />
        )
      })}
      {/* 节点 */}
      {graph.nodes.map((node) => {
        const pos = nodePositions.get(node.ruleId)
        if (!pos) return null
        const label =
          ruleNameMap.get(node.ruleId) ?? node.name
        return (
          <g key={`node-${node.ruleId}`}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r="8"
              className={nodeColor(node.scope)}
            />
            <text
              x={pos.x}
              y={pos.y - 12}
              textAnchor="middle"
              className="fill-muted-foreground text-[7px]"
            >
              {label.slice(0, 8)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default RulesManager
