// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export interface Session {
  id: string
  title: string
  workspace: string
  updatedAt: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  at: number
}

export interface Theme {
  mode: 'light' | 'dark'
  setMode: (m: 'light' | 'dark') => void
}

export interface Shell {
  sessions: Session[]
  activeSessionId: string
  setActiveSessionId: (id: string) => void
  newSession: () => void
  messagesBySession: Record<string, ChatMessage[]>
  messages: ChatMessage[]
  send: (text: string) => void
}

export const ThemeContext = createContext<Theme | null>(null)
export const ShellContext = createContext<Shell | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme outside provider')
  return ctx
}

export function useShell() {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell outside provider')
  return ctx
}

let seq = 0
function uid(prefix: string) {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq}`
}

function initialSessions(): Session[] {
  return [
    {
      id: 's1',
      title: '新会话',
      workspace: '默认工作区',
      updatedAt: Date.now(),
    },
  ]
}

function initialMessages(): Record<string, ChatMessage[]> {
  // 原版首屏：空白欢迎态（hero + composer），不预置任何消息
  return {}
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light')
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [activeSessionId, setActiveSessionId] = useState('s1')
  const [messagesBySession, setMessagesBySession] =
    useState<Record<string, ChatMessage[]>>(initialMessages)

  useEffect(() => {
    const root = document.documentElement
    if (mode === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }, [mode])

  const newSession = useCallback(() => {
    const id = uid('s')
    setSessions((prev) => [
      ...prev,
      {
        id,
        title: `新会话 ${prev.length + 1}`,
        workspace: '默认工作区',
        updatedAt: Date.now(),
      },
    ])
    setActiveSessionId(id)
    setMessagesBySession((prev) => ({
      ...prev,
      // 原版新会话是空白欢迎态（仅 hero + composer），不预置任何消息
      [id]: [],
    }))
  }, [])

  const send = useCallback(
    (text: string) => {
      const t = text.trim()
      if (!t) return
      const id = activeSessionId
      setMessagesBySession((prev) => {
        const list = prev[id] ?? []
        const next = [
          ...list,
          { id: uid('m'), role: 'user' as const, content: t, at: Date.now() },
          {
            id: uid('m'),
            role: 'assistant' as const,
            content:
              '已收到你的消息。这是一个界面复刻演示：左侧可以新建/切换会话，右侧是工作区文件树，底部终端可以折叠展开。',
            at: Date.now(),
          },
        ]
        return { ...prev, [id]: next }
      })
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, updatedAt: Date.now() } : s)))
    },
    [activeSessionId],
  )

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      <ShellContext.Provider
        value={{
          sessions,
          activeSessionId,
          setActiveSessionId,
          newSession,
          messagesBySession,
          messages: messagesBySession[activeSessionId] ?? [],
          send,
        }}
      >
        {children}
      </ShellContext.Provider>
    </ThemeContext.Provider>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
