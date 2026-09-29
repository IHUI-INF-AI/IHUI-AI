// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 RN 的 config(API_BASE_URL)与本端日志约定,不适合共享。
// 接线本体在 `src/lib/user-broadcast`(可被用例直接驱动),跨端判据在
// `@ihui/shared/chat/user-broadcast-store`(AGENTS §3 共享层优先)—— 本文件只是挂载点。

import { useEffect, useRef } from 'react'
import { conversationMetaLedger, mcpStatusLedger } from '@ihui/shared/chat'

import { API_BASE_URL } from '../lib/config'
import { attachUserBroadcast, resetBroadcastNotices } from '../lib/user-broadcast'

const LOG_TAG = '[user-broadcast]'

export interface UseUserBroadcastSyncOptions {
  /** 当前 access token(与挂载者同源:谁的登录态就是唯一真相) */
  token: string | null
  /** 取词口(`useI18n().t`) */
  translate: (key: string, params?: Record<string, string | number>) => string
  /** 本端已有提示口(FloatBox `showToast` 的适配);本文件不新立界面 */
  notify: (message: string) => void
}

/**
 * 挂载点:`apps/mobile-rn/src/screens/ChatScreen.tsx`(真正承载会话列表的那一层)。
 *
 * 依赖数组只有 token:`useI18n()` 交回的 `t` 每次渲染都是新函数(RN 侧 context value
 * 是渲染期新建的字面量),把它们放进依赖会让订阅在**每一次渲染**上重建 ——
 * 表现是连接反复断开重连,而 typecheck 与用例全都看不出来。取词与提示口走 ref。
 *
 * 登出清两张账本:账本是设备级的,而身份不是。
 */
export function useUserBroadcastSync(opts: UseUserBroadcastSyncOptions): void {
  const { token } = opts
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    if (!token) {
      conversationMetaLedger.clear()
      mcpStatusLedger.clear()
      resetBroadcastNotices()
      return
    }
    const sub = attachUserBroadcast({
      baseUrl: API_BASE_URL,
      token,
      translate: (key, params) => optsRef.current.translate(key, params),
      notify: (message) => optsRef.current.notify(message),
      // 本端没有 logger 出口(与 use-ui-control-bridge 同一约定:连接类失败只 console.warn,
      // 刷屏的 toast 会把"AI 在用"读成"手机坏了")。只打事件名,不打载荷内容。
      onUndetermined: (raw) => {
        const event =
          typeof raw === 'object' && raw !== null ? (raw as { event?: unknown }).event : undefined
        console.warn(
          // 日志行写成 ASCII:守门 70 对新增硬编码中文按文件 HEAD 存量棘轮(本文件基线 0),
          // 界面文案一律走 i18n,而 console 行不是界面文案 —— 写中文等于给自己加一笔红。
          `${LOG_TAG} unrecognized frame received: event=${typeof event === 'string' ? event : '-'}`,
        )
      },
    })
    return () => {
      sub?.close()
    }
  }, [token])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
