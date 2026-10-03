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
import { AlertTriangle, CheckCircle2, FileUp, History, ListChecks, Sparkles } from 'lucide-react-native'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'

import { rnRadius } from '@ihui/design-tokens'
import { ImportAnalysisSheet } from './ImportAnalysisSheet'
import type { ImportSource } from '@ihui/shared/import-analysis'

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

/**
 * D28 补齐层(2026-10-03):`committed` 是一份成功落库的会话清单。
 *
 * 声明为**可选**而非联合类型的第二分支:联合会让消费侧在 `typeof result === 'string'`
 * 的 else 分支里仍拿到 `committed` 不存在的报错(实测 TS2339),而可选字段一条就够 ——
 * 端侧还没回带清单时(RN 端接的是既有 onCommit 契约)结果区不渲染,而不是报错。
 */
export interface ImportCommitResult {
  imported: number
  failed: number
  readonly committed?: readonly CommittedImportConversation[]
}

/**
 * D28 补齐层(2026-10-03):一条成功落库的会话 —— 结果区渲染与两个出口的载荷。
 *
 * `source` 必带且**取落库时那一份**:用户导完可能顺手点了别的来源卡,若分析弹窗去读
 * 当前 source 状态,一个微信导入的会话会拿到 codex 的推荐场景 ——
 * 恰好毁掉"wechat 默认推荐聊天记录类"这条判据(web 端同款注)。
 */
export interface CommittedImportConversation {
  readonly conversationId: string
  readonly title: string
  readonly messageCount: number
  readonly source: ImportSource
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
  /**
   * 「打开会话」:跳到该导入会话的详情/消息区(端侧导航,RN 走 Chat 路由)。
   * 不给时结果区只渲染「用场景分析」一个出口(不给点不动的按钮)。
   */
  onOpenConversation?: (conversationId: string) => void
  /**
   * 「用场景分析」发起:收到拼好的分析指令,端侧接**既有**聊天通道发出
   * (RN 接 ChatScreen 的 streamChat,与 P1.4 网页链接同一出口),不新造 LLM 调用链。
   */
  onAnalyze?: (params: {
    conversationId: string
    source: ImportSource
    prompt: string
  }) => void
}

export function ConversationImportScreen({
  t,
  colorScheme = 'light',
  sources,
  onPickFile,
  onParse,
  onCommit,
  onLoadHistory,
  onOpenConversation,
  onAnalyze,
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
  // D28 补齐层(2026-10-03):导入**结果区**。
  // 此前 commit 完只有一句 toast,用户看不到"导进来几个、哪个成功了、接下来能干什么";
  // 导完最想要的下一步(用场景分析)没有落点。端侧在 onCommit 的返回值里回带
  // committed 清单(RN 侧由 commitConversationImport 的 conversationId 攒),
  // 不给时结果区不渲染 —— 没有会话 id 就给不出可点的出口,画个空结果区是假 affordance。
  const [committed, setCommitted] = useState<readonly CommittedImportConversation[]>([])
  // 「用场景分析」弹层的目标会话(null = 关闭)
  const [analysisTarget, setAnalysisTarget] = useState<CommittedImportConversation | null>(null)

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
        // 结果区取代"导完就没下文":清单来自端侧回带,端侧没给就不渲染
        setCommitted(result.committed ?? [])
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
    <>
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

        {/* D28 补齐层:导入结果区。每个成功落库的会话给两个出口 ——
            打开会话看原始记录 / 直接用场景分析。这是"导入 → 拿来分析"在导入屏的落点。
            没有 onAnalyze 的端(本组件不接聊天通道时)只给「打开会话」,不画点不动的按钮。 */}
        {committed.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <CheckCircle2 size={15} color={tk.success.deep} />
              <Text style={styles.sectionTitle}>
                {t('conversationImport.resultTitle', { count: committed.length })}
              </Text>
            </View>
            {committed.map((c) => (
              <View key={c.conversationId} style={styles.resultRow}>
                <View style={styles.historyMain}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {c.title || t('conversationImport.conversationUntitled')}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {t('conversationImport.messagesCount', { count: c.messageCount })}
                  </Text>
                </View>
                <View style={styles.resultActions}>
                  {onOpenConversation && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={styles.resultBtnOutline}
                      onPress={() => onOpenConversation(c.conversationId)}
                    >
                      <Text style={styles.resultBtnOutlineText}>
                        {t('conversationImport.resultOpen')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {onAnalyze && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={styles.resultBtn}
                      onPress={() => setAnalysisTarget(c)}
                    >
                      <Sparkles size={13} color={tk.brand.ctaForeground} />
                      <Text style={styles.resultBtnText}>
                        {t('conversationImport.analysisOpen')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

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

    {/* 「用场景分析」弹层:按需挂载(analysisTarget 为 null 时不渲染)。
        场景目录 chunk 由弹层内部的动态 import 在挂载后才拉,RN 首屏不等它。
        关闭时清 target —— 留着一个已关闭的目标会让下次开弹窗显示上一个会话的标题。
        source 取**该条目落库时那一份**,不读当前来源选择状态。 */}
    {analysisTarget && onAnalyze && (
      <ImportAnalysisSheet
        visible
        colorScheme={colorScheme}
        t={t}
        source={analysisTarget.source}
        onClose={() => setAnalysisTarget(null)}
        onSubmit={(prompt) => {
          const target = analysisTarget
          setAnalysisTarget(null)
          onAnalyze({
            conversationId: target.conversationId,
            source: target.source,
            prompt,
          })
        }}
      />
    )}
    </>
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
      borderRadius: rnRadius.lg,
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
      borderRadius: rnRadius.sm,
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
      borderRadius: rnRadius.sm,
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
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    resultActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    resultBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      height: 30,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    resultBtnText: { fontSize: 12, fontWeight: '600', color: tk.brand.ctaForeground },
    resultBtnOutline: {
      paddingHorizontal: 10,
      height: 30,
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    resultBtnOutlineText: { fontSize: 12, color: tk.text.medium },
    historyMain: { flex: 1, gap: 2 },
    historyFile: { fontSize: 12, fontWeight: '600', color: tk.text.primary },
    statusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
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