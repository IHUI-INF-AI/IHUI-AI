// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
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

/** 消息视口上/下边缘各一枚浮动箭头:上=跳顶,下=跳到最新(对标主流 IDE 对话流)。
 *  - 用 @ihui/ui-react Button size="icon-sm",图标走项目既有 lucide
 *  - 跳顶 = 距顶>800px 才显;跳到最新 = 距底>800px 或用户主动上滚才显(真在底部时恒不显)
 *  - 2026-11-15 定位改判:两枚此前都堆在聊天面板右下角(跟随整个面板,含输入区),
 *    用户反馈上翻箭头应在对话显示区上方、下翻在下方。现容器锚定消息滚动视口的
 *    relative 包裹层(见 MessageList),上/下按钮各自贴视口边缘,不再挤在一个角;
 *    水平方向按用户要求对齐对话列正中(left-1/2 + -translate-x-1/2),不贴右缘。
 *  - 2026-09-22 归一:此前 MessageList 底部居中另挂了一枚同义的「跳到最新」
 *    (data-testid="message-list-jump-latest"),同屏两枚语义重复的按钮共处一条 300px 宽的
 *    对话列。现合并为本列的唯一「跳到最新」,行为改用 hook 的 scrollToBottom(滚到底 + 复位
 *    userScrolledUp),流式红点随该按钮。文案键沿用 jumpToTop/jumpToLatest,不新增键。
 *  - 禁发光/蓝光边框;红点属 ≤8px 装饰点(AGENTS.md 圆角豁免项)
 *  - 2026-11-15 字形归族:跳底改用 ChevronDown(= 跳顶 ChevronUp 的翻转),
 *    不再混用带竖杆的 ArrowDown —— 同列两枚箭头必须同字形族,否则上下不像一套 */
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
    <div data-testid="scroll-jump-buttons" className="pointer-events-none absolute inset-0 z-20">
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label={t('jumpToTop')}
        onClick={onJumpTop}
        data-testid="scroll-jump-top"
        // 2026-11-15:用户要求上/下翻按钮明暗两种模式下都是纯白底 + 深色图标;
        // hover 不改底色(outline 变体自带 hover:bg-accent,必须显式压回白),
        // 悬浮感交给全站统一的 ui-lift(位移 + 投影升档)。
        // 必须并进 visibilityProps 的 className(它自带 className,展开在其后会覆盖本属性)。
        {...visibilityProps(
          isFarFromTop,
          'absolute left-1/2 top-4 -translate-x-1/2 bg-white text-zinc-900 hover:bg-white hover:text-zinc-900 ui-lift',
        )}
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
        // 2026-11-15:同上,跳到最新按钮保持纯白底(暗色模式也白底),hover 只走 ui-lift 悬浮
        // 2026-11-15:位置继续下移 → bottom-4(16px) → bottom-1(4px),几乎贴住消息视口底边
        {...visibilityProps(
          showLatest,
          'absolute bottom-1 left-1/2 -translate-x-1/2 bg-white text-zinc-900 hover:bg-white hover:text-zinc-900 ui-lift',
        )}
      >
        <ChevronDown />
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
