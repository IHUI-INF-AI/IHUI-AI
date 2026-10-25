// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ABOUT_ENTRY_IDS } from '@ihui/shared/constants'
import { AboutScreen as SharedAboutScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { WEB_BASE_URL } from '../lib/webview-portal-config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * RN 端「关于我们」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/about/AboutScreen.tsx`,本文件只管平台侧:
 * 导航落点、取词、主题,以及把跨端共用的入口身份(`ABOUT_ENTRY_IDS`)映射到本端在册屏。
 *
 * 此前本屏自带一份实现(约 239 行),而共享层躺着一版没人渲染的旧「应用信息六行表」,
 * 小程序端又抄第三份分段表 ⇒ 同一屏三处对账,「两端一模一样」没有任何一层能判。
 * 本次把富版提升为真相源,端内实现与分段数据表(aboutPageSections.ts)一并删除。
 *
 * 入口集合按 `ABOUT_ENTRY_IDS` 的顺序渲染;本端 10 条全部有在册屏 + 在册取词键。
 */
const LABEL_KEY: Record<(typeof ABOUT_ENTRY_IDS)[number], string> = {
  agreement: 'menu.agreement',
  privacy: 'menu.privacy',
  appPermission: 'menu.appPermission',
  usageRules: 'menu.usageRules',
  businessLicense: 'menu.businessLicense',
  icpRecord: 'menu.icpRecord',
  modelRecord: 'menu.modelRecord',
  apiSettings: 'menu.apiSettings',
  help: 'help.title',
  contact: 'customerService.title',
}

export function AboutScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const openPortal = useCallback(() => {
    navigation.navigate('WebView', {
      url: `${WEB_BASE_URL}/developer`,
      title: t('about.ctaSecondary'),
    })
  }, [navigation, t])

  /**
   * 入口 id → 本端跳转。逐条具名调用(而不是 `navigate(ROUTE[id])`):
   * 路由名联合体会让 @react-navigation 的泛型重载匹配不上,而 `as never` 这类强转
   * 会把「屏改名」从编译期错误降级成运行时白屏。
   */
  const goTo: Record<(typeof ABOUT_ENTRY_IDS)[number], () => void> = {
    agreement: () => navigation.navigate('Agreement'),
    privacy: () => navigation.navigate('Privacy'),
    appPermission: () => navigation.navigate('AppPermission'),
    usageRules: () => navigation.navigate('UsageRules'),
    businessLicense: () => navigation.navigate('BusinessLicense'),
    icpRecord: () => navigation.navigate('IcpRecord'),
    modelRecord: () => navigation.navigate('ModelRecord'),
    apiSettings: () => navigation.navigate('ApiSettings'),
    help: () => navigation.navigate('Help'),
    contact: () => navigation.navigate('CustomerService'),
  }

  const entries = ABOUT_ENTRY_IDS.map((id) => ({
    id,
    label: t(LABEL_KEY[id]),
    onPress: goTo[id],
  }))

  return (
    <SharedAboutScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      onRegister={() => navigation.navigate('Register')}
      onOpenPortal={openPortal}
      entries={entries}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
