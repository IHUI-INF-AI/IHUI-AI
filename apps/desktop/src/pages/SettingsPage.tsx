import { useOutletContext } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, Switch } from '@ihui/ui'
import { clearToken } from '../lib/token'
import { useEffect, useState } from 'react'
import { useI18n, type Locale } from '../i18n'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { fetchApi } from '@ihui/api-client'
import { UpdateChecker } from '../components/UpdateChecker'
import { enableAutostart, disableAutostart, isAutostartEnabled, resetWindowState } from '../lib/desktop'

interface Ctx {
  onLogout: () => void
}

const localeOptions: { value: Locale; labelKey: string }[] = [
  { value: 'zh-CN', labelKey: 'setting.zhCN' },
  { value: 'en', labelKey: 'setting.en' },
  { value: 'ja', labelKey: 'setting.ja' },
  { value: 'ko', labelKey: 'setting.ko' },
  { value: 'zh-TW', labelKey: 'setting.zhTW' },
]

const IMPORT_SOURCES = [
  { value: 'cc-switch', label: 'cc-switch (.db / .json)' },
  { value: 'codex++', label: 'codex++ (settings.json)' },
  { value: 'claude-cli', label: 'Claude Code (settings.json)' },
  { value: 'codex-cli', label: 'Codex CLI (config.toml)' },
  { value: 'gemini-cli', label: 'Gemini CLI (.env)' },
  { value: 'hermes', label: 'Hermes (config.yaml)' },
  { value: 'env-file', label: '.env 通用配置' },
  { value: 'cursor', label: 'Cursor IDE (settings.json)' },
  { value: 'windsurf', label: 'Windsurf (settings.json)' },
  { value: 'cline', label: 'Cline (settings.json)' },
  { value: 'aider', label: 'Aider (.aider.conf.yml)' },
  { value: 'trae', label: 'Trae IDE (settings.json)' },
  { value: 'trae-work', label: 'Trae Work (settings.json)' },
  { value: 'qoder', label: 'Qoder (settings.json)' },
  { value: 'qoder-work', label: 'Qoder Work (settings.json)' },
  { value: 'codex-desktop', label: 'Codex Desktop (config.json)' },
  { value: 'claude-code-desktop', label: 'Claude Code Desktop (config.json)' },
  { value: 'github-copilot', label: 'GitHub Copilot (settings.json)' },
  { value: 'amazon-q', label: 'Amazon Q Developer (settings.json)' },
  { value: 'continue', label: 'Continue.dev (config.json)' },
  { value: 'tabnine', label: 'Tabnine (settings.json)' },
  { value: 'cody', label: 'Sourcegraph Cody (settings.json)' },
  { value: 'zed', label: 'Zed (settings.json)' },
  { value: 'antigravity', label: 'Google Antigravity (settings.json)' },
] as const

