'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { cn } from '@/lib/utils'
import {
  Play, Square, SkipForward, ArrowDown, ArrowUp, RotateCcw,
  ChevronRight, ChevronDown, Plus, X, Circle, CircleDot, Trash2, Terminal,
} from 'lucide-react'

type DebugState = 'stopped' | 'running' | 'paused'

interface Variable {
  name: string
  value: string
  type: string
  children?: Variable[]
}

interface Breakpoint {
  id: string
  file: string
  line: number
  enabled: boolean
}

const VARIABLES: Variable[] = [
  {
    name: 'this', value: 'IDEWorkspace', type: 'object',
    children: [
      { name: 'activeView', value: '"debug"', type: 'string' },
      { name: 'openTabs', value: 'Array(1)', type: 'array', children: [
        { name: '0', value: 'EditorTab', type: 'object' },
      ] },
      { name: 'fileTree', value: 'Array(3)', type: 'array' },
    ],
  },
  { name: 'query', value: '"IDELayout"', type: 'string' },
  { name: 'count', value: '12', type: 'number' },
  { name: 'isReady', value: 'true', type: 'boolean' },
]

const CONSOLE_LOGS = [
  { level: 'info', text: '调试会话已启动' },
  { level: 'log', text: 'IDELayout mounted' },
  { level: 'warn', text: 'openTabs.length = 0' },
  { level: 'error', text: 'Cannot read property "id" of undefined' },
]

