// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-28 V3 #72 —— 桌面宿主 git 通道的消费侧 hook(授权当前 workspace → 取变更清单)。
//
// 这里**不重新判定**任何东西:三态结论(`facts` / `command_failed` / `undetermined`)逐字
// 来自宿主 `git_channel_ipc.rs`。本 hook 只负责这么几件事:① 何时发请求(status/diff/
// index 各走各的);② 把宿主的 Err(与三态并列的"通道层面失败")单独存一格;③ 保证
// "没拿到结论"永远不等于"没有改动/没有差异/目录为空";④ 索引 delta 的 previous 快照
// 由前端 ref 持有(宿主刻意不存会话态),换根即作废。
//
// 为什么必须有第 ② 条:`requireTauri()` 在非宿主里抛错、宿主越界授权也抛 Err,这两种情况
// 若被 catch 成 `status=null`,界面上就和"还没点授权"同形 —— 那是把三种不同的事实压成一格。

'use client'

import * as React from 'react'

import {
  gitAuthorizeWorkspace,
  gitChannelInfo,
  gitWorkspaceDiff,
  gitWorkspaceStatus,
  isTauri,
  workspaceIndexScan,
  type GitChannelInfoReply,
  type GitWorkspaceDiffReply,
  type GitWorkspaceStatusReply,
  type WorkspaceIndexEntry,
  type WorkspaceIndexReply,
} from '@/lib/tauri-bridge'

/** 通道层面失败(与宿主返回的三态**并列**,不是第四态:它意味着一条结论都没拿到)。 */
export interface HostGitChannelError {
  /**
   * `not-in-host` = 当前不在桌面宿主内;`host-rejected` = 宿主把本次调用拒了。
   * 界面对这两种格各走自己的 i18n 词条,所以这里**不写给人看的中文散文**
   * (§19:界面文案一律走语言包;`message` 只装宿主原样回传的诊断文本)。
   */
  kind: 'not-in-host' | 'host-rejected'
  message: string
}

export interface UseHostGitWorkspaceResult {
  /** 当前是否在桌面宿主里(浏览器下整块能力不适用,界面据此不渲染) */
  inHost: boolean
  /** 上一次拿到的三态结论;null = 还一条都没取到(≠ 干净) */
  status: GitWorkspaceStatusReply | null
  /** 通道自述(git 二进制 / 允许 base);null = 未取到 */
  info: GitChannelInfoReply | null
  error: HostGitChannelError | null
  busy: 'authorize' | 'refresh' | 'info' | 'diff' | 'index' | null
  /** 上一次拿到的差异结论;null = 本次会话还没点开过差异(≠ 无差异) */
  diff: GitWorkspaceDiffReply | null
  /** 上一次拿到的索引结论;null = 还没扫过(≠ 目录为空) */
  index: WorkspaceIndexReply | null
  authorize: (root: string) => Promise<void>
  refresh: () => Promise<void>
  /** 取差异(传 path 收窄到单路径);结论存 diff,失败存 error,不清 status */
  getDiff: (path?: string) => Promise<void>
  /** 扫文件索引;上次 facts 的 entries 自动作为 previous 传入,结论存 index */
  scanIndex: () => Promise<void>
  /** 收起差异面板(只清 diff 格,不动 status/index) */
  clearDiff: () => void
}

function toChannelError(kind: HostGitChannelError['kind'], err: unknown): HostGitChannelError {
  // invoke() 在 Rust 侧 Err(String) 时 reject 的是那个字符串本身,不是 Error 实例
  const message =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : 'unspecified-host-channel-failure'
  return { kind, message }
}

