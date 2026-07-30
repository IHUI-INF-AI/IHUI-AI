'use client'

/**
 * MCP 面板 — 可视化管理 MCP 工具/资源/提示词/Skill/Slash 命令。
 * 替换 ide-layout.tsx 中 activeTopTab==='mcp' 的空壳 div。
 *
 * 布局:左侧 5 个垂直分类 tab + 右侧(列表 + 详情/调用 + 结果区)。
 * 数据懒加载:切换 tab 时加载对应列表,刷新按钮强制重载当前 tab。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  Wrench,
  Database,
  MessageSquare,
  Sparkles,
  Terminal as TerminalIcon,
  RefreshCw,
  Search,
  Copy,
  Play,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import {
  listMCPTools,
  callMCPTool,
  listMCPResources,
  readMCPResource,
  listMCPPrompts,
  invokeMCPPrompt,
  listMCPSkills,
  getSkill,
  executeSkill,
  listSlashCommands,
  executeSlashCommand,
} from '@ihui/api-client'
import type { McpTool, McpResource, McpPrompt, McpSkill, SlashCommandInfo } from '@ihui/api-client'

type TabKey = 'tools' | 'resources' | 'prompts' | 'skills' | 'slash'

const TABS: Array<{
  key: TabKey
  icon: React.ComponentType<{ className?: string }>
  labelKey: string
}> = [
  { key: 'tools', icon: Wrench, labelKey: 'mcpPane.tools' },
  { key: 'resources', icon: Database, labelKey: 'mcpPane.resources' },
  { key: 'prompts', icon: MessageSquare, labelKey: 'mcpPane.prompts' },
  { key: 'skills', icon: Sparkles, labelKey: 'mcpPane.skills' },
  { key: 'slash', icon: TerminalIcon, labelKey: 'mcpPane.slash' },
]

/** 列表项统一展示结构(各 tab 数据 map 成此结构) */
interface DisplayItem {
  key: string
  name: string
  description: string
  raw: unknown
}

/** JSON Schema 字段提取(类型守卫,从 inputSchema/arguments 动态生成表单) */
interface SchemaField {
  name: string
  description?: string
  required: boolean
  type?: string
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function extractSchemaFields(schema: unknown): SchemaField[] {
  if (!isObject(schema)) return []
  const props = schema.properties
  if (!isObject(props)) return []
  const requiredList = Array.isArray(schema.required) ? schema.required : []
  return Object.entries(props).map(([name, def]) => {
    const d = isObject(def) ? def : {}
    return {
      name,
      description: typeof d.description === 'string' ? d.description : undefined,
      required: requiredList.includes(name),
      type: typeof d.type === 'string' ? d.type : undefined,
    }
  })
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/** 加载指定 tab 的列表数据,统一映射为 DisplayItem[] */
async function loadTabItems(tab: TabKey): Promise<DisplayItem[]> {
  switch (tab) {
    case 'tools': {
      const r = await listMCPTools()
      if (!r.success) throw new Error(r.error)
      return r.data.tools.map((t: McpTool) => ({
        key: t.name,
        name: t.name,
        description: t.description,
        raw: t,
      }))
    }
    case 'resources': {
      const r = await listMCPResources()
      if (!r.success) throw new Error(r.error)
      return r.data.resources.map((res: McpResource) => ({
        key: res.uri,
        name: res.name || res.uri,
        description: res.description || '',
        raw: res,
      }))
    }
    case 'prompts': {
      const r = await listMCPPrompts()
      if (!r.success) throw new Error(r.error)
      return r.data.prompts.map((p: McpPrompt) => ({
        key: p.name,
        name: p.name,
        description: p.description,
        raw: p,
      }))
    }
    case 'skills': {
      const r = await listMCPSkills()
      if (!r.success) throw new Error(r.error)
      return r.data.skills.map((s: McpSkill) => ({
        key: s.name,
        name: s.name,
        description: s.description,
        raw: s,
      }))
    }
    case 'slash': {
      const r = await listSlashCommands()
      if (!r.success) throw new Error(r.error)
      return r.data.commands.map((c: SlashCommandInfo) => ({
        key: c.name,
        name: c.name,
        description: c.description,
        raw: c,
      }))
    }
  }
}

export function McpPane() {
  const t = useTranslations('ide')
  const [activeTab, setActiveTab] = React.useState<TabKey>('tools')
  const [items, setItems] = React.useState<DisplayItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [result, setResult] = React.useState<string | null>(null)
  const [calling, setCalling] = React.useState(false)

  // 加载当前 tab 数据
  const load = React.useCallback(async (tab: TabKey) => {
    setLoading(true)
    setError(null)
    setSelectedKey(null)
    try {
      const data = await loadTabItems(tab)
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 首次挂载 + 切换 tab 时加载
  React.useEffect(() => {
    void load(activeTab)
    setResult(null)
  }, [activeTab, load])

  // 过滤列表
  const filtered = React.useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(
      (it) => it.name.toLowerCase().includes(q) || it.description.toLowerCase().includes(q),
    )
  }, [items, search])

  const selectedItem = React.useMemo(
    () => filtered.find((it) => it.key === selectedKey) ?? null,
    [filtered, selectedKey],
  )

  const handleCopy = React.useCallback((text: string) => {
    void navigator.clipboard.writeText(text)
  }, [])

  return (
    <div className="flex h-full w-full overflow-hidden rounded-lg border border-border bg-card">
      {/* 左侧:垂直分类 tab 栏 */}
      <div className="flex w-14 shrink-0 flex-col gap-0.5 bg-muted/20 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              className={cn(
                'flex h-12 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
              onClick={() => setActiveTab(tab.key)}
              title={t(tab.labelKey)}
              aria-label={t(tab.labelKey)}
              aria-pressed={isActive}
            >
              <Icon className="h-4 w-4" />
              <span>{t(tab.labelKey)}</span>
            </button>
          )
        })}
      </div>

