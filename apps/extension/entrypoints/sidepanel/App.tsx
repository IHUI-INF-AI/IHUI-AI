import { useEffect, useRef, useState } from 'react'
import { fetchApi, streamChat } from '@ihui/api-client'
import { initApi, setToken, getToken } from '../../lib/token'

interface TokenPayload {
  accessToken: string
  user: { id: string; username: string; nickname: string; avatar: string | null }
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const MODEL = 'stepfun/step-3.7-flash'

export default function App() {
  const [ready, setReady] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [chatError, setChatError] = useState('')

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    initApi().then(() => {
      setLoggedIn(!!getToken())
      setReady(true)
    })
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const handleLogin = async () => {
    if (!account || !password) {
      setLoginError('请输入账号和密码')
      return
    }
    setLoading(true)
    setLoginError('')
    try {
      const res = await fetchApi<TokenPayload>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ account, password }),
      })
      if (res.success) {
        await setToken(res.data.accessToken)
        setLoggedIn(true)
      } else {
        setLoginError(res.error)
      }
    } catch {
      setLoginError('网络异常')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    if (abortRef.current) abortRef.current.abort()
    await setToken(null)
    setLoggedIn(false)
    setAccount('')
    setPassword('')
    setMessages([])
    setInputText('')
    setChatError('')
  }

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || isStreaming) return
    setInputText('')
    setChatError('')

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '' }

    const history = [...messages, userMsg]
    setMessages([...history, aiMsg])
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamChat({
        model: MODEL,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        signal: controller.signal,
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsg.id ? { ...m, content: m.content + delta } : m)),
          )
        },
        onError: (err) => {
          setChatError(err)
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.role === 'assistant' && last.content === '') {
              return prev.slice(0, -1)
            }
            return prev
          })
        },
        onDone: () => {
          setIsStreaming(false)
        },
      })
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!ready) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        加载中...
      </div>
    )
  }

  if (!loggedIn) {
    return (
      <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 18, margin: '0 0 16px' }}>IHUI AI 助手</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            placeholder="账号 / 手机号 / 邮箱"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          />
          {loginError && <p style={{ color: '#dc2626', margin: 0, fontSize: 13 }}>{loginError}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              padding: 8,
              borderRadius: 4,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        background: '#f8fafc',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid #e2e8f0',
          background: '#fff',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>IHUI AI</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            borderRadius: 4,
            border: '1px solid #cbd5e1',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          退出
        </button>
      </header>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 32, fontSize: 13 }}>
            开始与 AI 对话吧
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: m.role === 'user' ? '#dbeafe' : '#e2e8f0',
              color: '#0f172a',
            }}
          >
            {m.content || (m.role === 'assistant' && isStreaming ? '思考中...' : '')}
          </div>
        ))}
        {chatError && (
          <p style={{ color: '#dc2626', fontSize: 12, margin: 0, alignSelf: 'center' }}>
            {chatError}
          </p>
        )}
      </div>

      <footer
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          borderTop: '1px solid #e2e8f0',
          background: '#fff',
        }}
      >
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息,Enter 发送,Shift+Enter 换行"
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            padding: 8,
            borderRadius: 4,
            border: '1px solid #cbd5e1',
            fontSize: 13,
            lineHeight: 1.4,
            fontFamily: 'inherit',
          }}
        />
        {isStreaming ? (
          <button
            onClick={handleStop}
            style={{
              padding: '0 14px',
              borderRadius: 4,
              border: 'none',
              background: '#dc2626',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            停止
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            style={{
              padding: '0 14px',
              borderRadius: 4,
              border: 'none',
              background: inputText.trim() ? '#2563eb' : '#94a3b8',
              color: '#fff',
              cursor: inputText.trim() ? 'pointer' : 'not-allowed',
              fontSize: 13,
            }}
          >
            发送
          </button>
        )}
      </footer>
    </div>
  )
}
