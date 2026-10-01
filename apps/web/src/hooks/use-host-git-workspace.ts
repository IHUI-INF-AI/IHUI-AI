// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-28 V3 #72 —— 桌面宿主 git 通道的消费侧 hook(授权当前 workspace → 取变更清单)。
//
// 这里**不重新判定**任何东西:三态结论(`facts` / `command_failed` / `undetermined`)逐字
// 来自宿主 `git_channel_ipc.rs`。本 hook 只负责三件事:① 何时发请求;② 把宿主的 Err(
// 与三态并列的第四种"通道层面失败")单独存一格;③ 保证"没拿到结论"永远不等于"没有改动"。
//
// 为什么必须有第 ② 条:`requireTauri()` 在非宿主里抛错、宿主越界授权也抛 Err,这两种情况
// 若被 catch 成 `status=null`,界面上就和"还没点授权"同形 —— 那是把三种不同的事实压成一格。

'use client'

import * as React from 'react'

import {
  gitAuthorizeWorkspace,
  gitChannelInfo,
  gitWorkspaceStatus,
  isTauri,
  type GitChannelInfoReply,
  type GitWorkspaceStatusReply,
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
  busy: 'authorize' | 'refresh' | 'info' | null
  authorize: (root: string) => Promise<void>
  refresh: () => Promise<void>
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
  const [busy, setBusy] = React.useState<'authorize' | 'refresh' | 'info' | null>(null)

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
      } catch (err) {
        setStatus(null)
        setError(toChannelError('host-rejected', err))
      } finally {
        setBusy(null)
      }
    },
    [],
  )

  // 进面板即取一次通道自述:它不需要授权,且能把"为什么判不了"的候选路径先摊开
  React.useEffect(() => {
    if (inHost) void loadInfo()
  }, [inHost, loadInfo])

  return { inHost, status, info, error, busy, authorize, refresh }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
