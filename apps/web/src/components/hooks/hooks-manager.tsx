'use client'

import * as React from 'react'
import { Loader2, Pencil, Play, Plus, ScrollText, Trash2 } from 'lucide-react'

import { Button, Card, Input, Switch } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { Empty } from '@/components/common/Empty'
import { useHooks, useHookLogs } from '@/hooks/use-hooks'
import {
  draftToCreateInput,
  draftToUpdateInput,
  useHooksStore,
  type HookDraft,
} from '@/stores/hooks'
import type {
  Hook,
  HookActionType,
  HookLog,
  HookTriggerEvent,
  TestHookResult,
} from '@ihui/types'

/**
 * Hook 管理组件 — 2026-07-22 立。
 *
 * 包含:
 *  - Hook 列表(每行:名称 + event badge + action badge + 启用开关 + 编辑/删除按钮)
 *  - 编辑器对话框(事件下拉 + 条件 textarea + 动作类型 + 动作配置表单)
 *  - 测试结果展示
 *  - 日志查看面板(右侧侧栏 / 模态对话框)
 *
 * UI 约束(AGENTS.md §4):
 *  - 紧凑优雅,无蓝色发光边框
 *  - 禁 rounded-full(Switch 拇指豁免)、hr、divide-y
 *  - event badge:tool 蓝 / message 绿 / session 黄 / error 红
 *  - action badge:webhook 紫 / script 橙 / log 灰 / notify 蓝
 */

// ====================== Badge 颜色映射 ======================

const EVENT_BADGE_CLASS: Record<HookTriggerEvent, string> = {
  'tool.before': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
  'tool.after': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
  'message.send': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900',
  'message.receive': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900',
  'session.start': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  'session.end': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  error: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
}

const ACTION_BADGE_CLASS: Record<HookActionType, string> = {
  webhook: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900',
  script: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900',
  log: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800',
  notify: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
}

const ACTION_LABEL: Record<HookActionType, string> = {
  webhook: 'Webhook',
  script: '脚本',
  log: '日志',
  notify: '通知',
}

// ====================== 事件下拉选项 ======================

const EVENT_OPTIONS: { value: HookTriggerEvent; label: string }[] = [
  { value: 'tool.before', label: '工具调用前' },
  { value: 'tool.after', label: '工具调用后' },
  { value: 'message.send', label: '用户发消息' },
  { value: 'message.receive', label: 'AI 回复消息' },
  { value: 'session.start', label: '会话开始' },
  { value: 'session.end', label: '会话结束' },
  { value: 'error', label: '错误事件' },
]

const ACTION_TYPE_OPTIONS: { value: HookActionType; label: string }[] = [
  { value: 'log', label: '日志' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'script', label: '脚本' },
  { value: 'notify', label: '通知' },
]

// ====================== 主组件 ======================

