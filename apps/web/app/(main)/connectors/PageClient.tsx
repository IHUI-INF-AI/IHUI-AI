// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  BookOpen,
  Send,
  Building2,
  MessageCircle,
  RefreshCw,
  FileText,
  Trash2,
  Plus,
  Loader2,
  Settings2,
  Link2,
  KeyRound,
  Clock,
  Library,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  getConnectors,
  saveConnectorConfig,
  syncConnector,
  fetchConnectorDoc,
  setConnectorEnabled,
  deleteConnector,
  type ConnectorEntry,
  type ConnectorListResponse,
  type ConnectorSyncItem,
  type ConnectorType,
} from '@ihui/api-client/endpoints/connectors'
import { BackButton } from '@/components/common'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/data'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Switch,
} from '@ihui/ui-react'

/** 按连接器类型映射 lucide 图标 */
const TYPE_ICON: Record<string, LucideIcon> = {
  yuque: BookOpen,
  feishu: Send,
  wecom: Building2,
  dingtalk: MessageCircle,
}

/** 中文连接器配置表单(创建/编辑共用) */
interface ConnectorFormState {
  type: ConnectorType
  name: string
  app_id: string
  app_secret: string
  /** 语雀知识库 owner(用户或组织) */
  yuque_user: string
  /** 语雀知识库 slug */
  yuque_repo: string
}

const EMPTY_FORM: ConnectorFormState = {
  type: 'yuque',
  name: '',
  app_id: '',
  app_secret: '',
  yuque_user: '',
  yuque_repo: '',
}

/** 从名称生成 URL-safe slug(中文等非字母数字转 - 后压缩,空则回落) */
function toSlug(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s
}

/**
 * 中文连接器页 — 2026-09-02 新增(P2-2 中文 Connectors)
 *
 * 定位:配置语雀/飞书/企业微信/钉钉连接器(token/知识库地址),让 AI 对话能
 * 读取中文知识平台的文档。对标竞品深度开发项。
 * 接口:GET /api/connectors(脱敏列表,无 app_id/app_secret 明文)
 *       + POST /api/connectors/config | /sync | /{key}/fetch | /enable | /disable
 *       + DELETE /api/connectors/{key}
 *       (均经 next rewrites → ai-service 8803)。
 */
