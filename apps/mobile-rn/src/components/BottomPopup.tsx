/**
 * BottomPopup 支付弹窗(mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp vip_info/index.vue 行 6/127 BottomPopup 组件:
 * - Modal 底部弹出层(对齐 IntroducePopup 风格),展示 VIP 价格档位列表
 * - 每档:名称 + 价格 + 时长 + 选中态(单选)
 * - 底部确认按钮(主题色 #5088fa,复刻 Uniapp .agree 样式,非项目 brand.DEFAULT)
 * - 浅色优雅风,rnLightTokens;圆角守门(AGENTS.md §4,无 rounded-full);无分割线(gap 间距)
 *
 * 平台特有:依赖 RN Modal/ScrollView/Pressable,不适合共享。
 */
import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import type { VipLevelItem2 } from '@ihui/rn-app'

export interface BottomPopupProps {
  visible: boolean
  onClose: () => void
  levels: VipLevelItem2[]
  onConfirm: (levelId: string) => void
}

// 主题色 #5088fa:1:1 复刻 Uniapp 主题色(非项目 brand.DEFAULT,对齐 PrivacyPolicyModal 同款常量)
const ACCENT_COLOR = '#5088fa'

const SHEET_RADIUS = 16
const SHEET_PADDING = 20
const SHEET_MAX_HEIGHT_PERCENT = '70%'

const TITLE_FONT_SIZE = 18
const SUBTITLE_FONT_SIZE = 13

const CLOSE_BUTTON_SIZE = 32
const CLOSE_ICON_FONT_SIZE = 22

const LEVEL_ITEM_RADIUS = 8
const LEVEL_ITEM_PADDING = 14
const LEVEL_ITEM_GAP = 10
const LEVEL_NAME_FONT_SIZE = 15
const LEVEL_META_FONT_SIZE = 12
const LEVEL_PRICE_FONT_SIZE = 18

const BUTTON_HEIGHT = 46
const BUTTON_RADIUS = 8
const BUTTON_FONT_SIZE = 15

const EMPTY_TEXT_FONT_SIZE = 13

export function BottomPopup({ visible, onClose, levels, onConfirm }: BottomPopupProps) {
  const [selectedId, setSelectedId] = useState<string>('')

  const handleConfirm = () => {
    if (!selectedId) return
    onConfirm(selectedId)
    setSelectedId('')
  }

  const handleClose = () => {
    setSelectedId('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityLabel="关闭支付弹窗"
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              选择会员档位
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed ? styles.closeButtonPressed : null,
              ]}
              onPress={handleClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="关闭"
            >
              <Text style={styles.closeIcon} allowFontScaling={false}>
                {'\u00D7'}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>选择档位后点击立即开通</Text>

          <ScrollView
            style={styles.levelsScroll}
            contentContainerStyle={styles.levelsContent}
            showsVerticalScrollIndicator={false}
          >
            {levels.length === 0 ? (
              <Text style={styles.emptyText}>暂无可选档位</Text>
            ) : (
              levels.map((level) => {
                const selected = selectedId === level.id
                return (
                  <Pressable
                    key={level.id}
                    style={({ pressed }) => [
                      styles.levelItem,
                      selected ? styles.levelItemSelected : null,
                      pressed ? styles.levelItemPressed : null,
                    ]}
                    onPress={() => setSelectedId(level.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`选择 ${level.levelName}`}
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.levelInfo}>
                      <Text style={styles.levelName} numberOfLines={1}>
                        {level.levelName}
                      </Text>
                      <Text style={styles.levelMeta} allowFontScaling={false}>
                        {level.durationDays} 天 · Lv.{level.levelValue}
                      </Text>
                    </View>
                    <Text style={styles.levelPrice} allowFontScaling={false}>
                      ¥{level.price}
                    </Text>
                  </Pressable>
                )
              })
            )}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [
              styles.confirmButton,
              !selectedId ? styles.confirmButtonDisabled : null,
              pressed ? styles.confirmButtonPressed : null,
            ]}
            onPress={handleConfirm}
            disabled={!selectedId}
            accessibilityRole="button"
            accessibilityLabel="立即开通"
          >
            <Text style={styles.confirmButtonText}>立即开通</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    justifyContent: 'flex-end',
  } as ViewStyle,
  sheet: {
    width: '100%',
    maxHeight: SHEET_MAX_HEIGHT_PERCENT,
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: SHEET_PADDING,
    paddingTop: SHEET_PADDING,
    paddingBottom: SHEET_PADDING,
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  title: {
    flex: 1,
    fontSize: TITLE_FONT_SIZE,
    lineHeight: TITLE_FONT_SIZE + 4,
    fontWeight: '700',
    color: tokens.text.primary,
  } as TextStyle,
  closeButton: {
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  closeButtonPressed: {
    opacity: 0.5,
  } as ViewStyle,
  closeIcon: {
    fontSize: CLOSE_ICON_FONT_SIZE,
    lineHeight: CLOSE_ICON_FONT_SIZE + 2,
    color: tokens.text.tertiary,
    fontWeight: '300',
    textAlign: 'center',
  } as TextStyle,
  subtitle: {
    marginTop: 4,
    fontSize: SUBTITLE_FONT_SIZE,
    lineHeight: SUBTITLE_FONT_SIZE + 4,
    color: tokens.text.secondary,
  } as TextStyle,
  levelsScroll: {
    flex: 1,
    marginTop: 14,
  } as ViewStyle,
  levelsContent: {
    gap: LEVEL_ITEM_GAP,
    paddingBottom: 8,
  } as ViewStyle,
  emptyText: {
    fontSize: EMPTY_TEXT_FONT_SIZE,
    lineHeight: EMPTY_TEXT_FONT_SIZE + 4,
    color: tokens.text.tertiary,
    textAlign: 'center',
    paddingVertical: 20,
  } as TextStyle,
  levelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.surface.muted,
    borderRadius: LEVEL_ITEM_RADIUS,
    padding: LEVEL_ITEM_PADDING,
    borderWidth: 1,
    borderColor: 'transparent',
  } as ViewStyle,
  levelItemSelected: {
    backgroundColor: tokens.purple.light,
    borderColor: tokens.purple.DEFAULT,
  } as ViewStyle,
  levelItemPressed: {
    opacity: 0.7,
  } as ViewStyle,
  levelInfo: {
    flex: 1,
    marginRight: 12,
  } as ViewStyle,
  levelName: {
    fontSize: LEVEL_NAME_FONT_SIZE,
    lineHeight: LEVEL_NAME_FONT_SIZE + 4,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  levelMeta: {
    marginTop: 4,
    fontSize: LEVEL_META_FONT_SIZE,
    lineHeight: LEVEL_META_FONT_SIZE + 2,
    color: tokens.text.secondary,
  } as TextStyle,
  levelPrice: {
    fontSize: LEVEL_PRICE_FONT_SIZE,
    lineHeight: LEVEL_PRICE_FONT_SIZE + 2,
    fontWeight: '700',
    color: ACCENT_COLOR,
  } as TextStyle,
  confirmButton: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  } as ViewStyle,
  confirmButtonDisabled: {
    opacity: 0.4,
  } as ViewStyle,
  confirmButtonPressed: {
    opacity: 0.85,
  } as ViewStyle,
  confirmButtonText: {
    fontSize: BUTTON_FONT_SIZE,
    lineHeight: BUTTON_FONT_SIZE + 2,
    color: tokens.surface.light,
    fontWeight: '600',
  } as TextStyle,
})

export default BottomPopup
