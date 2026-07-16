import { useOutletContext } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, Switch } from '@ihui/ui'
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

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <h3>设置</h3>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>外观</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="sp-setting-row">
            <span>深色模式</span>
            <Switch checked={dark} onCheckedChange={onToggleTheme} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>账户</CardTitle>
        </CardHeader>
        <CardContent>
          <button type="button" onClick={onLogout} className="sp-danger-btn">
            退出登录
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
