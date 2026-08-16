/**
 * PurchaseNoticePopUp 购买通知 / 赚取佣金弹窗组件 (mobile-rn 端)
 *
 * 对齐历史项目 PurchaseNoticePopUp/index.vue(CommissionPopup):
 * - 底部通知弹窗(底部 sheet + 拖拽把手 + 半透明遮罩),点击遮罩关闭
 * - 标题"赚取佣金" + 描述 + 主按钮"前往开启会员"(warning 橙,对齐原版 #ff6600)
 * - onPrimary 回调:跳转逻辑预留(原版 navigateToCommission 为 navigateTo/switchTab/navigateTo 降级,
 *   由调用方在 onPrimary 中接入路由跳转)
 * - 可选 bullets 要点列表(success 绿 ✓)
 * - 浅色优雅风,系统字体,配色走 rnLightTokens(brand/success/warning/danger)
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { Modal, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'

export interface PurchaseNoticePopUpProps {
  visible: boolean
  title?: string
  subtitle?: string
  bullets?: ReadonlyArray<string>
  primaryLabel?: string
  onClose: () => void
  onPrimary: () => void
}

const TITLE_FONT_SIZE = 18
const SUBTITLE_FONT_SIZE = 13
const BULLET_MARK_FONT_SIZE = 16
const BULLET_TEXT_FONT_SIZE = 13
const PRIMARY_FONT_SIZE = 15
const PRIMARY_HEIGHT = 44
const PRIMARY_BORDER_RADIUS = 8
const CONTENT_PADDING = 20
const CARD_BORDER_RADIUS = 12
const BULLET_GAP = 8
const CHECK_MARK = '\u2713'
const BULLET_LIST_MARGIN_TOP = 16
const PRIMARY_BUTTON_MARGIN_TOP = 20
const SUBTITLE_MARGIN_TOP = 4

export function PurchaseNoticePopUp({
  visible,
  title = '赚取佣金',
  subtitle = '加入我们的推广计划，获得额外收入',
  bullets,
  primaryLabel = '前往开启会员',
  onClose,
  onPrimary,
}: PurchaseNoticePopUpProps) {
  const hasBullets = bullets !== undefined && bullets.length > 0

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="关闭弹窗" />
        {/* 底部弹层(对齐 Uniapp popup-content bottom: 0 + 上滑动画) */}
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            {hasBullets ? (
              <View style={styles.bulletList}>
                {bullets.map((line, index) => (
                  <View key={`bullet-${index.toString()}`} style={styles.bulletRow}>
                    <Text style={styles.bulletMark} allowFontScaling={false}>
                      {CHECK_MARK}
                    </Text>
                    <Text style={styles.bulletText}>{line}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.primaryButtonPressed : null,
              ]}
              onPress={onPrimary}
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
            >
              <Text style={styles.primaryLabel}>{primaryLabel}</Text>
            </Pressable>
          </View>
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
    backgroundColor: tokens.overlay.modal,
  } as ViewStyle,
  sheet: {
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: CARD_BORDER_RADIUS,
    borderTopRightRadius: CARD_BORDER_RADIUS,
    paddingBottom: 24,
  } as ViewStyle,
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.border.medium,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  } as ViewStyle,
  content: {
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: 12,
  } as ViewStyle,
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '700',
    color: tokens.text.primary,
    textAlign: 'center',
  } as ViewStyle,
  subtitle: {
    fontSize: SUBTITLE_FONT_SIZE,
    color: tokens.text.secondary,
    textAlign: 'center',
    marginTop: SUBTITLE_MARGIN_TOP,
  } as ViewStyle,
  bulletList: {
    marginTop: BULLET_LIST_MARGIN_TOP,
    gap: BULLET_GAP,
  } as ViewStyle,
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  bulletMark: {
    width: 18,
    fontSize: BULLET_MARK_FONT_SIZE,
    lineHeight: BULLET_MARK_FONT_SIZE + 2,
    color: tokens.success.DEFAULT,
    textAlign: 'center',
    fontWeight: '700',
  } as ViewStyle,
  bulletText: {
    flex: 1,
    fontSize: BULLET_TEXT_FONT_SIZE,
    color: tokens.text.secondary,
    lineHeight: BULLET_TEXT_FONT_SIZE + 6,
  } as ViewStyle,
  primaryButton: {
    height: PRIMARY_HEIGHT,
    borderRadius: PRIMARY_BORDER_RADIUS,
    backgroundColor: tokens.warning.deep,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: PRIMARY_BUTTON_MARGIN_TOP,
    marginHorizontal: CONTENT_PADDING,
  } as ViewStyle,
  primaryButtonPressed: {
    opacity: 0.85,
  } as ViewStyle,
  primaryLabel: {
    color: tokens.surface.light,
    fontSize: PRIMARY_FONT_SIZE,
    fontWeight: '600',
    textAlign: 'center',
  } as ViewStyle,
})

export default PurchaseNoticePopUp
