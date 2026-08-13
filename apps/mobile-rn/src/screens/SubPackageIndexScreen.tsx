/**
 * SubPackageIndexScreen 子包功能入口聚合页(mobile-rn 端)
 *
 * 对齐历史 Uniapp pagesA/index/index.vue(子包功能入口导航):
 * - 顶部 NavBar「更多功能」+ 返回
 * - Grid 网格功能入口(每个入口:图标 + 标题 + 描述 + 跳转)
 * - 入口列表:更多课程 / 开发者入驻 / 广场 / 充值 / 学习中心 / AIGC 等
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线(gap 间距)
 */
import { Pressable, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface FeatureEntry {
  icon: string
  title: string
  desc: string
  onPress: (navigation: NavigationProp) => void
}

const ENTRIES: readonly FeatureEntry[] = [
  {
    icon: '📚',
    title: '更多课程',
    desc: '探索精选课程',
    onPress: (nav) => nav.navigate('MoreCourse'),
  },
  {
    icon: '🚀',
    title: '开发者入驻',
    desc: '发布模型与应用',
    onPress: (nav) => nav.navigate('DevEnterCover'),
  },
  {
    icon: '🌐',
    title: 'AI 需求广场',
    desc: '需求对接平台',
    onPress: (nav) => nav.navigate('PlazaCover'),
  },
  {
    icon: '💳',
    title: '充值中心',
    desc: '智汇值充值',
    onPress: (nav) => nav.navigate('AppTopup'),
  },
  {
    icon: '🎓',
    title: '学习中心',
    desc: '系统化学习路径',
    onPress: (nav) => nav.navigate('Learn'),
  },
  {
    icon: '📖',
    title: '学习首页',
    desc: '学习进度与计划',
    onPress: (nav) => nav.navigate('StudyIndex'),
  },
  {
    icon: '🤖',
    title: 'AI 群组',
    desc: '多 Agent 协作',
    onPress: (nav) => nav.navigate('AiGroup'),
  },
  {
    icon: '🎨',
    title: 'AIGC 创作',
    desc: 'AI 内容生成',
    onPress: (nav) => nav.navigate('AigcList'),
  },
]

export function SubPackageIndexScreen() {
  const navigation = useNavigation<NavigationProp>()

  return (
    <View style={styles.container}>
      <NavBar title="更多功能" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {ENTRIES.map((entry) => (
            <Pressable
              key={entry.title}
              style={({ pressed }) => [styles.entryCard, pressed ? styles.entryCardPressed : null]}
              onPress={() => entry.onPress(navigation)}
              accessibilityRole="button"
              accessibilityLabel={entry.title}
            >
              <Text style={styles.entryIcon}>{entry.icon}</Text>
              <Text style={styles.entryTitle} numberOfLines={1}>
                {entry.title}
              </Text>
              <Text style={styles.entryDesc} numberOfLines={2}>
                {entry.desc}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
  scrollContent: { paddingHorizontal: 16, paddingVertical: 12 } as ViewStyle,
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } as ViewStyle,
  entryCard: {
    width: '47%',
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    alignItems: 'center',
  } as ViewStyle,
  entryCardPressed: { backgroundColor: tk.surface.muted } as ViewStyle,
  entryIcon: { fontSize: 32 } as TextStyle,
  entryTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary } as TextStyle,
  entryDesc: {
    fontSize: 12,
    color: tk.text.tertiary,
    textAlign: 'center',
    lineHeight: 16,
  } as TextStyle,
})

export default SubPackageIndexScreen
