// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  createOfflineRecord,
  deleteOfflineRecord,
  getMyOfflineRecords,
  updateOfflineRecord,
} from '@ihui/api-client'
import type { OfflineRecord } from '@ihui/api-client'
import type { OfflineRecordFormState } from '@ihui/rn-app'
import { OfflineRecordsScreen as SharedOfflineRecordsScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const EMPTY_FORM: OfflineRecordFormState = {
  type: '',
  title: '',
  description: '',
  hours: '',
  occurredAt: '',
}

function recordToForm(record: OfflineRecord): OfflineRecordFormState {
  return {
    type: record.type,
    title: record.title,
    description: record.description ?? '',
    hours: record.hours !== null && record.hours !== undefined ? String(record.hours) : '',
    occurredAt: record.occurredAt ? record.occurredAt.slice(0, 10) : '',
  }
}

/**
 * RN 端「线下学习记录」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/student/OfflineRecordsScreen.tsx`,本文件只管平台侧:
 * 取数(GET /api/edu/my-offline-records,载荷裸数组/{list} 两种形态与 web 端同口径归一)、
 * 新建(POST)/更新(PUT)/删除(DELETE /api/edu/offline-records/:id,删除前 Alert 确认)。
 * 附件:已有附件原样回传(与 web recordToForm 同语义),RN 不提供新增上传入口。
 */
export function OfflineRecordsScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [records, setRecords] = useState<OfflineRecord[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<OfflineRecord | null>(null)
  const [form, setForm] = useState<OfflineRecordFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getMyOfflineRecords()
      if (!res.success || !res.data) {
        setError(t('studentPage.fetchFailed'))
        return
      }
      const payload = res.data
      setRecords(Array.isArray(payload) ? payload : (payload.list ?? []))
    } catch {
      setError(t('studentPage.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = useCallback(() => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: OfflineRecord) => {
    setEditing(record)
    setForm(recordToForm(record))
    setFormError(null)
    setFormOpen(true)
  }, [])

  const cancelForm = useCallback(() => {
    if (saving) return
    setFormOpen(false)
    setEditing(null)
    setFormError(null)
  }, [saving])

  const handleFieldChange = useCallback((key: keyof OfflineRecordFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    setFormError(null)
    if (!form.title.trim()) {
      setFormError(t('offlineRecordsPage.errTitleRequired'))
      return
    }
    if (!form.type.trim()) {
      setFormError(t('offlineRecordsPage.errTypeRequired'))
      return
    }
    const body = {
      type: form.type.trim(),
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      hours: form.hours ? Number(form.hours) : undefined,
      occurredAt: form.occurredAt || undefined,
      attachments: editing?.attachments ?? [],
    }
    setSaving(true)
    try {
      const res = editing
        ? await updateOfflineRecord(editing.id, body)
        : await createOfflineRecord(body)
      if (!res.success) {
        setFormError(t('offlineRecordsPage.saveFailed'))
        return
      }
      setFormOpen(false)
      setEditing(null)
      await load()
    } catch {
      setFormError(t('offlineRecordsPage.saveFailed'))
    } finally {
      setSaving(false)
    }
  }, [form, editing, t, load])

  const handleDelete = useCallback(
    (record: OfflineRecord) => {
      Alert.alert(t('studentPage.deleteConfirmTitle'), undefined, [
        { text: t('studentPage.cancel'), style: 'cancel' },
        {
          text: t('studentPage.delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const res = await deleteOfflineRecord(record.id)
                if (!res.success) {
                  Alert.alert(t('studentPage.deleteFailed'))
                  return
                }
                await load()
              } catch {
                Alert.alert(t('studentPage.deleteFailed'))
              }
            })()
          },
        },
      ])
    },
    [t, load],
  )

  return (
    <SharedOfflineRecordsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      records={records}
      onRefresh={() => void load()}
      onCreate={openCreate}
      onEdit={openEdit}
      onDelete={handleDelete}
      formOpen={formOpen}
      editingId={editing?.id ?? null}
      form={form}
      onFieldChange={handleFieldChange}
      saving={saving}
      formError={formError}
      onSave={() => void handleSave()}
      onCancelForm={cancelForm}
    />
  )
}

export default OfflineRecordsScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
