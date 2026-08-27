/**
 * IntelligentAssistant 智汇值卡片 (mobile-rn 端)
 *
 * 对齐 Uniapp 项目 pages/table/tools/components/Intelligent-assistant.vue:
 * - 顶部悬浮装饰机器人图(原 xiaofang.png,float 动画)
 * - 欢迎文案:"Hi, 我是您的AI助手小方👋" + "用AI.找AI.学AI到AI智汇社区就够了"
 * - 底部"剩余智汇值: xxx" + 充值按钮(点击 → 充值页)
 *
 * 注意:配色遵循 web token 体系(primary 纯黑 + info 蓝),不使用原 uniapp 紫色 #517bff/#8389FF
 * (2026-08-16 定案:移动端配色 = web 端统一 token,禁 purple/indigo)。
 * 类型零 any;圆角守门;无分割线;复用 design-tokens。
 */
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface IntelligentAssistantProps {
  /** 剩余智汇值(对齐原 tokenQuantity) */
  tokenQuantity?: number
  /** 充值按钮点击(对齐原 topupClick → /pagesA/top-up/index) */
  onRecharge?: () => void
  /** 机器人装饰图(可选,缺省隐藏;原 xiaofang.png) */
  robotImage?: string
}

function formatTokenValue(value: number): string {
  if (!value || value <= 0) return '0'
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return String(value)
}

export default function IntelligentAssistant({
  tokenQuantity = 0,
  onRecharge,
  robotImage,
}: IntelligentAssistantProps) {
  return (
    <View style={styles.container}>
      {robotImage ? (
        <Image source={{ uri: robotImage }} style={styles.floatingDecoration} resizeMode="contain" />
      ) : null}
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeContent}>
          <View style={styles.welcomeMessage}>
            <Text style={styles.welcomeIntro}>{'Hi, 我是您的AI助手小方👋'}</Text>
            <Text style={styles.welcomeAction}>{'用AI.找AI.学AI到AI智汇社区就够了'}</Text>
          </View>
        </View>
        <View style={styles.limitInfo}>
          <View style={styles.limitContent}>
            <View style={styles.limitText}>
              <Text style={styles.limitLabel}>{'剩余智汇值:'}</Text>
              <Text style={styles.limitCount}>{formatTokenValue(tokenQuantity)}</Text>
            </View>
            {onRecharge ? (
              <TouchableOpacity
                style={styles.rechargeAction}
                onPress={onRecharge}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="充值"
              >
                <View style={styles.tokenButton}>
                  <Text style={styles.tokenButtonText}>{'充值'}</Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginHorizontal: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  floatingDecoration: {
    position: 'absolute',
    top: -8,
    right: 9,
    width: 107,
    height: 110,
    zIndex: 2,
  },
  welcomeCard: {
    borderRadius: 15,
    padding: 4,
    backgroundColor: tokens.surface.card,
    overflow: 'hidden',
  },
  welcomeContent: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  welcomeMessage: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    paddingLeft: 16,
    paddingTop: 4,
  },
  welcomeIntro: {
    fontSize: 19,
    fontWeight: '700',
    color: tokens.brand.DEFAULT,
  },
  welcomeAction: {
    fontSize: 12,
    color: tokens.text.secondary,
    fontWeight: '700',
    paddingTop: 4,
    paddingBottom: 4,
  },
  limitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  limitContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    marginLeft: 16,
  },
  limitText: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  limitLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  limitCount: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  rechargeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  tokenButton: {
    backgroundColor: tokens.brand.DEFAULT,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tokenButtonText: {
    fontSize: 12,
    color: tokens.surface.light,
    fontWeight: '700',
  },
})
