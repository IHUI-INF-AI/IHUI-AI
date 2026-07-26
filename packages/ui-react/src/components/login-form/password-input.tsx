/**
 * PasswordInput — 共享密码输入框(2026-07-26 立)
 *
 * 抽到 packages/ui-react,web + extension 共用同一份组件。
 * 视觉规范(2026-07-22 立,2026-07-26 共享):
 *   - 单一 SVG 方案,根据 visible 切换 d 属性,无嵌套 span,稳定可靠
 *   - viewBox 640×512 兼容 EYE_OPEN_D 和 EYE_SLASH_D
 *   - 20×20(比默认 16×16 更醒目,符合项目守则:元素尺寸越大,图标按比例放大)
 *   - fillRule="evenodd" 防止某些字形 fill 异常时出现黑洞
 *   - 切换按钮 40×40 命中区,右侧 8px 边距,垂直居中
 *   - aria-label 跟随状态切换,aria-pressed 反映当前可见状态
 *
 * 共享包不依赖 next-intl,i18n 字符串由 props 注入(避免 cross-package 耦合)。
 */
import * as React from 'react'
import { Input } from '../input'
import { cn } from '../../lib/utils'

// 眼睛(显示密码):开放的眼睛轮廓
const EYE_OPEN_D =
  'M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z'

// 闭眼(隐藏密码):眼睛 + 斜线
const EYE_SLASH_D =
  'M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z'

interface PasswordInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'type' | 'prefix' | 'suffix'> {
  /** "显示密码" aria-label */
  showLabel: string
  /** "隐藏密码" aria-label */
  hideLabel: string
  /** 初始可见状态(默认 false 隐藏) */
  defaultVisible?: boolean
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showLabel, hideLabel, defaultVisible = false, ...props }, ref) => {
    const [visible, setVisible] = React.useState(defaultVisible)
    return (
      <div className="relative w-full">
        <Input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          data-testid="password-toggle"
          className={cn(
            'absolute right-2 top-0 flex h-10 w-10 items-center justify-center overflow-visible',
            'rounded-r-md text-foreground/60 transition-colors duration-200',
            'hover:text-foreground focus-visible:outline-none',
          )}
        >
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
