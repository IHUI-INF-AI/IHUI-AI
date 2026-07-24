import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native'

interface Ability {
  name: string
  score: number
  desc: string
}

interface CareerMatch {
  id: string
  title: string
  match: number
  salary: string
  trend: 'up' | 'stable' | 'new'
  reasons: string[]
}

const ABILITIES: Ability[] = [
  { name: '逻辑思维', score: 86, desc: '善于结构化拆解与分析问题' },
  { name: '沟通表达', score: 72, desc: '能清晰传达观点,需加强倾听' },
  { name: '学习力', score: 91, desc: '快速掌握新知识与新技能' },
  { name: '执行力', score: 78, desc: '任务推进稳定,deadline 意识强' },
  { name: '创新力', score: 65, desc: '有想法但落地转化待提升' },
  { name: '协作力', score: 83, desc: '团队配合默契,跨职能适配佳' },
]

const CAREERS: CareerMatch[] = [
  { id: '1', title: '高级产品经理', match: 92, salary: '25-40K · 15薪', trend: 'up', reasons: ['逻辑思维突出', '学习力强', '跨职能协作佳'] },
  { id: '2', title: '技术架构师', match: 85, salary: '30-55K · 16薪', trend: 'up', reasons: ['学习力卓越', '逻辑思维强', '执行力稳'] },
  { id: '3', title: '数据分析师', match: 79, salary: '18-30K · 14薪', trend: 'stable', reasons: ['逻辑思维优', '学习力强'] },
  { id: '4', title: '增长运营专家', match: 73, salary: '20-35K · 14薪', trend: 'new', reasons: ['执行力稳', '协作力佳'] },
]

function trendLabel(t: CareerMatch['trend']): { text: string; color: string; bg: string } {
  if (t === 'up') return { text: '热门上升', color: '#10B981', bg: '#ECFDF5' }
  if (t === 'new') return { text: '新兴岗位', color: '#7B61FF', bg: '#F5F3FF' }
  return { text: '稳定需求', color: '#6B7280', bg: '#F3F4F6' }
}

function scoreColor(score: number): string {
  if (score >= 85) return '#10B981'
  if (score >= 70) return '#7B61FF'
  return '#FF6B00'
}

export default function AiCareerScreen() {
  const [selectedCareer, setSelectedCareer] = useState<CareerMatch | null>(null)

  const overall = Math.round(ABILITIES.reduce((s, a) => s + a.score, 0) / ABILITIES.length)

  const handleReassess = () =>
    Alert.alert('重新评估', '将开启 30 道能力测评题,预计耗时 8 分钟', [
      { text: '取消' },
      { text: '开始评估', onPress: () => Alert.alert('已开始') },
    ])

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>AI 职业规划</Text>
        <Text style={s.headerSub}>基于能力评估的智能职业匹配与成长建议</Text>
      </View>

      <View style={s.overallCard}>
        <View style={s.overallLeft}>
          <Text style={s.overallLabel}>综合能力评分</Text>
          <Text style={s.overallScore}>{overall}</Text>
          <Text style={s.overallGrade}>优秀 · 超 78% 用户</Text>
        </View>
        <TouchableOpacity style={s.reassessBtn} onPress={handleReassess} activeOpacity={0.85}>
          <Text style={s.reassessText}>重新评估</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>能力维度</Text>
      {ABILITIES.map((a) => (
        <View key={a.name} style={s.abilityItem}>
          <View style={s.abilityHead}>
            <Text style={s.abilityName}>{a.name}</Text>
            <Text style={[s.abilityScore, { color: scoreColor(a.score) }]}>{a.score}</Text>
          </View>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${a.score}%`, backgroundColor: scoreColor(a.score) }]} />
          </View>
          <Text style={s.abilityDesc}>{a.desc}</Text>
        </View>
      ))}

      <Text style={s.sectionTitle}>职业匹配推荐</Text>
      {CAREERS.map((c) => {
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
                <Text style={s.careerSalary}>{c.salary}</Text>
              </View>
              <View style={s.matchRing}>
                <Text style={[s.matchScore, { color: scoreColor(c.match) }]}>{c.match}</Text>
                <Text style={s.matchLabel}>匹配</Text>
              </View>
            </View>
            {expanded ? (
              <View style={s.reasonBox}>
                <Text style={s.reasonTitle}>匹配理由</Text>
                {c.reasons.map((r) => (
                  <Text key={r} style={s.reasonItem}>· {r}</Text>
                ))}
                <TouchableOpacity style={s.planBtn} onPress={() => Alert.alert('生成规划', `正在为「${c.title}」生成 90 天成长计划`)} activeOpacity={0.85}>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingTop: 4, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerSub: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  overallCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: '#F5F3FF' },
  overallLeft: { flex: 1 },
  overallLabel: { fontSize: 12, color: '#6B7280' },
  overallScore: { marginTop: 4, fontSize: 36, fontWeight: '700', color: '#7B61FF' },
  overallGrade: { marginTop: 4, fontSize: 11, color: '#7B61FF' },
  reassessBtn: { paddingHorizontal: 14, height: 34, borderRadius: 8, backgroundColor: '#7B61FF', alignItems: 'center', justifyContent: 'center' },
  reassessText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  sectionTitle: { marginTop: 20, marginBottom: 10, fontSize: 14, fontWeight: '600', color: '#111827' },
  abilityItem: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  abilityHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  abilityName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  abilityScore: { fontSize: 14, fontWeight: '700' },
  barBg: { marginTop: 8, height: 6, borderRadius: 3, backgroundColor: '#F3F4F6' },
  barFill: { height: 6, borderRadius: 3 },
  abilityDesc: { marginTop: 6, fontSize: 11, color: '#9CA3AF' },
  careerCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10 },
  careerCardActive: { borderColor: '#7B61FF' },
  careerHead: { flexDirection: 'row' },
  careerMain: { flex: 1 },
  careerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  careerTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  trendBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  trendText: { fontSize: 11, fontWeight: '600' },
  careerSalary: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  matchRing: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  matchScore: { fontSize: 18, fontWeight: '700' },
  matchLabel: { marginTop: 2, fontSize: 10, color: '#9CA3AF' },
  reasonBox: { marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: '#F9FAFB' },
  reasonTitle: { fontSize: 12, fontWeight: '600', color: '#111827', marginBottom: 6 },
  reasonItem: { fontSize: 12, color: '#4B5563', lineHeight: 20 },
  planBtn: { marginTop: 10, height: 36, borderRadius: 8, backgroundColor: '#7B61FF', alignItems: 'center', justifyContent: 'center' },
  planBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
})
