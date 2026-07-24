import { useState } from 'react'
import { FlatList, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Avatar, Badge, Card } from '@ihui/ui-native'
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

const MOCK_CREATOR: Creator = {
  name: '陈创客',
  title: '全栈工程师 · AI 应用开发者',
  bio: '专注 AI Agent 应用与跨端开发,擅长将大模型能力落地为可用的产品。',
  projects: 24,
  skills: 12,
  rating: 4.9,
}

const SKILLS = ['React Native', 'LangGraph', 'RAG', 'Prompt 工程', 'Node.js', 'PostgreSQL', 'Taro', 'Python']

const MOCK_WORKS: Work[] = [
  { id: '1', title: '智能客服 Agent', category: 'AI 应用', desc: '基于 LangGraph 的多轮对话客服系统,支持工单流转与知识库检索。', tags: ['LangGraph', 'RAG'], likes: 128 },
  { id: '2', title: '跨端笔记应用', category: '移动开发', desc: 'React Native + Next.js 同构笔记,支持 Markdown 与双向链接。', tags: ['RN', 'Next.js'], likes: 96 },
  { id: '3', title: '数据看板可视化', category: '前端工程', desc: '复杂数据的多维可视化看板,支持自定义图表与实时刷新。', tags: ['ECharts', 'React'], likes: 72 },
  { id: '4', title: '小程序商城', category: '移动开发', desc: 'Taro 4 多端商城,统一代码覆盖微信 / 支付宝 / H5。', tags: ['Taro', 'TS'], likes: 64 },
]

/** 创客名片 / 作品集:展示创客资料、技能标签与代表案例。 */
export default function CarteScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [creator] = useState<Creator>(MOCK_CREATOR)
  const [works] = useState<Work[]>(MOCK_WORKS)

  const stats = [
    { label: '项目', value: creator.projects },
    { label: '技能', value: creator.skills },
    { label: '好评', value: creator.rating },
  ]

  return (
    <FlatList
      className="flex-1 bg-card"
      data={works}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      ItemSeparatorComponent={() => <View className="h-2" />}
      ListHeaderComponent={
        <View>
          <View className="flex-row items-center gap-3 pb-3 pt-12">
            <TouchableOpacity onPress={() => navigation.goBack()} className="py-1">
              <Text className="text-sm text-muted-foreground">返回</Text>
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-foreground">创客名片</Text>
          </View>

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
