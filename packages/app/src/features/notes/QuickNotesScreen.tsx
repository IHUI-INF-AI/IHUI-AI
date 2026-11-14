// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 快捷笔记管理屏(D03 文字纵切片,平台无关组件源 + 宿主注入)
 *
 * 与 note/NoteScreen 同款 props 注入式跨端组件:t/colorScheme/数据与回调全部由宿主给,
 * 本文件不持有 store、不发起 IO。语音/转写(12 phase 状态机)不在本屏(D03 后续批)。
 * 挂载点:apps/mobile-rn 薄壳会话内 Modal(ChatScreen「+」面板入口)与独立壳屏复用同一份。
 */

import { useMemo } from 'react'
import { FlatList, Text, TouchableOpacity, View } from 'react-native'
import {
  Archive,
  ArchiveRestore,
  CornerDownLeft,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react-native'
import { getTokens, type AppThemeMode } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { QuickNoteEditor } from './QuickNoteEditor'
import { createQuickNotesStyles, formatQuickNoteStamp } from './quick-notes-styles'
import type { QuickNote } from '@ihui/shared/stores'

export interface QuickNoteDraft {
  title: string
  content: string
  group: string
}

export interface QuickNotesScreenProps {
  t: (key: string) => string
  /** 必填(守门 91:主题色不得静默脱钩) */
  colorScheme: AppThemeMode
  notes: QuickNote[]
  query: string
  showArchived: boolean
  /** 当前打开编辑器的笔记 id;null = 关闭;'' = 新建 */
  editingId: string | null
  draft: QuickNoteDraft
  onQueryChange: (q: string) => void
  onToggleShowArchived: () => void
  onStartCreate: () => void
  onStartEdit: (note: QuickNote) => void
  onDraftChange: (patch: Partial<QuickNoteDraft>) => void
  onSaveDraft: () => void
  onCloseEditor: () => void
  onDelete: (note: QuickNote) => void
  onToggleArchive: (note: QuickNote) => void
  /** 一键插入对话:交给宿主接既有输入框通道 */
  onInsert: (note: QuickNote) => void
  onBack: () => void
}

function formatStamp(ts: number): string {
  return formatQuickNoteStamp(ts)
}

export function QuickNotesScreen({
  t,
  colorScheme,
  notes,
  query,
  showArchived,
  editingId,
  draft,
  onQueryChange,
  onToggleShowArchived,
  onStartCreate,
  onStartEdit,
  onDraftChange,
  onSaveDraft,
  onCloseEditor,
  onDelete,
  onToggleArchive,
  onInsert,
  onBack,
}: QuickNotesScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createQuickNotesStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('quickNotes.title')}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={onStartCreate}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('quickNotes.new')}
        >
          <Plus size={16} color={tk.brand.ctaForeground} />
          <Text style={styles.addBtnText}>{t('quickNotes.new')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Search size={14} color={tk.text.tertiary} />
        <TextField
          colorScheme={colorScheme}
          style={styles.searchInput}
          value={query}
          onChangeText={onQueryChange}
          placeholder={t('quickNotes.search')}
          placeholderTextColor={tk.text.tertiary}
        />
      </View>

      <TouchableOpacity
        style={styles.archivedToggle}
        onPress={onToggleShowArchived}
        accessibilityRole="button"
        accessibilityLabel={t('quickNotes.showArchived')}
      >
        <View style={[styles.archivedDot, showArchived && styles.archivedDotOn]} />
        <Text style={styles.archivedToggleText}>{t('quickNotes.showArchived')}</Text>
      </TouchableOpacity>

      <FlatList
        style={styles.list}
        data={notes}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('quickNotes.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {item.archived ? (
                <View style={styles.badgeArchived}>
                  <Text style={styles.badgeArchivedText}>{t('quickNotes.archived')}</Text>
                </View>
              ) : null}
            </View>
            {item.content ? (
              <Text style={styles.cardContent} numberOfLines={3}>
                {item.content}
              </Text>
            ) : null}
            <Text style={styles.cardMeta}>
              {[item.group, formatStamp(item.updatedAt)].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.insertBtn}
                onPress={() => onInsert(item)}
                accessibilityRole="button"
                accessibilityLabel={t('quickNotes.insert')}
              >
                <CornerDownLeft size={14} color={tk.brand.ctaForeground} />
                <Text style={styles.insertBtnText}>{t('quickNotes.insert')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => onStartEdit(item)}
                accessibilityRole="button"
                accessibilityLabel={t('quickNotes.edit')}
              >
                <Pencil size={15} color={tk.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => onToggleArchive(item)}
                accessibilityRole="button"
                accessibilityLabel={
                  item.archived ? t('quickNotes.unarchive') : t('quickNotes.archive')
                }
              >
                {item.archived ? (
                  <ArchiveRestore size={15} color={tk.text.secondary} />
                ) : (
                  <Archive size={15} color={tk.text.secondary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => onDelete(item)}
                accessibilityRole="button"
                accessibilityLabel={t('common.delete')}
              >
                <Trash2 size={15} color={tk.danger.DEFAULT} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <QuickNoteEditor
        t={t}
        colorScheme={colorScheme}
        editingId={editingId}
        draft={draft}
        onDraftChange={onDraftChange}
        onSave={onSaveDraft}
        onClose={onCloseEditor}
      />
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