export function useHostGitWorkspace(): UseHostGitWorkspaceResult {
  const inHost = React.useMemo(() => isTauri(), [])
  const [status, setStatus] = React.useState<GitWorkspaceStatusReply | null>(null)
  const [info, setInfo] = React.useState<GitChannelInfoReply | null>(null)
  const [error, setError] = React.useState<HostGitChannelError | null>(null)
  const [busy, setBusy] = React.useState<'authorize' | 'refresh' | 'info' | 'diff' | 'index' | null>(
    null,
  )
  const [diff, setDiff] = React.useState<GitWorkspaceDiffReply | null>(null)
  const [index, setIndex] = React.useState<WorkspaceIndexReply | null>(null)
  // 上一次 facts 索引快照(ref 而非 state:它是 scanIndex 的入参,不该触发重渲染)。
  // 宿主刻意不存会话态,delta 的基准只能由前端持有。
  const prevIndexRef = React.useRef<WorkspaceIndexEntry[]>([])

  const loadInfo = React.useCallback(async () => {
    if (!isTauri()) {
      setError(toChannelError('not-in-host', 'outside-tauri-host'))
      return
    }
    setBusy('info')
    try {
      setInfo(await gitChannelInfo())
      setError(null)
    } catch (err) {
      setError(toChannelError('host-rejected', err))
    } finally {
      setBusy(null)
    }
  }, [])

  const refresh = React.useCallback(async () => {
    if (!isTauri()) {
      setError(toChannelError('not-in-host', 'outside-tauri-host'))
      return
    }
    setBusy('refresh')
    try {
      const reply = await gitWorkspaceStatus()
      setStatus(reply)
      setError(null)
    } catch (err) {
      // 未授权 / 宿主拒绝:结论**不能**留在上一次那份清单上冒充"已刷新过"
      setStatus(null)
      setError(toChannelError('host-rejected', err))
    } finally {
      setBusy(null)
    }
  }, [])

  const authorize = React.useCallback(
    async (root: string) => {
      if (!isTauri()) {
        setError(toChannelError('not-in-host', 'outside-tauri-host'))
        return
      }
      setBusy('authorize')
      try {
        // 授权成功后**立刻**带回一份清单:宿主在同一次调用里就做了状态判定,
        // 再发一次 status 请求只会多出"两次结论不一致"的窗口。
        setStatus(await gitAuthorizeWorkspace(root))
        setError(null)
        setInfo(await gitChannelInfo())
        // 根变了(或重新授权):旧根的索引快照与结论全部作废,不许跨根冒充
        setDiff(null)
        setIndex(null)
        prevIndexRef.current = []
      } catch (err) {
        setStatus(null)
        setError(toChannelError('host-rejected', err))
      } finally {
        setBusy(null)
      }
    },
    [],
  )

  const getDiff = React.useCallback(async (path?: string) => {
    if (!isTauri()) {
      setError(toChannelError('not-in-host', 'outside-tauri-host'))
      return
    }
    setBusy('diff')
    try {
      setDiff(await gitWorkspaceDiff(path))
      setError(null)
    } catch (err) {
      // 差异这一格自己的失败:清 diff(不许上次正文冒充本次),不动 status/index
      setDiff(null)
      setError(toChannelError('host-rejected', err))
    } finally {
      setBusy(null)
    }
  }, [])

  const scanIndex = React.useCallback(async () => {
    if (!isTauri()) {
      setError(toChannelError('not-in-host', 'outside-tauri-host'))
      return
    }
    setBusy('index')
    try {
      const reply = await workspaceIndexScan(
        prevIndexRef.current.length > 0 ? prevIndexRef.current : undefined,
      )
      setIndex(reply)
      setError(null)
      if (reply.state === 'facts') prevIndexRef.current = reply.entries
    } catch (err) {
      setIndex(null)
      setError(toChannelError('host-rejected', err))
    } finally {
      setBusy(null)
    }
  }, [])

  const clearDiff = React.useCallback(() => setDiff(null), [])

  // 进面板即取一次通道自述:它不需要授权,且能把"为什么判不了"的候选路径先摊开
  React.useEffect(() => {
    if (inHost) void loadInfo()
  }, [inHost, loadInfo])

  return {
    inHost,
    status,
    info,
    error,
    busy,
    diff,
    index,
    authorize,
    refresh,
    getDiff,
    scanIndex,
    clearDiff,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
