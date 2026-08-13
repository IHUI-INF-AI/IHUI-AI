/**
 * TopupFailScreen 充值失败 (mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp topup-fail/index.vue(展示充值失败状态):
 * - 失败图标(❌)+ 失败原因
 * - 两个按钮:"重试"(goBack)/ "联系客服"(Alert 占位)
 * 路由参数:{ reason?: string }
 * 类型零 any;颜色走 rnLightTokens;圆角仅 12/8/6。
 */
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import type { RootStackParamList } from '../navigation/RootNavigator'

type TopupFailParams = {
  TopupFail: { reason?: string }
}
type Route = RouteProp<TopupFailParams, 'TopupFail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function TopupFailScreen() {
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const reason = route.params?.reason || '充值未完成,请稍后重试'

  const retry = () => navigation.goBack()
  const contactService = () => Alert.alert('联系客服', '客服功能待接入')

  return (
    <View style={styles.container}>
      <NavBar title="充值结果" onBack={retry} />
      <View style={styles.body}>
        <Text style={styles.icon}>❌</Text>
        <Text style={styles.title}>充值失败</Text>
        <View style={styles.card}>
          <Text style={styles.reason}>{reason}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.7} onPress={retry}>
            <Text style={styles.primaryText}>重试</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.7} onPress={contactService}>
            <Text style={styles.secondaryText}>联系客服</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { flex: 1, alignItems: 'center', padding: 24, gap: 16 },
  icon: { fontSize: 64, marginTop: 24 },
  title: { fontSize: 20, fontWeight: '700', color: tokens.danger.DEFAULT },
  card: {
    width: '100%',
    backgroundColor: tokens.danger.light,
    borderRadius: 12,
    padding: 16,
  },
  reason: { fontSize: 14, color: tokens.danger.DEFAULT, textAlign: 'center' },
  actions: { width: '100%', gap: 12, marginTop: 8 },
  primaryBtn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: tokens.brand.DEFAULT,
  },
  primaryText: { fontSize: 15, fontWeight: '600', color: tokens.surface.light },
  secondaryBtn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: tokens.surface.card,
  },
  secondaryText: { fontSize: 15, color: tokens.text.primary },
})
