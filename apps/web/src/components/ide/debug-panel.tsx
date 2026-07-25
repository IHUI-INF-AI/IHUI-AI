'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { cn } from '@/lib/utils'
import {
  Play, Square, SkipForward, ArrowDown, ArrowUp, RotateCcw,
  ChevronRight, ChevronDown, Plus, X, Circle, CircleDot, Trash2, Terminal, Loader2,
} from 'lucide-react'
import {
  launchDebugSession, setBreakpoints as setBreakpointsApi,
  continueExecution, stepExecution, getStackTrace, getVariables,
  evaluateExpression, disconnectSession,
  type StackFrame, type DebugVariable, type StepType,
} from '@/lib/api/debug'

type DebugState = 'stopped' | 'running' | 'paused'

interface LocalVariable { name: string; value: string; type: string; children?: LocalVariable[] }
interface Breakpoint { id: string; file: string; line: number; enabled: boolean }
interface ConsoleLog { level: 'info' | 'log' | 'warn' | 'error'; text: string }

const STATE_META: Record<DebugState, { labelKey: string; dot: string; text: string }> = {
  stopped: { labelKey: 'debug.stateStopped', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
  running: { labelKey: 'debug.stateRunning', dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
  paused: { labelKey: 'debug.statePaused', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
}

const BREAKPOINTS_KEY = 'ide:breakpoints'
const WATCHES_KEY = 'ide:watches'
const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  mjs: 'javascript', cjs: 'javascript', py: 'python', go: 'go', rs: 'rust', java: 'java',
}

const adaptVar = (v: DebugVariable): LocalVariable => ({
  name: v.name, value: v.value, type: v.type ?? 'string',
})

function VariableRow({ v, depth = 0 }: { v: LocalVariable; depth?: number }) {
  const [expanded, setExpanded] = React.useState(depth < 1)
  const hasChildren = (v.children?.length ?? 0) > 0
  return (
    <div>
      <div className="flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-muted/30" style={{ paddingLeft: `${8 + depth * 12}px` }}>
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : <span className="w-3" />}
        <span className="text-blue-600 dark:text-blue-400">{v.name}</span>
        <span className="text-muted-foreground">:</span>
        <span className={cn(
          'ml-auto truncate',
          v.type === 'string' && 'text-green-600 dark:text-green-400',
          v.type === 'number' && 'text-purple-600 dark:text-purple-400',
          v.type === 'boolean' && 'text-orange-600 dark:text-orange-400',
        )}>{v.value}</span>
      </div>
      {hasChildren && expanded && v.children!.map((c, i) => <VariableRow key={i} v={c} depth={depth + 1} />)}
    </div>
  )
}

export function DebugPanel() {
  const t = useTranslations('ide')
  const { activeView, openTabs, activeTabId, workspacePath } = useIDEWorkspace()
  const [debugState, setDebugState] = React.useState<DebugState>('stopped')
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [stackFrames, setStackFrames] = React.useState<StackFrame[]>([])
  const [currentFrameId, setCurrentFrameId] = React.useState<number | null>(null)
  const [variables, setVariables] = React.useState<LocalVariable[]>([])
  const [consoleLogs, setConsoleLogs] = React.useState<ConsoleLog[]>([])
  const [watches, setWatches] = React.useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(WATCHES_KEY) ?? '[]') } catch { return [] }
  })
  const [watchValues, setWatchValues] = React.useState<Record<number, string>>({})
  const [watchInput, setWatchInput] = React.useState('')
  const [showConsole, setShowConsole] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [breakpoints, setBreakpoints] = React.useState<Breakpoint[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(BREAKPOINTS_KEY) ?? '[]') } catch { return [] }
  })

  React.useEffect(() => { try { localStorage.setItem(BREAKPOINTS_KEY, JSON.stringify(breakpoints)) } catch { /* ignore */ } }, [breakpoints])
  React.useEffect(() => { try { localStorage.setItem(WATCHES_KEY, JSON.stringify(watches)) } catch { /* ignore */ } }, [watches])

  const appendLog = React.useCallback((log: ConsoleLog) => {
    setConsoleLogs((prev) => [...prev, log].slice(-200))
  }, [])

  React.useEffect(() => {
    if (!sessionId || currentFrameId === null || currentFrameId === undefined) { setVariables([]); return }
    let cancelled = false
    getVariables(sessionId, currentFrameId)
      .then((res) => { if (!cancelled) setVariables(res.variables.map(adaptVar)) })
      .catch((e: unknown) => {
        if (!cancelled) {
          setVariables([])
          appendLog({ level: 'error', text: `[variables] ${e instanceof Error ? e.message : String(e)}` })
        }
      })
    return () => { cancelled = true }
  }, [sessionId, currentFrameId, appendLog])

  React.useEffect(() => {
    if (!sessionId || watches.length === 0) { setWatchValues({}); return }
    let cancelled = false
    Promise.all(watches.map((expr, i) =>
      evaluateExpression(sessionId, expr, currentFrameId ?? undefined)
        .then((r) => [i, r.result] as const)
        .catch((e: unknown) => [i, `Error: ${e instanceof Error ? e.message : String(e)}`] as const),
    )).then((entries) => {
      if (cancelled) return
      const map: Record<number, string> = {}
      entries.forEach(([i, val]) => { map[i] = val })
      setWatchValues(map)
    })
    return () => { cancelled = true }
  }, [sessionId, currentFrameId, watches])

  if (activeView !== 'debug') return null

  const meta = STATE_META[debugState]
  const toggleBreakpoint = (id: string) => setBreakpoints((p) => p.map((b) => b.id === id ? { ...b, enabled: !b.enabled } : b))
  const removeBreakpoint = (id: string) => setBreakpoints((p) => p.filter((b) => b.id !== id))
  const addWatch = () => { if (watchInput.trim()) { setWatches((p) => [...p, watchInput.trim()]); setWatchInput('') } }
  const removeWatch = (idx: number) => {
    setWatches((p) => p.filter((_, i) => i !== idx))
    setWatchValues((p) => { const n = { ...p }; delete n[idx]; return n })
  }

  const activeTab = openTabs.find((tab) => tab.id === activeTabId)
  const program = activeTab?.path ?? workspacePath ?? ''
  const language = activeTab?.language ?? LANG_MAP[program.split('.').pop()?.toLowerCase() ?? ''] ?? 'typescript'

  const syncBreakpoints = async (sid: string) => {
    const enabled = breakpoints.filter((b) => b.enabled)
    if (enabled.length === 0) return
    const byFile = new Map<string, Breakpoint[]>()
    enabled.forEach((b) => { const arr = byFile.get(b.file) ?? []; arr.push(b); byFile.set(b.file, arr) })
    await Promise.all(Array.from(byFile.entries()).map(([file, bps]) =>
      setBreakpointsApi(sid, { file, lines: bps.map((b) => ({ line: b.line })) }),
    ))
  }

  const handleStopped = async (sid: string, stopped: { reason?: string } | null) => {
    if (!stopped) { setDebugState('running'); setStackFrames([]); setCurrentFrameId(null); return }
    setDebugState('paused')
    appendLog({ level: 'info', text: `[stopped] reason=${stopped.reason ?? 'unknown'}` })
    try {
      const stack = await getStackTrace(sid)
      setStackFrames(stack.stackFrames)
      setCurrentFrameId(stack.stackFrames[0]?.id ?? null)
    } catch (e) {
      appendLog({ level: 'error', text: `[stack] ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const onError = (tag: string, e: unknown) => {
    toast.error(t('debug.launchFailed'))
    appendLog({ level: 'error', text: `[${tag}] ${e instanceof Error ? e.message : String(e)}` })
  }

  const onPlay = async () => {
    if (loading) return
    setLoading(true)
    try {
      const sid = sessionId ?? (await launchDebugSession({ language, program })).sessionId
      if (!sessionId) {
        setSessionId(sid)
        appendLog({ level: 'info', text: `[launch] session=${sid} lang=${language}` })
        await syncBreakpoints(sid)
      }
      const cont = await continueExecution(sid)
      await handleStopped(sid, cont.stopped)
    } catch (e) { onError('launch', e) } finally { setLoading(false) }
  }

  const onStop = async () => {
    if (loading) return
    if (!sessionId) { setDebugState('stopped'); return }
    setLoading(true)
    try {
      await disconnectSession(sessionId)
      appendLog({ level: 'info', text: `[disconnect] session=${sessionId}` })
    } catch (e) { onError('disconnect', e) }
    finally {
      setSessionId(null); setDebugState('stopped'); setStackFrames([])
      setCurrentFrameId(null); setVariables([]); setWatchValues({}); setLoading(false)
    }
  }

  const onStep = async (stepType: StepType) => {
    if (loading || !sessionId) return
    setLoading(true)
    try {
      const res = await stepExecution(sessionId, stepType)
      await handleStopped(sessionId, res.stopped)
    } catch (e) { onError(`step:${stepType}`, e) } finally { setLoading(false) }
  }

  const ctrlBtn = 'rounded p-1 transition-colors hover:bg-muted/50 disabled:opacity-50 disabled:pointer-events-none'
  const enabledBreaks = breakpoints.filter((b) => b.enabled).length
  const spinner = <Loader2 className="h-3.5 w-3.5 animate-spin" />

  return (
    <div className="flex w-72 shrink-0 flex-col bg-muted/20">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button onClick={onPlay} disabled={loading} className={cn(ctrlBtn, debugState === 'stopped' ? 'text-green-600' : 'text-muted-foreground')} aria-label={t('debug.start')}>
          {loading && debugState === 'stopped' ? spinner : <Play className="h-3.5 w-3.5" />}
        </button>
        <button disabled={loading} className={cn(ctrlBtn, 'text-amber-600')} aria-label={t('debug.pause')}><Square className="h-3.5 w-3.5" /></button>
        <button onClick={onStop} disabled={loading} className={cn(ctrlBtn, 'text-red-600')} aria-label={t('debug.stop')}><Square className="h-3.5 w-3.5" /></button>
        <button onClick={() => onStep('next')} disabled={loading || !sessionId} className={cn(ctrlBtn, 'text-muted-foreground')} aria-label={t('debug.stepOver')}><SkipForward className="h-3.5 w-3.5" /></button>
        <button onClick={() => onStep('stepIn')} disabled={loading || !sessionId} className={cn(ctrlBtn, 'text-muted-foreground')} aria-label={t('debug.stepInto')}><ArrowDown className="h-3.5 w-3.5" /></button>
        <button onClick={() => onStep('stepOut')} disabled={loading || !sessionId} className={cn(ctrlBtn, 'text-muted-foreground')} aria-label={t('debug.stepOut')}><ArrowUp className="h-3.5 w-3.5" /></button>
        <button onClick={onPlay} disabled={loading || !sessionId} className={cn(ctrlBtn, 'text-muted-foreground')} aria-label={t('debug.restart')}><RotateCcw className="h-3.5 w-3.5" /></button>
        <div className={cn('ml-auto flex items-center gap-1 text-xs font-medium', meta.text)}>
          {loading && debugState !== 'stopped' ? spinner : <span className={cn('h-2 w-2 rounded', meta.dot)} />}
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
              {variables.length === 0 ? (
                <div className="px-3 py-1 text-xs text-muted-foreground">{loading ? '…' : '—'}</div>
              ) : variables.map((v, i) => <VariableRow key={i} v={v} />)}
            </div>

            <div className="mb-2">
              <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground"><span>{t('debug.watch')}</span></div>
              <div className="flex items-center gap-1 px-2 pb-1">
                <input
                  value={watchInput}
                  onChange={(e) => setWatchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addWatch()}
                  placeholder={t('debug.watchPlaceholder')}
                  className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none"
                />
                <button onClick={addWatch} className="rounded p-0.5 text-muted-foreground hover:bg-muted/50" aria-label={t('debug.add')}><Plus className="h-3 w-3" /></button>
              </div>
              {watches.map((w, i) => (
                <div key={i} className="group flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-muted/30">
                  <span className="truncate text-blue-600 dark:text-blue-400">{w}</span>
                  <span className="text-muted-foreground">:</span>
                  <span className="ml-auto truncate text-green-600 dark:text-green-400">{watchValues[i] ?? '—'}</span>
                  <button onClick={() => removeWatch(i)} className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100" aria-label={t('debug.delete')}><X className="h-3 w-3" /></button>
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
                  <button onClick={() => removeBreakpoint(b.id)} className="ml-auto text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100" aria-label={t('debug.delete')}><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>

            <div className="mb-2">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{t('debug.callStack')}</div>
              {stackFrames.length === 0 ? (
                <div className="px-3 py-0.5 text-xs text-muted-foreground">{loading ? '…' : '—'}</div>
              ) : stackFrames.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setCurrentFrameId(f.id)}
                  className={cn('flex w-full items-center gap-1 px-3 py-0.5 text-left text-xs hover:bg-muted/30', currentFrameId === f.id && 'bg-muted/40')}
                >
                  <span className="truncate text-blue-600 dark:text-blue-400">{f.name}</span>
                  <span className="ml-auto truncate text-muted-foreground">{f.source?.name ?? f.source?.path ?? ''}:{f.line}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button onClick={() => setShowConsole(!showConsole)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/30">
        {showConsole ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Terminal className="h-3 w-3" />
        <span>{t('debug.debugConsole')}</span>
      </button>
      {showConsole && (
        <div className="max-h-32 overflow-auto bg-background/50 p-1.5 font-mono text-[11px]">
          {consoleLogs.length === 0 ? (
            <div className="px-1 py-0.5 text-muted-foreground">—</div>
          ) : consoleLogs.map((log, i) => (
            <div key={i} className={cn(
              'px-1 py-0.5',
              log.level === 'error' && 'text-red-600 dark:text-red-400',
              log.level === 'warn' && 'text-amber-600 dark:text-amber-400',
              log.level === 'info' && 'text-blue-600 dark:text-blue-400',
              log.level === 'log' && 'text-foreground',
            )}>{log.text}</div>
          ))}
        </div>
      )}
    </div>
  )
}
