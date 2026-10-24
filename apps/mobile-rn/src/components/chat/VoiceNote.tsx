// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D43 会话内快捷笔记 — 语音笔记面板(mobile-rn 腿,票③ RN 接线)。
 *
 * 与 apps/web/src/components/chat/voice-note.tsx 同语义:
 * - 12 相收敛全部走 `@ihui/shared/chat/voice-note` 的 transitionVoiceNotePhase(唯一入口,
 *   端内不散写 phase 判断 / switch / 本地判定表;phase-matrix 结构锁把本文件登记为消费点);
 * - 录音/转写复用 useVoiceRecorder(expo-audio → ai-service /api/voice/stt);
 * - 归档事实源 = 服务端 chat_voice_notes(listVoiceNotes / createVoiceNote / deleteVoiceNote:
 *   列表分页 + 检索/分组交给服务端 + 乐观上行 + 写失败当场回滚 + 读失败显式喊错);
 * - 「插入对话」经 onInsert 回调交调用方(输入框既有 onChangeText 通道),不新建注入通道;
 * - 降级:sttEnabled=false → 松开后停留 waitingTranscript pending(明确文案,不崩)。
 *
 * 与 web 的两处端差(如实登记,不是缺陷藏匿):
 * ① useVoiceRecorder 契约把「失败/无权限/空录音」统一压成 onComplete(''),端侧无从区分
 *    空转写与识别失败 ⇒ 空串按 transcriptFailed + recognitionFailed 处理(web 的
 *    errors.emptyTranscript 档在 RN 不可达,键仍随五语同批落库,不删);
 * ② 授权/准备/连接三段在 hook 内部一次异步链完成,无逐段回调 ⇒ recording 翻真时按序
 *    补发 permissionGranted → mediaReady → connected,相序仍逐格走共享表推进。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Mic, Square, Trash2, X } from 'lucide-react-native'
import { createVoiceNote, deleteVoiceNote, listVoiceNotes } from '@ihui/api-client'
import { rnRadius } from '@ihui/design-tokens'
import type { VoiceNoteGroupFacet } from '@ihui/types'
import {
  formatVoiceNoteDuration,
  isVoiceNotePhaseTerminal,
  isVoiceNoteTranscriptPending,
  removeVoiceNote,
  toVoiceNoteRecord,
  transitionVoiceNotePhase,
  upsertVoiceNote,
  VOICE_NOTE_ARCHIVE_LIMIT,
  voiceNoteHasInsertableText,
  type VoiceNoteEvent,
  type VoiceNotePhase,
  type VoiceNoteRecord,
} from '@ihui/shared/chat/voice-note'
import { useI18n } from '../../i18n'
import { useVoiceRecorder } from '../../hooks/use-voice-recorder'
import { tokens } from '../../theme/active-tokens'

/** RN locale → whisper 语言提示(兜底 zh,与 VoiceInput/useVoiceRecorder 默认同档) */
const STT_LANGUAGE: Record<string, string> = {
  'zh-CN': 'zh',
  'zh-TW': 'zh',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
}

export interface VoiceNoteProps {
  /** 所属会话(随笔记落库;无会话上下文传 null,与 web 组件默认一致) */
  conversationId?: string | null
  /** 转写端点开关:false = 显式降级(转写占位相可达但停留 pending,不崩) */
  sttEnabled?: boolean
  /** 「插入对话」出口:调用方把文本写进输入框(HomeScreen 走 onChangeText 追加通道) */
  onInsert: (text: string) => void
}

