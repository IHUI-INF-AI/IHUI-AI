import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SubPackageIndexScreen as SharedSubPackageIndexScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
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
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const entries = ENTRIES.map((entry) => ({
    icon: entry.icon,
    title: entry.title,
    desc: entry.desc,
    onPress: () => entry.onPress(navigation),
  }))

  return <SharedSubPackageIndexScreen t={t} onBack={() => navigation.goBack()} entries={entries} />
}
