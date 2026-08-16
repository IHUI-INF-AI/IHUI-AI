'use client'

import * as React from 'react'
import {
  isTauri,
  checkForUpdates,
  restartApp,
  markUpdateInstalled,
  setAvailableUpdateSession,
  type UpdateSession,
  type UpdateProgress,
} from '@/lib/tauri-bridge'

/** 更新状态机:idle → checking → available → downloading → installing → done / error */
export type UpdateStatus =
  'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'done' | 'error'

export interface UpdaterState {
  status: UpdateStatus
  /** 可用更新信息(available/downloading/installing 时有值)。 */
  session: UpdateSession | null
  /** 下载进度(0-1,downloading/installing 时更新)。 */
  progress: number
  /** 下载字节数(用于显示 MB)。 */
  downloaded: number
  /** 总字节数。 */
  total: number
  /** 错误信息(error 时有值)。 */
  error: string | null
}

/** 初始状态。 */
const INITIAL_STATE: UpdaterState = {
  status: 'idle',
  session: null,
  progress: 0,
  downloaded: 0,
  total: 0,
  error: null,
}

/** 静默检查延迟(启动后 5 秒,避免与初始化竞争资源)。 */
const SILENT_CHECK_DELAY_MS = 5000

/** 安装完成后的自动重启倒计时(秒)。默认 60 秒,用户可在倒计时内选择"稍后重启"或"立即重启"。 */
export const RESTART_COUNTDOWN_SECONDS = 60

/** 更新安装完成、进入等待重启倒计时时派发的自定义事件名。UI(如 GlobalShell)可监听该事件显示提示。 */
export const UPDATER_PENDING_EVENT = 'desktop-updater-pending'

/**
 * 开发环境测试模式:
 * - 仅当 URL 带 ?dev-update=1 时启用 mock 会话(浏览器 dev 环境)
 * - Tauri 环境必须显式加 ?dev-update=1 才启用测试
 * 2026-08-16 修复:此前 Tauri 分支自动 return true,但 macOS/Linux 生产 origin
 * 是 tauri://localhost(hostname === 'localhost'),被误判为开发 → mock 替代真实
 * updater → 生产版本更新失效。改为不依赖 hostname,生产永不误判。
 */
function isDevUpdateTest(): boolean {
  if (typeof window === 'undefined') return false
  const devParam = new URLSearchParams(window.location.search).get('dev-update')
  if (devParam !== '1') return false
  // Tauri 环境:显式参数 + 本地 origin 才视为开发测试
  if (isTauri()) return true
  // 浏览器环境:仅 localhost 允许 mock 测试
  return (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  )
}

/** 模拟更新会话(开发测试用,15.2MB 假包,~4s 下载完)。 */
function createMockSession(): UpdateSession {
  const total = Math.round(15.2 * 1024 * 1024)
  return {
    info: {
      version: '0.2.0',
      date: new Date().toISOString(),
      notes: '新增更新推送功能,支持下拉窗提示和精美动画按钮\n优化桌面端启动性能\n修复若干已知问题',
    },
    downloadAndInstall: async (onProgress?: (p: UpdateProgress) => void) => {
      let downloaded = 0
      onProgress?.({ downloaded: 0, total })
      const chunkSize = total / 25
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 150))
        downloaded = Math.min(downloaded + chunkSize, total)
        onProgress?.({ downloaded, total })
      }
      onProgress?.({ downloaded: total, total })
    },
  }
}

/**
 * useUpdater — 桌面端应用更新状态机(2026-07-31 立,平台独占:仅桌面端)。
 *
 * 状态流转:
 *   idle → checking → (available | idle) → downloading → installing → done → (restart)
 *   任意阶段失败 → error → idle
 *
 * 触发来源:
 * - 启动静默检查 + 自动下载安装(挂载后 5s 自动 check + autoInstall,发现更新直接下载)
 * - 托盘菜单 "检查更新"(desktop-check-update 事件,手动检查不自动安装,显示弹窗)
 * - 组件手动触发 checkForUpdate()
 *
 * 强制自动更新策略(2026-07-31 立,无需用户点击任何按钮):
 * - 打开程序:启动 5s 后静默检查,发现更新自动下载安装,完成后 60 秒倒计时自动重启
 *   (2026-08-16 改:倒计时期间用户可点"稍后重启"重置倒计时,或"立即重启"直接重启)
 * - 关闭程序:由 quitAndUpdateIfNeeded() 拦截退出流程,自动检查+下载+安装+重启(不可跳过)
 * - 使用中:托盘菜单触发或启动检查,自动下载安装,完成后 60 秒倒计时自动重启,弹窗展示进度
 * - 更新失败:自动重试(最多 3 次,间隔 5 秒),超过后显示错误信息
 *
 * 浏览器端 isTauri()=false,此 hook 不执行任何副作用,返回 idle 状态。
 */
