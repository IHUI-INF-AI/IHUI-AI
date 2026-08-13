/**
 * IcpRecordScreen ICP 备案信息页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/settings/icp-record.vue:
 * - 顶部 NavBar(标题「ICP备案」+ 返回)
 * - 内容区:卡片展示 ICP 备案/许可证号
 * - 浅色优雅风,rnLightTokens;圆角守门;无分割线
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// mobile-rn 端暂无 settings.icpRecord 翻译 key(对齐 .vue 硬编码中文),key 就绪后自动切换
const TITLE_KEY = 'settings.icpRecord'

export function IcpRecordScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const tTitle = t(TITLE_KEY)
  const title = tTitle === TITLE_KEY ? 'ICP备案' : tTitle

  return (
    <View style={styles.container}>
      <NavBar title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>ICP备案/许可证号</Text>
          <Text style={styles.value}>吉ICP备2025027274号-7A</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tk.surface.muted,
  },
  content: {
    padding: 12,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: tk.surface.light,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 13,
    color: tk.text.tertiary,
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: tk.text.primary,
    fontWeight: '500',
  },
})

export default IcpRecordScreen