      {/* 右侧:主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶部工具条:刷新 + 搜索 */}
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => void load(activeTab)}
            disabled={loading}
            title={t('mcpPane.refresh')}
            aria-label={t('mcpPane.refresh')}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
          <div className="flex h-6 min-w-0 flex-1 items-center gap-1 rounded border border-border bg-background px-1.5">
            <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('mcpPane.searchPlaceholder')}
              className="h-full min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              aria-label={t('mcpPane.searchPlaceholder')}
            />
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {filtered.length}/{items.length}
          </span>
        </div>

        {/* 中间:列表 + 详情(横向分栏) */}
        <div className="flex min-h-0 flex-1">
          {/* 列表 */}
          <div className="w-48 shrink-0 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-1 px-3 py-4 text-center text-xs text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                {t('mcpPane.empty')}
              </div>
            ) : (
              filtered.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  className={cn(
                    'flex w-full flex-col gap-0.5 px-2.5 py-1.5 text-left text-xs transition-colors',
                    selectedKey === it.key
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50',
                  )}
                  onClick={() => setSelectedKey(it.key)}
                >
                  <span className="truncate font-medium">{it.name}</span>
                  {it.description && (
                    <span className="truncate text-[10px] text-muted-foreground">
                      {it.description}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* 详情/调用 */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {selectedItem ? (
              <DetailPanel
                tab={activeTab}
                item={selectedItem}
                calling={calling}
                onCall={async (args) => {
                  setCalling(true)
                  setResult(null)
                  try {
                    const res = await callTabItem(activeTab, selectedItem, args)
                    setResult(formatJson(res))
                  } catch (e) {
                    setResult(formatJson({ error: e instanceof Error ? e.message : String(e) }))
                  } finally {
                    setCalling(false)
                  }
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t('mcpPane.selectHint')}
              </div>
            )}

            {/* 底部结果区 */}
            {result && (
              <div className="flex max-h-48 min-h-0 flex-col overflow-hidden border-t border-border bg-muted/20">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t('mcpPane.result')}
                  </span>
                  <button
                    type="button"
                    className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onClick={() => handleCopy(result)}
                    title={t('mcpPane.copy')}
                    aria-label={t('mcpPane.copy')}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto px-2 pb-2 text-[11px] leading-relaxed">
                  <code className="font-mono">{result}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** 调用指定 tab 的选中项,返回结果(unknown)供格式化展示 */
async function callTabItem(
  tab: TabKey,
  item: DisplayItem,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (tab) {
    case 'tools': {
      const r = await callMCPTool(item.key, args)
      if (!r.success) throw new Error(r.error)
      return r.data
    }
    case 'resources': {
      const r = await readMCPResource(item.key)
      if (!r.success) throw new Error(r.error)
      return r.data
    }
    case 'prompts': {
      const r = await invokeMCPPrompt(item.key, args)
      if (!r.success) throw new Error(r.error)
      return r.data
    }
    case 'skills': {
      const r = await executeSkill(item.key, args)
      if (!r.success) throw new Error(r.error)
      return r.data
    }
    case 'slash': {
      const argList = typeof args.args === 'string' ? parseSlashArgs(args.args) : []
      const r = await executeSlashCommand(item.key, argList)
      if (!r.success) throw new Error(r.error)
      return r.data
    }
  }
}

/** slash 命令参数解析:空格分隔(简单实现,不处理引号转义) */
function parseSlashArgs(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean)
}

/** 详情面板:根据 tab 渲染不同表单 + 调用按钮 */
function DetailPanel({
  tab,
  item,
  calling,
  onCall,
}: {
  tab: TabKey
  item: DisplayItem
  calling: boolean
  onCall: (args: Record<string, unknown>) => Promise<void>
}) {
  const t = useTranslations('ide')
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [skillDetail, setSkillDetail] = React.useState<McpSkill | null>(null)
  const [skillLoading, setSkillLoading] = React.useState(false)

  // skills tab:选中后加载详情(getSkill 返回 prompt_template)
  React.useEffect(() => {
    if (tab !== 'skills') {
      setSkillDetail(null)
      return
    }
    const raw = item.raw as McpSkill
    if (raw.prompt_template) {
      setSkillDetail(raw)
      return
    }
    setSkillLoading(true)
    getSkill(item.key)
      .then((r) => {
        if (r.success) setSkillDetail(r.data)
      })
      .finally(() => setSkillLoading(false))
  }, [tab, item.key, item.raw])

  // schema 字段提取(工具用 inputSchema,提示词用 arguments)
  const schemaFields = React.useMemo<SchemaField[]>(() => {
    if (tab === 'tools') {
      const tool = item.raw as McpTool
      return extractSchemaFields(tool.inputSchema)
    }
    if (tab === 'prompts') {
      const prompt = item.raw as McpPrompt
      if (!prompt.arguments) return []
      return prompt.arguments.map((a) => ({
        name: a.name,
        description: a.description,
        required: a.required ?? false,
        type: 'string',
      }))
    }
    return []
  }, [tab, item.raw])

  const handleInvoke = () => {
    if (tab === 'resources') {
      void onCall({})
      return
    }
    if (tab === 'slash') {
      void onCall({ args: values.args ?? '' })
      return
    }
    // tools / prompts / skills:把表单值转成 arguments
    const args: Record<string, unknown> = {}
    for (const f of schemaFields) {
      const v = values[f.name]
      if (v === undefined || v === '') continue
      args[f.name] = v
    }
    void onCall(args)
  }

  const callLabel = t('mcpPane.call')
  const showForm = tab === 'tools' || tab === 'prompts'
  const showSkillTemplate = tab === 'skills'
  const showResourceInfo = tab === 'resources'
  const showSlashInput = tab === 'slash'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5 text-xs">
      {/* 标题 + 描述 */}
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground">{item.name}</span>
        {item.description && <span className="text-muted-foreground">{item.description}</span>}
      </div>

      {/* 资源:显示 URI */}
      {showResourceInfo && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('mcpPane.resourceUri')}
          </span>
          <code className="break-all rounded bg-muted/50 px-1.5 py-1 font-mono text-[11px]">
            {(item.raw as McpResource).uri}
          </code>
        </div>
      )}

      {/* 工具/提示词:参数表单 */}
      {showForm && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('mcpPane.parameters')}
          </span>
          {schemaFields.length === 0 ? (
            <span className="text-muted-foreground">{t('mcpPane.noParams')}</span>
          ) : (
            schemaFields.map((f) => (
              <label key={f.name} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {f.name}
                  {f.required && <span className="text-destructive"> *</span>}
                  {f.type && <span className="ml-1 opacity-60">({f.type})</span>}
                </span>
                <input
                  type="text"
                  value={values[f.name] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                  placeholder={f.description || ''}
                  className="h-6 rounded border border-border bg-background px-2 text-xs outline-none focus:border-ring/50"
                />
              </label>
            ))
          )}
        </div>
      )}

      {/* Skill:显示 prompt_template */}
      {showSkillTemplate && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('mcpPane.skillTemplate')}
          </span>
          {skillLoading ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{t('mcpPane.loading')}</span>
            </div>
          ) : skillDetail?.prompt_template ? (
            <pre className="max-h-40 overflow-auto rounded bg-muted/50 px-2 py-1.5 text-[11px] leading-relaxed">
              <code className="font-mono whitespace-pre-wrap">{skillDetail.prompt_template}</code>
            </pre>
          ) : (
            <span className="text-muted-foreground">{t('mcpPane.noTemplate')}</span>
          )}
        </div>
      )}

      {/* Slash 命令:参数输入 */}
      {showSlashInput && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('mcpPane.slashArgs')}
          </span>
          <input
            type="text"
            value={values.args ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, args: e.target.value }))}
            placeholder={t('mcpPane.slashArgsHint')}
            className="h-6 rounded border border-border bg-background px-2 text-xs outline-none focus:border-ring/50"
          />
        </div>
      )}

      {/* 调用按钮 */}
      <button
        type="button"
        className="mt-1 flex h-7 items-center justify-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:opacity-50"
        onClick={handleInvoke}
        disabled={calling}
      >
        {calling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
        <span>{callLabel}</span>
      </button>
    </div>
  )
}
