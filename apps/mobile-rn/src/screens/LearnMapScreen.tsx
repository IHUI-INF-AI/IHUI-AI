// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { BookOpen, ChevronDown, ChevronUp, Map as MapIcon } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 学习地图 —— 对齐 web `/learn/map`。
 *
 * 契约按 apps/api 现读(两处与 web 页不同):
 *  - `GET /api/learn/map`(edu-frontend-routes.ts)返回 `{ list, total }`,行即 learn_maps
 *    整行(id/title/description/cover/content/sort/isPublished)。web 页按
 *    `{ title, description, totalProgress, nodes }` 读取 ⇒ `nodes` 恒 undefined,页面恒空;
 *    本屏按真实形状解析。
 *  - 地图节点藏在 `content` jsonb(与 web `/edu-ai/map` 同一约定:`content.nodes` 或直接数组),
 *    节点只有 id/title/description 是可展示事实;`progress/status` 属内容配置,不是用户进度,
 *    本屏不冒充学习进度。
 *  - 用户进度没有数据源(`totalProgress` 后端无此字段),故不渲染进度条。
 */
interface MapNode {
  id?: string
  title?: string
  description?: string
}

interface LearnMapRow {
  id: string
  title: string
  description?: string | null
  cover?: string | null
  content?: unknown
  sort?: number
  isPublished?: boolean
}

interface LearnMapListData {
  list: LearnMapRow[]
  total: number
}

/** learn_maps.content 兼容两种历史形态:数组本体 / `{ nodes: [] }`。 */
function extractNodes(content: unknown): MapNode[] {
  if (!content) return []
  if (Array.isArray(content)) return content as MapNode[]
  if (typeof content === 'object') {
    const nodes = (content as { nodes?: unknown }).nodes
    if (Array.isArray(nodes)) return nodes as MapNode[]
  }
  return []
}

export default function LearnMapScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [maps, setMaps] = useState<LearnMapRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<LearnMapListData>('/api/learn/map')
      if (!res.success) throw new Error(res.error)
      setMaps(res.data?.list ?? [])
      setTotal(res.data?.total ?? res.data?.list?.length ?? 0)
    } catch {
      setError(t('learnMap.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const empty = !loading && !error && maps.length === 0

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('learnMap.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.subtitle}>{t('learnMap.subtitle')}</Text>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={tokens.text.tertiary} />
            <Text style={styles.muted}>{t('learnMap.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void load()}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>{t('learnMap.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : empty ? (
          <View style={styles.stateBox}>
            <MapIcon size={32} color={tokens.text.tertiary} />
            <Text style={styles.muted}>{t('learnMap.empty')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <MapIcon size={22} color={tokens.brandAccent.deep} />
              </View>
              <View style={styles.summaryMain}>
                <Text style={styles.summaryLabel}>{t('learnMap.total', { total })}</Text>
                <Text style={styles.summaryHint}>{t('learnMap.subtitle')}</Text>
              </View>
            </View>

            {maps.map((item, index) => {
              const nodes = extractNodes(item.content)
              const expanded = expandedId === item.id
              return (
                <View key={item.id} style={styles.card}>
                  <TouchableOpacity
                    style={styles.cardHead}
                    onPress={() => setExpandedId(expanded ? null : item.id)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                  >
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{index + 1}</Text>
                    </View>
                    <View style={styles.cardMain}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      {item.description ? (
                        <Text style={styles.cardDesc}>{item.description}</Text>
                      ) : null}
                      <View style={styles.metaRow}>
                        <BookOpen size={13} color={tokens.text.tertiary} />
                        <Text style={styles.metaText}>
                          {t('learnMap.nodeCount', { count: nodes.length })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.expandBox}>
                      {expanded ? (
                        <ChevronUp size={18} color={tokens.text.secondary} />
                      ) : (
                        <ChevronDown size={18} color={tokens.text.secondary} />
                      )}
                      <Text style={styles.expandText}>
                        {expanded ? t('learnMap.collapse') : t('learnMap.expand')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {expanded ? (
                    <View style={styles.nodesBox}>
                      <Text style={styles.nodesTitle}>{t('learnMap.nodesTitle')}</Text>
                      {nodes.length === 0 ? (
                        <Text style={styles.muted}>{t('learnMap.emptyNodes')}</Text>
                      ) : (
                        nodes.map((node, nodeIndex) => (
                          <View key={node.id ?? `${item.id}-${nodeIndex}`} style={styles.nodeRow}>
                            <View style={styles.nodeIndex}>
                              <Text style={styles.nodeIndexText}>{nodeIndex + 1}</Text>
                            </View>
                            <View style={styles.nodeMain}>
                              <Text style={styles.nodeTitle}>
                                {node.title ?? t('learnMap.untitledNode', { n: nodeIndex + 1 })}
                              </Text>
                              {node.description ? (
                                <Text style={styles.nodeDesc}>{node.description}</Text>
                              ) : null}
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
              )
            })}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: 10 },
  subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: rnSpacing.sm,
    paddingVertical: rnSpacing['5xl'],
  },
  muted: { fontSize: 13, color: tokens.text.secondary },
  errorBox: {
    padding: rnSpacing.md,
    gap: rnSpacing.sm,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.danger.DEFAULT,
    backgroundColor: tokens.surface.card,
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
  retryText: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.md,
    padding: 14,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: rnRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.brandAccent.light,
  },
  summaryMain: { flex: 1, gap: 2 },
  summaryLabel: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.text.primary },
  summaryHint: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
  card: {
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    overflow: 'hidden',
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: rnRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  stepBadgeText: { fontSize: rnType.label.size, fontWeight: '600', color: tokens.text.secondary },
  cardMain: { flex: 1, gap: rnSpacing.xs },
  cardTitle: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.text.primary },
  cardDesc: { fontSize: 13, lineHeight: 19, color: tokens.text.secondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
  metaText: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
  expandBox: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 2 },
  expandText: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
  nodesBox: {
    gap: 10,
    marginHorizontal: 14,
    marginBottom: 14,
    paddingHorizontal: rnSpacing.md,
    paddingVertical: 10,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.bg,
  },
  nodesTitle: {
    fontSize: rnType.label.size,
    fontWeight: '600',
    color: tokens.text.secondary,
    paddingTop: rnSpacing.sm,
  },
  nodeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.sm },
  nodeIndex: {
    width: 20,
    height: 20,
    borderRadius: rnRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.brandAccent.light,
  },
  nodeIndexText: {
    fontSize: rnType.caption.size,
    fontWeight: '600',
    color: tokens.brandAccent.deep,
  },
  nodeMain: { flex: 1, gap: 2 },
  nodeTitle: { fontSize: 13, fontWeight: '500', color: tokens.text.primary },
  nodeDesc: { fontSize: rnType.label.size, lineHeight: 18, color: tokens.text.secondary },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
