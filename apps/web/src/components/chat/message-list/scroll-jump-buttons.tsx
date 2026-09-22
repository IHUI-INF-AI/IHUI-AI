// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ChevronUp, ArrowDown } from 'lucide-react'
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
  /** 用户主动上滚(不限距离)。与 isFarFromBottom 任一成立即需要「回到最新」。 */
  userScrolledUp: boolean
  hasMessages: boolean
  isStreaming: boolean
  onJumpTop: () => void
  onJumpLatest: () => void
}

/** 显隐用 opacity + pointer-events,不用条件渲染:保留 300ms 渐隐过渡且不撬动布局。
 *  隐藏态同时退出无障碍树与 Tab 序(opacity-0 元素默认可聚焦,会在右下角偷走 Tab)。 */
function visibilityProps(on: boolean, extraClass = '') {
  return {
    className: `transition-opacity duration-300 ${extraClass} ${
      on ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
    }`.trim(),
    'aria-hidden': on ? undefined : true,
    tabIndex: on ? 0 : -1,
  }
}

/** 右下角浮动 affordance 列(对标主流 IDE 对话流)。
 *  - 用 @ihui/ui-react Button size="icon-sm",图标走项目既有 lucide
 *  - 跳顶 = 距顶>800px 才显;跳到最新 = 距底>800px 或用户主动上滚才显(真在底部时恒不显)
 *  - 2026-09-22 归一:此前 MessageList 底部居中另挂了一枚同义的「跳到最新」
 *    (data-testid="message-list-jump-latest"),同屏两枚语义重复的按钮共处一条 300px 宽的
 *    对话列。现合并为本列的唯一「跳到最新」,行为改用 handleJumpToLatest(滚到底 + 广播
 *    ihui:jump-to-latest),流式红点随该按钮。文案键沿用 jumpToTop/jumpToLatest,不新增键。
 *  - 禁发光/蓝光边框;红点属 ≤8px 装饰点(AGENTS.md 圆角豁免项) */
export function ScrollJumpButtons({
  isFarFromTop,
  isFarFromBottom,
  userScrolledUp,
  hasMessages,
  isStreaming,
  onJumpTop,
  onJumpLatest,
}: ScrollJumpButtonsProps) {
  const t = useTranslations('chat')
  const showLatest = hasMessages && (isFarFromBottom || userScrolledUp)
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
        {...visibilityProps(isFarFromTop)}
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label={t('jumpToLatest')}
        onClick={onJumpLatest}
        data-testid="scroll-jump-bottom"
        {...visibilityProps(showLatest, 'relative')}
      >
        <ArrowDown />
        {isStreaming && (
          <span
            data-testid="message-list-jump-latest-dot"
            className="absolute -right-0.5 -top-0.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"
            aria-hidden
          />
        )}
      </Button>
    </div>
  )
}

export default ScrollJumpButtons
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
