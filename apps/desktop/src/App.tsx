import { useEffect, useState } from 'react'
import { setBaseUrl, setTokenProvider, streamChat, type StreamChatOptions } from '@ihui/api-client'
import './app.css'

const API_BASE_URL = 'http://127.0.0.1:3001'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const TOKEN_KEY = 'ihui-desktop-token'

function getStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function persistToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

setBaseUrl(API_BASE_URL)
setTokenProvider({ getToken: getStoredToken })

export default function App() {
  const [token, setToken] = useState<string>(getStoredToken)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [logging, setLogging] = useState(false)
  const [loginError, setLoginError] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [model] = useState('stepfun/step-3.7-flash')

  useEffect(() => {
    document.title = 'IHUI AI 桌面端'
  }, [])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || !code) {
      setLoginError('请输入手机号与验证码')
      return
    }
    setLogging(true)
    setLoginError('')
    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/login/phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        throw new Error(text || `登录失败 (${resp.status})`)
      }
      const json = await resp.json()
      const newToken = json?.data?.token ?? json?.token ?? ''
      if (!newToken) throw new Error('响应缺少 token')
      persistToken(newToken)
      setToken(newToken)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLogging(false)
    }
  }

  const onLogout = () => {
    persistToken('')
    setToken('')
    setMessages([])
  }

  const onSend = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    const next: Message[] = [
      ...messages,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ]
    setMessages(next)
    setStreaming(true)
    const controller = new AbortController()
    const opts: StreamChatOptions = {
      model,
      messages: next.slice(0, -1),
      signal: controller.signal,
      onDelta: (delta) => {
        setMessages((cur) => {
          const copy = [...cur]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: last.content + delta }
          }
          return copy
        })
      },
      onError: (msg) => {
        setMessages((cur) => {
          const copy = [...cur]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: last.content || `⚠ ${msg}` }
          }
          return copy
        })
        setStreaming(false)
      },
      onDone: () => setStreaming(false),
    }
    await streamChat(opts)
  }

  const onStop = () => {
    setStreaming(false)
  }

  if (!token) {
    return (
      <main className="shell">
        <form className="card" onSubmit={onLogin}>
          <h1>IHUI AI 桌面端</h1>
          <p className="hint">登录后开始 AI 对话</p>
          <label>
            手机号
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
              autoComplete="tel"
              disabled={logging}
            />
          </label>
          <label>
            验证码
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6 位验证码"
              maxLength={6}
              disabled={logging}
            />
          </label>
          {loginError && <p className="error">{loginError}</p>}
          <button type="submit" disabled={logging}>
            {logging ? '登录中…' : '登录'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="shell chat">
      <header className="topbar">
        <span className="brand">IHUI AI</span>
        <span className="model">{model}</span>
        <button type="button" className="link" onClick={onLogout}>
          退出
        </button>
      </header>
      <section className="messages">
        {messages.length === 0 && <p className="placeholder">向 IHUI 提问,流式输出回复</p>}
        {messages.map((m, i) => (
          <article key={i} className={`msg ${m.role}`}>
            <div className="role">{m.role === 'user' ? '你' : 'AI'}</div>
            <div className="bubble">
              {m.content || (streaming && i === messages.length - 1 ? '●' : '')}
            </div>
          </article>
        ))}
      </section>
      <footer className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void onSend()
            }
          }}
          placeholder="输入消息 (Cmd/Ctrl+Enter 发送)"
          rows={3}
          disabled={streaming}
        />
        {streaming ? (
          <button type="button" onClick={onStop}>
            停止
          </button>
        ) : (
          <button type="button" onClick={() => void onSend()} disabled={!input.trim()}>
            发送
          </button>
        )}
      </footer>
    </main>
  )
}
