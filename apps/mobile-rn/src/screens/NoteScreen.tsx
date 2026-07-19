import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface Note {
  id: string
  title: string
  content: string
  updatedAt: string
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function NoteScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await fetchApi<Note[]>('/api/notes')
      if (res.success) {
        setNotes(res.data ?? [])
      } else {
        setError(res.error || t('note.loadFailed'))
      }
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setTitle('')
    setContent('')
    setModalVisible(true)
  }

  const openEdit = (note: Note) => {
    setEditing(note)
    setTitle(note.title)
    setContent(note.content)
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setToast(t('note.titleRequired'))
      return
    }
    setSaving(true)
    setToast('')
    const body = { title: title.trim(), content: content.trim() }
    const res = editing
      ? await fetchApi<Note>(`/api/notes/${encodeURIComponent(editing.id)}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      : await fetchApi<Note>('/api/notes', {
          method: 'POST',
          body: JSON.stringify(body),
        })
    setSaving(false)
    if (res.success) {
      setModalVisible(false)
      setToast(t('note.saved'))
      void load()
    } else {
      setToast(res.error || t('note.saveFailed'))
    }
  }

  const handleDelete = async (note: Note) => {
    const res = await fetchApi<void>(`/api/notes/${encodeURIComponent(note.id)}`, {
      method: 'DELETE',
    })
    if (res.success) {
      setToast(t('note.deleted'))
      void load()
    } else {
      setToast(res.error || t('note.deleteFailed'))
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && notes.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('note.title')}</Text>
        <Text style={styles.subtitle}>{t('note.subtitle')}</Text>
        <Text style={styles.userText}>{user?.nickname ?? user?.username ?? ''}</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>{t('note.add')}</Text>
        </TouchableOpacity>
      </View>

      {toast ? <Text style={styles.toastText}>{toast}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        style={styles.list}
        data={notes}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('note.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.content ? (
              <Text style={styles.cardContent} numberOfLines={3}>
                {item.content}
              </Text>
            ) : null}
            <Text style={styles.cardMeta}>
              {t('note.updatedAt')}:{formatDateTime(item.updatedAt)}
            </Text>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Text style={styles.editBtnText}>{t('note.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item)}
              >
                <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editing ? t('note.edit') : t('note.add')}
            </Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder={t('note.titlePlaceholder')}
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              placeholder={t('note.placeholder')}
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const PRIMARY = '#10B981'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingHorizontal: 16 },
  loadingText: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6b7280' },
  userText: { marginTop: 4, fontSize: 11, color: '#9ca3af' },
  actionRow: { paddingHorizontal: 16, paddingVertical: 8 },
  addBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  toastText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: PRIMARY },
  errorText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: '#dc2626' },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardContent: { marginTop: 4, fontSize: 13, color: '#374151' },
  cardMeta: { marginTop: 4, fontSize: 11, color: '#9ca3af' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f3f4f6' },
  editBtnText: { color: '#374151', fontSize: 12 },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#fef2f2' },
  deleteBtnText: { color: '#dc2626', fontSize: 12 },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  retryText: { color: '#fff', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  titleInput: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 14, color: '#111827' },
  contentInput: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 14, color: '#111827', minHeight: 120, maxHeight: 200 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center' },
  cancelBtnText: { color: '#374151', fontSize: 14 },
  saveBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: '#9ca3af' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
