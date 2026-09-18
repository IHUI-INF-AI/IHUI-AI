// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'

/** 距顶/距底超过该阈值(px)时才渐显跳顶/跳底按钮(任务 D3 阈值 800px)。 */
export const JUMP_FAR_THRESHOLD = 800

export interface JumpVisibility {
  isFarFromTop: boolean
  isFarFromBottom: boolean
}

/** 纯函数:由滚动几何量计算跳顶/跳底按钮显隐。
 *  - isFarFromTop = scrollTop > 阈值
 *  - isFarFromBottom = (scrollHeight - scrollTop - clientHeight) > 阈值
 *  保持纯函数以便单测,不引入 React / i18n 依赖。 */
export function computeJumpVisibility(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold: number = JUMP_FAR_THRESHOLD,
): JumpVisibility {
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight
  return {
    isFarFromTop: scrollTop > threshold,
    isFarFromBottom: distanceFromBottom > threshold,
  }
}

interface ScrollJumpButtonsProps {
  isFarFromTop: boolean
  isFarFromBottom: boolean
  onJumpTop: () => void
  onJumpBottom: () => void
}

/** 右下角浮动跳顶/跳底按钮(对标主流 IDE 对话流)。
 *  - 用 @ihui/ui-react Button size="icon-sm",chevron 图标用项目现有 lucide 图标
 *  - 仅当"距顶>800px 或距底>800px"时对应按钮渐显(opacity 过渡,禁发光/蓝光边框)
 *  - 跳顶复用 jumpToTop 键,跳底复用 jumpToLatest 键(不新增文案键) */
export function ScrollJumpButtons({
  isFarFromTop,
  isFarFromBottom,
  onJumpTop,
  onJumpBottom,
}: ScrollJumpButtonsProps) {
  const t = useTranslations('chat')
  return (
    <div
      data-testid="scroll-jump-buttons"
      className="pointer-events-none absolute bottom-4 right-4 z-20 flex flex-col gap-2 transition-opacity duration-300"
    >
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label={t('jumpToTop')}
        onClick={onJumpTop}
        data-testid="scroll-jump-top"
        className={`transition-opacity duration-300 ${
          isFarFromTop ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label={t('jumpToLatest')}
        onClick={onJumpBottom}
        data-testid="scroll-jump-bottom"
        className={`transition-opacity duration-300 ${
          isFarFromBottom ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <ChevronDown />
      </Button>
    </div>
  )
}

export default ScrollJumpButtons
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
