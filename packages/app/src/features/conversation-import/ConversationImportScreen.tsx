// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端共享 UI:不含平台 API。文件选择 / multipart 上传由调用端(RN)以 props 注入。
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { AlertTriangle, CheckCircle2, FileUp, History, ListChecks } from 'lucide-react-native'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'

import { rnRadius } from '@ihui/design-tokens'

/**
 * 外部会话导入共享屏(D28 多端同步,2026-09-21 立)
 *
 * 对应 web 端 apps/web/app/(main)/settings/import 的「会话导入」Tab。
 * 流程:选来源 → 选文件 → 解析预览(勾选) → 逐会话串行提交 → 导入历史。
 *
 * 隐私约束:预览只渲染会话元信息(标题 / 消息数 / 模型 / 时间),
 * **不渲染消息正文**,正文只留在调用端内存里用于提交。
 *
 * 平台无关:UI + 选择/进度状态机;文件选择、multipart 上传、commit、
 * 历史拉取全部通过 props 注入(见 ConversationImportScreenProps)。
 */

/** 注入式翻译函数(与 mobile-rn useI18n 的 t 同签名) */
export type ConversationImportTFunction = (
  key: string,
  params?: Record<string, string | number>,
) => string

/** 来源选项:value 为端侧持有的后端枚举字面量,UI 只做透传不解释 */
export interface ConversationImportSourceOption {
  value: string
  label: string
  hint: string
}

/** 已选文件(平台 adapter 返回;size 在部分平台不可得) */
export interface PickedImportFile {
  name: string
  uri: string
  mimeType: string
  size?: number
}

/** 解析预览的一行会话元信息 */
export interface ImportPreviewRow {
  /** 稳定标识,commit 时回传 */
  id: number
  title: string
  messageCount: number
  model: string
  createdAt: string
}

export type ImportParseResult =
  | { ok: true; rows: ImportPreviewRow[]; truncated: boolean; warnings: string[] }
  | { ok: false; error: string }

export interface ImportCommitResult {
  imported: number
  failed: number
}

/** 导入历史状态(未知状态端侧归一为 'unknown',UI 直接显示原文) */
export type ConversationImportHistoryStatus = 'success' | 'partial' | 'failed' | 'unknown'

export interface ConversationImportHistoryRow {
  id: string
  fileName: string
  status: ConversationImportHistoryStatus
  statusLabel: string
  parsedCount: number
  importedCount: number
  importedAt: string
}

export interface ConversationImportScreenProps {
  t: ConversationImportTFunction
  colorScheme?: AppThemeMode
  sources: ConversationImportSourceOption[]
  /** 打开平台文件选择器;取消返回 null */
  onPickFile: (sourceValue: string) => Promise<PickedImportFile | null>
  /** 上传并解析导出文件 */
  onParse: (file: PickedImportFile, sourceValue: string) => Promise<ImportParseResult>
  /** 逐会话串行提交(第一个参数为当前来源,端侧据此映射后端枚举);通过 reportProgress 回灌进度 */
  onCommit: (
    sourceValue: string,
    rowIds: readonly number[],
    reportProgress: (progress: { done: number; total: number }) => void,
  ) => Promise<ImportCommitResult | string>
  onLoadHistory: () => Promise<ConversationImportHistoryRow[]>
}