export function HooksManager() {
  const {
    hooks,
    isLoading,
    createHook,
    updateHook,
    deleteHook,
    toggleHook,
    testHook,
    isCreating,
    isUpdating,
    isTesting,
  } = useHooks()
  const store = useHooksStore()

  const handleSave = async () => {
    const draft = store.draft
    if (!draft.name.trim()) {
      return
    }
    try {
      if (store.editorMode === 'create') {
        await createHook(draftToCreateInput(draft))
      } else if (store.editorMode === 'edit' && draft.id) {
        await updateHook({ id: draft.id, input: draftToUpdateInput(draft) })
      }
      store.closeEditor()
    } catch {
      // toast 已由 mutation 触发
    }
  }

  const handleTest = async () => {
    const draft = store.draft
    if (!draft.id) return
    store.setTestingHookId(draft.id)
    try {
      const result: TestHookResult = await testHook({
        id: draft.id,
        input: {
          event: draft.event,
          context: {
            tool: 'write_file',
            args: { path: '/tmp/example.txt' },
            result: 'ok',
            sessionId: 'test-session',
          },
        },
      })
      store.setTestResult(result)
    } catch {
      // toast 已触发
    } finally {
      store.setTestingHookId(null)
    }
  }

  const handleToggle = async (hook: Hook, enabled: boolean) => {
    try {
      await toggleHook({ id: hook.id, enabled })
    } catch {
      // ignore
    }
  }

  const handleDelete = async (hook: Hook) => {
    if (!window.confirm(`确定删除 Hook "${hook.name}" 吗?`)) return
    try {
      await deleteHook(hook.id)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <HooksHeader
        count={hooks.length}
        onCreate={() => store.openCreate()}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span>加载中</span>
        </div>
      ) : hooks.length === 0 ? (
        <Empty
          icon={ScrollText}
          title="暂无 Hook 配置"
          description="创建第一个 Hook 以在 agent 行为事件触发时自动执行自定义动作"
          action={
            <Button onClick={() => store.openCreate()} size="sm">
              <Plus className="h-4 w-4" />
              <span>新建 Hook</span>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {hooks.map((hook) => (
            <HookRow
              key={hook.id}
              hook={hook}
              onEdit={() => store.openEdit(hook)}
              onDelete={() => void handleDelete(hook)}
              onToggle={(enabled) => void handleToggle(hook, enabled)}
              onViewLogs={() => store.openLogs(hook.id)}
            />
          ))}
        </div>
      )}

      {/* 编辑器对话框 */}
      {store.editorMode !== 'closed' && (
        <HookEditor
          draft={store.draft}
          mode={store.editorMode}
          testResult={store.testResult}
          isSaving={isCreating || isUpdating}
          isTesting={isTesting && store.testingHookId === store.draft.id}
          onChange={(patch) => store.setDraft(patch)}
          onClose={() => store.closeEditor()}
          onSave={() => void handleSave()}
          onTest={() => void handleTest()}
        />
      )}

      {/* 日志查看对话框 */}
      {store.viewingLogsHookId && (
        <HookLogsDialog
          hookId={store.viewingLogsHookId}
          onClose={() => store.closeLogs()}
        />
      )}
    </div>
  )
}

// ====================== Header ======================

function HooksHeader({ count, onCreate }: { count: number; onCreate: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold leading-none">Hook 管理</h2>
        <p className="text-xs text-muted-foreground">
          在 agent 行为事件触发时执行自定义动作(共 {count} 个)
        </p>
      </div>
      <Button onClick={onCreate} size="sm">
        <Plus className="h-4 w-4" />
        <span>新建 Hook</span>
      </Button>
    </div>
  )
}

// ====================== Hook 行 ======================

interface HookRowProps {
  hook: Hook
  onEdit: () => void
  onDelete: () => void
  onToggle: (enabled: boolean) => void
  onViewLogs: () => void
}

function HookRow({ hook, onEdit, onDelete, onToggle, onViewLogs }: HookRowProps) {
  return (
    <Card className="px-3 py-2.5 shadow-none">
      <div className="flex items-center gap-3">
        {/* 名称 + 描述 */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{hook.name}</span>
            {!hook.enabled && (
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                已禁用
              </span>
            )}
          </div>
          {hook.description && (
            <span className="truncate text-xs text-muted-foreground">{hook.description}</span>
          )}
        </div>

        {/* event badge */}
        <Badge className={EVENT_BADGE_CLASS[hook.event]}>{hook.event}</Badge>
        {/* action badge */}
        <Badge className={ACTION_BADGE_CLASS[hook.action.type]}>
          {ACTION_LABEL[hook.action.type]}
        </Badge>

        {/* 启用开关 */}
        <div className="flex items-center gap-1.5">
          <Switch checked={hook.enabled} onCheckedChange={onToggle} aria-label="启用/禁用" />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onViewLogs} aria-label="查看日志">
            <ScrollText className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="编辑">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:text-destructive"
            onClick={onDelete}
            aria-label="删除"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ====================== Badge ======================

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  )
}

// ====================== 编辑器对话框 ======================

