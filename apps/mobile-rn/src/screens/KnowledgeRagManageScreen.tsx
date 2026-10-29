// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 知识文档管理 —— 对齐 web `/knowledge-rag/manage`。
 *
 * 契约(按 apps/api/src/routes/knowledge-rag.ts 实读):
 *  - `GET /api/knowledge/docs` 返回 **数组**(不是分页对象),行字段只有
 *    id/title/sourceType/chunkCount/createdAt —— 没有 status、没有文件大小列,故本屏不渲染这两个假字段;
 *  - `DELETE /api/knowledge/docs/:id` 软删除,返回 `{ deleted }`;
 *  - `POST /api/knowledge/docs/batch-delete` 入参 `{ docIds }`;
 *  - 归属由后端从登录凭据决定,请求里不再带 ownerUuid。
 *  - 端点不支持服务端搜索/分页,搜索与"加载更多"都在已取回的数组上做。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Check, FileText, Trash2 } from 'lucide-react-native'
import {
  batchDeleteKnowledgeDocs,
  deleteKnowledgeDoc,
  listKnowledgeDocs,
  type KnowledgeDocSummary,
} from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

interface Feedback {
  type: 'success' | 'error'
  text: string
}

export default function KnowledgeRagManageScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [docs, setDocs] = useState<KnowledgeDocSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [locale],
  )

  const load = useCallback(async () => {
    setError('')
    try {
      const list = await listKnowledgeDocs()
      setDocs(list)
      setSelected((prev) => {
        const alive = new Set(list.map((d) => d.id))
        return new Set([...prev].filter((id) => alive.has(id)))
      })
    } catch {
      setError(t('knowledgeRagManage.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 3000)
    return () => clearTimeout(timer)
  }, [feedback])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return docs
    return docs.filter((d) => d.title.toLowerCase().includes(q))
  }, [docs, query])

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const allSelected = visible.length > 0 && visible.every((d) => selected.has(d.id))

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        for (const d of visible) next.delete(d.id)
      } else {
        for (const d of visible) next.add(d.id)
      }
      return next
    })
  }

  const onDeleteOne = (doc: KnowledgeDocSummary) => {
    appAlert(
      t('knowledgeRagManage.singleDeleteTitle'),
      t('knowledgeRagManage.singleDeleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('knowledgeRagManage.confirm'),
          style: 'destructive',
          onPress: () => {
            setBusy(true)
            void (async () => {
              try {
                await deleteKnowledgeDoc(doc.id)
                setFeedback({ type: 'success', text: t('knowledgeRagManage.deleteSuccess') })
                await load()
              } catch {
                setFeedback({ type: 'error', text: t('knowledgeRagManage.deleteFailed') })
              } finally {
                setBusy(false)
              }
            })()
          },
        },
      ],
    )
  }

  const onBatchDelete = () => {
    if (selected.size === 0) return
    const ids = [...selected]
    appAlert(
      t('knowledgeRagManage.batchDeleteTitle'),
      t('knowledgeRagManage.batchDeleteMessage', { count: ids.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('knowledgeRagManage.confirm'),
          style: 'destructive',
          onPress: () => {
            setBusy(true)
            void (async () => {
              try {
                const res = await batchDeleteKnowledgeDocs(ids)
                const removed = new Set(res.success)
                setDocs((prev) => prev.filter((d) => !removed.has(d.id)))
                setSelected((prev) => new Set([...prev].filter((id) => !removed.has(id))))
                if (res.failed.length > 0) {
                  setFeedback({
                    type: 'error',
                    text: t('knowledgeRagManage.partialFailed', { failed: res.failed.length }),
                  })
                } else {
                  setFeedback({ type: 'success', text: t('knowledgeRagManage.deleteSuccess') })
                }
              } catch {
                setFeedback({ type: 'error', text: t('knowledgeRagManage.deleteFailed') })
              } finally {
                setBusy(false)
              }
            })()
          },
        },
      ],
    )
  }

  const sourceLabel = (sourceType: string): string => {
    if (sourceType === 'text') return t('knowledgeRagManage.sourceText')
    if (sourceType === 'file') return t('knowledgeRagManage.sourceFile')
    if (sourceType === 'url') return t('knowledgeRagManage.sourceUrl')
    return t('knowledgeRagManage.sourceOther')
  }

  const renderRow = ({ item }: { item: KnowledgeDocSummary }) => {
    const checked = selected.has(item.id)
    return (
      <View style={[styles.card, checked && styles.cardChecked]}>
        <TouchableOpacity
          style={styles.checkHit}
          onPress={() => toggleOne(item.id)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked ? <Check size={14} color={styles.checkboxChecked.color} /> : null}
          </View>
        </TouchableOpacity>
        <View style={styles.rowMain}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.badge}>{sourceLabel(item.sourceType)}</Text>
            <Text style={styles.metaText}>
              {item.chunkCount} {t('knowledgeRagManage.chunkCount')}
            </Text>
            <Text style={styles.metaText}>
              {item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime())
                ? dateFmt.format(new Date(item.createdAt))
                : '—'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => onDeleteOne(item)}
          disabled={busy}
          hitSlop={8}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('knowledgeRagManage.delete')}
        >
          <Trash2 size={18} color={tokens.danger.DEFAULT} />
        </TouchableOpacity>
      </View>
    )
  }

  const isFiltered = query.trim().length > 0
  const empty = !loading && !error && visible.length === 0

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('knowledgeRagManage.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <FlatList
        data={error ? [] : visible}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRow}
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void load()
            }}
            tintColor={tokens.text.tertiary}
          />
        }
        onEndReached={() => {
          if (visible.length < filtered.length) setVisibleCount((n) => n + PAGE_SIZE)
        }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.subtitle}>{t('knowledgeRagManage.subtitle')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={query}
              onChangeText={(text) => {
                setQuery(text)
                setVisibleCount(PAGE_SIZE)
              }}
              placeholder={t('knowledgeRagManage.searchPlaceholder')}
              style={styles.input}
              returnKeyType="search"
            />
            {feedback ? (
              <View
                style={[styles.feedbackBox, feedback.type === 'error' && styles.feedbackBoxError]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    feedback.type === 'error' && styles.feedbackTextError,
                  ]}
                >
                  {feedback.text}
                </Text>
              </View>
            ) : null}
            {!loading && !error && docs.length > 0 ? (
              <View style={styles.toolbar}>
                <TouchableOpacity
                  style={styles.selectAll}
                  onPress={toggleAll}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: allSelected }}
                >
                  <View style={[styles.checkbox, allSelected && styles.checkboxChecked]}>
                    {allSelected ? <Check size={14} color={styles.checkboxChecked.color} /> : null}
                  </View>
                  <Text style={styles.selectAllText}>
                    {t('knowledgeRagManage.selectAll')} {selected.size}/{docs.length}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dangerButton,
                    (selected.size === 0 || busy) && styles.buttonDisabled,
                  ]}
                  onPress={onBatchDelete}
                  disabled={selected.size === 0 || busy}
                  activeOpacity={0.7}
                >
                  <Trash2 size={14} color={tokens.danger.DEFAULT} />
                  <Text style={styles.dangerButtonText}>{t('knowledgeRagManage.batchDelete')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {loading ? (
              <ActivityIndicator style={styles.loading} color={tokens.text.tertiary} />
            ) : error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => {
                    setLoading(true)
                    void load()
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.retryText}>{t('knowledgeRagManage.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : empty ? (
              <View style={styles.emptyBox}>
                <FileText size={32} color={tokens.text.tertiary} />
                <Text style={styles.emptyText}>
                  {isFiltered ? t('knowledgeRagManage.emptySearch') : t('knowledgeRagManage.empty')}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          error ? null : visible.length >= filtered.length && docs.length > 0 ? (
            <Text style={styles.footerText}>{t('knowledgeRagManage.noMore')}</Text>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: 10 },
  header: { gap: 10, paddingBottom: 2 },
  subtitle: { fontSize: 13, color: tokens.text.secondary },
  input: {
    height: 42,
    paddingHorizontal: rnSpacing.md,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    color: tokens.text.primary,
    fontSize: rnType.strong.size,
    backgroundColor: tokens.surface.card,
  },
  feedbackBox: {
    paddingHorizontal: rnSpacing.md,
    paddingVertical: rnSpacing.sm,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.success.light,
  },
  feedbackBoxError: { backgroundColor: tokens.danger.light },
  feedbackText: { fontSize: rnType.label.size, color: tokens.success.deepText },
  feedbackTextError: { color: tokens.danger.DEFAULT },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rnSpacing.md,
    paddingVertical: rnSpacing.sm,
    borderRadius: rnRadius.md,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
  selectAllText: { fontSize: 13, color: tokens.text.primary },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.danger.DEFAULT,
  },
  dangerButtonText: {
    fontSize: rnType.label.size,
    fontWeight: '600',
    color: tokens.danger.DEFAULT,
  },
  buttonDisabled: { opacity: 0.5 },
  loading: { paddingVertical: rnSpacing['2xl'] },
  errorBox: {
    paddingVertical: rnSpacing.lg,
    paddingHorizontal: rnSpacing.md,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.danger.DEFAULT,
    backgroundColor: tokens.surface.card,
    gap: rnSpacing.sm,
  },
  errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
  },
  retryText: { fontSize: 13, color: tokens.text.primary },
  emptyBox: { alignItems: 'center', paddingVertical: rnSpacing['4xl'], gap: rnSpacing.sm },
  emptyText: { fontSize: 13, color: tokens.text.secondary },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: rnSpacing.lg,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  cardChecked: { borderColor: tokens.brandAccent.deep },
  checkHit: { paddingVertical: 2 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: tokens.brand.cta,
    borderColor: tokens.brand.cta,
    color: tokens.brand.ctaForeground,
  },
  rowMain: { flex: 1, gap: rnSpacing.xs },
  title: { fontSize: rnType.strong.size, fontWeight: '500', color: tokens.text.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: rnSpacing.sm },
  badge: {
    fontSize: rnType.caption.size,
    color: tokens.text.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
  },
  metaText: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
  footerText: {
    paddingVertical: rnSpacing.lg,
    textAlign: 'center',
    fontSize: rnType.label.size,
    color: tokens.text.tertiary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
