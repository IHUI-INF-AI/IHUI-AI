'use client'

/**
 * PasswordInput — 密码输入框 + 显隐切换按钮(2026-07-22 立)
 *
 * 设计要点:
 *  - 复用 styled-components 参考实现的视觉/动画效果:
 *    · 眼睛图标(open eye)/ 闭眼图标(eye with slash)切换
 *  - 适配项目设计系统:
 *    · 改用 Tailwind 4 utility + shadcn 设计 token
 *    · 切换按钮:absolute 定位在 input 右侧(40×40 命中区)
 *    · 颜色:var(--color-muted-foreground) 默认 → var(--color-foreground) hover
 *    · 圆角:rounded-md(6px)而非 rounded-full(符合项目圆角守门)
 *  - 可访问性:
 *    · type=button 不触发表单 submit
 *    · aria-label 跟随状态切换("显示密码" / "隐藏密码")
 *    · aria-pressed 反映当前可见状态
 *    · focus-visible 显示 ring,与 shadcn Input focus 行为一致
 *  - 受控/非受控均支持:
 *    · 透传所有 input 属性(包括 react-hook-form register 返回的)
 *    · ref 正确转发到底层 input
 *  - 单一 SVG 方案:用单个 svg,根据 visible 切换 d 属性,避免 opacity 切换
 *    时的 transform 动画 / 嵌套 span pointer-events 问题。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { Input } from '@ihui/ui'
import { cn } from '@/lib/utils'

// 眼睛(显示密码):开放的眼睛轮廓
const EYE_OPEN_D =
  'M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z'

// 闭眼(隐藏密码):眼睛 + 斜线
const EYE_SLASH_D =
  'M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z'

interface PasswordInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'type' | 'prefix' | 'suffix'> {
  /** 自定义"显示密码" aria-label,默认用 i18n a11y.showPassword */
  showLabel?: string
  /** 自定义"隐藏密码" aria-label,默认用 i18n a11y.hidePassword */
  hideLabel?: string
  /** 初始可见状态(默认 false 隐藏) */
  defaultVisible?: boolean
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showLabel, hideLabel, defaultVisible = false, ...props }, ref) => {
    const t = useTranslations('a11y')
    const [visible, setVisible] = React.useState(defaultVisible)
    const a11yShow = showLabel ?? t('showPassword')
    const a11yHide = hideLabel ?? t('hidePassword')

    return (
      <div className="relative w-full">
        <Input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          // 留出右侧切换按钮空间(按钮 40px)
          className={cn('pr-10', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? a11yHide : a11yShow}
          aria-pressed={visible}
          data-testid="password-toggle"
          className={cn(
            'absolute right-2 top-0 flex h-10 w-10 items-center justify-center overflow-visible',
            'rounded-r-md text-foreground/60 transition-colors duration-200',
            'hover:text-foreground focus-visible:outline-none',
          )}
        >
          {/* 单一 SVG,根据 visible 切换 d 属性 — 无嵌套 span,无 opacity 切换,
              无 keyframe 动画,稳定可靠。
              尺寸 h-5 w-5 (20×20) — 比默认的 16×16 更醒目,符合项目守则:
              元素尺寸越大,圆角和图标按比例放大。
              fillRule="evenodd" 防止某些字形 fill 异常时出现黑洞。 */}
          {/* viewBox 选 640×512 以兼容两个 path 的实际宽度:
              EYE_SLASH_D 实际占 0~640(EYE_OPEN_D 占 0~626),meet 模式居中等比缩放,
              不裁切任何一边的 path 数据,避免斜杠右端被切。 */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 512"
            fill="currentColor"
            fillRule="evenodd"
            aria-hidden="true"
            className="h-5 w-5"
          >
            <path d={visible ? EYE_SLASH_D : EYE_OPEN_D} />
          </svg>
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'
