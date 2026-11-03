// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { DomainHubScreen as SharedDomainHubScreen, type DomainHubItem } from '@ihui/rn-app'
import { rnGeometry } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { tokens } from '../theme/active-tokens'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { DOMAIN_HUBS, type DomainKey } from '../navigation/domain-hub'

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'DomainHub'>
type DomainRouteProp = RouteProp<RootStackParamList, 'DomainHub'>

/**
 * DomainHubScreen — RN 端域入口二级屏(P3 侧边栏收敛,2026-10-19)。
 *
 * 与 web /domains/* 域入口同构:抽屉只保留教育/交易/社区三个域入口行,点击进入本屏,
 * 屏内按 navigation/domain-hub 单源列出该域全部子项,条目一条不丢、URL/路由不变。
 *
 * 〔G-921 2026-10-21〕UI 已下沉到共享层 `@ihui/rn-app` 的 DomainHubScreen —— 本文件改成
 * wrapper,只留平台侧三件事:路由参数(domain)、导航分派(target)、i18n 与主题注入;
 * 列表行与返回键由共享层渲染(与 PaymentScreen 同一型 wrapper 模式)。
 * **不准**靠"补一条 @ihui/rn-app import"或塞白名单消门 39 的红 —— 那两条都不改真实共享度。
 */
export default function DomainHubScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<DomainRouteProp>()
  const domain = route.params?.domain as DomainKey | undefined
  const hub = domain ? DOMAIN_HUBS[domain] : undefined

  const items: DomainHubItem[] = (hub?.items ?? []).map((item) => {
    const ItemIcon = item.Icon
    return {
      key: item.labelKey,
      label: t(item.labelKey),
      icon: <ItemIcon size={rnGeometry.glyphMd} color={tokens.text.secondary} />,
    }
  })

  const openTarget = (key: string) => {
    const item = (hub?.items ?? []).find((i) => i.labelKey === key)
    if (!item) return
    if (item.target.type === 'main') {
      navigation.navigate('Main', { screen: item.target.screen })
    } else {
      // as never:navigate 重载按单一键名分派,联合键名匹配不了任何单一重载(抽屉/设置页先例)
      navigation.navigate(item.target.name as never)
    }
  }

  return (
    <SharedDomainHubScreen
      t={t}
      title={hub ? t(hub.titleKey) : ''}
      items={items}
      onSelect={openTarget}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
