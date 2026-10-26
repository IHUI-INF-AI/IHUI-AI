// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 快捷笔记屏(mobile-rn 薄壳,D03 文字纵切片)
 *
 * 共享屏 QuickNotesScreen(@ihui/rn-app,平台无关)+ 本端 store/状态胶水。
 * 挂载面:ChatScreen「+」来源面板入口,以全屏 Modal 打开;
 * 一键插入对话 = onInsert 回调交回 ChatScreen 的既有 setPrompt 通道(D43③ 同口径,
 * composeInsertText 单源拼接),不另开事件总线。
 */

import { useCallback, useMemo, useState } from 'react'
import { Modal } from 'react-native'
import { filterQuickNotes, type QuickNote } from '@ihui/shared/stores'
import { QuickNotesScreen as SharedQuickNotesScreen, type QuickNoteDraft } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { quickNotesStore } from '../stores/quick-notes'

const EMPTY_DRAFT: QuickNoteDraft = { title: '', content: '', group: '' }

export interface QuickNotesOverlayProps {
  visible: boolean
  onClose: () => void
  /** 选中笔记插入会话:文本拼接已由宿主(ChatScreen)经 composeInsertText 处理 */
  onInsert: (note: QuickNote) => void
}

export function QuickNotesOverlay({ visible, onClose, onInsert }: QuickNotesOverlayProps) {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const notes = quickNotesStore.useQuickNotesStore((s) => s.notes)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<QuickNoteDraft>(EMPTY_DRAFT)

  const visibleNotes = useMemo(
    () => filterQuickNotes(notes, { query, includeArchived: showArchived }),
    [notes, query, showArchived],
  )

  const resetEditor = useCallback(() => {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }, [])

  const handleSave = useCallback(() => {
    const s = quickNotesStore.getState()
    if (!draft.title.trim() && !draft.content.trim()) {
      resetEditor()
      return
    }
    if (editingId === null) return
    if (editingId === '') {
      s.createNote({ title: draft.title.trim(), content: draft.content, group: draft.group.trim() })
    } else {
      s.updateNote(editingId, {
        title: draft.title.trim(),
        content: draft.content,
        group: draft.group.trim(),
      })
    }
    resetEditor()
  }, [draft, editingId, resetEditor])

  if (!visible) return null

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SharedQuickNotesScreen
        t={t}
        colorScheme={resolvedTheme}
        notes={visibleNotes}
        query={query}
        showArchived={showArchived}
        editingId={editingId}
        draft={draft}
        onQueryChange={setQuery}
        onToggleShowArchived={() => setShowArchived((v) => !v)}
        onStartCreate={() => {
          setDraft(EMPTY_DRAFT)
          setEditingId('')
        }}
        onStartEdit={(note) => {
          setDraft({ title: note.title, content: note.content, group: note.group })
          setEditingId(note.id)
        }}
        onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        onSaveDraft={handleSave}
        onCloseEditor={resetEditor}
        onDelete={(note) => {
          quickNotesStore.getState().removeNote(note.id)
          resetEditor()
        }}
        onToggleArchive={(note) => {
          quickNotesStore.getState().setArchived(note.id, !note.archived)
        }}
        onInsert={(note) => {
          onInsert(note)
          onClose()
        }}
        onBack={onClose}
      />
    </Modal>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
