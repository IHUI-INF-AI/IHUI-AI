import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAgents, getProfile, type Agent, type AuthUser } from '@ihui/api-client'
import {
  CarteScreen as SharedCarteScreen,
  type CarteCreator,
  type CarteWork,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const SKILLS = ['React Native', 'LangGraph', 'RAG', 'Prompt 工程', 'Node.js', 'PostgreSQL', 'Taro', 'Python']

function mapCreator(u: AuthUser, projectCount: number, skillCount: number, rating: number): CarteCreator {
  return {
    name: u.nickname ?? u.username ?? '未命名创作者',
    title: u.level ? `创作者 · Lv.${u.level}` : '创作者',
    bio: u.bio ?? '暂无简介',
    projects: projectCount,
    skills: skillCount,
    rating,
  }
}

function mapWork(a: Agent): CarteWork {
  return {
    id: a.id,
    title: a.name,
    category: a.category || a.tags[0] || '未分类',
    desc: a.description,
    tags: a.tags,
    likes: a.favoriteCount,
  }
}

/** 创客名片 / 作品集:展示创客资料、技能标签与代表案例。 */
export default function CarteScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [creator, setCreator] = useState<CarteCreator | null>(null)
  const [works, setWorks] = useState<CarteWork[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [profileRes, agentsRes] = await Promise.all([getProfile(), getAgents({ pageSize: 100 })])
      if (!profileRes.success) throw new Error(profileRes.error)
      if (!agentsRes.success) throw new Error(agentsRes.error)
      const u = profileRes.data
      const agentList = agentsRes.data.list ?? []
      const tags = new Set<string>()
      let ratingSum = 0
      let ratingCount = 0
      for (const a of agentList) {
        for (const tg of a.tags) tags.add(tg)
        if (a.rating > 0) {
          ratingSum += a.rating
          ratingCount++
        }
      }
      const avgRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0
      setCreator(mapCreator(u, agentList.length, tags.size, avgRating))
      setWorks(agentList.map(mapWork))
    } catch {
      setError(t('carte.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedCarteScreen
      t={t}
      creator={creator}
      works={works}
      skills={SKILLS}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onRetry={() => {
        setLoading(true)
        void load()
      }}
      onBack={() => navigation.goBack()}
    />
  )
}
