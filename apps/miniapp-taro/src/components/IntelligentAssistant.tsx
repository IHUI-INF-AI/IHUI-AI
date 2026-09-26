// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { TARO_RPX_PER_PX } from '@ihui/design-tokens'
import {
  IA_GREETING_FONT_PX,
  IA_GREETING_TOP_PX,
  IA_HEADING_FONT_WEIGHT,
  IA_MARGIN_PX,
  IA_PADDING_PX,
  IA_RECHARGE_FONT_PX,
  IA_RECHARGE_TOUCH_PAD_PX,
  IA_ROBOT_ICON_INK_PX,
  IA_SUBTITLE_FONT_PX,
  IA_TEXT_GAP_PX,
  IA_TOKEN_FONT_PX,
  IA_TOKEN_ROW_GAP_PX,
} from '@ihui/shared/ui/intelligent-assistant-spec'
import LineIcon from '@/components/LineIcon'
import { rpx } from '@/utils/rpx'
import './IntelligentAssistant.css'

/**
 * 会显形的数字与盒子结构不在本文件取数 —— 单一源是
 * `packages/shared/src/ui/intelligent-assistant-spec`(模式同 BackChevron);
 * 这里只做单位换算(逻辑 px → rpx)。圆角走 `--radius-2xl` 档(裁决依据见 spec 头注)。
 */
const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)
const CARD_BOX_STYLE: CSSProperties = {
  margin: toUnit(IA_MARGIN_PX),
  padding: toUnit(IA_PADDING_PX),
}
const GREETING_STYLE: CSSProperties = {
  fontSize: toUnit(IA_GREETING_FONT_PX),
  fontWeight: IA_HEADING_FONT_WEIGHT,
}
const SUBTITLE_STYLE: CSSProperties = {
  fontSize: toUnit(IA_SUBTITLE_FONT_PX),
  fontWeight: IA_HEADING_FONT_WEIGHT,
  marginTop: toUnit(IA_TEXT_GAP_PX),
}
const TOKEN_ROW_STYLE: CSSProperties = { marginTop: toUnit(IA_TOKEN_ROW_GAP_PX) }
// 文本块顶偏移:两端同档(RN 文本块原有 paddingTop 4,本端同一落点补同值 ——
// 裁决依据写在 spec 的 IA_GREETING_TOP_PX 注释)
const CONTENT_STYLE: CSSProperties = { paddingTop: toUnit(IA_GREETING_TOP_PX) }
const TOKEN_TEXT_STYLE: CSSProperties = {
  fontSize: toUnit(IA_TOKEN_FONT_PX),
  fontWeight: IA_HEADING_FONT_WEIGHT,
}
// 充值是本页最小可点块:上下内衬按 spec 派生式补到命中块 ≥44(小程序无 hitSlop 通道)。
const RECHARGE_STYLE: CSSProperties = {
  fontSize: toUnit(IA_RECHARGE_FONT_PX),
  fontWeight: IA_HEADING_FONT_WEIGHT,
  paddingTop: toUnit(IA_RECHARGE_TOUCH_PAD_PX),
  paddingBottom: toUnit(IA_RECHARGE_TOUCH_PAD_PX),
}

export interface IntelligentAssistantProps {
  /** Token 余额(智汇值),由父组件传入 */
  tokenBalance?: number
  /** 是否已登录 */
  isLoggedIn?: boolean
  /** 点击充值按钮回调 */
  onRecharge?: () => void
}

function formatTokenValue(count: number): string {
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K'
  return String(count)
}

export default function IntelligentAssistant({
  tokenBalance = 0,
  isLoggedIn = false,
  onRecharge,
}: IntelligentAssistantProps) {
  const { t } = useI18n()
  return (
    <View className="ia-card" style={CARD_BOX_STYLE}>
      <LineIcon
        name="bot"
        // 行内矢量墨迹单端档(与 RN 位图装饰是不同媒介,不构成同一元素;依据见 spec)
        // × TARO_RPX_PER_PX 后仍是 LineIcon 的 rpx 数值通道,与收编前 size={64} 逐位同值
        size={IA_ROBOT_ICON_INK_PX * TARO_RPX_PER_PX}
        color="var(--color-muted-foreground)"
        className="ia-robot ia-float"
      />
      <View className="ia-content" style={CONTENT_STYLE}>
        <Text className="ia-greeting" style={GREETING_STYLE}>
          {t('ai.intelligentAssistant.greeting')}
        </Text>
        <Text className="ia-subtitle" style={SUBTITLE_STYLE}>
          {t('ai.intelligentAssistant.subtitle')}
        </Text>
        <View className="ia-token-row" style={TOKEN_ROW_STYLE}>
          <Text className="ia-token-text" style={TOKEN_TEXT_STYLE}>
            {isLoggedIn
              ? t('ai.intelligentAssistant.tokenBalance', { n: formatTokenValue(tokenBalance) })
              : t('ai.intelligentAssistant.loginRequired')}
          </Text>
          {isLoggedIn && (
            <Text className="ia-recharge-btn" style={RECHARGE_STYLE} onClick={onRecharge}>
              {t('ai.intelligentAssistant.recharge')}
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
