// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// @gen-rn-host-shell —— 本文件为生成物,勿手改结构;共享屏 props 变更后重跑:
//   node scripts/gen-rn-host-shell.mjs --screen=packages/app/src/features/legal-doc/LegalDocsHubScreen.tsx --write --force

import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { LegalDocsHubScreen as SharedLegalDocsHubScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * RN 宿主薄壳 —— 真相源 legal-doc/LegalDocsHubScreen.tsx。
 * 端内不写布局、不写样式:视觉与结构全在共享屏,本屏只做平台注入(取词/主题/返回)。
 */
export function LegalDocsHubScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  return (
    <SharedLegalDocsHubScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
    />
  )
}
