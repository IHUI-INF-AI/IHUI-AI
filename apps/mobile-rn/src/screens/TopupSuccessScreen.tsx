/**
 * TopupSuccessScreen 充值成功 (mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp topup-success/index.vue(展示充值成功状态):
 * - 成功图标(✅)+ 金额 + 订单号 + 时间
 * - 两个按钮:"查看订单"(跳 Order 路由)/ "返回首页"(跳 home tab)
 * 路由参数:{ amount: number; orderId: string }
 * 类型零 any;颜色走 rnLightTokens;圆角仅 12/8/6;无分割线。
 */
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { IntroducePopup } from '../components/IntroducePopup'
import type { RootStackParamList } from '../navigation/RootNavigator'

type TopupSuccessParams = {
  TopupSuccess: { amount: number; orderId: string }
}
type Route = RouteProp<TopupSuccessParams, 'TopupSuccess'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 常见问题弹窗文案(对齐 Uniapp topup-success 页面的到账/订单答疑) */
const TOPUP_FAQ_ITEMS: readonly string[] = [
  '充值成功后智汇值一般实时到账,如余额未更新,可在「我的智汇值」页下拉刷新',
  '微信扣款成功但停留在结果页时,请先到订单列表查看订单状态,请勿重复充值',
  '订单编号是查询与售后的重要凭证,请妥善保留',
  '如长时间未到账,请联系客服并提供订单编号与充值时间',
  '充值金额不支持退款与转让',
]

export default function TopupSuccessScreen() {
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { amount, orderId } = route.params
  const time = new Date().toLocaleString('zh-CN')
  const [faqVisible, setFaqVisible] = useState(false)

  const goOrder = () => navigation.navigate('Order')
  const goHome = () => navigation.navigate('Main', { screen: 'HomeMain' })

  return (
    <View style={styles.container}>
      <NavBar title="充值结果" onBack={goHome} />
      <View style={styles.body}>
        <Text style={styles.icon}>✅</Text>
        <Text style={styles.title}>充值成功</Text>
        <View style={styles.card}>
          <Row label="充值金额" value={`¥${amount.toFixed(2)}`} />
          <Row label="订单编号" value={orderId} />
          <Row label="充值时间" value={time} />
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.7} onPress={goOrder}>
            <Text style={styles.secondaryText}>查看订单</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.7} onPress={goHome}>
            <Text style={styles.primaryText}>返回首页</Text>
          </TouchableOpacity>
          {/* 常见问题入口(IntroducePopup,对齐 Uniapp top-up 系列页面说明弹窗) */}
          <TouchableOpacity
            style={styles.faqLink}
            activeOpacity={0.7}
            onPress={() => setFaqVisible(true)}
          >
            <Text style={styles.faqText}>常见问题 ?</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 常见问题弹窗(IntroducePopup) */}
      <IntroducePopup
        visible={faqVisible}
        onClose={() => setFaqVisible(false)}
        variant="index"
        title="常见问题"
        content="关于充值到账与订单的常见问题"
        benefits={[...TOPUP_FAQ_ITEMS]}
        moreBenefits=""
        confirmText="我知道了"
        onConfirm={() => setFaqVisible(false)}
      />
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { flex: 1, alignItems: 'center', padding: 24, gap: 16 },
  icon: { fontSize: 64, marginTop: 24 },
  title: { fontSize: 20, fontWeight: '700', color: tokens.success.deep },
  card: {
    width: '100%',
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: tokens.text.secondary },
  rowValue: { fontSize: 14, color: tokens.text.primary, maxWidth: '60%' },
  actions: { width: '100%', gap: 12, marginTop: 8 },
  secondaryBtn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: tokens.surface.card,
  },
  secondaryText: { fontSize: 15, color: tokens.text.primary },
  primaryBtn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: tokens.brand.DEFAULT,
  },
  primaryText: { fontSize: 15, fontWeight: '600', color: tokens.surface.light },
  faqLink: { paddingVertical: 6, alignSelf: 'center' },
  faqText: { fontSize: 13, color: tokens.text.secondary },
})
