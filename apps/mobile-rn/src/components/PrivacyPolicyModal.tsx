/**
 * PrivacyPolicyModal 隐私政策弹窗(mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp 项目 App.vue 行 30-103 的隐私政策弹窗:
 * - 全屏 Modal 覆盖(zIndex 最高,RN Modal transparent + 蒙层)
 * - 标题"隐私政策",ScrollView 滚动显示完整隐私政策全文
 * - 两个按钮:"不同意"(灰色)/"同意"(主题色 #5088fa,复刻 Uniapp .agree 样式)
 * - "同意":触发 onAgree 回调(由 App.tsx 写 AsyncStorage + 关闭弹窗 + 后续 SDK 初始化)
 * - "不同意":Alert 提示"需同意才能使用"(复刻 Uniapp preventClose 不允许关闭语义,RN 用 Alert)
 *
 * 小米平台要求:隐私政策弹窗必须显示在最顶层,不可绕过,必须用户同意后才能继续使用。
 * 故 onRequestClose 返回空函数,阻止 Android 返回键关闭弹窗。
 */
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Shield, Lock, FileText, ArrowUpRight, CornerDownLeft } from 'lucide-react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  PRIVACY_POLICY_PARAGRAPHS,
  PRIVACY_POLICY_TITLE,
} from '../constants/privacyPolicy'

export interface PrivacyPolicyModalProps {
  /** 是否显示弹窗 */
  visible: boolean
  /** 用户点击"同意"回调(由父组件写 storage + 关闭弹窗 + 触发后续初始化) */
  onAgree: () => void
  /** 点击"服务条款"链接回调(可选,无则静默) */
  onOpenTerms?: () => void
  /** 点击"完整隐私政策"链接回调(可选) */
  onOpenPrivacy?: () => void
}

// 主题色 #5088fa:1:1 复刻 Uniapp App.vue .privacy-btn.agree 样式(非项目 brand.DEFAULT)
const AGREE_BUTTON_COLOR = '#5088fa'

const OVERLAY_BG = 'rgba(0,0,0,0.6)'
const CARD_WIDTH_RATIO = '88%'
const CARD_MAX_HEIGHT_RATIO = '82%'
const CARD_BORDER_RADIUS = 12
const CARD_PADDING_HORIZONTAL = 20
const CARD_PADDING_VERTICAL = 20
const TITLE_FONT_SIZE = 18
const TITLE_MARGIN_BOTTOM = 12
const _SCROLL_FLEX = 1
const SCROLL_MAX_HEIGHT = 50
const SCROLL_MARGIN_BOTTOM = 16
const PARAGRAPH_FONT_SIZE = 13
const PARAGRAPH_LINE_HEIGHT = 20
const PARAGRAPH_MARGIN_BOTTOM = 8
const HEADING_FONT_SIZE = 14
const HEADING_MARGIN_TOP = 4
const BUTTON_HEIGHT = 46
const BUTTON_BORDER_RADIUS = 8
const BUTTON_FONT_SIZE = 15
const _BUTTON_GAP = 12
const DISAGREE_COLOR = tokens.text.secondary

export function PrivacyPolicyModal({ visible, onAgree }: PrivacyPolicyModalProps) {
  const handleDisagree = () => {
    // 复刻 Uniapp preventClose:不允许关闭,RN 用 Alert 提示
    Alert.alert('提示', '需同意隐私政策才能使用本应用', [{ text: '我知道了' }])
  }

  const handleAgree = () => {
    onAgree()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // 空函数阻止 Android 返回键关闭(复刻 Uniapp preventClose 不可绕过语义)
      onRequestClose={() => {}}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.overlayPressable} onPress={handleDisagree} />
        <View style={styles.card}>
          <Text style={styles.title}>{PRIVACY_POLICY_TITLE}</Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator>
            {PRIVACY_POLICY_PARAGRAPHS.map((para, index) => (
              <Text
                key={index}
                style={para.isHeading ? styles.heading : styles.paragraph}
              >
                {para.text}
              </Text>
            ))}
          </ScrollView>
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.button, styles.disagreeButton, pressed && styles.buttonPressed]}
              onPress={handleDisagree}
              accessibilityRole="button"
              accessibilityLabel="不同意隐私政策"
            >
              <Text style={styles.disagreeText}>不同意</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.button, styles.agreeButton, pressed && styles.buttonPressed]}
              onPress={handleAgree}
              accessibilityRole="button"
              accessibilityLabel="同意隐私政策"
            >
              <Text style={styles.agreeText}>同意</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OVERLAY_BG,
  } as ViewStyle,
  overlayPressable: {
    ...StyleSheet.absoluteFill,
  } as ViewStyle,
  card: {
    width: CARD_WIDTH_RATIO,
    maxHeight: CARD_MAX_HEIGHT_RATIO,
    backgroundColor: tokens.surface.light,
    borderRadius: CARD_BORDER_RADIUS,
    paddingTop: CARD_PADDING_VERTICAL,
    paddingHorizontal: CARD_PADDING_HORIZONTAL,
    paddingBottom: CARD_PADDING_VERTICAL,
    // iOS 阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    // Android 阴影
    elevation: 8,
  } as ViewStyle,
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
    marginBottom: TITLE_MARGIN_BOTTOM,
  },
  scroll: {
    flex: _SCROLL_FLEX,
    maxHeight: SCROLL_MAX_HEIGHT,
    marginBottom: SCROLL_MARGIN_BOTTOM,
  } as ViewStyle,
  paragraph: {
    fontSize: PARAGRAPH_FONT_SIZE,
    lineHeight: PARAGRAPH_LINE_HEIGHT,
    color: tokens.text.secondary,
    marginBottom: PARAGRAPH_MARGIN_BOTTOM,
  },
  heading: {
    fontSize: HEADING_FONT_SIZE,
    fontWeight: '600',
    lineHeight: PARAGRAPH_LINE_HEIGHT,
    color: tokens.text.primary,
    marginTop: HEADING_MARGIN_TOP,
    marginBottom: PARAGRAPH_MARGIN_BOTTOM,
  },
  buttonRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  } as ViewStyle,
  button: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  disagreeButton: {
    backgroundColor: tokens.surface.card,
  } as ViewStyle,
  agreeButton: {
    backgroundColor: AGREE_BUTTON_COLOR,
  } as ViewStyle,
  buttonPressed: {
    opacity: 0.85,
  } as ViewStyle,
  disagreeText: {
    fontSize: BUTTON_FONT_SIZE,
    color: DISAGREE_COLOR,
    textAlign: 'center',
  },
  agreeText: {
    fontSize: BUTTON_FONT_SIZE,
    fontWeight: '500',
    color: tokens.surface.light,
    textAlign: 'center',
  },
})

export default PrivacyPolicyModal
