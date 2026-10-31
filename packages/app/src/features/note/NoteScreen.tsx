// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { TextField } from '../../components/TextField'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { NoteItem, NoteScreenProps } from '../../types'

import { rnRadius, rnCssLight, rnSpacing } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

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
      <View style={styles.container}>
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && notes.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorState
          message={error}
          onRetry={onBack}
          retryLabel={t('common.back')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('note.title')}</Text>
        <Text style={styles.subtitle}>{t('note.subtitle')}</Text>
        {userLabel ? <Text style={styles.userText}>{userLabel}</Text> : null}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={onOpenCreate}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
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
        ListEmptyComponent={<EmptyState title={t('note.empty')} colorScheme={colorScheme} />}
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
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => onOpenEdit(item)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text style={styles.editBtnText}>{t('note.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => onDelete(item)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={onCloseModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editing ? t('note.edit') : t('note.add')}</Text>
            <TextField
              colorScheme={colorScheme}
              style={styles.titleInput}
              value={title}
              onChangeText={onTitleChange}
              placeholder={t('note.titlePlaceholder')}
              placeholderTextColor={tk.text.tertiary}
            />
            <TextField
              colorScheme={colorScheme}
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
    header: { paddingHorizontal: rnSpacing['sm-loose'], paddingBottom: rnSpacing.sm },
    title: { marginTop: rnSpacing.sm, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: rnSpacing.sm, fontSize: 14, color: tk.text.secondary },
    userText: { marginTop: rnSpacing.sm, fontSize: 11, color: tk.text.tertiary },
    actionRow: { paddingHorizontal: rnSpacing['sm-loose'], paddingVertical: rnSpacing.sm },
    addBtn: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    },
    addBtnText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
    toastText: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.xs,
      fontSize: 14,
      color: tk.brand.DEFAULT,
    },
    errorText: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.xs,
      fontSize: 14,
      color: tk.danger.DEFAULT,
    },
    list: { flex: 1, paddingHorizontal: rnSpacing['sm-loose'] },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: rnSpacing.md,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    cardContent: { marginTop: rnSpacing.sm, fontSize: 14, color: tk.text.medium },
    cardMeta: { marginTop: rnSpacing.sm, fontSize: 11, color: tk.text.tertiary },
    cardActions: { flexDirection: 'row', gap: rnSpacing.sm, marginTop: rnSpacing['sm-loose'] },
    editBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.card,
    },
    editBtnText: { color: tk.text.medium, fontSize: 14 },
    deleteBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.danger.light,
    },
    deleteBtnText: { color: tk.danger.DEFAULT, fontSize: 14 },
    modalOverlay: {
      flex: 1,
      backgroundColor: rnCssLight.black50,
      justifyContent: 'center',
      alignItems: 'center',
      padding: rnSpacing.lg,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.xl,
      padding: rnSpacing.lg,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    titleInput: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 16,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    contentInput: {
      marginTop: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 16,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
      minHeight: 120,
      maxHeight: 200,
    },
    modalActions: { flexDirection: 'row', gap: rnSpacing.sm, marginTop: rnSpacing.md },
    cancelBtn: {
      flex: 1,
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
    },
    cancelBtnText: { color: tk.text.medium, fontSize: 16 },
    saveBtn: {
      flex: 1,
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    },
    saveBtnDisabled: { backgroundColor: tk.text.tertiary },
    saveBtnText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