interface HookEditorProps {
  draft: HookDraft
  mode: 'create' | 'edit'
  testResult: TestHookResult | null
  isSaving: boolean
  isTesting: boolean
  onChange: (patch: Partial<HookDraft>) => void
  onClose: () => void
  onSave: () => void
  onTest: () => void
}

function HookEditor({
  draft,
  mode,
  testResult,
  isSaving,
  isTesting,
  onChange,
  onClose,
  onSave,
  onTest,
}: HookEditorProps) {
  const isEdit = mode === 'edit'
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? '编辑 Hook' : '新建 Hook'}
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <Card
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-base font-semibold leading-none">
              {isEdit ? '编辑 Hook' : '新建 Hook'}
            </h3>
            <p className="text-xs text-muted-foreground">
              在事件触发时执行自定义动作
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="关闭"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区(滚动) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 thin-scroll">
          <div className="flex flex-col gap-4">
            {/* 名称 */}
            <Field label="名称" required>
              <Input
                value={draft.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="例如:写文件前通知"
                maxLength={200}
              />
            </Field>

            {/* 描述 */}
            <Field label="描述">
              <Input
                value={draft.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="可选,简单说明 Hook 用途"
                maxLength={2000}
              />
            </Field>

            {/* 事件 */}
            <Field label="触发事件" required>
              <NativeSelect
                value={draft.event}
                onChange={(v) => onChange({ event: v as HookTriggerEvent })}
                options={EVENT_OPTIONS}
              />
            </Field>

            {/* 条件表达式 */}
            <Field
              label="条件表达式(JSONLogic,可选)"
              hint='示例:{"==":["tool","write_file"]} 匹配 tool 字段等于 write_file'
            >
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={draft.condition}
                onChange={(e) => onChange({ condition: e.target.value })}
                placeholder='{"and":[{"==":["tool","write_file"]},{"contains":["args.path",".env"]}]}'
                maxLength={8192}
                spellCheck={false}
              />
            </Field>

            {/* 动作类型 */}
            <Field label="动作类型" required>
              <NativeSelect
                value={draft.actionType}
                onChange={(v) => onChange({ actionType: v as HookActionType })}
                options={ACTION_TYPE_OPTIONS}
              />
            </Field>

            {/* 动作配置(根据类型) */}
            <HookActionConfigForm draft={draft} onChange={onChange} />
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold">测试结果</span>
                <Badge
                  className={
                    testResult.triggered
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800'
                  }
                >
                  {testResult.triggered ? '已触发' : '未匹配'}
                </Badge>
              </div>
              {testResult.logs.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {testResult.logs.map((log, idx) => (
                    <LogRow key={log.id ?? idx} log={log} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">条件未匹配,无日志产生</p>
              )}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div className="flex items-center gap-2">
            {isEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onTest}
                disabled={isTesting || !draft.id}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span>测试</span>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <span>取消</span>
            </Button>
            <Button size="sm" onClick={onSave} disabled={isSaving || !draft.name.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>{isEdit ? '保存' : '创建'}</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ====================== 动作配置表单 ======================

function HookActionConfigForm({
  draft,
  onChange,
}: {
  draft: HookDraft
  onChange: (patch: Partial<HookDraft>) => void
}) {
  if (draft.actionType === 'webhook') {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <Field label="URL" required>
          <Input
            value={draft.webhookUrl}
            onChange={(e) => onChange({ webhookUrl: e.target.value })}
            placeholder="https://example.com/webhook"
            maxLength={2048}
            type="url"
          />
        </Field>
        <Field label="HTTP 方法">
          <NativeSelect
            value={draft.webhookMethod}
            onChange={(v) =>
              onChange({ webhookMethod: v as 'GET' | 'POST' | 'PUT' })
            }
            options={[
              { value: 'POST', label: 'POST' },
              { value: 'GET', label: 'GET' },
              { value: 'PUT', label: 'PUT' },
            ]}
          />
        </Field>
        <Field label="请求头(JSON)">
          <textarea
            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={draft.webhookHeaders}
            onChange={(e) => onChange({ webhookHeaders: e.target.value })}
            spellCheck={false}
          />
        </Field>
        <Field label="请求体模板" hint="支持 {{event}} {{tool}} {{args}} {{result}} 变量">
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={draft.webhookBody}
            onChange={(e) => onChange({ webhookBody: e.target.value })}
            spellCheck={false}
          />
        </Field>
      </div>
    )
  }
  if (draft.actionType === 'script') {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <Field
          label="Shell 命令"
          required
          hint="沙箱内执行,超时 10s,环境变量 HOOK_EVENT / HOOK_CONTEXT 可用"
        >
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={draft.scriptCommand}
            onChange={(e) => onChange({ scriptCommand: e.target.value })}
            placeholder={`echo "event=$HOOK_EVENT" >> hooks.log`}
            spellCheck={false}
            maxLength={2048}
          />
        </Field>
      </div>
    )
  }
  if (draft.actionType === 'notify') {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <Field label="通知渠道">
          <NativeSelect
            value={draft.notifyChannel}
            onChange={(v) =>
              onChange({ notifyChannel: v as 'toast' | 'notification' | 'email' })
            }
            options={[
              { value: 'toast', label: 'Toast(轻提示)' },
              { value: 'notification', label: '系统通知' },
              { value: 'email', label: '邮件' },
            ]}
          />
        </Field>
        <Field label="消息模板" hint="支持 {{event}} {{tool}} {{args}} 变量">
          <Input
            value={draft.notifyMessage}
            onChange={(e) => onChange({ notifyMessage: e.target.value })}
            placeholder="{{event}} 已触发"
            maxLength={2048}
          />
        </Field>
      </div>
    )
  }
  // log
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <Field label="日志消息模板" hint="支持 {{event}} {{tool}} {{args}} 变量,写入 logs/hooks.log">
        <Input
          value={draft.logMessage}
          onChange={(e) => onChange({ logMessage: e.target.value })}
          placeholder="{{event}} on {{tool}}"
          maxLength={2048}
        />
      </Field>
    </div>
  )
}

// ====================== 日志查看对话框 ======================

function HookLogsDialog({
  hookId,
  onClose,
}: {
  hookId: string
  onClose: () => void
}) {
  const { logs, isLoading } = useHookLogs(hookId)
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hook 日志"
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <Card
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-base font-semibold leading-none">Hook 执行日志</h3>
            <p className="text-xs text-muted-foreground">最近 100 条触发记录</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="关闭"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 thin-scroll">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>加载中</span>
            </div>
          ) : logs.length === 0 ? (
            <Empty title="暂无日志" description="该 Hook 还未被触发过" />
          ) : (
            <div className="flex flex-col gap-2">
              {logs.map((log, idx) => (
                <LogRow key={log.id ?? idx} log={log} showHookId={false} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

// ====================== 单条日志 ======================

function LogRow({
  log,
  showHookId = true,
}: {
  log: HookLog
  showHookId?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-md border bg-card px-3 py-2 text-xs',
        log.success
          ? 'border-border'
          : 'border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/30',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={EVENT_BADGE_CLASS[log.event]}>{log.event}</Badge>
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium',
            log.success
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
          )}
        >
          {log.success ? '成功' : '失败'}
        </span>
        <span className="text-muted-foreground">{log.duration} ms</span>
        <span className="text-muted-foreground">
          {new Date(log.triggeredAt).toLocaleString()}
        </span>
        {showHookId && (
          <span className="text-muted-foreground">#{log.hookId.slice(-8)}</span>
        )}
      </div>
      {log.result && (
        <pre className="mt-1.5 max-h-24 overflow-auto rounded-sm bg-muted/40 p-1.5 font-mono text-[11px] thin-scroll">
          {log.result}
        </pre>
      )}
      {log.error && (
        <p className="mt-1 text-red-600 dark:text-red-400">{log.error}</p>
      )}
    </div>
  )
}

// ====================== 工具子组件 ======================

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1 text-xs font-medium text-foreground">
        <span>{label}</span>
        {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function NativeSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
