'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { cn } from '@/lib/utils'
import {
  Play, Plus, Terminal, Globe, Bug, X, Check, History,
} from 'lucide-react'

type ConfigType = 'node' | 'python' | 'web' | 'terminal'

interface AppConfig {
  id: string
  name: string
  type: ConfigType
  command: string
}

const TYPE_META: Record<ConfigType, { icon: typeof Terminal; color: string }> = {
  node: { icon: Terminal, color: 'text-green-600 dark:text-green-400' },
  python: { icon: Terminal, color: 'text-blue-600 dark:text-blue-400' },
  web: { icon: Globe, color: 'text-purple-600 dark:text-purple-400' },
  terminal: { icon: Terminal, color: 'text-muted-foreground' },
}

const INITIAL_CONFIGS: AppConfig[] = [
  { id: '1', name: '启动开发服务器', type: 'node', command: 'pnpm dev' },
  { id: '2', name: '运行测试', type: 'node', command: 'pnpm test' },
  { id: '3', name: '类型检查', type: 'node', command: 'pnpm typecheck' },
  { id: '4', name: 'Python 服务', type: 'python', command: 'python main.py' },
  { id: '5', name: '浏览器预览', type: 'web', command: 'http://localhost:3000' },
]

function getTypeLabel(type: ConfigType, t: (k: string) => string) {
  if (type === 'terminal') return t('applications.typeTerminal')
  if (type === 'node') return 'Node'
  if (type === 'python') return 'Python'
  return 'Web'
}

export function ApplicationsPanel() {
  const t = useTranslations('ide')
  const { activeView } = useIDEWorkspace()
  const [configs, setConfigs] = React.useState<AppConfig[]>(INITIAL_CONFIGS)
  const [history, setHistory] = React.useState<{ name: string; time: string }[]>([
    { name: '启动开发服务器', time: '5 分钟前' },
    { name: '类型检查', time: '12 分钟前' },
    { name: '运行测试', time: '1 小时前' },
  ])
  const [showForm, setShowForm] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', type: 'node' as ConfigType, command: '' })

  if (activeView !== 'applications') return null

  const runConfig = (config: AppConfig) => {
    setHistory((prev) => [{ name: config.name, time: '刚刚' }, ...prev].slice(0, 5))
  }

  const submitForm = () => {
    if (!form.name.trim() || !form.command.trim()) return
    setConfigs((prev) => [...prev, { id: String(Date.now()), ...form }])
    setForm({ name: '', type: 'node', command: '' })
    setShowForm(false)
  }

  return (
    <div className="flex w-72 shrink-0 flex-col bg-muted/20">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <span className="text-xs font-medium">{t('applications.title')}</span>
        <button
          onClick={() => setShowForm(!showForm)}
          className={cn('ml-auto rounded p-1 transition-colors', showForm ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50')}
          aria-label={t('applications.newConfig')}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {showForm && (
        <div className="mx-2 mb-1.5 rounded-md border border-border bg-background p-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('applications.configNamePlaceholder')}
            className="mb-1 w-full rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none"
          />
          <div className="mb-1 flex gap-1">
            {(Object.keys(TYPE_META) as ConfigType[]).map((typeKey) => {
              const Icon = TYPE_META[typeKey].icon
              return (
                <button
                  key={typeKey}
                  onClick={() => setForm({ ...form, type: typeKey })}
                  className={cn(
                    'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors',
                    form.type === typeKey ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  <Icon className={cn('h-3 w-3', TYPE_META[typeKey].color)} />
                  <span>{getTypeLabel(typeKey, t)}</span>
                </button>
              )
            })}
          </div>
          <input
            value={form.command}
            onChange={(e) => setForm({ ...form, command: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && submitForm()}
            placeholder={t('applications.commandPlaceholder')}
            className="mb-1.5 w-full rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none"
          />
          <div className="flex justify-end gap-1">
            <button onClick={() => setShowForm(false)} className="rounded p-1 text-muted-foreground hover:bg-muted/50" aria-label={t('applications.cancel')}>
              <X className="h-3.5 w-3.5" />
            </button>
            <button onClick={submitForm} className="flex items-center gap-1 rounded bg-foreground px-2 py-1 text-xs text-background hover:bg-foreground/90">
              <Check className="h-3 w-3" />
              <span>{t('applications.add')}</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-1">
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{t('applications.launchConfigs')}</div>
        {configs.map((config) => {
          const meta = TYPE_META[config.type]
          const Icon = meta.icon
          return (
            <div key={config.id} className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/30">
              <Icon className={cn('h-3.5 w-3.5 shrink-0', meta.color)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{config.name}</div>
                <div className="truncate text-xs text-muted-foreground">{config.command}</div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => runConfig(config)}
                  className="rounded p-1 text-green-600 hover:bg-muted/50"
                  aria-label={t('applications.run')}
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => runConfig(config)}
                  className="rounded p-1 text-amber-600 hover:bg-muted/50"
                  aria-label={t('applications.debug')}
                >
                  <Bug className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}

        {history.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground">
              <History className="h-3 w-3" />
              <span>{t('applications.recentRuns')}</span>
            </div>
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/30">
                <Play className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{h.name}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">{h.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
