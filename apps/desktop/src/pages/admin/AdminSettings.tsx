/**
 * AdminSettings — 系统设置(配置 CRUD + 操作日志)。
 *
 * 配置部分:
 *  - 加载 adminGetConfig → 渲染为键值对
 *  - 单击"新增"或行内"编辑"/"删除"通过 ConfigRowDialog 实装
 *  - "保存"调用 adminUpdateConfig 整批提交
 *  - "恢复默认"丢弃未保存修改并重新拉取
 * 日志部分:只读(继续走 listSystemOperationLogs)。
 */
import { useEffect, useRef, useState } from 'react'
import {
  adminGetConfig,
  adminUpdateConfig,
  listSystemOperationLogs,
  type AdminConfig,
} from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { useI18n } from '../../i18n'
import { ConfigRowDialog, type ConfigRowValues } from '../../components/admin/ConfigRowDialog'

type Section = 'config' | 'logs'

interface ConfigRow {
  /** local key in the rows array (stable for edit/delete) */
  localId: string
  key: string
  value: string
}

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' })

function configToRows(cfg: AdminConfig): ConfigRow[] {
  return Object.entries(cfg)
    .filter(([, v]) => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    .map(([k, v], idx) => ({ localId: `${k}-${idx}`, key: k, value: v === null ? '' : String(v) }))
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

interface LogRow {
  id: string | number
  createdAt?: string
  action?: string
  userNickname?: string
  resource?: string
}

export default function AdminSettings() {
  const { t } = useI18n()
  const [section, setSection] = useState<Section>('config')
  const [rows, setRows] = useState<ConfigRow[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add')
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingInitial, setEditingInitial] = useState<ConfigRowValues>({ key: '', value: '' })
  const snapshotRef = useRef<ConfigRow[]>([])

  const loadConfig = async (): Promise<ConfigRow[]> => {
    const res: ApiResult<AdminConfig> = await adminGetConfig()
    if (!res.success) throw new Error(res.error || t('admin.common.loadFailed'))
    const next = configToRows(res.data)
    snapshotRef.current = next
    return next
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessage('')
    void (async () => {
      try {
        const [nextRows, l] = await Promise.all([
          loadConfig(),
          listSystemOperationLogs({ page: 1, pageSize: 20 }),
        ])
        if (cancelled) return
        setRows(nextRows)
        if (l.success) setLogs((l.data.list ?? []) as LogRow[])
      } catch (e) {
        if (!cancelled) setMessage(e instanceof Error ? e.message : t('admin.common.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onSave = async () => {
    setSaving(true)
    setMessage('')
    const res = await adminUpdateConfig(rowsToConfig(rows))
    setSaving(false)
    if (res.success) {
      setMessage(t('admin.settings.saveSuccess'))
      setMessageKind('success')
      try {
        const next = await loadConfig()
        setRows(next)
      } catch {
        // ignore
      }
    } else {
      setMessage(res.error || t('admin.settings.saveFailed'))
      setMessageKind('error')
    }
  }

  const onAddRow = () => {
    setDialogMode('add')
    setEditingRowId(null)
    setEditingInitial({ key: '', value: '' })
    setDialogOpen(true)
  }

  const onEditRow = (row: ConfigRow) => {
    setDialogMode('edit')
    setEditingRowId(row.localId)
    setEditingInitial({ key: row.key, value: row.value })
    setDialogOpen(true)
  }

  const onRemoveRow = (row: ConfigRow) => {
    if (!window.confirm(t('admin.settings.deleteRowConfirm'))) return
    setRows((prev) => prev.filter((r) => r.localId !== row.localId))
  }

  const onRestore = () => {
    if (rows !== snapshotRef.current) {
      if (!window.confirm(t('admin.settings.restoreConfirm'))) return
    }
    setRows(snapshotRef.current.map((r) => ({ ...r })))
    setMessage(t('admin.settings.restored'))
    setMessageKind('success')
  }

  const handleDialogSubmit = (values: ConfigRowValues) => {
    if (dialogMode === 'add') {
      // 冲突检测:key 已存在
      if (rows.some((r) => r.key === values.key)) {
        // 用户重名 — 走"行合并"语义:更新现有行
        setRows((prev) => prev.map((r) => (r.key === values.key ? { ...r, value: values.value } : r)))
      } else {
        setRows((prev) => [...prev, { localId: `${values.key}-${prev.length}-${Date.now()}`, key: values.key, value: values.value }])
      }
    } else if (editingRowId !== null) {
      setRows((prev) => prev.map((r) => (r.localId === editingRowId ? { ...r, key: values.key, value: values.value } : r)))
    }
    setDialogOpen(false)
  }

  return (
    <div className="admin-page" data-testid="admin-settings">
      <header className="admin-page-header">
        <h2>{t('admin.settings.title')}</h2>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.settings.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="admin-tabs" role="tablist" data-testid="admin-settings-tabs">
            <button
              type="button"
              role="tab"
              aria-selected={section === 'config'}
              data-testid="admin-settings-tab-config"
              className={`admin-tab ${section === 'config' ? 'admin-tab-active' : ''}`}
              onClick={() => setSection('config')}
            >
              {t('admin.settings.tabConfig')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={section === 'logs'}
              data-testid="admin-settings-tab-logs"
              className={`admin-tab ${section === 'logs' ? 'admin-tab-active' : ''}`}
              onClick={() => setSection('logs')}
            >
              {t('admin.settings.tabLogs')}
            </button>
          </div>
          {section === 'config' ? (
            <>
              {loading ? (
                <div className="empty-state">{t('common.loading')}</div>
              ) : (
                <>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '30%' }}>{t('admin.settings.colKey')}</th>
                        <th>{t('admin.settings.colValue')}</th>
                        <th style={{ width: 140 }}>{t('admin.settings.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.localId} data-testid={`admin-config-row-${r.localId}`}>
                          <td className="admin-mono">{r.key}</td>
                          <td className="admin-mono" style={{ wordBreak: 'break-all' }}>{r.value}</td>
                          <td>
                            <div className="admin-row-actions">
                              <button
                                type="button"
                                onClick={() => onEditRow(r)}
                                data-testid={`admin-config-edit-${r.localId}`}
                              >
                                {t('admin.settings.editRow')}
                              </button>
                              <button
                                type="button"
                                className="danger"
                                onClick={() => onRemoveRow(r)}
                                data-testid={`admin-config-remove-${r.localId}`}
                              >
                                {t('admin.settings.deleteRow')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="admin-toolbar" style={{ marginTop: 12 }}>
                    <button type="button" onClick={onAddRow} data-testid="admin-config-add">
                      {t('admin.settings.addRow')}
                    </button>
                    <button type="button" onClick={onSave} disabled={saving} data-testid="admin-config-save">
                      {saving ? t('common.loading') : t('admin.settings.save')}
                    </button>
                    <button type="button" onClick={onRestore} data-testid="admin-config-restore">
                      {t('admin.settings.restore')}
                    </button>
                    {message ? (
                      <span
                        className={messageKind === 'error' ? 'admin-form-error' : 'admin-muted'}
                        data-testid="admin-config-message"
                        style={messageKind === 'error' ? { marginLeft: 8 } : undefined}
                      >
                        {message}
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {loading ? (
                <div className="empty-state">{t('common.loading')}</div>
              ) : logs.length === 0 ? (
                <div className="empty-state">{t('admin.common.noData')}</div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>{t('admin.settings.colAction')}</th>
                      <th>{t('admin.settings.colUser')}</th>
                      <th>{t('admin.settings.colResource')}</th>
                      <th>{t('admin.settings.colTime')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={String(log.id)}>
                        <td className="admin-mono">{String(log.id)}</td>
                        <td>{log.action ?? '—'}</td>
                        <td>{log.userNickname ?? '—'}</td>
                        <td>{log.resource ?? '—'}</td>
                        <td className="admin-muted">
                          {log.createdAt ? DATE_FORMATTER.format(new Date(log.createdAt)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfigRowDialog
        open={dialogOpen}
        mode={dialogMode}
        initialKey={editingInitial.key}
        initialValue={editingInitial.value}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleDialogSubmit}
      />
    </div>
  )
}
