// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import type { ReactNode } from 'react'
import { TARO_RPX_PER_PX } from '@ihui/design-tokens'
import {
  SECTION_HEADER_ARROW_MARGIN_LEFT_PX,
  SECTION_HEADER_MORE_MARGIN_LEFT_PX,
  SECTION_HEADER_SUBTITLE_FONT_PX,
  SECTION_HEADER_SUBTITLE_GAP_PX,
  SECTION_HEADER_TITLE_FONT_PX,
} from '@ihui/shared/ui/section-header-spec'
import { rpx } from '@/utils/rpx'
import LineIcon from '@/components/LineIcon'

/// 标题区字号/间距唯一源在 @ihui/shared/ui/section-header-spec(与 RN 端 packages/app 同表);
/// 「更多」入口字号/箭头按 §4 定档(12px / 24rpx),已由 MoreLink 与 LineIcon 体系单源,不在本表重复。
const toUnit = (logicalPx: number) => rpx(logicalPx * TARO_RPX_PER_PX)
const TITLE_FONT = toUnit(SECTION_HEADER_TITLE_FONT_PX)
const SUBTITLE_FONT = toUnit(SECTION_HEADER_SUBTITLE_FONT_PX)

/**
 * 通用"标题 + 更多"区块头部组件。
 * 对齐原项目 components/MoreTitles/index.vue:左侧标题(可选副标题)+ 右侧「更多 + chevron-right 矢量」。
 *
 * 箭头必须是矢量(LineIcon chevron-right),不得用 `>` / `›` 字符:字符箭头与标签字号
 * 不同时必上下错位,且与 RN 侧 MoreLink、web 侧 ViewMore 不同形。
 */
export interface SectionHeaderProps {
  title: string
  subtitle?: string
  moreText?: string
  showMore?: boolean
  onMore?: () => void
  extra?: ReactNode
  className?: string
}

export default function SectionHeader({
  title,
  subtitle,
  moreText,
  showMore = true,
  onMore,
  extra,
  className = '',
}: SectionHeaderProps) {
  const tt = useTt()
  const moreLabel = moreText ?? tt('common.more', '更多')

  return (
    <View className={`flex items-center justify-between ${className}`}>
      <View className="flex items-center min-w-0 flex-1">
        <Text className="font-bold text-foreground truncate" style={{ fontSize: TITLE_FONT }}>
          {title}
        </Text>
        {subtitle && (
          <Text
            className="text-muted-foreground truncate"
            style={{ fontSize: SUBTITLE_FONT, marginLeft: toUnit(SECTION_HEADER_SUBTITLE_GAP_PX) }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <View className="flex items-center flex-shrink-0">
        {extra}
        {showMore && (
          <View
            className="flex items-center"
            style={{ marginLeft: toUnit(SECTION_HEADER_MORE_MARGIN_LEFT_PX) }}
            onClick={onMore}
            hoverClass="opacity-60"
          >
            <Text className="text-[length:24rpx] text-muted-foreground">{moreLabel}</Text>
            <LineIcon
              name="chevron-right"
              size={24}
              color="var(--color-muted-foreground)"
              style={{ marginLeft: toUnit(SECTION_HEADER_ARROW_MARGIN_LEFT_PX) }}
            />
          </View>
        )}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
