import { useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { NoteItem, NoteScreenProps } from '../../types'

/** 笔记管理共享屏(含编辑 Modal)— props 注入式跨端组件 */
export type { NoteItem, NoteScreenProps }

export function NoteScreen({
  t,
  userLabel,
  notes,
  loading,
  refreshing,
  error,
  toast,
  modalVisible,
  editing,
  title,
  content,
  saving,
  onRefresh,
  onBack,
  onOpenCreate,
  onOpenEdit,
  onTitleChange,
  onContentChange,
  onSave,
  onDelete,
  onCloseModal,
  colorScheme = 'light',
}: NoteScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && notes.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.retryText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('note.title')}</Text>
        <Text style={styles.subtitle}>{t('note.subtitle')}</Text>
        {userLabel ? <Text style={styles.userText}>{userLabel}</Text> : null}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.addBtn} onPress={onOpenCreate} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
          <Text style={styles.addBtnText}>{t('note.add')}</Text>
        </TouchableOpacity>
      </View>

      {toast ? <Text style={styles.toastText}>{toast}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList<NoteItem>
        style={styles.list}
        data={notes}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
              {t('note.updatedAt')}: {item.updatedAt}
            </Text>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => onOpenEdit(item)} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <Text style={styles.editBtnText}>{t('note.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item)} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
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
        onRequestClose={onCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editing ? t('note.edit') : t('note.add')}
            </Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={onTitleChange}
              placeholder={t('note.titlePlaceholder')}
              placeholderTextColor={tk.text.tertiary}
            />
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={onContentChange}
              placeholder={t('note.placeholder')}
              placeholderTextColor={tk.text.tertiary}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCloseModal}
                disabled={saving}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={onSave}
                disabled={saving}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                {saving ? (
                  <ActivityIndicator color={tk.surface.light} />
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

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.light },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.light,
      paddingHorizontal: 16,
    },
    loadingText: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    userText: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
    actionRow: { paddingHorizontal: 16, paddingVertical: 8 },
    addBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    addBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    toastText: {
      paddingHorizontal: 16,
      paddingVertical: 4,
      fontSize: 12,
      color: tk.brand.DEFAULT,
    },
    errorText: {
      paddingHorizontal: 16,
      paddingVertical: 4,
      fontSize: 12,
      color: tk.danger.DEFAULT,
    },
    list: { flex: 1, paddingHorizontal: 16 },
    empty: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 10,
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary },
    cardContent: { marginTop: 4, fontSize: 13, color: tk.text.medium },
    cardMeta: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
    cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    editBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    editBtnText: { color: tk.text.medium, fontSize: 12 },
    deleteBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.danger.light,
    },
    deleteBtnText: { color: tk.danger.DEFAULT, fontSize: 12 },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    retryText: { color: tk.surface.light, fontSize: 14 },
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
      backgroundColor: tk.surface.light,
      borderRadius: 8,
      padding: 16,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 12,
    },
    titleInput: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 14,
      color: tk.text.primary,
    },
    contentInput: {
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 14,
      color: tk.text.primary,
      minHeight: 120,
      maxHeight: 200,
    },
    modalActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    cancelBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
    },
    cancelBtnText: { color: tk.text.medium, fontSize: 14 },
    saveBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    saveBtnDisabled: { backgroundColor: tk.text.tertiary },
    saveBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
  })
}
