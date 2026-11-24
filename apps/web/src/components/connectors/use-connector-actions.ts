// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  checkConnector,
  connectManagedConnector,
  deleteConnector,
  fetchConnectorDoc,
  getConnectorOAuthAuthorize,
  saveConnectorConfig,
  setConnectorEnabled,
  syncConnector,
  type ConnectorEntry,
  type ConnectorSyncItem,
  type SaveConnectorConfigInput,
} from '@ihui/api-client/endpoints/connectors'

interface DocDialogState {
  title: string
  content: string
  truncated: boolean
}

/**
 * 连接器页交互状态与动作编排:保存 / 一键接入 + 自检 / 自检 / 启停 /
 * 同步 / 拉文档 / 删除。页面组件只负责挂载与传参。
 */
export function useConnectorActions(refresh: () => void) {
  const t = useTranslations('connectors')

  const [configOpen, setConfigOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ConnectorEntry | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [invokeTarget, setInvokeTarget] = React.useState<ConnectorEntry | null>(null)
  const [syncingKey, setSyncingKey] = React.useState<string | null>(null)
  const [syncItems, setSyncItems] = React.useState<Record<string, ConnectorSyncItem[]>>({})
  const [readingKey, setReadingKey] = React.useState<string | null>(null)
  const [docDialog, setDocDialog] = React.useState<DocDialogState | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<ConnectorEntry | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [connectingType, setConnectingType] = React.useState<string | null>(null)
  const [checkingKey, setCheckingKey] = React.useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setConfigOpen(true)
  }

  const openEdit = (entry: ConnectorEntry) => {
    setEditing(entry)
    setConfigOpen(true)
  }

  const handleSave = async (input: SaveConnectorConfigInput) => {
    if (saving) return
    setSaving(true)
    try {
      const r = await saveConnectorConfig(input)
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

  /** 用户扫码授权自己账号:拿平台授权 URL 后整页跳转(回调由后端处理) */
  const handleUserAuthorize = async (type: string) => {
    try {
      const r = await getConnectorOAuthAuthorize(type)
      if (!r.success || !r.data) {
        toast.error(r.error ?? t('actionFailed'))
        return
      }
      window.location.href = r.data.url
    } catch {
      toast.error(t('actionFailed'))
    }
  }

  const handleManagedConnect = async (type: string, label: string) => {
    if (connectingType) return
    setConnectingType(type)
    try {
      const r = await connectManagedConnector(type)
      if (r.success) {
        // 一键接入后立刻自检:用户不用再去列表里点「测试连接」才知道凭据是否有效。
        const key = r.data?.key
        if (key) {
          const check = await checkConnector(key)
          if (check.success && check.data?.ok) {
            toast.success(
              `${t('managedConnected', { name: label })}，${check.data.message || t('checkOk')}`,
            )
          } else {
            const failMessage = check.success ? check.data?.message : ''
            toast.error(
              `${t('managedConnected', { name: label })}，${failMessage || t('checkFailed')}`,
            )
          }
        } else {
          toast.success(t('managedConnected', { name: label }))
        }
        refresh()
      } else {
        toast.error(r.error ?? t('actionFailed'))
      }
    } catch {
      toast.error(t('actionFailed'))
    } finally {
      setConnectingType(null)
    }
  }

  const handleCheck = async (entry: ConnectorEntry) => {
    if (checkingKey) return
    setCheckingKey(entry.key)
    try {
      const r = await checkConnector(entry.key)
      if (r.success && r.data) {
        if (r.data.ok) toast.success(r.data.message || t('checkOk'))
        else toast.error(r.data.message || t('checkFailed'))
      } else {
        toast.error(r.error ?? t('checkFailed'))
      }
    } catch {
      toast.error(t('checkFailed'))
    } finally {
      setCheckingKey(null)
    }
  }

  const handleToggle = async (entry: ConnectorEntry, enabled: boolean) => {
    try {
      const r = await setConnectorEnabled(entry.key, enabled)
      if (r.success) {
        toast.success(
          enabled
            ? t('enableSuccess', { name: entry.name })
            : t('disableSuccess', { name: entry.name }),
        )
        refresh()
      } else {
        toast.error(r.error ?? t('actionFailed'))
      }
    } catch {
      toast.error(t('actionFailed'))
    }
  }

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
            items.length > 0 ? t('syncSuccess', { count: items.length }) : t('syncEmpty'),
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

  return {
    configOpen,
    setConfigOpen,
    editing,
    saving,
    invokeTarget,
    setInvokeTarget,
    syncingKey,
    syncItems,
    readingKey,
    docDialog,
    setDocDialog,
    deleteTarget,
    setDeleteTarget,
    connectingType,
    checkingKey,
    openCreate,
    openEdit,
    handleSave,
    handleManagedConnect,
    handleUserAuthorize,
    handleCheck,
    handleToggle,
    handleSync,
    handleFetchDoc,
    handleDelete,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
