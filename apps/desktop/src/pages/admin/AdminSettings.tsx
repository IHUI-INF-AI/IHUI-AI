/**
 * AdminSettings — 系统设置(2 个 Tab:系统配置 / 操作日志)。
 * 数据源:`adminGetConfig` / `adminUpdateConfig` / `listSystemOperationLogs`。
 */
import { useEffect, useState } from 'react'
import {
  adminGetConfig,
  adminUpdateConfig,
  listSystemOperationLogs,
  type AdminConfig,
} from '@ihui/api-client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ihui/ui'

type Section = 'config' | 'logs'

interface ConfigRow {
  key: string
  value: string
}

function configToRows(cfg: AdminConfig): ConfigRow[] {
  return Object.entries(cfg)
    .filter(([, v]) => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    .map(([k, v]) => ({ key: k, value: v === null ? '' : String(v) }))
}

function rowsToConfig(rows: ConfigRow[]): AdminConfig {
  const out: AdminConfig = {}
  rows.forEach((r) => {
    if (!r.key) return
    if (r.value === 'true') out[r.key] = true
    else if (r.value === 'false') out[r.key] = false
    else if (r.value !== '' && !Number.isNaN(Number(r.value))) out[r.key] = Number(r.value)
    else out[r.key] = r.value
  })
  return out
}

export default function AdminSettings() {
  const [section, setSection] = useState<Section>('config')
  const [rows, setRows] = useState<ConfigRow[]>([])
  const [logs, setLogs] = useState<Array<{ id: string | number; createdAt?: string; [k: string]: unknown }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = () => {
    setLoading(true)
    setMessage('')
    void (async () => {
      const [c, l] = await Promise.all([adminGetConfig(), listSystemOperationLogs({ page: 1, pageSize: 20 })])
      if (c.success) setRows(configToRows(c.data))
      if (l.success) setLogs(l.data.list)
      setLoading(false)
    })()
  }

  useEffect(() => {
    load()
  }, [])

  const onSave = async () => {
    setSaving(true)
    setMessage('')
    const res = await adminUpdateConfig(rowsToConfig(rows))
    setSaving(false)
    if (res.success) setMessage('已保存')
    else setMessage(res.error || '保存失败')
  }

  const onChangeRow = (idx: number, patch: Partial<ConfigRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const onAddRow = () => {
    setRows((prev) => [...prev, { key: '', value: '' }])
  }

  const onRemoveRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="admin-page" data-testid="admin-settings">
      <header className="admin-page-header">
        <h2>系统设置</h2>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>配置 / 日志</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={section} onValueChange={(v) => setSection(v as Section)}>
            <TabsList>
              <TabsTrigger value="config" data-testid="admin-settings-tab-config">系统配置</TabsTrigger>
              <TabsTrigger value="logs" data-testid="admin-settings-tab-logs">操作日志</TabsTrigger>
            </TabsList>
            <TabsContent value="config">
              {loading ? (
                <div className="empty-state">加载中...</div>
              ) : (
                <>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '30%' }}>键</th>
                        <th>值</th>
                        <th style={{ width: 60 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => (
                        <tr key={`${r.key}-${idx}`}>
                          <td>
                            <input
                              value={r.key}
                              onChange={(e) => onChangeRow(idx, { key: e.target.value })}
                              className="admin-cell-input"
                              data-testid={`admin-config-key-${idx}`}
                            />
                          </td>
                          <td>
                            <input
                              value={r.value}
                              onChange={(e) => onChangeRow(idx, { value: e.target.value })}
                              className="admin-cell-input"
                              data-testid={`admin-config-value-${idx}`}
                            />
                          </td>
                          <td>
                            <button type="button" className="danger" onClick={() => onRemoveRow(idx)}>
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="admin-toolbar" style={{ marginTop: 12 }}>
                    <button type="button" onClick={onAddRow}>新增</button>
                    <button type="button" onClick={onSave} disabled={saving} data-testid="admin-config-save">
                      {saving ? '保存中...' : '保存'}
                    </button>
                    {message ? <span className="admin-muted">{message}</span> : null}
                  </div>
                </>
              )}
            </TabsContent>
            <TabsContent value="logs">
              {loading ? (
                <div className="empty-state">加载中...</div>
              ) : logs.length === 0 ? (
                <div className="empty-state">暂无日志</div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>操作</th>
                      <th>用户</th>
                      <th>资源</th>
                      <th>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={String(log.id)}>
                        <td className="admin-mono">{String(log.id)}</td>
                        <td>{String((log as { action?: string }).action ?? '—')}</td>
                        <td>{String((log as { userNickname?: string }).userNickname ?? '—')}</td>
                        <td>{String((log as { resource?: string }).resource ?? '—')}</td>
                        <td className="admin-muted">
                          {log.createdAt
                            ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.createdAt))
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
