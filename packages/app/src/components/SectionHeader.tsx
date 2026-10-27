// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import {
  SECTION_HEADER_MORE_MARGIN_LEFT_PX,
  SECTION_HEADER_SUBTITLE_FONT_PX,
  SECTION_HEADER_SUBTITLE_GAP_PX,
  SECTION_HEADER_TITLE_FONT_PX,
} from '@ihui/shared/ui/section-header-spec'
import { MoreLink } from './MoreLink'
import { getTokens, type AppThemeMode } from '../theme/tokens'
import type { ReactNode } from 'react'

/**
 * 区段头(标题 + 可选副标题 + 可选「更多」)的 RN 唯一渲染腿。
 *
 * 几何/字号全部取自 `@ihui/shared/ui/section-header-spec`(RN 端 1:1,不做 rpx 换算);
 * 「更多」入口委托 `MoreLink`(箭头/字号单源),本件不另造第二份几何常量。
 * 容器只负责单行 row + space-between;上下留白/内边距由调用方经 `style` 传入,
 * 以免把各屏既有区段间距也收成几何档。
 */
export interface SectionHeaderProps {
  title: string
  subtitle?: string
  /** 「更多」文案(调用方已取词);未传时回退「更多」 */
  moreText?: string
  /** 是否渲染「更多」入口;缺省按是否传 onMore 决定 */
  showMore?: boolean
  onMore?: () => void
  /** 标题前导节点(图标等);间距由调用方节点自身样式负责 */
  leading?: ReactNode
  /** 「更多」左侧的附加节点(如自定义按钮) */
  extra?: ReactNode
  colorScheme?: AppThemeMode
  style?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
  subtitleStyle?: StyleProp<TextStyle>
  accessibilityLabel?: string
  testID?: string
}

export function SectionHeader({
  title,
  subtitle,
  moreText,
  showMore,
  onMore,
  leading,
  extra,
  colorScheme = 'light',
  style,
  titleStyle,
  subtitleStyle,
  accessibilityLabel,
  testID,
}: SectionHeaderProps) {
  const tk = getTokens(colorScheme)
  const renderMore = showMore ?? Boolean(onMore)

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.left}>
        {leading}
        <Text style={[styles.title, { color: tk.text.primary }, titleStyle]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: tk.text.secondary }, subtitleStyle]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {extra}
        {renderMore ? (
          <MoreLink
            label={moreText ?? '更多'}
            onPress={onMore}
            colorScheme={colorScheme}
            accessibilityLabel={accessibilityLabel}
            style={styles.more}
          />
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  } as ViewStyle,
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    flex: 1,
  } as ViewStyle,
  title: {
    fontSize: SECTION_HEADER_TITLE_FONT_PX,
    fontWeight: '700',
  } as TextStyle,
  subtitle: {
    marginLeft: SECTION_HEADER_SUBTITLE_GAP_PX,
    fontSize: SECTION_HEADER_SUBTITLE_FONT_PX,
  } as TextStyle,
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  } as ViewStyle,
  more: {
    marginLeft: SECTION_HEADER_MORE_MARGIN_LEFT_PX,
  } as ViewStyle,
})

export default SectionHeader
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
