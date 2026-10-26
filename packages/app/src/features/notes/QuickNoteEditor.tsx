// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 快捷笔记编辑弹窗(D03,从 QuickNotesScreen 拆出的编辑器)
 * props 注入式:草稿与回调由宿主给,本组件不持状态。
 */

import { useMemo } from 'react'
import { Modal, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { TextField } from '../../components/TextField'
import { createQuickNoteEditorStyles } from './quick-notes-styles'
import type { QuickNoteDraft } from './QuickNotesScreen'

export interface QuickNoteEditorProps {
  t: (key: string) => string
  colorScheme: AppThemeMode
  /** null = 关闭;'' = 新建;其余 = 编辑该 id */
  editingId: string | null
  draft: QuickNoteDraft
  onDraftChange: (patch: Partial<QuickNoteDraft>) => void
  onSave: () => void
  onClose: () => void
}

export function QuickNoteEditor({
  t,
  colorScheme,
  editingId,
  draft,
  onDraftChange,
  onSave,
  onClose,
}: QuickNoteEditorProps) {
  const tk: AppThemeTokens = getTokens(colorScheme)
  const styles = useMemo(() => createQuickNoteEditorStyles(tk), [tk])
  const isEditing = editingId !== null && editingId !== ''

  return (
    <Modal visible={editingId !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {isEditing ? t('quickNotes.edit') : t('quickNotes.new')}
          </Text>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={draft.title}
            onChangeText={(v) => onDraftChange({ title: v })}
            placeholder={t('quickNotes.titlePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
          />
          <TextField
            colorScheme={colorScheme}
            style={styles.inputMultiline}
            value={draft.content}
            onChangeText={(v) => onDraftChange({ content: v })}
            placeholder={t('quickNotes.contentPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            multiline
            textAlignVertical="top"
          />
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={draft.group}
            onChangeText={(v) => onDraftChange({ group: v })}
            placeholder={t('quickNotes.groupPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
              <Text style={styles.saveBtnText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
