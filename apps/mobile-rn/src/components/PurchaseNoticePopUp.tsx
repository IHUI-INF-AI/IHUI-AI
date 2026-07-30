/**
 * PurchaseNoticePopUp 购买通知 / 介绍弹窗组件 (mobile-rn 端)
 *
 * 对齐历史项目 PurchaseNoticePopUp + introduce-popup:
 * - 居中 Modal 弹窗,半透明黑色遮罩,点击遮罩或右上角 × 关闭
 * - 卡片 320 宽,圆角 12,含 hero 图标区 + 标题/副标题/要点列表 + 主按钮
 * - 卡片外右上角圆形关闭按钮(32×32,半透明黑底白 ×)
 * - 浅色优雅风,系统字体,无霓虹 / 无渐变
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { Modal, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'

export interface PurchaseNoticePopUpProps {
  visible: boolean
  title: string
  subtitle: string
  icon: string
  bullets?: ReadonlyArray<string>
  primaryLabel: string
  onClose: () => void
  onPrimary: () => void
}

const CARD_MAX_WIDTH = 320
const HERO_HEIGHT = 160
const ICON_FONT_SIZE = 64
const TITLE_FONT_SIZE = 18
const SUBTITLE_FONT_SIZE = 13
const BULLET_MARK_FONT_SIZE = 16
const BULLET_TEXT_FONT_SIZE = 13
const PRIMARY_FONT_SIZE = 15
const PRIMARY_HEIGHT = 44
const PRIMARY_BORDER_RADIUS = 8
const CLOSE_BUTTON_SIZE = 32
const CLOSE_ICON_FONT_SIZE = 18
const CLOSE_BUTTON_OFFSET = -12
const CONTENT_PADDING = 20
const CARD_BORDER_RADIUS = 12
const BULLET_GAP = 8
const CHECK_MARK = '\u2713'
const CLOSE_MARK = '\u00D7'
const CLOSE_BUTTON_BG = 'rgba(0,0,0,0.5)'
const BULLET_LIST_MARGIN_TOP = 16
const PRIMARY_BUTTON_MARGIN_TOP = 20
const SUBTITLE_MARGIN_TOP = 4

export function PurchaseNoticePopUp({
  visible,
  title,
  subtitle,
  icon,
  bullets,
  primaryLabel,
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
        <View style={styles.center}>
          <View style={styles.card}>
            <View style={styles.hero}>
              <Text style={styles.heroIcon} allowFontScaling={false}>
                {icon}
              </Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              {hasBullets ? (
                <View style={styles.bulletList}>
                  {bullets.map((line, index) => (
                    <View
                      key={`bullet-${index.toString()}`}
                      style={styles.bulletRow}
                    >
                      <Text style={styles.bulletMark} allowFontScaling={false}>
                        {CHECK_MARK}
                      </Text>
                      <Text style={styles.bulletText}>{line}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
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
          <Pressable
            style={({ pressed }) => [
              styles.closeButton,
              pressed ? styles.closeButtonPressed : null,
            ]}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="关闭"
          >
            <Text style={styles.closeIcon} allowFontScaling={false}>
              {CLOSE_MARK}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.overlay.modal,
  } as ViewStyle,
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    backgroundColor: tokens.surface.card,
    borderRadius: CARD_BORDER_RADIUS,
    overflow: 'hidden',
  },
  hero: {
    height: HERO_HEIGHT,
    backgroundColor: tokens.success.lighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    fontSize: ICON_FONT_SIZE,
    lineHeight: ICON_FONT_SIZE + 4,
    textAlign: 'center',
  },
  content: {
    padding: CONTENT_PADDING,
  },
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: SUBTITLE_FONT_SIZE,
    color: tokens.text.secondary,
    textAlign: 'center',
    marginTop: SUBTITLE_MARGIN_TOP,
  },
  bulletList: {
    marginTop: BULLET_LIST_MARGIN_TOP,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BULLET_GAP,
  },
  bulletMark: {
    fontSize: BULLET_MARK_FONT_SIZE,
    lineHeight: BULLET_MARK_FONT_SIZE + 2,
    color: tokens.success.DEFAULT,
    textAlign: 'center',
  },
  bulletText: {
    flex: 1,
    fontSize: BULLET_TEXT_FONT_SIZE,
    color: tokens.text.secondary,
  },
  primaryButton: {
    height: PRIMARY_HEIGHT,
    borderRadius: PRIMARY_BORDER_RADIUS,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: PRIMARY_BUTTON_MARGIN_TOP,
    marginHorizontal: CONTENT_PADDING,
    marginBottom: CONTENT_PADDING,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryLabel: {
    color: tokens.surface.light,
    fontSize: PRIMARY_FONT_SIZE,
    fontWeight: '500',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: CLOSE_BUTTON_OFFSET,
    right: CLOSE_BUTTON_OFFSET,
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    borderRadius: CLOSE_BUTTON_SIZE / 2,
    backgroundColor: CLOSE_BUTTON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  closeIcon: {
    color: tokens.surface.light,
    fontSize: CLOSE_ICON_FONT_SIZE,
    lineHeight: CLOSE_ICON_FONT_SIZE + 2,
    textAlign: 'center',
    fontWeight: '300',
  },
})

export default PurchaseNoticePopUp
