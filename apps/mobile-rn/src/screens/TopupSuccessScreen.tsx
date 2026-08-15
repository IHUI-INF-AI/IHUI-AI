import { useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { TopupSuccessScreen as SharedTopupSuccessScreen } from '@ihui/rn-app'
import { IntroducePopup } from '../components/IntroducePopup'
import { useI18n } from '../i18n'
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
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { amount, orderId } = route.params
  const time = new Date().toLocaleString('zh-CN')
  const [faqVisible, setFaqVisible] = useState(false)

  const goOrder = () => navigation.navigate('Order')
  const goHome = () => navigation.navigate('Main', { screen: 'HomeMain' })

  return (
    <>
      <SharedTopupSuccessScreen
        t={t}
        amount={amount}
        orderId={orderId}
        time={time}
        onViewOrder={goOrder}
        onGoHome={goHome}
        faqItems={TOPUP_FAQ_ITEMS}
        onFaqVisibleChange={setFaqVisible}
        onBack={() => navigation.goBack()}
      />
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
    </>
  )
}