export default function ConnectorsPageClient() {
  const t = useTranslations('connectors')
  const queryClient = useQueryClient()

  const {
    data: list,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['connectors', 'list'],
    queryFn: async (): Promise<ConnectorListResponse> => {
      const r = await getConnectors()
      if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
      return r.data
    },
  })

  // ---- 配置对话框 ----
  const [configOpen, setConfigOpen] = React.useState(false)
  /** null = 新建;非 null = 编辑已有连接器(保留原 key) */
  const [editing, setEditing] = React.useState<ConnectorEntry | null>(null)
  const [form, setForm] = React.useState<ConnectorFormState>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)

  // ---- 同步 / 文档 ----
  const [syncingKey, setSyncingKey] = React.useState<string | null>(null)
  /** 各连接器最新一次同步得到的文档列表(初始取 entry.sync_items) */
  const [syncItems, setSyncItems] = React.useState<Record<string, ConnectorSyncItem[]>>({})
  const [readingKey, setReadingKey] = React.useState<string | null>(null)
  const [docDialog, setDocDialog] = React.useState<{
    title: string
    content: string
    truncated: boolean
  } | null>(null)

  // ---- 删除确认 ----
  const [deleteTarget, setDeleteTarget] = React.useState<ConnectorEntry | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['connectors', 'list'] })
  }

  /** 打开新建对话框 */
  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setConfigOpen(true)
  }

  /** 打开编辑对话框(密钥不回显,app_secret 留空=保留旧值) */
  const openEdit = (entry: ConnectorEntry) => {
    setEditing(entry)
    setForm({
      type: (entry.type as ConnectorType) ?? 'yuque',
      name: entry.name,
      app_id: '',
      app_secret: '',
      yuque_user: entry.extra?.user ?? '',
      yuque_repo: entry.extra?.repo ?? '',
    })
    setConfigOpen(true)
  }

  /** 提交配置保存 */
  const handleSave = async () => {
    if (saving) return
    // 语雀需 owner+slug;飞书/企微/钉钉需 app_id(新建时还需 app_secret)
    if (form.type === 'yuque') {
      if (!form.yuque_user.trim() || !form.yuque_repo.trim()) {
        toast.error(t('actionFailed'))
        return
      }
    } else {
      if (!form.app_id.trim()) {
        toast.error(t('actionFailed'))
        return
      }
      if (!editing && !form.app_secret.trim()) {
        toast.error(t('actionFailed'))
        return
      }
    }
    setSaving(true)
    try {
      const key = editing
        ? editing.key
        : `${form.type}:${toSlug(form.name) || (form.type === 'yuque' ? toSlug(form.yuque_repo) : form.app_id) || 'c'}`
      const extra: Record<string, string> =
        form.type === 'yuque'
          ? { user: form.yuque_user.trim(), repo: form.yuque_repo.trim() }
          : {}
      const r = await saveConnectorConfig({
        key,
        type: form.type,
        name: form.name.trim(),
        app_id: form.app_id.trim(),
        app_secret: form.app_secret,
        extra,
      })
      if (r.success) {
        toast.success(t('saved'))
        setConfigOpen(false)
        refresh()
      } else {
        toast.error(r.error ?? t('actionFailed'))
      }
    } catch {
      toast.error(t('actionFailed'))
    } finally {
      setSaving(false)
    }
  }

  /** 启停切换 */
  const handleToggle = async (entry: ConnectorEntry, enabled: boolean) => {
    try {
      const r = await setConnectorEnabled(entry.key, enabled)
      if (r.success) {
        toast.success(enabled ? t('enableSuccess', { name: entry.name }) : t('disableSuccess', { name: entry.name }))
        refresh()
      } else {
        toast.error(r.error ?? t('actionFailed'))
      }
    } catch {
      toast.error(t('actionFailed'))
    }
  }

  /** 同步数据源,成功后把文档列表渲染到卡片内 */
  const handleSync = async (entry: ConnectorEntry) => {
    if (syncingKey) return
    setSyncingKey(entry.key)
    try {
      const r = await syncConnector(entry.key)
      if (r.success && r.data) {
        const items = r.data.items ?? []
        if (r.data.ok) {
          setSyncItems((prev) => ({ ...prev, [entry.key]: items }))
          toast.success(
            items.length > 0
              ? t('syncSuccess', { count: items.length })
              : t('syncEmpty'),
          )
          refresh()
        } else {
          toast.error(r.data.message || t('syncFailed'))
        }
      } else {
        toast.error(r.error ?? t('syncFailed'))
      }
    } catch {
      toast.error(t('syncFailed'))
    } finally {
      setSyncingKey(null)
    }
  }

  /** 拉取单篇文档正文并展示 */
  const handleFetchDoc = async (entry: ConnectorEntry, item: ConnectorSyncItem) => {
    if (readingKey) return
    setReadingKey(item.doc_id)
    try {
      const r = await fetchConnectorDoc(entry.key, item.doc_id)
      if (r.success && r.data) {
        if (r.data.ok) {
          setDocDialog({
            title: r.data.title || item.title,
            content: r.data.content,
            truncated: r.data.truncated,
          })
        } else {
          toast.error(r.data.message || t('syncFailed'))
        }
      } else {
        toast.error(r.error ?? t('syncFailed'))
      }
    } catch {
      toast.error(t('syncFailed'))
    } finally {
      setReadingKey(null)
    }
  }

  /** 删除连接器 */
  const handleDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const r = await deleteConnector(deleteTarget.key)
      if (r.success) {
        toast.success(t('deleteSuccess'))
        setDeleteTarget(null)
        refresh()
      } else {
        toast.error(r.error ?? t('deleteFailed'))
      }
    } catch {
      toast.error(t('deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  const connectors = list?.connectors ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4">
      <BackButton />

      {/* 顶部:标题 + 统计 + 添加按钮 */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Library className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            {!isLoading && !error && (
              <Badge variant="primary">{t('count', { count: list?.count ?? connectors.length })}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t('add')}
        </Button>
      </header>

      {/* 加载态 */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      )}

      {/* 错误态 */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {t('loadFailed')}
        </div>
      )}

      {/* 空态 */}
      {!isLoading && !error && connectors.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-12 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('add')}
          </Button>
        </div>
      )}

      {/* 连接器卡片列表 */}
      {!isLoading && !error && connectors.length > 0 && (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-2">
          {connectors.map((entry) => (
            <ConnectorCard
              key={entry.key}
              entry={entry}
              syncing={syncingKey === entry.key}
              reading={readingKey}
              items={syncItems[entry.key] ?? entry.sync_items ?? []}
              onToggle={(enabled) => void handleToggle(entry, enabled)}
              onSync={() => void handleSync(entry)}
              onEdit={() => openEdit(entry)}
              onRead={(item) => void handleFetchDoc(entry, item)}
              onDelete={() => setDeleteTarget(entry)}
            />
          ))}
        </div>
      )}

      {/* 配置对话框(创建/编辑共用) */}
      <Dialog open={configOpen} onOpenChange={(v) => !v && setConfigOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t('edit') : t('add')}</DialogTitle>
            <DialogDescription>{t('subtitle')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('typeLabel')}</Label>
              <Select
                value={form.type}
                disabled={!!editing}
                onValueChange={(v) => setForm((prev) => ({ ...prev, type: v as ConnectorType }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yuque">{t('yuque')}</SelectItem>
                  <SelectItem value="feishu">{t('feishu')}</SelectItem>
                  <SelectItem value="wecom">{t('wecom')}</SelectItem>
                  <SelectItem value="dingtalk">{t('dingtalk')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('nameLabel')}</Label>
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t('namePlaceholder')}
                autoComplete="off"
              />
            </div>

            {form.type === 'yuque' ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('yuqueUserLabel')}</Label>
                  <Input
                    type="text"
                    value={form.yuque_user}
                    onChange={(e) => setForm((prev) => ({ ...prev, yuque_user: e.target.value }))}
                    placeholder={t('yuqueUserPlaceholder')}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('yuqueRepoLabel')}</Label>
                  <Input
                    type="text"
                    value={form.yuque_repo}
                    onChange={(e) => setForm((prev) => ({ ...prev, yuque_repo: e.target.value }))}
                    placeholder={t('yuqueRepoPlaceholder')}
                    autoComplete="off"
                  />
                </div>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Link2 className="h-3 w-3" />
                  {t('yuqueHint')}
                </p>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('appIdLabel')}</Label>
                  <Input
                    type="text"
                    value={form.app_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, app_id: e.target.value }))}
                    placeholder={t('appIdPlaceholder')}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('appSecretLabel')}</Label>
                  <Input
                    type="password"
                    value={form.app_secret}
                    onChange={(e) => setForm((prev) => ({ ...prev, app_secret: e.target.value }))}
                    placeholder={editing ? t('secretKeepHint') : t('appSecretPlaceholder')}
                    autoComplete="new-password"
                  />
                  {editing && (
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <KeyRound className="h-3 w-3" />
                      {t('secretKeepHint')}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t('submit')}
                </>
              ) : (
                t('submit')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 文档正文对话框 */}
      <Dialog open={docDialog !== null} onOpenChange={(v) => !v && setDocDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{docDialog?.title}</DialogTitle>
            {docDialog?.truncated && (
              <DialogDescription>
                {t('truncatedHint', { chars: docDialog.content.length })}
              </DialogDescription>
            )}
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
            {docDialog?.content}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialog(null)}>
              {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDesc', { name: deleteTarget?.name ?? '' })}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        variant="destructive"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

/** 单个连接器卡片:名称/类型/状态徽章/启停开关 + 同步/配置/删除 + 文档列表 */
function ConnectorCard({
  entry,
  syncing,
  reading,
  items,
  onToggle,
  onSync,
  onEdit,
  onRead,
  onDelete,
}: {
  entry: ConnectorEntry
  syncing: boolean
  reading: string | null
  items: ConnectorSyncItem[]
  onToggle: (enabled: boolean) => void
  onSync: () => void
  onEdit: () => void
  onRead: (item: ConnectorSyncItem) => void
  onDelete: () => void
}) {
  const t = useTranslations('connectors')
  const Icon = TYPE_ICON[entry.type] ?? BookOpen
  const configured = entry.configured

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold leading-tight text-foreground">{entry.name}</span>
            <Badge variant="primary">{entry.type}</Badge>
            <Badge variant={configured ? 'success' : 'default'}>
              {configured ? t('configured') : t('notConfigured')}
            </Badge>
            {configured &&
              (entry.enabled ? (
                <Badge variant="success">{t('enabled')}</Badge>
              ) : (
                <Badge variant="default">{t('disabled')}</Badge>
              ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {entry.last_sync_at ? (
                <>
                  {t('lastSyncAt')}: {entry.last_sync_at}
                </>
              ) : (
                t('neverSynced')
              )}
            </span>
          </div>
        </div>
        <Switch
          checked={entry.enabled}
          disabled={!configured}
          onCheckedChange={onToggle}
          aria-label={entry.enabled ? t('enabled') : t('disabled')}
        />
      </div>

      {entry.last_error && (
        <p className="text-xs text-destructive">{t('lastError', { error: entry.last_error })}</p>
      )}

      <div className="mt-auto flex gap-2">
        <Button variant="outline" onClick={onSync} disabled={syncing || !configured} className="flex-1">
          {syncing ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              {t('syncing')}
            </>
          ) : (
            <>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {t('sync')}
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onEdit} className="flex-1">
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          {t('edit')}
        </Button>
        <Button
          variant="outline"
          onClick={onDelete}
          className="flex-1 text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          {t('delete')}
        </Button>
      </div>

      {/* 同步得到的文档列表 */}
      {items.length > 0 && (
        <div className="space-y-1.5 border-t pt-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <FileText className="h-3 w-3" />
            {t('docList')}
          </p>
          <ul className="space-y-1">
            {items.map((item) => (
              <li
                key={item.doc_id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1.5"
              >
                <span className="min-w-0 truncate text-xs text-foreground">{item.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-2 text-[11px]"
                  onClick={() => onRead(item)}
                  disabled={reading === item.doc_id}
                >
                  {reading === item.doc_id ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="mr-1 h-3 w-3" />
                  )}
                  {t('readDoc')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