export default function SettingsPage() {
  const { onLogout } = useOutletContext<Ctx>()
  const { locale, setLocale, t } = useI18n()
  const [dark, setDark] = useState(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  )
  const [importSource, setImportSource] = useState<string>('cc-switch')
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState<string>('')
  const [autostart, setAutostart] = useState(false)
  const [resettingWindow, setResettingWindow] = useState(false)

  useEffect(() => {
    isAutostartEnabled()
      .then(setAutostart)
      .catch(() => setAutostart(false))
  }, [])

  const onResetWindowLayout = async () => {
    if (resettingWindow) return
    setResettingWindow(true)
    try {
      await resetWindowState()
      setImportMsg(t('desktop.windowResetDone'))
    } catch (err) {
      setImportMsg(`${t('desktop.windowResetFailed')}: ${(err as Error).message}`)
    } finally {
      setResettingWindow(false)
    }
  }

  const onToggleTheme = (v: boolean) => {
    setDark(v)
    document.documentElement.dataset.theme = v ? 'dark' : 'light'
  }

  const onToggleAutostart = async (v: boolean) => {
    try {
      if (v) await enableAutostart()
      else await disableAutostart()
      setAutostart(v)
    } catch (err) {
      alert(`${t('desktop.autostartToggleFailed')}: ${(err as Error).message}`)
    }
  }

  const onClearCache = () => {
    if (!confirm(t('setting.clearCacheConfirm'))) return
    try {
      localStorage.clear()
      alert(t('setting.cacheCleared'))
    } catch {
      alert(t('setting.clearCacheFailed'))
    }
  }

  const onImportCliConfig = async () => {
    setImportBusy(true)
    setImportMsg('')
    try {
      const filePath = await openDialog({
        multiple: false,
        directory: false,
      })
      if (!filePath || Array.isArray(filePath)) {
        setImportBusy(false)
        return
      }
      const fileBytes = await readFile(filePath as string)
      const fd = new FormData()
      fd.append('source', importSource)
      const blob = new Blob([fileBytes])
      fd.append('file', blob, (filePath as string).split(/[\\/]/).pop() || 'config')

      const parseRes = await fetchApi<{ preview: { previewId: string; providers: unknown[] } }>(
        '/api/user/cli-import/parse-file',
        { method: 'POST', body: fd },
      )
      if (!parseRes.success) {
        setImportMsg(`解析失败: ${parseRes.error}`)
        setImportBusy(false)
        return
      }
      const preview = parseRes.data.preview
      const commitRes = await fetchApi<{ imported: number; skipped: number; failed: number }>(
        '/api/user/cli-import/commit',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            previewId: preview.previewId,
            selectedProviderIds: [],
            conflictStrategy: 'skip',
          }),
        },
      )
      if (!commitRes.success) {
        setImportMsg(`导入失败: ${commitRes.error}`)
      } else {
        const r = commitRes.data
        setImportMsg(`导入完成:成功 ${r.imported},跳过 ${r.skipped},失败 ${r.failed}`)
      }
    } catch (err) {
      setImportMsg(`异常: ${(err as Error).message}`)
    } finally {
      setImportBusy(false)
    }
  }

  return (
    <div className="page page-settings">
      <header className="page-header">
        <h2>{t('nav.settings')}</h2>
      </header>
      <div className="settings-list">
        <Card>
          <CardHeader>
            <CardTitle>{t('setting.language')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>{t('setting.language')}</span>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="locale-select"
              >
                {localeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('setting.appearance')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>{t('setting.darkMode')}</span>
              <Switch checked={dark} onCheckedChange={onToggleTheme} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('setting.data')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>{t('setting.clearCache')}</span>
              <button type="button" onClick={onClearCache}>
                {t('common.delete')}
              </button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>CLI 配置导入</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>来源</span>
              <select
                value={importSource}
                onChange={(e) => setImportSource(e.target.value)}
                className="locale-select"
              >
                {IMPORT_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="setting-row">
              <span>选择本地配置文件并导入</span>
              <button type="button" onClick={onImportCliConfig} disabled={importBusy}>
                {importBusy ? '导入中...' : '选择文件'}
              </button>
            </div>
            {importMsg && <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>{importMsg}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('setting.account')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>{t('auth.logout')}</span>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  clearToken()
                  onLogout()
                }}
              >
                {t('auth.logout')}
              </button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('desktop.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="setting-row">
              <span>{t('desktop.autostart')}</span>
              <Switch checked={autostart} onCheckedChange={onToggleAutostart} />
            </div>
            <div className="setting-row">
              <span>{t('desktop.shortcut')}</span>
              <span className="muted">Ctrl+Shift+I</span>
            </div>
            <div className="setting-row">
              <span>{t('desktop.windowLayout')}</span>
              <button
                type="button"
                onClick={() => void onResetWindowLayout()}
                disabled={resettingWindow}
                className="btn-secondary"
              >
                {resettingWindow ? t('common.loading') : t('desktop.resetWindowLayout')}
              </button>
            </div>
            {importMsg ? <div className="setting-msg">{importMsg}</div> : null}
          </CardContent>
        </Card>
        <UpdateChecker />
        <Card>
          <CardHeader>
            <CardTitle>{t('setting.about')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="about">
              <p>{t('setting.desktopApp')}</p>
              <p className="muted">Tauri 2 + React + @ihui/ui + @ihui/api-client</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
