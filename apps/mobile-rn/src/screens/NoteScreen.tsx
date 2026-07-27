import { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { tokens } from '@ihui/rn-app'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatDateByTemplate } from '../utils/date-utils'

import { Input, Loading } from '@ihui/ui-native'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface Note {
  id: string
  title: string
  content: string
  updatedAt: string
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
        <Loading />
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
              {t('note.updatedAt')}:{formatDateByTemplate(item.updatedAt, 'YYYY-MM-DD HH:mm')}
            </Text>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Text style={styles.editBtnText}>{t('note.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editing ? t('note.edit') : t('note.add')}</Text>
            <Input
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder={t('note.titlePlaceholder')}
              placeholderTextColor={tokens.text.tertiary}
            />
            <Input
              className="h-auto min-h-[120px]"
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              placeholder={t('note.placeholder')}
              placeholderTextColor={tokens.text.tertiary}
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
                  <Loading color="#fff" size="sm" />
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

const PRIMARY = tokens.brand.DEFAULT

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.light },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.light,
    paddingHorizontal: 16,
  },
  loadingText: { marginTop: 8, fontSize: 13, color: tokens.text.secondary },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { fontSize: 14, color: tokens.text.secondary },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  subtitle: { marginTop: 4, fontSize: 13, color: tokens.text.secondary },
  userText: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
  actionRow: { paddingHorizontal: 16, paddingVertical: 8 },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },
  addBtnText: { color: tokens.surface.light, fontSize: 14, fontWeight: '600' },
  toastText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: PRIMARY },
  errorText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: tokens.error.text },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: tokens.text.tertiary },
  card: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: tokens.text.primary },
  cardContent: { marginTop: 4, fontSize: 13, color: tokens.text.medium },
  cardMeta: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
  },
  editBtnText: { color: tokens.text.medium, fontSize: 12 },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  deleteBtnText: { color: tokens.error.text, fontSize: 12 },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: PRIMARY,
  },
  retryText: { color: tokens.surface.light, fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: tokens.surface.light,
    borderRadius: 8,
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: tokens.text.primary, marginBottom: 12 },
  titleInput: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    fontSize: 14,
    color: tokens.text.primary,
  },
  contentInput: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    fontSize: 14,
    color: tokens.text.primary,
    minHeight: 120,
    maxHeight: 200,
  },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
  },
  cancelBtnText: { color: tokens.text.medium, fontSize: 14 },
  saveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: tokens.text.tertiary },
  saveBtnText: { color: tokens.surface.light, fontSize: 14, fontWeight: '600' },
})
