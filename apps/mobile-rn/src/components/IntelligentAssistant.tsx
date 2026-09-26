// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { tokens } from '../theme/active-tokens'

import { rnRadius } from '@ihui/design-tokens'
import {
  IA_GREETING_FONT_PX,
  IA_GREETING_TOP_PX,
  IA_HEADING_FONT_WEIGHT,
  IA_MARGIN_PX,
  IA_PADDING_PX,
  IA_RECHARGE_CAPSULE_PAD_X_PX,
  IA_RECHARGE_CAPSULE_PAD_Y_PX,
  IA_RECHARGE_FONT_PX,
  IA_RECHARGE_GAP_PX,
  IA_RECHARGE_HIT_PX,
  IA_ROBOT_DECOR_H_PX,
  IA_ROBOT_DECOR_RIGHT_PX,
  IA_ROBOT_DECOR_TOP_PX,
  IA_ROBOT_DECOR_W_PX,
  IA_SUBTITLE_FONT_PX,
  IA_TEXT_GAP_PX,
  IA_TEXT_INDENT_PX,
  IA_TOKEN_FONT_PX,
  IA_TOKEN_ROW_GAP_PX,
} from '@ihui/shared/ui/intelligent-assistant-spec'

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
        <Image
          source={{ uri: robotImage }}
          style={styles.floatingDecoration}
          resizeMode="contain"
        />
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
    marginHorizontal: IA_MARGIN_PX,
    marginTop: IA_MARGIN_PX,
    marginBottom: IA_MARGIN_PX,
  },
  floatingDecoration: {
    // 位图装饰(小程序是行内矢量墨迹,不同媒介)—— 布局盒与位置是单端档,数字住 spec
    // (裁决与"机制差异,非取值分叉"的依据写在 IA_ROBOT_DECOR_* 注释)
    position: 'absolute',
    top: IA_ROBOT_DECOR_TOP_PX,
    right: IA_ROBOT_DECOR_RIGHT_PX,
    width: IA_ROBOT_DECOR_W_PX,
    height: IA_ROBOT_DECOR_H_PX,
    zIndex: 2,
  },
  welcomeCard: {
    // 圆角走 radius.js 的 2xl 档(与小程序 `--radius-2xl` 同档;裁决依据见 spec 头注)
    borderRadius: rnRadius['2xl'],
    padding: IA_PADDING_PX,
    backgroundColor: tokens.surface.card,
    overflow: 'hidden',
  },
  welcomeContent: {
    flexDirection: 'row',
  },
  welcomeMessage: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    // 左缩进:装饰走 absolute 不占流,文本左缘靠它避让(单端档,依据见 IA_TEXT_INDENT_PX);
    // 顶偏移两端同档(小程序 .ia-content 补同值,依据见 IA_GREETING_TOP_PX)
    paddingLeft: IA_TEXT_INDENT_PX,
    paddingTop: IA_GREETING_TOP_PX,
  },
  welcomeIntro: {
    fontSize: IA_GREETING_FONT_PX,
    fontWeight: IA_HEADING_FONT_WEIGHT,
    color: tokens.brand.DEFAULT,
  },
  welcomeAction: {
    fontSize: IA_SUBTITLE_FONT_PX,
    color: tokens.text.secondary,
    fontWeight: IA_HEADING_FONT_WEIGHT,
    marginTop: IA_TEXT_GAP_PX,
  },
  limitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  limitContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: IA_TOKEN_ROW_GAP_PX,
    // 与上方文本块同档(两行左缘必须对齐,裁决依据见 IA_TEXT_INDENT_PX)
    marginLeft: IA_TEXT_INDENT_PX,
  },
  limitText: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  limitLabel: {
    fontSize: IA_TOKEN_FONT_PX,
    fontWeight: IA_HEADING_FONT_WEIGHT,
    color: tokens.text.primary,
  },
  limitCount: {
    fontSize: IA_TOKEN_FONT_PX,
    fontWeight: IA_HEADING_FONT_WEIGHT,
    color: tokens.text.primary,
  },
  rechargeAction: {
    // 命中块 ≥44 走 minHeight(可见胶囊不放大);小程序侧同一常数以 pad 兑现(通道差异)
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: IA_RECHARGE_HIT_PX,
    // 胶囊与值文本的间距:RN 值行左聚拢、靠本档留距;小程序 space-between 无固定档
    // (机制差异,非取值分叉 —— 依据见 IA_RECHARGE_GAP_PX)
    marginLeft: IA_RECHARGE_GAP_PX,
  },
  tokenButton: {
    backgroundColor: tokens.brand.cta,
    // 胶囊可见内衬:小程序是纯文字链、无胶囊本体,单端档(依据见 IA_RECHARGE_CAPSULE_PAD_*)
    paddingHorizontal: IA_RECHARGE_CAPSULE_PAD_X_PX,
    paddingVertical: IA_RECHARGE_CAPSULE_PAD_Y_PX,
    borderRadius: rnRadius.xl,
  },
  tokenButtonText: {
    fontSize: IA_RECHARGE_FONT_PX,
    color: tokens.brand.ctaForeground,
    fontWeight: IA_HEADING_FONT_WEIGHT,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
