// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Eye, Flame, Newspaper } from 'lucide-react-native'
import { fetchApi, resolveFileUrl } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

/**
 * 文章热榜 —— 对齐 web `/articles/hot`。
 *
 * 端点按 apps/api/src/routes/user/articles-routes.ts 现读:
 *  - `GET /api/article/hot` → `{ list }`,handler 显式忽略 query 且固定
 *    `page=1, pageSize=10`,**不返回 total/page/pageSize**。
 *  - web 页传 `?page&pageSize` 并读 `data.total`(undefined)⇒ 分页 UI 实际只有 1 页。
 *    本屏不造假分页:一次展示后端给的 10 条,下拉刷新重新取。
 *  - 列表项字段来自 news_articles 表:title/summary/coverImage/authorName/
 *    publishedAt/viewCount;没有 hotScore(web 接口里那个字段后端不产出)。
 */
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface HotArticle {
  id: string
  title: string
  summary?: string | null
  coverImage?: string | null
  authorName?: string | null
  viewCount: number
  publishedAt?: string | null
}

export default function ArticleHotScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<HotArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      try {
        const res = await fetchApi<{ list: HotArticle[] }>('/api/article/hot')
        if (!res.success) throw new Error(apiFailureToText(res, t('articleHot.loadFailed')))
        setItems(res.data?.list ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : t('articleHot.loadFailed'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const fmtDate = (value?: string | null): string => {
    if (!value) return '-'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat(locale).format(date)
  }

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('articleHot.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={tokens.text.tertiary} />
          <Text style={styles.muted}>{t('articleHot.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.body}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void load()}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>{t('articleHot.retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.stateBox}>
          <Flame size={32} color={tokens.text.tertiary} />
          <Text style={styles.muted}>{t('articleHot.empty')}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void load(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.retryText}>{t('articleHot.refresh')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={tokens.text.tertiary}
            />
          }
        >
          <Text style={styles.subtitle}>{t('articleHot.subtitle')}</Text>
          {items.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ArticleDetail', { id: item.id })}
            >
              <View style={[styles.rank, index < 3 && styles.rankTop]}>
                <Text style={[styles.rankText, index < 3 && styles.rankTextTop]}>{index + 1}</Text>
              </View>
              <View style={styles.rowMain}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.summary ? (
                  <Text style={styles.summary} numberOfLines={2}>
                    {item.summary}
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  {item.authorName ? <Text style={styles.meta}>{item.authorName}</Text> : null}
                  <Text style={styles.meta}>
                    {t('articleHot.publishedAt', { date: fmtDate(item.publishedAt) })}
                  </Text>
                  <View style={styles.viewMeta}>
                    <Eye size={12} color={tokens.text.tertiary} />
                    <Text style={styles.meta}>
                      {t('articleHot.viewCount', { count: item.viewCount })}
                    </Text>
                  </View>
                </View>
              </View>
              {item.coverImage ? (
                <Image
                  source={{ uri: resolveFileUrl(item.coverImage) }}
                  style={styles.cover}
                  resizeMode="cover"
                />
              ) : null}
            </TouchableOpacity>
          ))}
          <View style={styles.footer}>
            <Newspaper size={14} color={tokens.text.tertiary} />
            <Text style={styles.meta}>{t('articleHot.footer')}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: rnSpacing.sm },
  subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary, marginBottom: 2 },
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: rnSpacing['2xl'],
  },
  muted: { fontSize: 13, color: tokens.text.secondary, textAlign: 'center' },
  errorBox: {
    padding: rnSpacing.md,
    gap: rnSpacing.sm,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.danger.DEFAULT,
    backgroundColor: tokens.surface.card,
  },
  errorText: { fontSize: rnType.label.size, color: tokens.danger.DEFAULT },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
  },
  retryText: { fontSize: rnType.label.size, fontWeight: '600', color: tokens.text.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: rnSpacing.md,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  rank: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.bg,
  },
  rankTop: { backgroundColor: tokens.surface.chrome },
  rankText: { fontSize: rnType.body.size, fontWeight: '700', color: tokens.text.tertiary },
  rankTextTop: { color: tokens.brandAccent.deep },
  rowMain: { flex: 1, gap: 3 },
  title: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.text.primary },
  summary: { fontSize: rnType.label.size, color: tokens.text.secondary },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  meta: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
  viewMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cover: {
    width: 72,
    height: 52,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.bg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rnSpacing.xs,
    paddingTop: rnSpacing.sm,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
