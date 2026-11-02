// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  LearnDevelopScreen as SharedLearnDevelopScreen,
  type LearnDevelopEntry,
  type LearnDevelopScreenProps,
} from '@ihui/rn-app'
import { Rocket, BookOpen, Brain, Compass, GraduationCap } from 'lucide-react-native'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useHostPorts } from '../host/use-host-ports'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// 学习功能导航入口由端侧注入真实跳转(替代原有的「开发中」占位)
const ENTRIES = (
  onNavigate: LearnDevelopScreenProps['onNavigate'],
  t: (k: string) => string,
): LearnDevelopEntry[] => [
  {
    icon: Rocket,
    title: t('learnDevelop.courseTitle'),
    desc: t('learnDevelop.courseDesc'),
    onPress: () => onNavigate('CoursePlanet'),
  },
  {
    icon: BookOpen,
    title: t('studyPlan.title'),
    desc: t('learnDevelop.planDesc'),
    onPress: () => onNavigate('StudyPlan'),
  },
  {
    icon: Brain,
    title: t('learnDevelop.kTitle'),
    desc: t('learnDevelop.kDesc'),
    onPress: () => onNavigate('KnowledgePlanet'),
  },
  {
    icon: Compass,
    title: t('learnDevelop.videoTitle'),
    desc: t('learnDevelop.videoDesc'),
    onPress: () => onNavigate('StudyIndex'),
  },
  {
    icon: GraduationCap,
    title: t('learnDevelop.centerTitle'),
    desc: t('learnDevelop.centerDesc'),
    onPress: () => onNavigate('Learn'),
  },
]

export function LearnDevelopScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const { onNavigate } = useHostPorts()

  // 直接联系李总 → 创客名片页(对齐原项目 learn_develop showDetails → /pages/carte/index)
  const onContact = () => {
    onNavigate('Carte')
  }

  const props: LearnDevelopScreenProps = {
    t,
    onBack: () => navigation.goBack(),
    onContact,
    entries: ENTRIES(onNavigate, t),
    colorScheme: resolvedTheme,
    onNavigate,
  }

  return <SharedLearnDevelopScreen {...props} />
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
