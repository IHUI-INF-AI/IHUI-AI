import { useI18n } from '../../i18n'
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 新建:会话内「语音笔记」插入面板(D43③)。列表只读(不归档/不删除),零副作用、不落盘。

import { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Mic, X } from 'lucide-react-native'
import { listVoiceNotes, type VoiceNoteItem } from '@ihui/api-client'
import { tokens } from '../../theme/active-tokens'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { rpx } from '../../utils/rpx'
import { formatShortDateTime } from '../../utils/date-utils'

/** durationMs → `m:ss`;0/负值视为「无时长」(回空串,行上只留创建时间) */
function formatDuration(durationMs: number): string {
  if (!durationMs || durationMs <= 0) return ''
  const totalSec = Math.round(durationMs / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  // ── 与 VoicePanel 同口径的弹窗容器 ──
  modalMask: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listDialogContent: {
    width: '88%',
    maxHeight: '70%',
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.xl,
    overflow: 'hidden',
  },
  listDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(20),
    backgroundColor: tokens.surface.card,
  },
  listDialogTitle: {
    fontSize: rnType.strong.size,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  listDialogClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── 顶部「新建录音」入口 ──
  newRecordSlot: {
    marginHorizontal: rpx(32),
    marginTop: rpx(8),
  },
  newRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rpx(12),
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(24),
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.sm,
  },
  newRecordText: {
    fontSize: rnType.strong.size,
    fontWeight: '500',
    color: tokens.text.primary,
  },
  // ── 列表区三态 ──
  notesScroll: {
    maxHeight: rpx(680),
    paddingHorizontal: rpx(32),
    paddingTop: rpx(16),
  },
  notesRowSlot: {
    marginBottom: rpx(12),
  },
  notesRow: {
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(20),
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.sm,
  },
  notesRowTitle: {
    fontSize: rnType.strong.size,
    color: tokens.text.primary,
  },
  notesRowMeta: {
    marginTop: rpx(8),
    fontSize: rnType.label.size,
    color: tokens.text.tertiary,
  },
  loadingText: {
    textAlign: 'center',
    paddingVertical: rpx(48),
    fontSize: 13,
    color: tokens.text.secondary,
  },
  // 空态沿用全仓 emptyText 口径(AgentList/BottomPopup 同值)
  emptyText: {
    textAlign: 'center',
    paddingVertical: rnSpacing['2xl'],
    fontSize: 13,
    color: tokens.text.tertiary,
  },
  errorText: {
    textAlign: 'center',
    paddingTop: rpx(48),
    paddingBottom: rpx(16),
    fontSize: 13,
    color: tokens.error.text,
  },
  retryBtn: {
    alignSelf: 'center',
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(16),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
    marginBottom: rpx(24),
  },
  retryText: {
    fontSize: rnType.body.size,
    fontWeight: '500',
    color: tokens.text.primary,
  },
  // ── 底部取消 ──
  panelCancelBtn: {
    marginHorizontal: rpx(32),
    marginTop: rpx(16),
    height: 48,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelItemPressed: {
    opacity: 0.85,
  },
  notesCancelBtn: {
    marginTop: rpx(24),
    marginBottom: rpx(32),
  },
  panelCancelText: {
    fontSize: rnType.title.size,
    fontWeight: '500',
    color: tokens.text.primary,
  },
})

interface NotesPanelProps {
  /** 弹窗可见性(对齐 ChatScreen 的 ttsVisible 一类开关) */
  visible?: boolean
  /** 选中某条笔记:交给调用方塞进输入框,本面板不落盘、不写入 */
  onInsertNote: (note: VoiceNoteItem) => void
  /** 顶部「新建录音」入口:交给调用方接既有录音链路 */
  onRecordNew: () => void
  /** 关闭弹窗 */
  onClose: () => void
}

/**
 * 语音笔记插入面板:挂载时按 listVoiceNotes({}) 拉一次只读列表,
 * 三态(loading / empty / error+重试),点行回 onInsertNote。
 * 归档/删除不在本面板(属后台或别的票)。
 */
export function NotesPanel({
  visible = false,
  onInsertNote,
  onRecordNew,
  onClose,
}: NotesPanelProps) {
  const { t } = useI18n()
  const [notes, setNotes] = useState<VoiceNoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      // 信封解包同 ActivityScreen/WorkflowsScreen:`{ code,message,data }` 里要的是 data.list,
      // 把整个信封当数组会让列表永远空且不抛错。
      const res = await listVoiceNotes({})
      if (!res.success) throw new Error(res.error || t('chat.notes.loadFailShort'))
      setNotes(res.data?.list ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('chat.notes.loadFailShort'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalMask} onPress={onClose}>
        <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.listDialogHeader}>
            <Text style={styles.listDialogTitle}>语音笔记</Text>
            <Pressable
              hitSlop={8}
              onPress={onClose}
              style={styles.listDialogClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <X size={20} color={tokens.text.primary} />
            </Pressable>
          </View>

          <Pressable
            style={styles.newRecordSlot}
            onPress={onRecordNew}
            accessibilityRole="button"
            accessibilityLabel={t('chat.notes.recordNew')}
          >
            {({ pressed }) => (
              <View style={[styles.newRecordBtn, pressed && styles.panelItemPressed]}>
                <Mic size={16} color={tokens.text.primary} />
                <Text style={styles.newRecordText}>新建录音</Text>
              </View>
            )}
          </Pressable>

          {loading ? (
            <Text style={styles.loadingText}>加载中...</Text>
          ) : error ? (
            <>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                onPress={() => void load()}
                style={styles.retryBtn}
                accessibilityRole="button"
                accessibilityLabel={t('common.retryShort')}
              >
                <Text style={styles.retryText}>重试</Text>
              </Pressable>
            </>
          ) : notes.length === 0 ? (
            <Text style={styles.emptyText}>暂无语音笔记</Text>
          ) : (
            <ScrollView style={styles.notesScroll} showsVerticalScrollIndicator={false}>
              {notes.map((note) => (
                <Pressable
                  key={note.id}
                  onPress={() => onInsertNote(note)}
                  style={styles.notesRowSlot}
                  accessibilityRole="button"
                  accessibilityLabel={note.title}
                >
                  {({ pressed }) => (
                    <View style={[styles.notesRow, pressed && styles.panelItemPressed]}>
                      <Text style={styles.notesRowTitle} numberOfLines={1}>
                        {note.title}
                      </Text>
                      <Text style={styles.notesRowMeta}>
                        {[formatDuration(note.durationMs), formatShortDateTime(note.createdAt)]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Pressable
            onPress={onClose}
            style={[styles.panelCancelBtn, styles.notesCancelBtn]}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={styles.panelCancelText}>取消</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
