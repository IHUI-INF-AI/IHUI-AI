// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { getTokens, type AppThemeMode } from '../theme/tokens'

/**
 * 区块头「更多」入口 —— RN 端唯一实现。
 *
 * 为什么箭头不能用 `›` / `>` 字符(实测,非推断):flex 行 `align-items:center` 居中的是
 * **行盒**,而每个字形相对自己行盒中心的位置 d = (ascent − descent)/2 + 墨迹中心,
 * **与 line-height 无关、与字号无关**,只由字体度量决定。用应用实际字体 HarmonyOS Sans SC
 * 量出来:12px 的「更」d = −1.0px(墨迹偏上),而 `›` 在 14/16/18/20px 档 d = +1.0~+1.5px
 * (墨迹偏下)—— 一上一下是**相加**不是相消,所以旧写法各档错位 2.0~2.5px,端内那句
 * `marginBottom: -2` 正是在补这个数。lucide `ChevronRight` 是 24 单位网格固定几何、
 * 墨迹天然居于外框中心(d = 0),换掉载体即把"相加"消成"抵消"。
 *
 * 剩余 ~1px 是中文墨迹本身相对行盒中心的固有偏心,不属本组件的病:web 端由
 * `globals.css` 的全局 `--text-vcenter-offset` 补偿规则处理(要求文字包 `<span>`,
 * 见 `apps/web/src/components/common/view-more-link.tsx`);RN 端不得再用 translateY
 * 手调 —— 那会重新变回 `marginBottom:-2` 那一类按肉眼凑的补丁,且换机型即失效。
 *
 * 为什么 `style` 只能是数组、不能用 `style={({pressed}) => …}`(2026-09-26 真机事故):
 * `react-native-css-interop/dist/runtime/components.js:7` 给 `Pressable` 注册了
 * `cssInterop(Pressable, {className:"style"})`,而 `runtime/wrap-jsx.js` 是**无条件**替换
 * (与用没用 className 无关)。`native-interop.js` 收集内联档时对函数形态执行
 * `assignToTarget(props, { ...declaration }, …)`,而 `{ ...函数 }` === `{}`
 * (name/length 不可枚举)⇒ `props.style` 被写成 `{}` 并在 `render-component.js:76`
 * 覆盖掉原函数 ⇒ 容器**整份** style 消失(实测:按钮 28dp = 文字 16 + 箭头 12,
 * padding 与 gap 全不见,即默认 column + stretch 的竖排)。数组/对象形态不受影响,
 * 因为 collectInlineRules 会递归数组并按序并入自有对象。
 * 按压反馈因此改走 Pressable 的 children 渲染函数:不新增布局节点,几何不变。
 */

/** 与 web 端 `text-xs` + `ChevronRight h-3 w-3` 同档 */
const LABEL_FONT_SIZE = 12
const ICON_SIZE = 12
const GAP = 2
/** 与 RN `Text.maxFontSizeMultiplier` 同义的上限,防超大系统字体下按钮撑破行高 */
const MAX_FONT_MULTIPLIER = 1.4

/**
 * 标签与箭头必须**同比长大**。迁移前箭头写着 `allowFontScaling={false}` 而标签允许缩放,
 * 于是用户在系统里调大字号后,文字变大、箭头不动 —— 换掉字形载体并不消除这一半病因,
 * 固定 12dp 的 SVG 同样会跑偏,所以倍率必须同时喂给 `maxFontSizeMultiplier` 与图标尺寸。
 */
export function useFontMultiplier(): number {
  const raw = PixelRatio.getFontScale()
  if (!Number.isFinite(raw) || raw <= 0) return 1
  return Math.min(Math.max(raw, 1), MAX_FONT_MULTIPLIER)
}

export interface MoreLinkProps {
  /** 已取词的入口文案(由调用方注入,组件不内置语种) */
  label: string
  onPress?: () => void
  /** 已解析主题;共享层组件必须由调用方显式传入,缺省默认 light */
  colorScheme?: AppThemeMode
  /** 无障碍标签,缺省用 label */
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function MoreLink({
  label,
  onPress,
  colorScheme = 'light',
  accessibilityLabel,
  style,
  testID,
}: MoreLinkProps) {
  const tk = getTokens(colorScheme)
  const color = tk.text.secondary
  const multiplier = useFontMultiplier()

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={4}
      testID={testID}
      style={[styles.hit, style]}
    >
      {({ pressed }) => (
        <>
          <Text
            style={[styles.label, { color }, pressed ? styles.pressed : null]}
            numberOfLines={1}
            maxFontSizeMultiplier={multiplier}
          >
            {label}
          </Text>
          <ChevronRight
            size={Math.round(ICON_SIZE * multiplier)}
            color={color}
            style={pressed ? styles.pressed : undefined}
          />
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: LABEL_FONT_SIZE,
    /**
     * Android 默认把 fm.top / fm.bottom 的**字体最大留白**(对带中文的字体是不对称的)
     * 算进行盒,文字框因此比上面量到的 ascent+descent 更高,图标就成了"盒对齐、字不对齐"。
     * 关掉后 Android 的行盒 == ascent+descent,即本文件推导所用的那一套盒模型。
     * 端内既有 8 处同样写法(BottomActionBar / NavBar / HomeScreen / SquareScreen 等),非本票新造。
     */
    includeFontPadding: false,
  },
})

export default MoreLink
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
