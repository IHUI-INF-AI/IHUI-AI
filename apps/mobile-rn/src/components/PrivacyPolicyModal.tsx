/**
 * PrivacyPolicyModal 隐私政策弹窗(mobile-rn 端)
 *
 * 视觉对齐 web 端登录协议弹窗(AgreementNoticeDialog):
 * - 顶部居中 shield 图标(48px 圆角方块,主题色浅背景 + 描边)+ 标题 + 副标题
 * - 安全提示条(Lock 图标 + 加密说明)
 * - 隐私政策全文 ScrollView(移动端合规必需,保留 1:1 复刻 Uniapp 全文)
 * - 底部双按钮:不同意(灰)/ 同意并继续(黑底白字 + CornerDownLeft 图标)
 *
 * 小米平台要求:隐私政策弹窗必须显示在最顶层,不可绕过,必须用户同意后才能继续使用。
 * 故 onRequestClose 返回空函数,阻止 Android 返回键关闭弹窗。
 */
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Shield, Lock, CornerDownLeft } from 'lucide-react-native'
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
}

// 视觉对齐 web 端 AgreementNoticeDialog:同意按钮 = brand.DEFAULT(黑底白字),非历史 Uniapp 蓝 #5088fa
const AGREE_BUTTON_COLOR = tokens.brand.DEFAULT
const OVERLAY_BG = 'rgba(0,0,0,0.6)'
const CARD_WIDTH_RATIO = '88%'
const CARD_MAX_HEIGHT_RATIO = '92%'
const CARD_BORDER_RADIUS = 12
const CARD_PADDING_HORIZONTAL = 20
const CARD_PADDING_VERTICAL = 14
const SHIELD_SIZE = 44
const SHIELD_BG = 'rgba(0,0,0,0.08)'
const SHIELD_RING = 'rgba(0,0,0,0.12)'
const TITLE_FONT_SIZE = 18
const TITLE_MARGIN_BOTTOM = 12
const SUBTITLE_FONT_SIZE = 12
const SUBTITLE_MARGIN_BOTTOM = 6
const SAFE_BAR_BG = 'rgba(0,0,0,0.04)'
const SAFE_BAR_MARGIN_TOP = 14
const SAFE_BAR_FONT_SIZE = 11
const SCROLL_MARGIN_TOP = 12
const SCROLL_MARGIN_BOTTOM = 16
const PARAGRAPH_FONT_SIZE = 13
const PARAGRAPH_LINE_HEIGHT = 20
const PARAGRAPH_MARGIN_BOTTOM = 8
const HEADING_FONT_SIZE = 14
const HEADING_MARGIN_TOP = 4
const BUTTON_ROW_MARGIN_TOP = 16
const BUTTON_HEIGHT = 44
const BUTTON_BORDER_RADIUS = 8
const BUTTON_FONT_SIZE = 15
const BUTTON_GAP = 12
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
          {/* 顶部:shield 图标 + 标题 + 副标题(对齐 web 端) */}
          <View style={styles.header}>
            <View style={styles.shieldWrap}>
              <Shield size={24} color={AGREE_BUTTON_COLOR} strokeWidth={2} />
            </View>
            <Text style={styles.title}>{PRIVACY_POLICY_TITLE}</Text>
            <Text style={styles.subtitle}>请阅读并同意以下内容后继续使用</Text>
          </View>

          {/* 安全提示条(对齐 web 端) */}
          <View style={styles.safeBar}>
            <Lock size={12} color={tokens.text.secondary} strokeWidth={2} />
            <Text style={styles.safeBarText}>你的信息将被加密传输,仅用于账户服务</Text>
          </View>

          {/* 隐私政策全文滚动区(flexShrink 收缩,保证底部按钮始终可见) */}
          {/* 中间弹性层包裹 ScrollView,保证按钮始终可见 */}
          <View style={styles.scrollWrapper}>
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
          </View>

          {/* 双按钮(对齐 web 端:不同意灰 / 同意并继续黑) */}
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
              <CornerDownLeft size={14} color={tokens.surface.light} strokeWidth={2.25} />
              <Text style={styles.agreeText}>同意并继续</Text>
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
    paddingHorizontal: 24,
    paddingVertical: 20,
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
    paddingHorizontal: CARD_PADDING_HORIZONTAL,
    paddingTop: CARD_PADDING_VERTICAL,
    paddingBottom: CARD_PADDING_VERTICAL,
    // iOS 阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    // Android 阴影
    elevation: 8,
  } as ViewStyle,
  header: {
    alignItems: 'center',
  } as ViewStyle,
  shieldWrap: {
    width: SHIELD_SIZE,
    height: SHIELD_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SHIELD_BG,
    borderWidth: 1,
    borderColor: SHIELD_RING,
  } as ViewStyle,
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
    marginBottom: TITLE_MARGIN_BOTTOM,
  },
  subtitle: {
    fontSize: SUBTITLE_FONT_SIZE,
    lineHeight: 18,
    color: tokens.text.secondary,
    textAlign: 'center',
    marginBottom: SUBTITLE_MARGIN_BOTTOM,
  },
  safeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SAFE_BAR_BG,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: SAFE_BAR_MARGIN_TOP,
  } as ViewStyle,
  safeBarText: {
    fontSize: SAFE_BAR_FONT_SIZE,
    lineHeight: 16,
    color: tokens.text.secondary,
  },
  // 中间弹性层:flex:1 在 column flex 中占满剩余空间,约束 ScrollView 不撑爆
  scrollWrapper: {
    flex: 1,
    minHeight: 80,
  } as ViewStyle,
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: BUTTON_GAP,
    marginTop: BUTTON_ROW_MARGIN_TOP,
  } as ViewStyle,
  button: {
    flex: 1,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_BORDER_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
    fontWeight: '500',
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
