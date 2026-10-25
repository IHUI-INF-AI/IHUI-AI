// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ChevronLeft, ChevronRight, Eye, FileText } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

/**
 * 我的文章 —— 对齐 web `/user/articles`。
 *
 * 端点 GET /api/article/my?page&pageSize(apps/api/src/routes/user/articles-routes.ts),
 * 数据来自 db/news-queries.findMyArticles,行是 news_articles 全列:
 *   id / title / summary / coverImage / isPublished(boolean) / status(number) /
 *   viewCount / publishedAt / createdAt。
 * 契约更正:web 的 ArticleItem 声明 `status: 'draft'|'published'|'reviewing'` 与 `likeCount`,
 * 但表里 status 是整数、无 likeCount 列 ⇒ 本屏按 isPublished 判发布态,不渲染点赞数。
 */
interface ArticleRow {
  id: string
  title: string
  summary: string | null
  coverImage: string | null
  isPublished: boolean
  viewCount: number
  publishedAt: string | null
  createdAt: string
}

export default function UserArticlesScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [rows, setRows] = useState<ArticleRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const fmtDate = useCallback(
    (iso: string | null) => {
      if (!iso) return '—'
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return '—'
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const load = useCallback(async (targetPage: number) => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetchApi<{ list: ArticleRow[]; total: number }>(
        `/api/article/my?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      )
      if (!res.success) throw new Error(res.error)
      setRows(res.data?.list ?? [])
      setTotal(res.data?.total ?? 0)
    } catch {
      setRows([])
      setTotal(0)
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(1)
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const goPage = (next: number) => {
    const target = Math.max(1, Math.min(totalPages, next))
    setPage(target)
    void load(target)
  }

  const styles = makeStyles()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('userArticles.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
        ) : failed ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('userArticles.loadFailed')}</Text>
            <TouchableOpacity onPress={() => void load(page)} activeOpacity={0.7}>
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.stateBox}>
            <FileText size={28} color={tokens.text.tertiary} />
            <Text style={styles.muted}>{t('userArticles.empty')}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.total}>{t('userArticles.total', { total })}</Text>
            {rows.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.card}
                onPress={() => navigation.navigate('ArticleDetail', { id: a.id })}
                activeOpacity={0.7}
              >
                {a.coverImage ? (
                  <Image source={{ uri: a.coverImage }} style={styles.cover} />
                ) : null}
                <View style={styles.cardMain}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>
                      {a.title}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        a.isPublished ? styles.badgePublished : styles.badgeDraft,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          a.isPublished ? styles.badgeTextPublished : styles.badgeTextDraft,
                        ]}
                      >
                        {a.isPublished
                          ? t('userArticles.statusPublished')
                          : t('userArticles.statusDraft')}
                      </Text>
                    </View>
                  </View>
                  {a.summary ? (
                    <Text style={styles.summary} numberOfLines={2}>
                      {a.summary}
                    </Text>
                  ) : null}
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Eye size={12} color={tokens.text.tertiary} />
                      <Text style={styles.metaText}>{a.viewCount ?? 0}</Text>
                    </View>
                    <Text style={styles.metaText}>{fmtDate(a.publishedAt ?? a.createdAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            {totalPages > 1 ? (
              <View style={styles.pager}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  onPress={() => goPage(page - 1)}
                  disabled={page <= 1}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={14} color={tokens.text.primary} />
                  <Text style={styles.pageBtnText}>{t('userArticles.prev')}</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                  {t('userArticles.pageInfo', { page, totalPages })}
                </Text>
                <TouchableOpacity
                  style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                  onPress={() => goPage(page + 1)}
                  disabled={page >= totalPages}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pageBtnText}>{t('userArticles.next')}</Text>
                  <ChevronRight size={14} color={tokens.text.primary} />
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.md, gap: rnSpacing.sm, paddingBottom: rnSpacing['3xl'] },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['5xl'],
    },
    errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    muted: { fontSize: rnType.label.size, color: tokens.text.secondary },
    total: {
      fontSize: rnType.label.size,
      color: tokens.text.tertiary,
      paddingHorizontal: rnSpacing.xs,
    },
    card: {
      flexDirection: 'row',
      gap: 10,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
    },
    cover: {
      width: 84,
      height: 64,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.muted,
    },
    cardMain: { flex: 1, gap: rnSpacing.xs },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { flex: 1, fontSize: rnType.body.size, fontWeight: '600', color: tokens.text.primary },
    badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: rnRadius.md },
    badgePublished: { backgroundColor: tokens.success.light },
    badgeDraft: { backgroundColor: tokens.surface.muted },
    badgeText: { fontSize: rnType.caption.size, fontWeight: '600' },
    badgeTextPublished: { color: tokens.success.DEFAULT },
    badgeTextDraft: { color: tokens.text.secondary },
    summary: { fontSize: rnType.label.size, lineHeight: 17, color: tokens.text.secondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.md },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
    pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    pageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      height: 34,
      paddingHorizontal: 10,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      backgroundColor: tokens.surface.card,
    },
    pageBtnDisabled: { opacity: 0.4 },
    pageBtnText: { fontSize: rnType.label.size, color: tokens.text.primary },
    pageInfo: { fontSize: rnType.label.size, color: tokens.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
