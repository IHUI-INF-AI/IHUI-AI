/**
 * ShareScreen 分享入口占位页(mobile-rn 端)
 *
 * 对齐历史项目 pages/table/share/index.vue:
 * - Uniapp 此页是 Loading 占位,onShow 立即 uni.reLaunch 到 pagesA/plaza/index
 * - RN 复刻:挂载后立即 navigation.replace('Plaza') 跳转 PlazaScreen,期间显示 Loading
 * - 显示简单 Loading(用 common/Loading 组件)
 *
 * 注:'Plaza' 路由由主 agent 在 RootNavigator 统一注册(本任务不修改 RootNavigator)。
 * 此处用本地类型补声明 RootStackParamList & { Plaza: undefined } 保证 typecheck 通过,
 * 主 agent 注册 'Plaza: undefined' 后该交集等价、无冲突。
 */
import { useEffect, useMemo } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import Loading from '../components/common/Loading'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

/** 本地补声明 Plaza 路由(主 agent 将在 RootNavigator 注册) */
type ShareNavParamList = RootStackParamList & { Plaza: undefined }
type NavigationProp = NativeStackNavigationProp<ShareNavParamList>

export function ShareScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  useEffect(() => {
    // 对齐 Uniapp onShow → uni.reLaunch:立即 replace 到 Plaza,不留返回栈
    navigation.replace('Plaza')
  }, [navigation])

  return (
    <View style={styles.container}>
      <Loading text={t('common.loading')} />
    </View>
  )
}

function createStyles(tk: RnThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
  })
}

export default ShareScreen