export function VoiceNote({ conversationId = null, sttEnabled = true, onInsert }: VoiceNoteProps) {
  const { t, locale } = useI18n()

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<VoiceNotePhase>('ready')
  const [errorCode, setErrorCode] = useState<
    'permission' | 'startFailed' | 'saveFailed' | 'recognitionFailed' | null
  >(null)
  const [transcript, setTranscript] = useState('')
  const [archived, setArchived] = useState<VoiceNoteRecord[]>([])
  const [listError, setListError] = useState(false)
  // 检索与分组都落在服务端(与 web 同形):面板只持有查询条件,不持数据
  const [query, setQuery] = useState('')
  const [groupKey, setGroupKey] = useState<string | null>(null)
  const [groups, setGroups] = useState<VoiceNoteGroupFacet[]>([])

  const dispatch = useCallback((event: VoiceNoteEvent) => {
    setPhase((prev) => transitionVoiceNotePhase(prev, event))
  }, [])

  // 归档事实源 = 服务端 chat_voice_notes;archivedRef 只是删除回滚镜像,不参与渲染
  const archivedRef = useRef<VoiceNoteRecord[]>([])
  archivedRef.current = archived

  const loadArchive = useCallback(async () => {
    const res = await listVoiceNotes({
      pageSize: VOICE_NOTE_ARCHIVE_LIMIT,
      withGroups: '1',
      ...(query.trim() ? { q: query.trim() } : {}),
      ...(groupKey ? { groupKey } : {}),
    })
    if (!res.success) {
      // 读失败必须喊出来:静默兜空列表会让人以为「笔记都丢了」
      setListError(true)
      return
    }
    setListError(false)
    setArchived(res.data.list.map(toVoiceNoteRecord))
    setGroups(res.data.groups ?? [])
  }, [groupKey, query])

  // 输入即搜去抖 300ms(每敲一个字符打一次后端会把列表打抖);首帧不去抖
  const firstLoadRef = useRef(true)
  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false
      void loadArchive()
      return
    }
    const timer = setTimeout(() => void loadArchive(), 300)
    return () => clearTimeout(timer)
  }, [loadArchive])

  // 落一条笔记时「松手这一瞬」的时长镜像(hook 的 duration 是每秒 state,stop 续体读 ref)
  const durationSecRef = useRef(0)

  /**
   * 乐观上行,写失败当场回滚 + 显式报错 —— 不留 renderer-only 假记录
   * (那正是本仓反复登记的「看着存上了,刷新就没」那一型,与 web 组件同判据)。
   */
  const persistNote = useCallback(
    async (text: string | null) => {
      const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const durationMs = durationSecRef.current * 1000
      const optimistic: VoiceNoteRecord = {
        id: pendingId,
        conversationId,
        createdAt: new Date().toISOString(),
        durationMs,
        transcript: text,
      }
      setArchived((prev) => upsertVoiceNote(prev, optimistic))
      const res = await createVoiceNote({
        // 标题优先取转写起首;仅存音频时回落到本命名空间自带的「语音笔记」文案(不写死中文)
        title: (text?.trim() || t('chat.voiceNote.title')).slice(0, 200),
        transcript: text,
        durationMs,
        conversationId,
      })
      if (!res.success) {
        setArchived((prev) => removeVoiceNote(prev, pendingId))
        setErrorCode('saveFailed')
        return
      }
      void loadArchive()
    },
    [conversationId, loadArchive, t],
  )

  const removeNote = useCallback(async (id: string) => {
    const snapshot = archivedRef.current
    setArchived(removeVoiceNote(snapshot, id))
    const res = await deleteVoiceNote(id)
    if (!res.success) setArchived(snapshot)
  }, [])

  const handleTranscript = useCallback(
    (text: string) => {
      if (!sttEnabled) return
      // hook 契约:空串 = 失败/无权限/空录音,端侧无从细分(见文件头端差①)
      if (text.trim().length === 0) {
        setErrorCode('recognitionFailed')
        dispatch('transcriptFailed')
        return
      }
      setTranscript(text)
      void persistNote(text)
      dispatch('transcriptReady')
    },
    [dispatch, persistNote, sttEnabled],
  )

  const handleUnavailable = useCallback(
    (reason: 'permission-denied' | 'record-failed') => {
      setErrorCode(reason === 'permission-denied' ? 'permission' : 'startFailed')
      dispatch('permissionDenied')
    },
    [dispatch],
  )

  const { recording, transcribing, duration, start, stop } = useVoiceRecorder({
    onComplete: handleTranscript,
    onUnavailable: handleUnavailable,
    transcribe: sttEnabled,
    language: STT_LANGUAGE[locale] ?? 'zh',
  })

  // 授权/准备/连接在 hook 内一次异步链完成 ⇒ recording 翻真时按序补发三段(端差②)
  useEffect(() => {
    if (recording) {
      dispatch('permissionGranted')
      dispatch('mediaReady')
      dispatch('connected')
    }
  }, [recording, dispatch])

  durationSecRef.current = duration

  const startRecording = useCallback(() => {
    setErrorCode(null)
    setTranscript('')
    dispatch('start')
    start()
  }, [dispatch, start])

  const stopRecording = useCallback(() => {
    dispatch('stop')
    void stop()
    dispatch('saved')
  }, [dispatch, stop])

  const resetToReady = useCallback(() => {
    setErrorCode(null)
    setTranscript('')
    // 终态唯一合法回 ready 出边;非终态 no-op 原地(不散写 setPhase)
    dispatch('retry')
  }, [dispatch])

  const saveAudioOnly = useCallback(() => {
    void persistNote(null)
    dispatch('dismiss')
  }, [dispatch, persistNote])

  const closePanel = useCallback(() => {
    if (recording) stopRecording()
    setOpen(false)
  }, [recording, stopRecording])

  const busy = !isVoiceNotePhaseTerminal(phase) && phase !== 'ready'
  const showPhaseLabel = busy || isVoiceNotePhaseTerminal(phase)

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={t('chat.voiceNote.title')}
        testID="voice-note-trigger"
        style={styles.trigger}
      >
        <Mic size={16} color={tokens.text.secondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closePanel}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePanel} />
          <View style={styles.panel} testID="voice-note-panel">
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{t('chat.voiceNote.title')}</Text>
              <Pressable
                onPress={closePanel}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('chat.voiceNote.action.dismiss')}
                testID="voice-note-close"
              >
                <X size={16} color={tokens.text.secondary} />
              </Pressable>
            </View>

            {/* phase 徽章(12 相文案全量走 i18n,与 web 同命名空间) */}
            {showPhaseLabel && (
              <View style={styles.phaseBadge} testID="voice-note-phase">
                <Text style={styles.phaseText}>{t(`chat.voiceNote.phase.${phase}`)}</Text>
                {(recording || isVoiceNoteTranscriptPending(phase)) && (
                  <Text style={styles.phaseDuration}>
                    {formatVoiceNoteDuration(durationSecRef.current * 1000)}
                  </Text>
                )}
              </View>
            )}

            {errorCode && (
              <Text style={styles.errorText} testID="voice-note-error">
                {t(`chat.voiceNote.errors.${errorCode}`)}
              </Text>
            )}

            {phase === 'completed' && transcript && (
              <ScrollView style={styles.transcriptBox} testID="voice-note-transcript">
                <Text style={styles.transcriptText}>{transcript}</Text>
              </ScrollView>
            )}

            {/* 降级文案:waitingTranscript 停留 pending(端点缺失) */}
            {isVoiceNoteTranscriptPending(phase) && !sttEnabled && (
              <Text style={styles.pendingText} testID="voice-note-stt-pending">
                {t('chat.voiceNote.errors.sttPending')}
              </Text>
            )}

            <View style={styles.actionRow}>
              {phase === 'ready' && (
                <Pressable
                  style={styles.primaryBtn}
                  onPress={startRecording}
                  accessibilityRole="button"
                  testID="voice-note-start"
                >
                  <Mic size={14} color={tokens.brand.ctaForeground} />
                  <Text style={styles.primaryBtnText}>{t('chat.voiceNote.action.start')}</Text>
                </Pressable>
              )}
              {busy && (
                <Pressable
                  style={styles.stopBtn}
                  onPress={stopRecording}
                  accessibilityRole="button"
                  disabled={!recording}
                  testID="voice-note-stop"
                >
                  {transcribing ? (
                    <ActivityIndicator size="small" color={tokens.brand.ctaForeground} />
                  ) : (
                    <Square size={12} color={tokens.brand.ctaForeground} />
                  )}
                  <Text style={styles.primaryBtnText}>{t('chat.voiceNote.action.stop')}</Text>
                </Pressable>
              )}
              {/* 转写 pending 中用户显式存盘(dismiss → completed) */}
              {isVoiceNoteTranscriptPending(phase) && sttEnabled && (
                <Pressable
                  style={styles.outlineBtn}
                  onPress={saveAudioOnly}
                  accessibilityRole="button"
                  testID="voice-note-save-audio-only"
                >
                  <Text style={styles.outlineBtnText}>
                    {t('chat.voiceNote.action.saveAudioOnly')}
                  </Text>
                </Pressable>
              )}
              {isVoiceNotePhaseTerminal(phase) && (
                <Pressable
                  style={styles.outlineBtn}
                  onPress={resetToReady}
                  accessibilityRole="button"
                  testID="voice-note-retry"
                >
                  <Text style={styles.outlineBtnText}>{t('chat.voiceNote.action.retry')}</Text>
                </Pressable>
              )}
            </View>

            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('chat.voiceNote.searchPlaceholder')}
              placeholderTextColor={tokens.text.tertiary}
              testID="voice-note-search"
            />

            {groups.length > 0 && (
              <View style={styles.groupRow} testID="voice-note-filters">
                <Pressable
                  style={[styles.chip, groupKey === null ? styles.chipActive : null]}
                  onPress={() => setGroupKey(null)}
                  accessibilityRole="button"
                  testID="voice-note-group-chip-all"
                >
                  <Text style={styles.chipText}>{t('chat.voiceNote.groupAll')}</Text>
                </Pressable>
                {groups.map((facet) => (
                  <Pressable
                    key={facet.groupKey}
                    style={[styles.chip, groupKey === facet.groupKey ? styles.chipActive : null]}
                    onPress={() => setGroupKey(facet.groupKey)}
                    accessibilityRole="button"
                    testID="voice-note-group-chip"
                  >
                    <Text style={styles.chipText}>
                      {facet.groupKey} {facet.count}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {listError && (
              <Text style={styles.errorText} testID="voice-note-list-error">
                {t('chat.voiceNote.errors.loadFailed')}
              </Text>
            )}

            {/* 归档列表(服务端事实源:新建→落库→插入对话→删除) */}
            <ScrollView style={styles.archiveList}>
              {archived
                .slice()
                .reverse()
                .map((note) => (
                  <View key={note.id} style={styles.archiveItem} testID="voice-note-archive-item">
                    <Text style={styles.archiveDuration}>
                      {formatVoiceNoteDuration(note.durationMs)}
                    </Text>
                    <Text style={styles.archiveText} numberOfLines={1}>
                      {/* 无转写=只存了音频,给命名空间自带的「语音笔记」文案,不猜任何相 */}
                      {note.transcript ?? t('chat.voiceNote.title')}
                    </Text>
                    {voiceNoteHasInsertableText(note) && (
                      <Pressable
                        onPress={() => onInsert(note.transcript ?? '')}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t('chat.voiceNote.action.insertToInput')}
                        testID="voice-note-insert"
                      >
                        <Text style={styles.archiveAction}>
                          {t('chat.voiceNote.action.insertToInput')}
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => void removeNote(note.id)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={t('chat.voiceNote.action.dismiss')}
                      testID="voice-note-archive-delete"
                    >
                      <Trash2 size={14} color={tokens.text.secondary} />
                    </Pressable>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  trigger: { paddingHorizontal: 4, paddingVertical: 4 },
  backdrop: { flex: 1, backgroundColor: tokens.overlay.modal, justifyContent: 'flex-end' },
  panel: {
    backgroundColor: tokens.surface.card,
    borderTopLeftRadius: rnRadius.lg, // panel 档 lg(8)
    borderTopRightRadius: rnRadius.lg,
    padding: 12,
    maxHeight: '70%',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  panelTitle: { fontSize: 13, fontWeight: '500', color: tokens.text.primary },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.border.medium,
    borderRadius: rnRadius.sm, // control 档 sm(4)
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  phaseText: { fontSize: 12, color: tokens.text.secondary },
  phaseDuration: { marginLeft: 8, fontSize: 12, color: tokens.text.secondary },
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT, marginBottom: 8 },
  pendingText: { fontSize: 12, color: tokens.text.tertiary, marginBottom: 8 },
  transcriptBox: {
    borderWidth: 1,
    borderColor: tokens.border.medium,
    borderRadius: rnRadius.sm, // control 档 sm(4)
    padding: 8,
    marginBottom: 8,
    maxHeight: 128,
  },
  transcriptText: { fontSize: 12, color: tokens.text.primary },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.brand.cta,
    borderRadius: rnRadius.sm, // control 档 sm(4)
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.danger.DEFAULT,
    borderRadius: rnRadius.sm, // control 档 sm(4)
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  primaryBtnText: { fontSize: 12, color: tokens.brand.ctaForeground },
  outlineBtn: {
    borderWidth: 1,
    borderColor: tokens.border.medium,
    borderRadius: rnRadius.sm, // control 档 sm(4)
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  outlineBtnText: { fontSize: 12, color: tokens.text.secondary },
  searchInput: {
    borderWidth: 1,
    borderColor: tokens.border.medium,
    borderRadius: rnRadius.sm, // control 档 sm(4)
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: tokens.text.primary,
    marginBottom: 8,
  },
  groupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: tokens.border.medium,
    borderRadius: rnRadius.sm, // control 档 sm(4)
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipActive: { backgroundColor: tokens.surface.light },
  chipText: { fontSize: 11, color: tokens.text.secondary },
  archiveList: { maxHeight: 220 },
  archiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  archiveDuration: { fontSize: 11, color: tokens.text.tertiary },
  archiveText: { flex: 1, fontSize: 12, color: tokens.text.primary },
  archiveAction: { fontSize: 11, color: tokens.text.secondary },
})

export default VoiceNote
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
