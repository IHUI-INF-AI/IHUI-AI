// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// 2026-09-10 0-6 组件拆分:主组件保留会话生命周期/求值 effect/控制条,
// Variables 行/Watch/断点/调用栈/Console 已拆至同目录子组件。

'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { useDebugStore } from '@/stores/debug'
import { cn } from '@/lib/utils'
import { Play, Square, SkipForward, ArrowDown, ArrowUp, RotateCcw, Loader2 } from 'lucide-react'
import {
  launchDebugSession,
  setBreakpoints as setBreakpointsApi,
  continueExecution,
  stepExecution,
  getStackTrace,
  evaluateExpression,
  disconnectSession,
  type StepType,
} from '@/lib/api/debug'
import { STATE_META, getLanguageFromPath } from './model'
import { ScopeGroup } from './ScopeGroup'
import { WatchSection } from './WatchSection'
import { BreakpointSection } from './BreakpointSection'
import { CallStackSection } from './CallStackSection'
import { DebugConsoleSection } from './DebugConsoleSection'

export function DebugPanel() {
  const t = useTranslations('ide')
  const { activeView, openTabs, activeTabId, workspacePath } = useIDEWorkspace()
  const debugState = useDebugStore((s) => s.debugState)
  const sessionId = useDebugStore((s) => s.sessionId)
  const currentFrameId = useDebugStore((s) => s.currentFrameId)
  const scopes = useDebugStore((s) => s.scopes)
  const watches = useDebugStore((s) => s.watches)
  const breakpoints = useDebugStore((s) => s.breakpoints)
  const loading = useDebugStore((s) => s.loading)

  // ---- store actions(回调中经 getState 取最新值,避免闭包过期) ----
  const setLoading = useDebugStore((s) => s.setLoading)
  const setSessionId = useDebugStore((s) => s.setSessionId)
  const setDebugState = useDebugStore((s) => s.setDebugState)
  const setStackFrames = useDebugStore((s) => s.setStackFrames)
  const clearRuntime = useDebugStore((s) => s.clearRuntime)
  const appendLog = useDebugStore((s) => s.appendLog)
  const setWatchValues = useDebugStore((s) => s.setWatchValues)
  const loadScopes = useDebugStore((s) => s.loadScopes)

  // 暂停且有当前帧时,加载 scope 分组 + 顶层变量
  // 注:breakpoints/watches 持久化恢复已在 store 模块加载时完成(localStorage),无需 hydrate
  React.useEffect(() => {
    if (!sessionId || currentFrameId === null || currentFrameId === undefined) return
    let cancelled = false
    loadScopes(sessionId, currentFrameId).catch((e: unknown) => {
      if (!cancelled) {
        appendLog({
          level: 'error',
          text: `[scopes] ${e instanceof Error ? e.message : String(e)}`,
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [sessionId, currentFrameId, loadScopes, appendLog])

  // watch 表达式求值(每次会话/帧/watch 列表变化时刷新)
  React.useEffect(() => {
    if (!sessionId || watches.length === 0) {
      setWatchValues({})
      return
    }
    let cancelled = false
    Promise.all(
      watches.map((expr, i) =>
        evaluateExpression(sessionId, expr, currentFrameId ?? undefined)
          .then((r) => [i, r.result] as const)
          .catch(
            (e: unknown) => [i, `Error: ${e instanceof Error ? e.message : String(e)}`] as const,
          ),
      ),
    ).then((entries) => {
      if (cancelled) return
      const map: Record<number, string> = {}
      entries.forEach(([i, val]) => {
        map[i] = val
      })
      setWatchValues(map)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId, currentFrameId, watches, setWatchValues])

  // ---- 断点生命周期同步(DAP setBreakpoints 语义:每次请求为该文件的全量替换) ----
  // syncedFiles 记录上次已同步到后端的文件集合:某文件断点被全部删除/禁用时,
  // 仍需发送空 lines 清除,否则后端 adapter 会继续命中已删除的断点。
  const syncedFilesRef = React.useRef<Set<string>>(new Set())
  const syncedSigRef = React.useRef<string>('[]')
  const syncInflightRef = React.useRef<Promise<void>>(Promise.resolve())

  const syncBreakpoints = React.useCallback(async (sid: string) => {
    const all = useDebugStore.getState().breakpoints
    const byFile = new Map<string, number[]>()
    all.forEach((b) => {
      if (!b.enabled) return
      const arr = byFile.get(b.file) ?? []
      arr.push(b.line)
      byFile.set(b.file, arr)
    })
    // 上次同步过、本次无启用断点的文件 → 发送空列表清除
    syncedFilesRef.current.forEach((file) => {
      if (!byFile.has(file)) byFile.set(file, [])
    })
    const sig = JSON.stringify(
      [...byFile.entries()].map(([file, lines]) => [file, [...lines].sort((a, b) => a - b)]),
    )
    if (byFile.size === 0 || sig === syncedSigRef.current) return
    const prev = syncInflightRef.current
    const run = async () => {
      await prev.catch(() => {})
      if (syncedSigRef.current === sig) return
      await Promise.all(
        [...byFile.entries()].map(([file, lines]) =>
          setBreakpointsApi(sid, { file, lines: lines.map((line) => ({ line })) }),
        ),
      )
      syncedFilesRef.current = new Set(byFile.keys())
      syncedSigRef.current = sig
    }
    syncInflightRef.current = run()
    await syncInflightRef.current
  }, [])

  // 会话中增删/启停断点后重新同步到后端(launch 后首次同步由 onPlay 显式 await,
  // 此处通过 sig 去重,不会重复请求)
  React.useEffect(() => {
    if (!sessionId) {
      syncedFilesRef.current = new Set()
      syncedSigRef.current = '[]'
      return
    }
    let cancelled = false
    syncBreakpoints(sessionId).catch((e: unknown) => {
      if (!cancelled) {
        appendLog({
          level: 'error',
          text: `[breakpoints] ${e instanceof Error ? e.message : String(e)}`,
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [sessionId, breakpoints, syncBreakpoints, appendLog])

  if (activeView !== 'debug') return null

  const meta = STATE_META[debugState]

  const activeTab = openTabs.find((tab) => tab.id === activeTabId)
  const program = activeTab?.path ?? workspacePath ?? ''
  const language = activeTab?.language ?? getLanguageFromPath(program) ?? 'typescript'

  const handleStopped = async (sid: string, stopped: { reason?: string } | null) => {
    if (!stopped) {
      setDebugState('running')
      clearRuntime()
      return
    }
    const reason = stopped.reason ?? 'unknown'
    // 后端 continue/step 等待 stopped 超时的合成 reason:程序仍在运行,保持 running 态
    if (reason === 'timeout') {
      setDebugState('running')
      clearRuntime()
      appendLog({ level: 'info', text: '[stopped] reason=timeout(程序仍在运行)' })
      return
    }
    // 程序已正常结束(DAP terminated 语义):会话失效,回到初始态
    if (reason === 'terminated') {
      appendLog({ level: 'info', text: `[terminated] session=${sid}` })
      setSessionId(null)
      setDebugState('stopped')
      clearRuntime()
      return
    }
    setDebugState('paused')
    appendLog({ level: 'info', text: `[stopped] reason=${reason}` })
    try {
      const stack = await getStackTrace(sid)
      setStackFrames(stack.stackFrames)
    } catch (e) {
      appendLog({ level: 'error', text: `[stack] ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const onError = (tag: string, e: unknown) => {
    toast.error(t('debug.launchFailed'))
    appendLog({ level: 'error', text: `[${tag}] ${e instanceof Error ? e.message : String(e)}` })
  }

  const onPlay = async () => {
    const s = useDebugStore.getState()
    if (s.loading) return
    setLoading(true)
    try {
      const sid = s.sessionId ?? (await launchDebugSession({ language, program })).sessionId
      if (!s.sessionId) {
        setSessionId(sid)
        appendLog({ level: 'info', text: `[launch] session=${sid} lang=${language}` })
        await syncBreakpoints(sid)
      }
      const cont = await continueExecution(sid)
      await handleStopped(sid, cont.stopped)
    } catch (e) {
      onError('launch', e)
    } finally {
      setLoading(false)
    }
  }

  const onStop = async () => {
    const s = useDebugStore.getState()
    if (s.loading) return
    if (!s.sessionId) {
      setDebugState('stopped')
      return
    }
    setLoading(true)
    try {
      await disconnectSession(s.sessionId)
      appendLog({ level: 'info', text: `[disconnect] session=${s.sessionId}` })
    } catch (e) {
      onError('disconnect', e)
    } finally {
      setSessionId(null)
      setDebugState('stopped')
      clearRuntime()
      setLoading(false)
    }
  }

  const onStep = async (stepType: StepType) => {
    const s = useDebugStore.getState()
    if (s.loading || !s.sessionId) return
    setLoading(true)
    try {
      const res = await stepExecution(s.sessionId, stepType)
      await handleStopped(s.sessionId, res.stopped)
    } catch (e) {
      onError(`step:${stepType}`, e)
    } finally {
      setLoading(false)
    }
  }

  const ctrlBtn =
    'rounded p-1 transition-colors hover:bg-muted/50 disabled:opacity-50 disabled:pointer-events-none'
  const spinner = <Loader2 className="h-3.5 w-3.5 animate-spin" />

  return (
    <div className="flex w-72 shrink-0 flex-col bg-muted/20">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          onClick={onPlay}
          disabled={loading}
          className={cn(
            ctrlBtn,
            debugState === 'stopped' ? 'text-green-600' : 'text-muted-foreground',
          )}
          aria-label={t('debug.start')}
        >
          {loading && debugState === 'stopped' ? spinner : <Play className="h-3.5 w-3.5" />}
        </button>
        <button
          disabled={loading}
          className={cn(ctrlBtn, 'text-amber-600')}
          aria-label={t('debug.pause')}
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onStop}
          disabled={loading}
          className={cn(ctrlBtn, 'text-red-600')}
          aria-label={t('debug.stop')}
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onStep('next')}
          disabled={loading || !sessionId}
          className={cn(ctrlBtn, 'text-muted-foreground')}
          aria-label={t('debug.stepOver')}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onStep('stepIn')}
          disabled={loading || !sessionId}
          className={cn(ctrlBtn, 'text-muted-foreground')}
          aria-label={t('debug.stepInto')}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onStep('stepOut')}
          disabled={loading || !sessionId}
          className={cn(ctrlBtn, 'text-muted-foreground')}
          aria-label={t('debug.stepOut')}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onPlay}
          disabled={loading || !sessionId}
          className={cn(ctrlBtn, 'text-muted-foreground')}
          aria-label={t('debug.restart')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <div className={cn('ml-auto flex items-center gap-1 text-xs font-medium', meta.text)}>
          {loading && debugState !== 'stopped' ? (
            spinner
          ) : (
            <span className={cn('h-2 w-2 rounded', meta.dot)} />
          )}
          <span>{t(meta.labelKey)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {debugState === 'stopped' ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">{t('debug.noSession')}</div>
        ) : (
          <>
            <div className="mb-2">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {t('debug.variables')}
              </div>
              {scopes.length === 0 ? (
                <div className="px-3 py-1 text-xs text-muted-foreground">{loading ? '…' : '—'}</div>
              ) : (
                scopes.map((sc) => <ScopeGroup key={sc.name} scope={sc} />)
              )}
            </div>

            <WatchSection />

            <BreakpointSection />

            <CallStackSection />
          </>
        )}
      </div>

      <DebugConsoleSection />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
