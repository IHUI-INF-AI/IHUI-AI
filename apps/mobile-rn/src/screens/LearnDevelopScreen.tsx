/**
 * LearnDevelopScreen 学习开发页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/learn_develop/index.vue(课程星球占位页):
 * - 顶部 NavBar(标题「学习开发」+ 返回)
 * - 渐变背景(对齐 Uniapp linear-gradient #cbeaf1 → #f6f7f7;RN 无原生 CSS 渐变且禁止引入新依赖,
 *   用纯色 #cbeaf1 逼近顶部主色)
 * - 会员权益卡片(对齐 membership-benefits-card:渐变 #FFE09E → #ffffff,圆角 30rpx≈15dp,
 *   宽 90%,高 400rpx≈200dp,阴影,marginTop 150rpx≈75dp;RN 用双层 View 伪渐变逼近)
 * - 占位文案「课程星球正在开发中」(对齐 benefit-item fontSize 50rpx≈25dp,marginTop 100rpx≈50dp)
 * - 「直接联系李总」按钮(对齐 details-button:渐变 #FFAA36 → #FFE0E0,圆角 60rpx≈30dp,
 *   宽 374rpx≈187dp,高 76rpx≈38dp,白色文字,阴影)
 * - 按钮点击:Uniapp 跳转 /pages/carte/index;RN 端 Carte 路由未注册(约束禁止改其他文件),
 *   用 Alert 提示联系方式作为安全回退
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full)
 */
import { Alert, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function LearnDevelopScreen() {
  const navigation = useNavigation<NavigationProp>()

  // 直接联系李总(对齐 Uniapp showDetails → /pages/carte/index;RN 端 Carte 路由未注册,
  // 受「禁止修改其他文件」约束,用 Alert 提示联系方式作为安全回退)
  const onContact = () => {
    Alert.alert('直接联系李总', '课程星球正在开发中,如需咨询请联系客服或李总。', [
      { text: '知道了', style: 'default' },
    ])
  }

  return (
    <View style={styles.container}>
      <NavBar title="学习开发" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <View style={styles.card}>
          {/* 伪渐变:上层金色(对齐 #FFE09E 35%)+ 下层白色(对齐 #ffffff 100%) */}
          <View style={styles.cardGradientTop} />
          <View style={styles.cardGradientBottom} />
          <View style={styles.cardContent}>
            <View style={styles.benefitsList}>
              <Text style={styles.benefitText}>课程星球正在开发中</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.detailsButton, pressed ? styles.detailsButtonPressed : null]}
              onPress={onContact}
              accessibilityRole="button"
              accessibilityLabel="直接联系李总"
            >
              <Text style={styles.detailsButtonText}>直接联系李总</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
  // 页面主体(对齐 Uniapp .type:渐变背景 + flex column + center align)
  body: {
    flex: 1,
    // 对齐 Uniapp linear-gradient(180deg, #cbeaf1 0%, #f6f7f7 100%);无原生渐变用顶部主色 #cbeaf1 逼近
    backgroundColor: '#cbeaf1',
    alignItems: 'center',
  } as ViewStyle,
  // 会员权益卡片(对齐 Uniapp .membership-benefits-card)
  card: {
    width: '90%',
    height: 200,
    marginTop: 75,
    borderRadius: 15,
    overflow: 'hidden',
    // 对齐 Uniapp box-shadow: 0 0 12rpx rgba(0,0,0,0.05)
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  } as ViewStyle,
  // 伪渐变上层:金色(对齐 #FFE09E 35%)
  cardGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#FFE09E',
  } as ViewStyle,
  // 伪渐变下层:白色(对齐 #ffffff 100%)
  cardGradientBottom: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
  } as ViewStyle,
  // 卡片内容(绝对定位居中)
  cardContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  } as ViewStyle,
  // 福利列表区(对齐 Uniapp .benefits-list:height 60%,marginBottom 40rpx≈20dp)
  benefitsList: {
    width: '80%',
    height: '60%',
    marginTop: 50,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  // 占位文案(对齐 Uniapp .benefit-item fontSize 50rpx≈25dp)
  benefitText: {
    fontSize: 25,
    color: '#333333',
    textAlign: 'center',
  } as TextStyle,
  // 「直接联系李总」按钮(对齐 Uniapp .details-button)
  detailsButton: {
    width: 187,
    height: 38,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    // 对齐 Uniapp linear-gradient(180deg, #FFAA36 20%, #FFE0E0 100%);用主色 #FFAA36 逼近
    backgroundColor: '#FFAA36',
    // 对齐 Uniapp box-shadow: 0 0 10rpx rgba(255,179,130,0.4)
    elevation: 3,
    shadowColor: '#FFB382',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  } as ViewStyle,
  detailsButtonPressed: {
    opacity: 0.8,
  } as ViewStyle,
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  } as TextStyle,
})

export default LearnDevelopScreen