const STATE_META: Record<DebugState, { labelKey: string; dot: string; text: string }> = {
  stopped: { labelKey: 'debug.stateStopped', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
  running: { labelKey: 'debug.stateRunning', dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
  paused: { labelKey: 'debug.statePaused', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
}

const BREAKPOINTS_KEY = 'ide:breakpoints'
const WATCHES_KEY = 'ide:watches'

function VariableRow({ v, depth = 0 }: { v: Variable; depth?: number }) {
  const [expanded, setExpanded] = React.useState(depth < 1)
  const hasChildren = (v.children?.length ?? 0) > 0
  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-muted/30"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="text-blue-600 dark:text-blue-400">{v.name}</span>
        <span className="text-muted-foreground">:</span>
        <span className={cn(
          'ml-auto truncate',
          v.type === 'string' && 'text-green-600 dark:text-green-400',
          v.type === 'number' && 'text-purple-600 dark:text-purple-400',
          v.type === 'boolean' && 'text-orange-600 dark:text-orange-400',
        )}>{v.value}</span>
      </div>
      {hasChildren && expanded && v.children!.map((c, i) => (
        <VariableRow key={i} v={c} depth={depth + 1} />
      ))}
    </div>
  )
}

export function DebugPanel() {
  const t = useTranslations('ide')
  const { activeView } = useIDEWorkspace()
  const [debugState, setDebugState] = React.useState<DebugState>('stopped')
  const [breakpoints, setBreakpoints] = React.useState<Breakpoint[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(BREAKPOINTS_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [watches, setWatches] = React.useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(WATCHES_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [watchInput, setWatchInput] = React.useState('')
  const [showConsole, setShowConsole] = React.useState(true)

  React.useEffect(() => {
    try {
      localStorage.setItem(BREAKPOINTS_KEY, JSON.stringify(breakpoints))
    } catch {
      // ignore
    }
  }, [breakpoints])

  React.useEffect(() => {
    try {
      localStorage.setItem(WATCHES_KEY, JSON.stringify(watches))
    } catch {
      // ignore
    }
  }, [watches])

  if (activeView !== 'debug') return null

  const meta = STATE_META[debugState]

  const toggleBreakpoint = (id: string) => {
    setBreakpoints((prev) => prev.map((b) => b.id === id ? { ...b, enabled: !b.enabled } : b))
  }
  const removeBreakpoint = (id: string) => {
    setBreakpoints((prev) => prev.filter((b) => b.id !== id))
  }
  const addWatch = () => {
    if (!watchInput.trim()) return
    setWatches((prev) => [...prev, watchInput.trim()])
    setWatchInput('')
  }
  const removeWatch = (idx: number) => {
    setWatches((prev) => prev.filter((_, i) => i !== idx))
  }

  const ctrlBtn = 'rounded p-1 transition-colors hover:bg-muted/50'
  const enabledBreaks = breakpoints.filter((b) => b.enabled).length

  return (
    <div className="flex w-72 shrink-0 flex-col bg-muted/20">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button onClick={() => setDebugState('running')} className={cn(ctrlBtn, debugState === 'stopped' ? 'text-green-600' : 'text-muted-foreground')} aria-label={t('debug.start')}>
          <Play className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setDebugState('paused')} className={cn(ctrlBtn, 'text-amber-600')} aria-label={t('debug.pause')}>
          <Square className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setDebugState('stopped')} className={cn(ctrlBtn, 'text-red-600')} aria-label={t('debug.stop')}>
          <Square className="h-3.5 w-3.5" />
        </button>
        <button className={cn(ctrlBtn, 'text-muted-foreground')} aria-label={t('debug.stepOver')}><SkipForward className="h-3.5 w-3.5" /></button>
        <button className={cn(ctrlBtn, 'text-muted-foreground')} aria-label={t('debug.stepInto')}><ArrowDown className="h-3.5 w-3.5" /></button>
        <button className={cn(ctrlBtn, 'text-muted-foreground')} aria-label={t('debug.stepOut')}><ArrowUp className="h-3.5 w-3.5" /></button>
        <button className={cn(ctrlBtn, 'text-muted-foreground')} aria-label={t('debug.restart')}><RotateCcw className="h-3.5 w-3.5" /></button>
        <div className={cn('ml-auto flex items-center gap-1 text-xs font-medium', meta.text)}>
          <span className={cn('h-2 w-2 rounded', meta.dot)} />
          <span>{t(meta.labelKey)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {debugState === 'stopped' ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">{t('debug.noSession')}</div>
        ) : (
          <>
            <div className="mb-2">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{t('debug.variables')}</div>
              {VARIABLES.map((v, i) => <VariableRow key={i} v={v} />)}
            </div>

            <div className="mb-2">
              <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground">
                <span>{t('debug.watch')}</span>
              </div>
              <div className="flex items-center gap-1 px-2 pb-1">
                <input
                  value={watchInput}
                  onChange={(e) => setWatchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addWatch()}
                  placeholder={t('debug.watchPlaceholder')}
                  className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none"
                />
                <button onClick={addWatch} className="rounded p-0.5 text-muted-foreground hover:bg-muted/50" aria-label={t('debug.add')}>
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              {watches.map((w, i) => (
                <div key={i} className="group flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-muted/30">
                  <span className="truncate text-blue-600 dark:text-blue-400">{w}</span>
                  <span className="text-muted-foreground">:</span>
                  <span className="ml-auto truncate text-green-600 dark:text-green-400">undefined</span>
                  <button onClick={() => removeWatch(i)} className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100" aria-label={t('debug.delete')}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mb-2">
              <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground">
                <span>{t('debug.breakpoints')}</span>
                <span className="ml-auto text-muted-foreground">{enabledBreaks}/{breakpoints.length}</span>
              </div>
              {breakpoints.map((b) => (
                <div key={b.id} className="group flex items-center gap-1.5 px-2 py-0.5 text-xs hover:bg-muted/30">
                  <button onClick={() => toggleBreakpoint(b.id)} className="text-muted-foreground" aria-label={t('debug.toggle')}>
                    {b.enabled ? <CircleDot className="h-3 w-3 text-red-500" /> : <Circle className="h-3 w-3" />}
                  </button>
                  <span className={cn('truncate', !b.enabled && 'text-muted-foreground line-through')}>{b.file}:{b.line}</span>
                  <button onClick={() => removeBreakpoint(b.id)} className="ml-auto text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100" aria-label={t('debug.delete')}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mb-2">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{t('debug.callStack')}</div>
              <div className="px-3 py-0.5 text-xs">
                <span className="text-blue-600 dark:text-blue-400">IDELayout</span>
                <span className="text-muted-foreground"> ide-layout.tsx:12</span>
              </div>
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => setShowConsole(!showConsole)}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/30"
      >
        {showConsole ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Terminal className="h-3 w-3" />
        <span>{t('debug.debugConsole')}</span>
      </button>
      {showConsole && (
        <div className="max-h-32 overflow-auto bg-background/50 p-1.5 font-mono text-[11px]">
          {CONSOLE_LOGS.map((log, i) => (
            <div key={i} className={cn(
              'px-1 py-0.5',
              log.level === 'error' && 'text-red-600 dark:text-red-400',
              log.level === 'warn' && 'text-amber-600 dark:text-amber-400',
              log.level === 'info' && 'text-blue-600 dark:text-blue-400',
              log.level === 'log' && 'text-foreground',
            )}>
              {log.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