export function useUpdater() {
  const [state, setState] = React.useState<UpdaterState>(INITIAL_STATE)
  const mountedRef = React.useRef(true)
  /** 自动重试计数(错误后自动重试,最多 3 次)。 */
  const [retryCount, setRetryCount] = React.useState(0)
  /** 安装完成后距自动重启的剩余秒数(0 表示未进入等待重启倒计时)。 */
  const [restartCountdown, setRestartCountdown] = React.useState(0)
  /** 自动重启倒计时定时器(到 0 时执行 restartApp)。 */
  const restartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 剩余秒数递减定时器(每秒 -1)。 */
  const countdownTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  /** 清除自动重启相关定时器(幂等)。 */
  const clearRestartTimers = React.useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [])

  /**
   * 启动一轮自动重启倒计时(默认 60 秒):
   * 先通过 UPDATER_PENDING_EVENT 通知 UI(UpdatePrompt 直接消费返回值,其它组件可监听该事件),
   * 每秒递减剩余秒数,倒计时结束自动重启;期间用户可调用 restartNow / postponeRestart。
   */
  const startRestartCountdown = React.useCallback(() => {
    clearRestartTimers()
    setRestartCountdown(RESTART_COUNTDOWN_SECONDS)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(UPDATER_PENDING_EVENT, {
          detail: { remainingSeconds: RESTART_COUNTDOWN_SECONDS },
        }),
      )
    }
    countdownTimerRef.current = setInterval(() => {
      setRestartCountdown((c) => (c > 0 ? c - 1 : 0))
    }, 1000)
    restartTimerRef.current = setTimeout(() => {
      if (isDevUpdateTest()) {
        setState(INITIAL_STATE)
        return
      }
      void restartApp()
    }, RESTART_COUNTDOWN_SECONDS * 1000)
  }, [])

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /** 检查更新。silent=true 时不显示 error(静默启动检查)。autoInstall=true 时发现更新后自动下载安装。 */
  const checkForUpdate = React.useCallback(async (silent = false, autoInstall = false) => {
    // 开发测试模式:不依赖 Tauri,直接返回模拟更新
    if (isDevUpdateTest()) {
      setState({ ...INITIAL_STATE, status: 'checking' })
      await new Promise((r) => setTimeout(r, 800))
      if (!mountedRef.current) return
      const mockSession = createMockSession()
      if (autoInstall) {
        // 自动安装:跳过 available 状态,直接进入下载
        setAvailableUpdateSession(mockSession)
        void startDownload(mockSession)
      } else {
        setAvailableUpdateSession(mockSession)
        setState({ ...INITIAL_STATE, status: 'available', session: mockSession })
      }
      return
    }

    if (!isTauri()) return
    setState({ ...INITIAL_STATE, status: 'checking' })
    const session = await checkForUpdates()
    if (!mountedRef.current) return
    if (!session) {
      // 已是最新或检查失败
      setAvailableUpdateSession(null)
      setState({ ...INITIAL_STATE, status: 'idle', error: silent ? null : 'check_failed' })
      return
    }
    if (autoInstall) {
      // 自动安装:跳过 available 状态,直接进入下载
      setAvailableUpdateSession(session)
      void startDownload(session)
    } else {
      setAvailableUpdateSession(session)
      setState({
        ...INITIAL_STATE,
        status: 'available',
        session,
      })
    }
  }, [])

  /** 下载并安装更新(内部核心逻辑,接受 session 参数避免依赖异步 state)。 */
  const startDownload = React.useCallback(async (session: UpdateSession) => {
    setState((prev) => ({ ...prev, status: 'downloading', progress: 0 }))
    try {
      await session.downloadAndInstall((p: UpdateProgress) => {
        if (!mountedRef.current) return
        const ratio = p.total > 0 ? p.downloaded / p.total : 0
        setState((prev) => ({
          ...prev,
          status: 'downloading',
          progress: ratio,
          downloaded: p.downloaded,
          total: p.total,
        }))
      })
      if (!mountedRef.current) return
      // 安装完成,标记待重启(供退出时自动更新使用)
      markUpdateInstalled()
      setAvailableUpdateSession(null)
      setState((prev) => ({ ...prev, status: 'installing', progress: 1 }))
      // 安装完成,等待用户点击重启或自动重启
      setState((prev) => ({ ...prev, status: 'done' }))
    } catch (e) {
      if (!mountedRef.current) return
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      }))
    }
  }, [])

  /** 下载并安装更新(公开方法,使用当前 state 中的 session)。 */
  const downloadAndInstall = React.useCallback(async () => {
    if (!state.session) return
    await startDownload(state.session)
  }, [state.session, startDownload])

  /** 重启应用(安装完成后调用)。 */
  const restart = React.useCallback(async () => {
    if (isDevUpdateTest()) {
      setState(INITIAL_STATE)
      return
    }
    await restartApp()
  }, [])

  /** 关闭提示(回到 idle)。 */
  const dismiss = React.useCallback(() => {
    setAvailableUpdateSession(null)
    setState(INITIAL_STATE)
  }, [])

  // 启动静默检查 + 自动下载安装(Tauri 环境 5 秒后,开发测试模式 1 秒后)
  // autoInstall=true:发现更新后自动开始下载安装,不需要用户手动点击"立即更新"
  React.useEffect(() => {
    if (isDevUpdateTest()) {
      const timer = setTimeout(() => void checkForUpdate(true, true), 1000)
      return () => clearTimeout(timer)
    }
    if (!isTauri()) return
    const timer = setTimeout(() => {
      void checkForUpdate(true, true)
    }, SILENT_CHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [checkForUpdate])

  // 监听托盘菜单 "检查更新" 事件(由 useDesktopEvents 转发的 CustomEvent)
  React.useEffect(() => {
    if (!isTauri() && !isDevUpdateTest()) return
    const handler = () => void checkForUpdate(true, true)
    window.addEventListener('desktop-check-update', handler)
    return () => window.removeEventListener('desktop-check-update', handler)
  }, [checkForUpdate])

  // 安装完成自动重启:默认 60 秒倒计时(不再 3 秒强杀),期间用户可选择"稍后重启"或"立即重启"
  React.useEffect(() => {
    if (state.status !== 'done') return
    startRestartCountdown()
    return () => clearRestartTimers()
  }, [state.status, startRestartCountdown, clearRestartTimers])

  /** 稍后重启:重置一轮自动重启倒计时(再给 60 秒),并再次通知 UI。 */
  const postponeRestart = React.useCallback(() => {
    startRestartCountdown()
  }, [startRestartCountdown])

  /** 立即重启应用(用户点击"立即重启"或倒计时结束前的主动重启)。 */
  const restartNow = React.useCallback(async () => {
    clearRestartTimers()
    setRestartCountdown(0)
    setState(INITIAL_STATE)
    if (isDevUpdateTest()) return
    await restartApp()
  }, [])

  // 更新失败自动重试(强制更新:最多重试 3 次,每次间隔 5 秒)
  React.useEffect(() => {
    if (state.status !== 'error') return
    if (retryCount >= 3) return
    const timer = setTimeout(() => {
      setRetryCount((c) => c + 1)
      void checkForUpdate(true, true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [state.status, retryCount, checkForUpdate])

  // 下载开始时重置重试计数
  React.useEffect(() => {
    if (state.status === 'downloading') {
      setRetryCount(0)
    }
  }, [state.status])

  // 重试耗尽后自动关闭错误提示(10 秒后回到 idle,不影响用户继续使用)
  React.useEffect(() => {
    if (state.status !== 'error') return
    if (retryCount < 3) return
    const timer = setTimeout(() => {
      setState(INITIAL_STATE)
      setRetryCount(0)
    }, 10000)
    return () => clearTimeout(timer)
  }, [state.status, retryCount])

  return {
    ...state,
    retryCount,
    maxRetries: 3,
    restartCountdown,
    checkForUpdate,
    downloadAndInstall,
    restart,
    restartNow,
    postponeRestart,
    dismiss,
  }
}
