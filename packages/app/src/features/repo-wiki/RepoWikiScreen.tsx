// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Repo Wiki 文档浏览共享屏(RN / web 同源渲染)。
 *
 * 宿主职责:数据编排(list / detail / delete)、平台件(NavBar / NavChrome / appAlert /
 * AsyncStorage / 登录态门)、以及 **web 独有的"选文件夹 + 生成"能力**(File System
 * Access API,RN 无等价能力,留在 web 宿主页,不进共享屏、不造单端 prop)。
 * 共享屏职责:仓库名输入与加载、文档列表、详情查看、删除确认触发。
 * 内部零平台判断(无 Platform.OS / window / navigator / 原生弹窗)。
 *
 * 能力并集:modulePath、model、生成时间、文件数同时保留;
 * 详情正文渲染由宿主注入(web MarkdownStream / RN 纯文本),不让任何一端丢渲染能力。
 */
import { useMemo, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Eye, RefreshCw, Trash2 } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { TextField } from '../../components/TextField'

export type RepoWikiKind = 'overview' | 'module'

export interface RepoWikiDocView {
  id: string
  title: string
  kind: RepoWikiKind
  modulePath?: string | null
  model?: string | null
  fileCount: number
  generatedAt: string
}

export interface RepoWikiConfirmOptions {
  title: string
  message: string
  destructive?: boolean
}

export interface RepoWikiScreenProps {
  /** 宿主注入的翻译函数(键族统一为 repoWiki.*) */
  t: TFunction
  colorScheme?: 'light' | 'dark'
  /** 受控仓库名(RN 宿主负责 AsyncStorage 回填/落盘) */
  repoName: string
  onChangeRepoName: (value: string) => void
  docs: RepoWikiDocView[]
  loading: boolean
  error?: string | null
  /** 宿主注入的日期格式化(web Intl / RN 固定格式),保证两端同格式 */
  formatDate: (iso: string) => string
  /** 加载/搜索 + 下拉刷新共用的取列表入口 */
  onLoad: () => void | Promise<void>
  /** 取详情正文(markdown 字符串) */
  onLoadDoc: (id: string) => Promise<string>
  onDelete: (id: string) => Promise<void>
  /** 危险动作二次确认(必填:不允许静默删除) */
  onConfirm: (options: RepoWikiConfirmOptions) => Promise<boolean>
  /** 详情正文渲染器(web MarkdownStream / RN 纯文本);不传则按纯文本渲染 */
  renderDetail?: (content: string) => ReactNode
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  const text = String(err ?? '').trim()
  return text || fallback
}

