import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  LearnDevelopScreen as SharedLearnDevelopScreen,
  type LearnDevelopEntry,
  type LearnDevelopScreenProps,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// 学习功能导航入口由端侧注入真实跳转(替代原有的「开发中」占位)
const ENTRIES = (navigation: NavigationProp): LearnDevelopEntry[] => [
  {
    icon: '🪐',
    title: '课程星球',
    desc: '热门/精选课程浏览',
    onPress: () => navigation.navigate('CoursePlanet'),
  },
  {
    icon: '📖',
    title: '学习计划',
    desc: '查看我的学习计划',
    onPress: () => navigation.navigate('StudyPlan'),
  },
  {
    icon: '🧠',
    title: '知识星球',
    desc: '知识内容浏览',
    onPress: () => navigation.navigate('KnowledgePlanet'),
  },
  {
    icon: '🧭',
    title: '学习视频',
    desc: '最新课程视频',
    onPress: () => navigation.navigate('StudyIndex'),
  },
  {
    icon: '🎓',
    title: '学习中心',
    desc: '系统化学习路径',
    onPress: () => navigation.navigate('Learn'),
  },
]

export function LearnDevelopScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  // 直接联系李总 → 创客名片页(对齐原项目 learn_develop showDetails → /pages/carte/index)
  const onContact = () => {
    navigation.navigate('Carte')
  }

  const props: LearnDevelopScreenProps = {
    t,
    onBack: () => navigation.goBack(),
    onContact,
    entries: ENTRIES(navigation),
    colorScheme: 'light',
  }

  return <SharedLearnDevelopScreen {...props} />
}
