import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, RefreshControl } from 'react-native'
import { getAiCareers, type AiCareerItem } from '@ihui/api-client'
import { useI18n } from '../i18n'

interface CareerMatch {
  id: string
  title: string
  match: number
  salary: string
  trend: 'up' | 'stable' | 'new'
  reasons: string[]
}

function mapToCareer(it: AiCareerItem): CareerMatch {
  const rawReasons = it.reasons
  const reasons = Array.isArray(rawReasons)
    ? rawReasons.filter((r): r is string => typeof r === 'string')
    : typeof it.content === 'string' && it.content.trim()
      ? it.content
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean)
      : []
  const trend: CareerMatch['trend'] = it.trend === 'up' || it.trend === 'new' ? it.trend : 'stable'
  const match = typeof it.match === 'number' && Number.isFinite(it.match) ? it.match : 0
  const salary =
    typeof it.salary === 'string' && it.salary.trim()
      ? it.salary
      : typeof it.description === 'string' && it.description.trim()
        ? it.description
        : ''
  return { id: it.id, title: it.title, match, salary, trend, reasons }
}

function trendLabel(t: CareerMatch['trend']): { text: string; color: string; bg: string } {
  if (t === 'up') return { text: '热门上升', color: tokens.brand.DEFAULT, bg: tokens.success.light }
  if (t === 'new') return { text: '新兴岗位', color: tokens.purple.DEFAULT, bg: tokens.purple.light }
  return { text: '稳定需求', color: tokens.text.secondary, bg: tokens.surface.card }
}

function scoreColor(score: number): string {
  if (score >= 85) return tokens.brand.DEFAULT
  if (score >= 70) return tokens.purple.DEFAULT
  return tokens.warning.deep
}

export default function AiCareerScreen() {
  const { t } = useI18n()
  const [items, setItems] = useState<CareerMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedCareer, setSelectedCareer] = useState<CareerMatch | null>(null)

  const load = useCallback(async () => {
    setError('')
    const res = await getAiCareers({ pageSize: 20 })
    if (res.success) {
      setItems((res.data.list ?? []).map(mapToCareer))
    } else {
      setError(res.error || '加载失败,请下拉刷新重试')
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={s.header}>
        <Text style={s.headerTitle}>AI 职业规划</Text>
        <Text style={s.headerSub}>基于能力评估的智能职业匹配与成长建议</Text>
      </View>

      {error ? <Text style={s.errorText}>{error}</Text> : null}
      {loading && items.length === 0 ? <Text style={s.loadingText}>加载中...</Text> : null}

      <Text style={s.sectionTitle}>职业匹配推荐</Text>
      {items.map((c) => {
        const tl = trendLabel(c.trend)
        const expanded = selectedCareer?.id === c.id
        return (
          <TouchableOpacity
            key={c.id}
            style={[s.careerCard, expanded && s.careerCardActive]}
            onPress={() => setSelectedCareer(expanded ? null : c)}
            activeOpacity={0.85}
          >
            <View style={s.careerHead}>
              <View style={s.careerMain}>
                <View style={s.careerNameRow}>
                  <Text style={s.careerTitle}>{c.title}</Text>
                  <View style={[s.trendBadge, { backgroundColor: tl.bg }]}>
                    <Text style={[s.trendText, { color: tl.color }]}>{tl.text}</Text>
                  </View>
                </View>
                {c.salary ? <Text style={s.careerSalary}>{c.salary}</Text> : null}
              </View>
              <View style={s.matchRing}>
                <Text style={[s.matchScore, { color: scoreColor(c.match) }]}>{c.match}</Text>
                <Text style={s.matchLabel}>匹配</Text>
              </View>
            </View>
            {expanded ? (
              <View style={s.reasonBox}>
                <Text style={s.reasonTitle}>匹配理由</Text>
                {c.reasons.length > 0 ? (
                  c.reasons.map((r) => (
                    <Text key={r} style={s.reasonItem}>
                      · {r}
                    </Text>
                  ))
                ) : (
                  <Text style={s.reasonItem}>暂无匹配理由</Text>
                )}
                <TouchableOpacity
                  style={s.planBtn}
                  onPress={() => Alert.alert(t('aiCareer.plan.title'), t('aiCareer.plan.message', { name: c.title }))}
                  activeOpacity={0.85}
                >
                  <Text style={s.planBtnText}>生成成长计划</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.light },
  header: { paddingTop: 4, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: tokens.text.primary },
  headerSub: { marginTop: 4, fontSize: 12, color: tokens.text.secondary },
  errorText: { color: tokens.danger.DEFAULT, fontSize: 12, marginBottom: 8 },
  loadingText: { color: tokens.text.tertiary, fontSize: 12, marginBottom: 8 },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  careerCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border.light,
    marginBottom: 10,
  },
  careerCardActive: { borderColor: tokens.purple.DEFAULT },
  careerHead: { flexDirection: 'row' },
  careerMain: { flex: 1 },
  careerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  careerTitle: { fontSize: 15, fontWeight: '600', color: tokens.text.primary },
  trendBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  trendText: { fontSize: 11, fontWeight: '600' },
  careerSalary: { marginTop: 4, fontSize: 12, color: tokens.text.secondary },
  matchRing: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchScore: { fontSize: 18, fontWeight: '700' },
  matchLabel: { marginTop: 2, fontSize: 10, color: tokens.text.tertiary },
  reasonBox: { marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: tokens.surface.muted },
  reasonTitle: { fontSize: 12, fontWeight: '600', color: tokens.text.primary, marginBottom: 6 },
  reasonItem: { fontSize: 12, color: tokens.gray[600], lineHeight: 20 },
  planBtn: {
    marginTop: 10,
    height: 36,
    borderRadius: 8,
    backgroundColor: tokens.purple.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBtnText: { fontSize: 13, fontWeight: '600', color: tokens.surface.light },
})
