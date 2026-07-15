import { useEffect, useState } from 'react'
import { initApi, getToken } from '../../lib/token'

export default function App() {
  const [ready, setReady] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    initApi().then(() => {
      setLoggedIn(!!getToken())
      setReady(true)
    })
  }, [])

  if (!ready) {
    return <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>加载中...</div>
  }

  return (
    <div style={{ width: 280, padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ margin: 0, fontSize: 16, marginBottom: 8 }}>IHUI AI</h2>
      {loggedIn ? (
        <p style={{ margin: 0, color: '#16a34a' }}>已登录</p>
      ) : (
        <p style={{ margin: 0, color: '#666' }}>未登录,请打开侧边栏登录</p>
      )}
    </div>
  )
}