export function ConversationImportScreen({
  t,
  colorScheme = 'light',
  sources,
  onPickFile,
  onParse,
  onCommit,
  onLoadHistory,
}: ConversationImportScreenProps) {
  const tk = useMemo(() => getTokens(colorScheme), [colorScheme])
  const styles = useMemo(() => createStyles(tk), [tk])

  const [source, setSource] = useState('')
  const [file, setFile] = useState<PickedImportFile | null>(null)
  const [rows, setRows] = useState<ImportPreviewRow[]>([])
  const [truncated, setTruncated] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [picking, setPicking] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [doneMessage, setDoneMessage] = useState('')
  const [history, setHistory] = useState<ConversationImportHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')

  const resetPreview = useCallback((): void => {
    setFile(null)
    setRows([])
    setTruncated(false)
    setWarnings([])
    setSelected(new Set())
    setProgress({ done: 0, total: 0 })
  }, [])

  const loadHistory = useCallback(async (): Promise<void> => {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      setHistory(await onLoadHistory())
    } catch (e) {
      setHistoryError(t('conversationImport.historyFailed', { error: toMessage(e) }))
    } finally {
      setHistoryLoading(false)
    }
  }, [onLoadHistory, t])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  /** 选文件 → 解析(两步串联,失败只提示不落预览) */
  const pickAndParse = async (): Promise<void> => {
    if (!source) {
      setError(t('conversationImport.errorNoSource'))
      return
    }
    setError('')
    setDoneMessage('')
    setPicking(true)
    try {
      const picked = await onPickFile(source)
      if (!picked) return
      const parsed = await onParse(picked, source)
      if (!parsed.ok) {
        resetPreview()
        setError(parsed.error)
        return
      }
      if (parsed.rows.length === 0) {
        resetPreview()
        setFile(picked)
        setError(t('conversationImport.parseEmpty'))
        return
      }
      setFile(picked)
      setRows(parsed.rows)
      setTruncated(parsed.truncated)
      setWarnings(parsed.warnings)
      setSelected(new Set(parsed.rows.map((r) => r.id)))
    } catch (e) {
      setError(t('conversationImport.parseFailed', { error: toMessage(e) }))
    } finally {
      setPicking(false)
    }
  }

  const toggleRow = (id: number): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (): void => {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))))
  }

  const commit = async (): Promise<void> => {
    if (selected.size === 0 || committing) return
    setError('')
    setDoneMessage('')
    setCommitting(true)
    try {
      const result = await onCommit(source, [...selected], setProgress)
      if (typeof result === 'string') {
        setError(result)
      } else {
        setDoneMessage(
          t('conversationImport.commitDone', { imported: result.imported, failed: result.failed }),
        )
        resetPreview()
        void loadHistory()
      }
    } catch (e) {
      setError(t('conversationImport.commitFailed', { error: toMessage(e) }))
    } finally {
      setCommitting(false)
    }
  }

  const allSelected = rows.length > 0 && selected.size === rows.length

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.body}>
      <Text style={styles.desc}>{t('conversationImport.desc')}</Text>

      {/* Step 1:来源 */}
      <Text style={styles.sectionTitle}>{t('conversationImport.sourcesTitle')}</Text>
      <View style={styles.sourceGrid}>
        {sources.map((s) => {
          const active = s.value === source
          return (
            <TouchableOpacity
              key={s.value}
              accessibilityRole="button"
              style={[styles.sourceCard, active ? styles.sourceCardActive : null]}
              onPress={() => {
                setSource(s.value)
                resetPreview()
                setError('')
              }}
            >
              <Text style={[styles.sourceLabel, active ? styles.sourceLabelActive : null]}>
                {s.label}
              </Text>
              <Text style={styles.sourceHint}>{s.hint}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Step 2:选文件 + 解析 */}
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.pickButton}
        onPress={() => void pickAndParse()}
        disabled={picking || committing}
      >
        {picking ? (
          <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
        ) : (
          <FileUp size={16} color={tk.brand.ctaForeground} />
        )}
        <Text style={styles.pickButtonText}>
          {picking ? t('conversationImport.parsing') : t('conversationImport.pickFile')}
        </Text>
      </TouchableOpacity>
      {file ? (
        <Text style={styles.fileLine}>
          {t('conversationImport.fileSelected', { name: file.name })}
        </Text>
      ) : (
        <Text style={styles.hint}>{t('conversationImport.uploadHint')}</Text>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {doneMessage ? <Text style={styles.doneText}>{doneMessage}</Text> : null}

      {/* Step 3:解析预览 */}
      {rows.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.sectionTitle}>{t('conversationImport.previewTitle')}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={toggleAll}>
              <Text style={styles.linkText}>
                {allSelected
                  ? t('conversationImport.deselectAll')
                  : t('conversationImport.selectAll')}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            {t('conversationImport.selected', { count: selected.size, total: rows.length })}
          </Text>

          {truncated ? (
            <View style={styles.warningBox}>
              <AlertTriangle size={13} color={tk.warning.DEFAULT} />
              <Text style={styles.warningText}>{t('conversationImport.truncatedWarning')}</Text>
            </View>
          ) : null}
          {warnings.map((w, i) => (
            <View key={`${i}-${w}`} style={styles.warningBox}>
              <AlertTriangle size={13} color={tk.warning.DEFAULT} />
              <Text style={styles.warningText}>{w}</Text>
            </View>
          ))}

          {rows.map((row) => {
            const checked = selected.has(row.id)
            return (
              <TouchableOpacity
                key={row.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                style={[styles.rowCard, checked ? styles.rowCardActive : null]}
                onPress={() => toggleRow(row.id)}
              >
                <View style={styles.rowTitleLine}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {row.title || t('conversationImport.conversationUntitled')}
                  </Text>
                  {checked ? <CheckCircle2 size={15} color={tk.brand.DEFAULT} /> : null}
                </View>
                <Text style={styles.rowMeta} numberOfLines={2}>
                  {t('conversationImport.messagesCount', { count: row.messageCount })}
                  {` · ${row.model || '—'} · ${row.createdAt || '—'}`}
                </Text>
              </TouchableOpacity>
            )
          })}

          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.commitButton, selected.size === 0 ? styles.commitButtonDisabled : null]}
            onPress={() => void commit()}
            disabled={selected.size === 0 || committing}
          >
            <ListChecks size={16} color={tk.brand.ctaForeground} />
            <Text style={styles.commitButtonText}>
              {committing
                ? t('conversationImport.committing', { done: progress.done, total: progress.total })
                : t('conversationImport.commit')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Step 4:导入历史 */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <History size={15} color={tk.text.secondary} />
          <Text style={styles.sectionTitle}>{t('conversationImport.historyTitle')}</Text>
        </View>
        {historyLoading ? (
          <Text style={styles.hint}>{t('conversationImport.parsing')}</Text>
        ) : historyError ? (
          <Text style={styles.errorText}>{historyError}</Text>
        ) : history.length === 0 ? (
          <Text style={styles.hint}>{t('conversationImport.historyEmpty')}</Text>
        ) : (
          history.map((h) => (
            <View key={h.id} style={styles.historyRow}>
              <View style={styles.historyMain}>
                <Text style={styles.historyFile} numberOfLines={1}>
                  {h.fileName || '—'}
                </Text>
                <Text style={styles.rowMeta}>
                  {`${t('conversationImport.historyParsed')} ${h.parsedCount} · ${t(
                    'conversationImport.historyImported',
                  )} ${h.importedCount} · ${h.importedAt || '—'}`}
                </Text>
              </View>
              <Text
                style={[
                  styles.statusBadge,
                  h.status === 'success'
                    ? styles.statusSuccess
                    : h.status === 'failed'
                      ? styles.statusFailed
                      : styles.statusPartial,
                ]}
              >
                {h.statusLabel}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

/** 把 unknown 异常收敛成可展示文本(不打印堆栈) */
function toMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : String(e)
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    body: { padding: 12, gap: 8 },
    desc: { fontSize: 12, lineHeight: 18, color: tk.text.secondary },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    hint: { fontSize: 11, lineHeight: 16, color: tk.text.tertiary },
    fileLine: { fontSize: 12, color: tk.text.medium },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT },
    doneText: { fontSize: 12, color: tk.success.deep },
    card: {
      padding: 12,
      gap: 8,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      justifyContent: 'space-between',
    },
    sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    sourceCard: {
      flexGrow: 1,
      flexBasis: '46%',
      padding: 10,
      gap: 2,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    sourceCardActive: { borderColor: tk.brandAccent.deep, backgroundColor: tk.surface.muted },
    sourceLabel: { fontSize: 12, fontWeight: '600', color: tk.text.medium },
    sourceLabelActive: { color: tk.text.primary },
    sourceHint: { fontSize: 10, lineHeight: 14, color: tk.text.tertiary },
    pickButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 40,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.brand.cta,
    },
    pickButtonText: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
    linkText: { fontSize: 12, color: tk.brand.dark },
    rowCard: {
      padding: 10,
      gap: 2,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    rowCardActive: { borderColor: tk.brandAccent.deep, backgroundColor: tk.surface.muted },
    rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: tk.text.primary },
    rowMeta: { fontSize: 11, lineHeight: 15, color: tk.text.tertiary },
    commitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 36,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.brand.cta,
    },
    commitButtonDisabled: { backgroundColor: tk.border.medium },
    commitButtonText: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      padding: 8,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.warning.light,
    },
    warningText: { flex: 1, fontSize: 11, lineHeight: 16, color: tk.warning.amberText },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    historyMain: { flex: 1, gap: 2 },
    historyFile: { fontSize: 12, fontWeight: '600', color: tk.text.primary },
    statusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: rnRadius.sm,
      fontSize: 10,
      fontWeight: '600',
      overflow: 'hidden',
    },
    statusSuccess: { color: tk.success.deepText, backgroundColor: tk.success.light },
    statusPartial: { color: tk.warning.amberText, backgroundColor: tk.warning.light },
    statusFailed: { color: tk.error.text, backgroundColor: tk.error.bg },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
