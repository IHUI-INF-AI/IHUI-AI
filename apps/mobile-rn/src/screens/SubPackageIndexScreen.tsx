// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../context/ThemeContext'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SubPackageIndexScreen as SharedSubPackageIndexScreen } from '@ihui/rn-app'
import type { AppIcon } from '@ihui/types'
import {
  BookOpen,
  Rocket,
  Globe,
  CreditCard,
  GraduationCap,
  Bot,
  Palette,
} from 'lucide-react-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface FeatureEntry {
  icon: AppIcon | string
  title: string
  desc: string
  onPress: (navigation: NavigationProp) => void
}

const ENTRIES: readonly FeatureEntry[] = [
  {
    icon: BookOpen,
    title: t('course.moreTitle'),
    desc: t('subPkg.courseDesc'),
    onPress: (nav) => nav.navigate('MoreCourse'),
  },
  {
    icon: Rocket,
    title: t('subPkg.devTitle'),
    desc: t('subPkg.devDesc'),
    onPress: (nav) => nav.navigate('DevEnterCover'),
  },
  {
    icon: Globe,
    title: t('subPkg.plazaTitle'),
    desc: t('subPkg.plazaDesc'),
    onPress: (nav) => nav.navigate('PlazaCover'),
  },
  {
    icon: CreditCard,
    title: t('subPkg.topupTitle'),
    desc: t('subPkg.topupDesc'),
    onPress: (nav) => nav.navigate('AppTopup'),
  },
  {
    icon: GraduationCap,
    title: t('learnDevelop.centerTitle'),
    desc: t('learnDevelop.centerDesc'),
    onPress: (nav) => nav.navigate('Learn'),
  },
  {
    icon: BookOpen,
    title: t('subPkg.homeTitle'),
    desc: t('subPkg.homeDesc'),
    onPress: (nav) => nav.navigate('StudyIndex'),
  },
  {
    icon: Bot,
    title: t('subPkg.groupTitle'),
    desc: t('subPkg.groupDesc'),
    onPress: (nav) => nav.navigate('AiGroup'),
  },
  {
    icon: Palette,
    title: t('subPkg.aigcTitle'),
    desc: t('subPkg.aigcDesc'),
    onPress: (nav) => nav.navigate('AigcList'),
  },
]

export function SubPackageIndexScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const entries = ENTRIES.map((entry) => ({
    icon: entry.icon,
    title: entry.title,
    desc: entry.desc,
    onPress: () => entry.onPress(navigation),
  }))

  return (
    <SharedSubPackageIndexScreen
      t={t}
      onBack={() => navigation.goBack()}
      entries={entries}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
