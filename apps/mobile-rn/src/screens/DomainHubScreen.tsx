// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { tokens } from '../theme/active-tokens'
import { rnGeometry, rnRadius } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { DOMAIN_HUBS, type DomainKey } from '../navigation/domain-hub'

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'DomainHub'>
type DomainRouteProp = RouteProp<RootStackParamList, 'DomainHub'>

/**
 * DomainHubScreen — RN 端域入口二级屏(P3 侧边栏收敛,2026-10-19)。
 *
 * 与 web /domains/* 域入口同构:抽屉只保留教育/交易/社区三个域入口行,点击进入本屏,
 * 屏内按 navigation/domain-hub 单源列出该域全部子项,条目一条不丢、URL/路由不变。
 * 页头 = NavBar(返回键走 back-chevron-spec 单源),不硬编码中文、不自绘返回箭头。
 */
export default function DomainHubScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<DomainRouteProp>()
  const domain = route.params?.domain as DomainKey | undefined
  const hub = domain ? DOMAIN_HUBS[domain] : undefined

  const openTarget = (item: (typeof DOMAIN_HUBS)[DomainKey]['items'][number]) => {
    if (item.target.type === 'main') {
      navigation.navigate('Main', { screen: item.target.screen })
    } else {
      // as never:navigate 重载按单一键名分派,联合键名匹配不了任何单一重载(抽屉/设置页先例)
      navigation.navigate(item.target.name as never)
    }
  }

  if (!hub) {
    return (
      <View style={styles.container}>
        <NavChrome>
          <NavBar onBack={() => navigation.goBack()} />
        </NavChrome>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t(hub.titleKey)} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {hub.items.map((item) => {
          const { Icon } = item
          return (
            <TouchableOpacity
              key={item.labelKey}
              style={styles.row}
              activeOpacity={0.85}
              onPress={() => openTarget(item)}
              accessibilityRole="button"
              accessibilityLabel={t(item.labelKey)}
            >
              <Icon size={rnGeometry.glyphMd} color={tokens.text.secondary} />
              <Text numberOfLines={1} style={styles.rowLabel}>
                {t(item.labelKey)}
              </Text>
              <ChevronRight size={rnGeometry.glyphSm} color={tokens.text.tertiary} />
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { flex: 1 },
  bodyContent: { padding: 12, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
  },
  rowLabel: { flex: 1, fontSize: 16, color: tokens.text.primary },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
