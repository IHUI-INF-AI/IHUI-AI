/**
 * GlobalFloatBox 全局浮窗(mobile-rn 端)
 *
 * 对齐历史 Uniapp 项目 src/components/FloatBox.vue:
 * - 靠右的白色圆角容器 + 左侧一个竖条(zhankaiH.png),不是上下箭头按钮
 * - 收起时浮窗滑出屏幕右侧,只露出左侧竖条;点竖条 → 浮窗向左滑入
 * - 3 个按钮竖排:赚米(红字)/客服/反馈,图标用原 uniapp 图片
 * - 滑动动画:Animated translateX(对齐 uniapp transition right 0.35s)
 *
 * 尺寸对齐(2rpx=1dp):
 * - 浮窗宽 118rpx=59dp,圆角 30rpx=15dp,right 20rpx=10dp,bottom 9%
 * - 竖条 40rpx=20dp 宽 × 100rpx=50dp 高
 * - 图标 72rpx=36dp,文字 28rpx=14dp 加粗 #222
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'

export interface GlobalFloatBoxProps {
  /** 赚米按钮回调(分享/推广) */
  onPromote?: () => void
  /** 客服按钮回调 */
  onConsult?: () => void
  /** 反馈按钮回调 */
  onFeedback?: () => void
}

// 图标资源(位于 apps/mobile-rn/assets/images/common/,原 uniapp static/images 迁移)
// 2026-08-17 修复:原路径 src/assets/images/floatbox/ 不存在(资源在仓库根 assets/images/common/),
// CI Metro bundle 报 Unable to resolve module → iOS/Android 构建失败
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ICON_TUIGUANG = require('../../assets/images/common/tuiguang.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ICON_KF = require('../../assets/images/common/kf.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ICON_FANKUI = require('../../assets/images/common/yijianfankui.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ICON_ARROW = require('../../assets/images/common/zhankaiH.png')

const FLOAT_BOX_WIDTH = 59 // 118rpx
const ARROW_WIDTH = 20 // 40rpx
const ARROW_HEIGHT = 50 // 100rpx
const BORDER_RADIUS = 15 // 30rpx
const ICON_SIZE = 36 // 72rpx
const LABEL_FONT_SIZE = 14 // 28rpx
const ITEM_MARGIN = 2 // 5rpx
const CONTENT_PADDING = 7 // 14rpx
const RIGHT = 10 // 20rpx
const COLLAPSE_DISTANCE = FLOAT_BOX_WIDTH // 收起时向右滑出浮窗宽度

export function GlobalFloatBox({ onPromote, onConsult, onFeedback }: GlobalFloatBoxProps) {
  // isOpen = true 展开(浮窗在屏幕内);false 收起(浮窗滑出,只露竖条)
  const [isOpen, setIsOpen] = useState(true)
  const translateX = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: isOpen ? 0 : COLLAPSE_DISTANCE,
      duration: 350,
      useNativeDriver: true,
    }).start()
  }, [isOpen, translateX])

  const toggleBox = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const handlePromote = useCallback(() => {
    onPromote?.()
  }, [onPromote])

  const handleConsult = useCallback(() => {
    onConsult?.()
  }, [onConsult])

  const handleFeedback = useCallback(() => {
    onFeedback?.()
  }, [onFeedback])

  return (
    <Animated.View pointerEvents="box-none" style={[styles.root, { transform: [{ translateX }] }]}>
      {/* 竖条:点击展开/收起(对齐 uniapp float-arrow) */}
      <Pressable
        style={styles.arrow}
        onPress={toggleBox}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={isOpen ? '收起浮窗' : '展开浮窗'}
      >
        <Image source={ICON_ARROW} style={styles.arrowImg} resizeMode="contain" />
      </Pressable>

      {/* 浮窗内容:三个按钮竖排(赚米/客服/反馈) */}
      <View style={styles.floatBox}>
        <Pressable
          style={styles.item}
          onPress={handlePromote}
          accessibilityRole="button"
          accessibilityLabel="赚米"
        >
          <Image source={ICON_TUIGUANG} style={styles.icon} resizeMode="contain" />
          <Text style={[styles.label, styles.labelPromote]}>赚 米</Text>
        </Pressable>
        <Pressable
          style={styles.item}
          onPress={handleConsult}
          accessibilityRole="button"
          accessibilityLabel="客服"
        >
          <Image source={ICON_KF} style={styles.icon} resizeMode="contain" />
          <Text style={styles.label}>客 服</Text>
        </Pressable>
        <Pressable
          style={styles.item}
          onPress={handleFeedback}
          accessibilityRole="button"
          accessibilityLabel="反馈"
        >
          <Image source={ICON_FANKUI} style={styles.icon} resizeMode="contain" />
          <Text style={styles.label}>反 馈</Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: RIGHT,
    bottom: '9%',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
  } as ViewStyle,
  arrow: {
    width: ARROW_WIDTH,
    height: ARROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  arrowImg: {
    width: ARROW_WIDTH,
    height: ARROW_HEIGHT,
  },
  floatBox: {
    width: FLOAT_BOX_WIDTH,
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS,
    paddingVertical: CONTENT_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
    // 阴影(对齐 uniapp box-shadow 0 1px 3px rgba(0,0,0,0.06))
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  } as ViewStyle,
  item: {
    alignItems: 'center',
    marginVertical: ITEM_MARGIN,
  } as ViewStyle,
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    marginBottom: 3,
  },
  label: {
    fontSize: LABEL_FONT_SIZE,
    fontWeight: 'bold',
    color: '#222',
    letterSpacing: 1,
  },
  labelPromote: {
    color: '#ff0000',
  },
})

export default GlobalFloatBox
