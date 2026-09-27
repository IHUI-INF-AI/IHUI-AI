// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

/**
 * BottomPopup 支付弹窗(mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp vip_info/index.vue 行 6/127 BottomPopup 组件:
 * - Modal 底部弹出层(对齐 IntroducePopup 风格),展示 VIP 价格档位列表
 * - 每档:名称 + 价格 + 时长 + 选中态(单选)
 * - 底部确认按钮(主题色 #5088fa,复刻 Uniapp .agree 样式,非项目 brand.DEFAULT)
 * - 浅色优雅风,主题 token 入口;圆角守门(AGENTS.md §4,无 rounded-full);无分割线(gap 间距)
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
import { tokens } from '../theme/active-tokens'
import type { VipLevelItem2 } from '@ihui/rn-app'

export interface BottomPopupProps {
  visible: boolean
  onClose: () => void
  levels: VipLevelItem2[]
  onConfirm: (levelId: string) => void
}

// 主题色:1:1 复刻 Uniapp 主题色(原硬编码 #5088fa,治理后映射至 tokens.brandAccent.DEFAULT,非项目 brand.DEFAULT)
// 仅作底色用;文字/边框等前景场景请用 brandAccent.deep(浅灰蓝上对比度足够)
const ACCENT_COLOR = tokens.brandAccent.DEFAULT

const SHEET_PADDING = 20
const SHEET_MAX_HEIGHT_PERCENT = '70%'

const TITLE_FONT_SIZE = 18
const SUBTITLE_FONT_SIZE = 13

const CLOSE_BUTTON_SIZE = 32
const CLOSE_ICON_FONT_SIZE = 22

const LEVEL_ITEM_PADDING = 14
const LEVEL_ITEM_GAP = 10
const LEVEL_NAME_FONT_SIZE = 15
const LEVEL_META_FONT_SIZE = 12
const LEVEL_PRICE_FONT_SIZE = 18

const BUTTON_HEIGHT = 46
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
            {/* 关闭钮这一档只有宽/高/居中三条纯布局档(无底色无描边),所以盒子留在外层即可,
                只把按压态的透明度下移到子 View —— 它没有背景可画,内外两层的观感全等;
                外层保留尺寸与 hitSlop,命中区一分不减。 */}
            <Pressable
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="关闭"
            >
              {({ pressed }) => (
                <View style={pressed ? styles.closeButtonPressed : null}>
                  <Text style={styles.closeIcon} allowFontScaling={false}>
                    {'\u00D7'}
                  </Text>
                </View>
              )}
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
                  // 档位行带底色/圆角/描边 —— 属"整盒下移"那一档:外层裸 Pressable 只承接点击与
                  // 无障碍语义,盒子(含选中态与按压态)整体下移到子 View 的数组形态上,再用撑满档
                  // 把原来由父级 stretch 给出的整行宽还给盒子。留外层会把描边挤到 padding 内圈。
                  <Pressable
                    key={level.id}
                    onPress={() => setSelectedId(level.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`选择 ${level.levelName}`}
                    accessibilityState={{ selected }}
                  >
                    {({ pressed }) => (
                      <View
                        style={[
                          styles.levelItemFace,
                          styles.levelItem,
                          selected ? styles.levelItemSelected : null,
                          pressed ? styles.levelItemPressed : null,
                        ]}
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
                      </View>
                    )}
                  </Pressable>
                )
              })
            )}
          </ScrollView>

          {/* 确认按钮带底色与圆角 —— 同"整盒下移":外层只承接点击/禁用与无障碍语义,
              盒子(含禁用态与按压态)落到子 View 的数组形态上,宽度由撑满档保持原来的整行宽。 */}
          <Pressable
            onPress={handleConfirm}
            disabled={!selectedId}
            accessibilityRole="button"
            accessibilityLabel="立即开通"
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.confirmButtonFace,
                  styles.confirmButton,
                  !selectedId ? styles.confirmButtonDisabled : null,
                  pressed ? styles.confirmButtonPressed : null,
                ]}
              >
                <Text style={styles.confirmButtonText}>立即开通</Text>
              </View>
            )}
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
    backgroundColor: tokens.surface.card,
    borderTopLeftRadius: rnRadius['2xl'],
    borderTopRightRadius: rnRadius['2xl'],
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
  // 下移到子 View 的盒子用这两档取回原来由父级 stretch 给出的整行宽;不是新的尺寸档。
  levelItemFace: { width: '100%' } as ViewStyle,
  levelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.lg,
    padding: LEVEL_ITEM_PADDING,
    borderWidth: 1,
    borderColor: 'transparent',
  } as ViewStyle,
  levelItemSelected: {
    backgroundColor: tokens.brandAccent.light,
    borderColor: tokens.brandAccent.deep,
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
    color: tokens.brandAccent.deep,
  } as TextStyle,
  confirmButtonFace: { width: '100%' } as ViewStyle,
  confirmButton: {
    height: BUTTON_HEIGHT,
    borderRadius: rnRadius.lg,
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
    color: tokens.brandAccent.foreground,
    fontWeight: '600',
  } as TextStyle,
})

export default BottomPopup
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
