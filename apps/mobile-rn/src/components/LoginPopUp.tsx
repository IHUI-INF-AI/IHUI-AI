/**
 * LoginPopUp 登录弹窗 (mobile-rn 端)
 *
 * 触发场景:用户访问需授权功能时弹出,采用底部弹起 + 半透明遮罩样式。
 * 设计目标:浅色优雅风,无霓虹/无渐变;系统字体,无自定义 ttf。
 *
 * Props:
 * - visible:控制 Modal 显示
 * - title / description:标题与描述
 * - primaryLabel + onPrimary:主登录按钮(品牌色填充)
 * - secondaryLabel + onSecondary:次登录按钮(描边样式)
 * - onClose:关闭按钮回调
 * - agreeChecked?:协议勾选状态(可选,未传则不显示协议行)
 * - onAgreeChange?:协议勾选状态变化回调
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { Modal, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'

export interface LoginPopUpProps {
  visible: boolean
  title: string
  description: string
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel: string
  onSecondary: () => void
  onClose: () => void
  agreeChecked?: boolean
  onAgreeChange?: (value: boolean) => void
}

const CARD_PADDING_TOP = 8
const CARD_PADDING_HORIZONTAL = 16
const CARD_PADDING_BOTTOM = 32
const DRAG_BAR_WIDTH = 36
const DRAG_BAR_HEIGHT = 4
const DRAG_BAR_MARGIN_BOTTOM = 12
const TITLE_FONT_SIZE = 20
const TITLE_MARGIN_BOTTOM = 8
const DESCRIPTION_FONT_SIZE = 13
const DESCRIPTION_MARGIN_BOTTOM = 24
const BUTTON_HEIGHT = 48
const BUTTON_BORDER_RADIUS = 8
const BUTTON_FONT_SIZE = 15
const PRIMARY_BUTTON_MARGIN_BOTTOM = 12
const SECONDARY_BUTTON_MARGIN_BOTTOM = 24
const AGREEMENT_FONT_SIZE = 11
const AGREEMENT_GAP = 4
const CHECKBOX_SIZE = 16
const CHECKBOX_BORDER_RADIUS = 4
const CLOSE_BUTTON_SIZE = 32
const CLOSE_ICON_SIZE = 18
const CLOSE_BUTTON_TOP = 8
const CLOSE_BUTTON_RIGHT = 8

export function LoginPopUp({
  visible,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onClose,
  agreeChecked = false,
  onAgreeChange,
}: LoginPopUpProps) {
  const handleAgreeToggle = () => {
    onAgreeChange?.(!agreeChecked)
  }

  const showAgreementRow = onAgreeChange !== undefined

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="关闭登录弹窗" />
        <View style={styles.card}>
          <View style={styles.dragBar} />
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={8}
            accessibilityLabel="关闭"
          >
            <Text style={styles.closeIcon}>×</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            onPress={onPrimary}
          >
            <Text style={styles.primaryButtonLabel}>{primaryLabel}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            onPress={onSecondary}
          >
            <Text style={styles.secondaryButtonLabel}>{secondaryLabel}</Text>
          </Pressable>
          {showAgreementRow ? (
            <Pressable style={styles.agreementRow} onPress={handleAgreeToggle}>
              <View style={[styles.checkbox, agreeChecked ? styles.checkboxChecked : null]}>
                {agreeChecked ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.agreementText}>
                <Text style={styles.agreementLink}>《用户协议》</Text>
                <Text style={styles.agreementSeparator}> 与 </Text>
                <Text style={styles.agreementLink}>《隐私政策》</Text>
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  } as ViewStyle,
  card: {
    width: '100%',
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: CARD_PADDING_TOP,
    paddingHorizontal: CARD_PADDING_HORIZONTAL,
    paddingBottom: CARD_PADDING_BOTTOM,
  },
  dragBar: {
    alignSelf: 'center',
    width: DRAG_BAR_WIDTH,
    height: DRAG_BAR_HEIGHT,
    borderRadius: DRAG_BAR_HEIGHT / 2,
    backgroundColor: tokens.border.light,
    marginBottom: DRAG_BAR_MARGIN_BOTTOM,
  },
  closeButton: {
    position: 'absolute',
    top: CLOSE_BUTTON_TOP,
    right: CLOSE_BUTTON_RIGHT,
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    borderRadius: CLOSE_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: CLOSE_ICON_SIZE,
    lineHeight: CLOSE_ICON_SIZE + 4,
    color: tokens.text.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
    marginBottom: TITLE_MARGIN_BOTTOM,
  },
  description: {
    fontSize: DESCRIPTION_FONT_SIZE,
    color: tokens.text.secondary,
    textAlign: 'center',
    marginBottom: DESCRIPTION_MARGIN_BOTTOM,
  },
  primaryButton: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_BORDER_RADIUS,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: PRIMARY_BUTTON_MARGIN_BOTTOM,
  },
  primaryButtonPressed: {
    opacity: 0.8,
  },
  primaryButtonLabel: {
    fontSize: BUTTON_FONT_SIZE,
    fontWeight: '500',
    color: tokens.surface.light,
    textAlign: 'center',
  },
  secondaryButton: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SECONDARY_BUTTON_MARGIN_BOTTOM,
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonLabel: {
    fontSize: BUTTON_FONT_SIZE,
    color: tokens.text.primary,
    textAlign: 'center',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: CHECKBOX_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: AGREEMENT_GAP,
  },
  checkboxChecked: {
    backgroundColor: tokens.brand.DEFAULT,
    borderColor: tokens.brand.DEFAULT,
  },
  checkboxMark: {
    fontSize: 11,
    lineHeight: 12,
    color: tokens.surface.light,
    fontWeight: '700',
  },
  agreementText: {
    fontSize: AGREEMENT_FONT_SIZE,
    color: tokens.text.secondary,
  },
  agreementLink: {
    color: tokens.brand.DEFAULT,
  },
  agreementSeparator: {
    color: tokens.text.secondary,
  },
})

export default LoginPopUp
