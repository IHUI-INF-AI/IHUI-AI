import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Avatar, Badge, Card } from '@ihui/ui-native'
import { getAgents, getProfile, type Agent, type AuthUser } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface Creator {
  name: string
  title: string
  bio: string
  projects: number
  skills: number
  rating: number
}

interface Work {
  id: string
  title: string
  category: string
  desc: string
  tags: string[]
  likes: number
}

const SKILLS = ['React Native', 'LangGraph', 'RAG', 'Prompt 工程', 'Node.js', 'PostgreSQL', 'Taro', 'Python']

function mapCreator(u: AuthUser, projectCount: number, skillCount: number, rating: number): Creator {
  return {
    name: u.nickname ?? u.username ?? '未命名创作者',
    title: u.level ? `创作者 · Lv.${u.level}` : '创作者',
    bio: u.bio ?? '暂无简介',
    projects: projectCount,
    skills: skillCount,
    rating,
  }
}

function mapWork(a: Agent): Work {
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
  const navigation = useNavigation<NavigationProp>()
  const [creator, setCreator] = useState<Creator | null>(null)
  const [works, setWorks] = useState<Work[]>([])
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
      setError('加载失败,请下拉刷新重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  if (loading && !creator) {
    return (
      <View className="flex-1 items-center justify-center bg-card">
        <Text className="text-sm text-muted-foreground">加载中...</Text>
      </View>
    )
  }

  if (error && !creator) {
    return (
      <View className="flex-1 items-center justify-center bg-card px-6">
        <Text className="text-sm text-destructive">{error}</Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true)
            void load()
          }}
          className="mt-3"
        >
          <Text className="text-sm text-primary">重试</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const stats = creator
    ? [
        { label: '项目', value: creator.projects },
        { label: '技能', value: creator.skills },
        { label: '好评', value: creator.rating },
      ]
    : []

  return (
    <FlatList
      className="flex-1 bg-card"
      data={works}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      ItemSeparatorComponent={() => <View className="h-2" />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View className="flex-row items-center gap-3 pb-3 pt-12">
            <TouchableOpacity onPress={() => navigation.goBack()} className="py-1">
              <Text className="text-sm text-muted-foreground">返回</Text>
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-foreground">创客名片</Text>
          </View>

          {error ? (
            <View className="mb-3 rounded-md bg-destructive/10 p-2">
              <Text className="text-xs text-destructive">{error}</Text>
            </View>
          ) : null}

          {creator ? (
            <>
              <Card className="flex-row items-center p-4">
                <Avatar name={creator.name} size="lg" shape="rounded" className="bg-primary/10" />
                <View className="ml-3 flex-1">
                  <Text className="text-[17px] font-semibold text-foreground">{creator.name}</Text>
                  <Text className="mt-0.5 text-xs text-primary">{creator.title}</Text>
                </View>
              </Card>
              <Text className="mt-3 text-[13px] leading-5 text-foreground/80">{creator.bio}</Text>

              <View className="mt-3 flex-row rounded-md bg-muted p-3">
                {stats.map((st) => (
                  <View key={st.label} className="flex-1 items-center">
                    <Text className="text-lg font-bold text-foreground">{st.value}</Text>
                    <Text className="mt-1 text-[11px] text-muted-foreground">{st.label}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text className="mb-2 mt-4 text-sm font-semibold text-foreground">技能标签</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {SKILLS.map((sk) => (
              <Badge key={sk} variant="secondary" label={sk} className="bg-primary/10" />
            ))}
          </View>

          <Text className="mb-2 mt-4 text-sm font-semibold text-foreground">作品案例</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity activeOpacity={0.7}>
          <Card className="flex-row p-3">
            <View className="h-16 w-16 items-center justify-center rounded-md bg-muted">
              <Text className="text-[11px] text-muted-foreground">{item.category}</Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>{item.title}</Text>
              <Text className="mt-1 text-xs leading-[18px] text-muted-foreground" numberOfLines={2}>{item.desc}</Text>
              <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
                {item.tags.map((tg) => (
                  <View key={tg} className="rounded-md bg-muted px-1.5 py-0.5">
                    <Text className="text-[10px] text-muted-foreground">{tg}</Text>
                  </View>
                ))}
                <Text className="text-[11px] text-destructive">♥ {item.likes}</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      )}
    />
  )
}