export function RepoWikiScreen({
  t,
  colorScheme = 'light',
  repoName,
  onChangeRepoName,
  docs,
  loading,
  error,
  formatDate,
  onLoad,
  onLoadDoc,
  onDelete,
  onConfirm,
  renderDetail,
}: RepoWikiScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [refreshing, setRefreshing] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [viewingId, setViewingId] = useState('')
  const [viewingTitle, setViewingTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [busyId, setBusyId] = useState('')

  const handleLoad = async () => {
    if (!repoName.trim()) {
      setNameError(t('repoWiki.needRepoName'))
      return
    }
    setNameError(null)
    setActionError(null)
    try {
      await onLoad()
    } catch (e) {
      setActionError(errorMessage(e, t('repoWiki.loadFailed')))
    }
  }

  const handleRefresh = async () => {
    if (!repoName.trim() || refreshing) return
    setRefreshing(true)
    try {
      await onLoad()
    } catch (e) {
      setActionError(errorMessage(e, t('repoWiki.loadFailed')))
    } finally {
      setRefreshing(false)
    }
  }

  const handleView = async (doc: RepoWikiDocView) => {
    setViewingId(doc.id)
    setViewingTitle(doc.title)
    setDetail('')
    setLoadingDetail(true)
    setActionError(null)
    try {
      setDetail(await onLoadDoc(doc.id))
    } catch (e) {
      setActionError(errorMessage(e, t('repoWiki.loadFailed')))
      setViewingId('')
      setDetail('')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleBack = () => {
    setViewingId('')
    setViewingTitle('')
    setDetail('')
  }

  const handleDelete = async (doc: RepoWikiDocView) => {
    const ok = await onConfirm({
      title: t('repoWiki.deleteConfirm'),
      message: doc.title,
      destructive: true,
    })
    if (!ok) return
    setBusyId(doc.id)
    setActionError(null)
    try {
      await onDelete(doc.id)
      if (viewingId === doc.id) handleBack()
    } catch (e) {
      setActionError(errorMessage(e, t('repoWiki.loadFailed')))
    } finally {
      setBusyId('')
    }
  }

  const shownError = error ?? actionError
  const truncatedName = viewingTitle

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          viewingId ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void handleRefresh()
              }}
            />
          )
        }
      >
        {viewingId ? (
          <>
            <View style={styles.detailHead}>
              <Text style={styles.detailTitle} numberOfLines={2}>
                {truncatedName}
              </Text>
              <TouchableOpacity style={styles.outlineBtn} onPress={handleBack} activeOpacity={0.7}>
                <Text style={styles.outlineBtnText}>{t('repoWiki.backToList')}</Text>
              </TouchableOpacity>
            </View>
            {loadingDetail ? (
              <View style={styles.stateBox}>
                <ActivityIndicator size="small" color={tk.text.tertiary} />
                <Text style={styles.muted}>{t('repoWiki.loadingDetail')}</Text>
              </View>
            ) : renderDetail ? (
              renderDetail(detail)
            ) : (
              <Text style={styles.detailBody}>{detail}</Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.muted}>{t('repoWiki.description')}</Text>

            <View style={styles.searchRow}>
              <TextField
                colorScheme={colorScheme}
                value={repoName}
                onChangeText={onChangeRepoName}
                placeholder={t('repoWiki.repoNamePlaceholder')}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabled]}
                disabled={loading}
                onPress={() => {
                  void handleLoad()
                }}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
                ) : (
                  <RefreshCw size={14} color={tk.brand.ctaForeground} />
                )}
                <Text style={styles.primaryBtnText}>{t('repoWiki.searchBtn')}</Text>
              </TouchableOpacity>
            </View>

            {nameError ? <Text style={styles.error}>{nameError}</Text> : null}
            {shownError ? <Text style={styles.error}>{shownError}</Text> : null}

            {loading && docs.length === 0 ? (
              <View style={styles.stateBox}>
                <ActivityIndicator size="small" color={tk.text.tertiary} />
                <Text style={styles.muted}>{t('repoWiki.loadingDocs')}</Text>
              </View>
            ) : docs.length === 0 ? (
              <View style={styles.stateBox}>
                <Text style={styles.muted}>{t('repoWiki.emptyList')}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.listTitle}>{t('repoWiki.listTitle')}</Text>
                {docs.map((doc) => (
                  <View key={doc.id} style={styles.card}>
                    <View style={styles.rowHead}>
                      <Text style={styles.docTitle} numberOfLines={1}>
                        {doc.title}
                      </Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {t(doc.kind === 'module' ? 'repoWiki.kindModule' : 'repoWiki.kindOverview')}
                        </Text>
                      </View>
                    </View>

                    {doc.modulePath ? (
                      <Text style={styles.meta} numberOfLines={1}>
                        {doc.modulePath}
                      </Text>
                    ) : null}

                    <Text style={styles.meta}>
                      {t('repoWiki.generatedAt', { time: formatDate(doc.generatedAt) })}
                      {' · '}
                      {t('repoWiki.fileCount', { count: doc.fileCount })}
                      {doc.model ? ` · ${doc.model}` : ''}
                    </Text>

                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.primaryBtn, loadingDetail && styles.disabled]}
                        disabled={loadingDetail}
                        onPress={() => {
                          void handleView(doc)
                        }}
                        activeOpacity={0.7}
                      >
                        <Eye size={14} color={tk.brand.ctaForeground} />
                        <Text style={styles.primaryBtnText}>{t('repoWiki.view')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.outlineBtn, busyId === doc.id && styles.disabled]}
                        disabled={busyId === doc.id}
                        onPress={() => {
                          void handleDelete(doc)
                        }}
                        activeOpacity={0.7}
                      >
                        {busyId === doc.id ? (
                          <ActivityIndicator size="small" color={tk.danger.DEFAULT} />
                        ) : (
                          <Trash2 size={14} color={tk.danger.DEFAULT} />
                        )}
                        <Text style={styles.dangerText}>{t('repoWiki.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    scroll: { flex: 1 },
    body: { padding: rnSpacing.md, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    muted: { fontSize: rnType.bodySm.size, color: tk.text.secondary, lineHeight: 19 },
    error: { fontSize: rnType.bodySm.size, color: tk.danger.DEFAULT },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    input: {
      flex: 1,
      height: 42,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      color: tk.text.primary,
      fontSize: rnType.strong.size,
      backgroundColor: tk.surface.card,
    },
    primaryBtn: {
      height: 38,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
    },
    primaryBtnText: {
      fontSize: rnType.bodySm.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    outlineBtn: {
      height: 38,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
    },
    outlineBtnText: { fontSize: rnType.bodySm.size, color: tk.text.primary },
    dangerText: { fontSize: rnType.bodySm.size, fontWeight: '600', color: tk.danger.DEFAULT },
    disabled: { opacity: 0.5 },
    listTitle: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: rnSpacing.xs,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    docTitle: {
      flexShrink: 1,
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
    badgeText: { fontSize: rnType.badge.size, color: tk.text.secondary },
    meta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xs,
    },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['5xl'],
    },
    detailHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    detailTitle: {
      flexShrink: 1,
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    detailBody: { fontSize: rnType.bodySm.size, color: tk.text.primary, lineHeight: 21 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
