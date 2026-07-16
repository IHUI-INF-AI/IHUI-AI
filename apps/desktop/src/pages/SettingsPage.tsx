import { useOutletContext } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, Switch } from '@ihui/ui'
import { clearToken } from '../lib/token'
import { useState } from 'react'

interface Ctx {
  onLogout: () => void
}

export default function SettingsPage() {
  const { onLogout } = useOutletContext<Ctx>()
  const [dark, setDark] = useState(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  )

  const onToggleTheme = (v: boolean) => {
    setDark(v)
    document.documentElement.dataset.theme = v ? 'dark' : 'light'
  }

  const onClearCache = () => {
    if (!confirm('确定清空本地缓存吗?')) return
    try {
      localStorage.clear()
      alert('已清空')
    } catch {
      alert('清空失败')
    }
  }

  return (
    <div className="page page-settings">
      <header className="page-header">
        <h2>设置</h2>
      </header>
      <div className="settings-list">
        <Card>
          <CardHeader>
            <CardTitle>外观</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>深色模式</span>
              <Switch checked={dark} onCheckedChange={onToggleTheme} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>数据</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>清空本地缓存</span>
              <button type="button" onClick={onClearCache}>
                清空
              </button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>账户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>退出登录</span>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  clearToken()
                  onLogout()
                }}
              >
                退出
              </button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>关于</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="about">
              <p>IHUI AI 桌面端</p>
              <p className="muted">Tauri 2 + React + @ihui/ui + @ihui/api-client</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
