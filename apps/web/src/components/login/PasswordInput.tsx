'use client'

/**
 * PasswordInput — 密码输入框 + 显隐切换按钮(2026-07-22 立)
 *
 * 设计要点:
 *  - 复用 styled-components 参考实现的视觉/动画效果:
 *    · 眼睛图标(eye.svg)/ 闭眼图标(eye-slash.svg)切换
 *    · keyframes-fill 弹性放大动画(globals.css @keyframes eye-fill)
 *  - 适配项目设计系统:
 *    · 透明 styled-components,改用 Tailwind 4 utility + shadcn 设计 token
 *    · 切换按钮:absolute 定位在 input 右侧(36×40 命中区)
 *    · 颜色:var(--color-muted-foreground) 默认 → var(--color-foreground) hover
 *    · 圆角:rounded-md(6px)而非 rounded-full(符合项目圆角守门)
 *  - 可访问性:
 *    · type=button 不触发表单 submit
 *    · aria-label 跟随状态切换("显示密码" / "隐藏密码")
 *    · aria-pressed 反映当前可见状态
 *    · focus-visible 显示 ring,与 shadcn Input focus 行为一致
 *  - 受控/非受控均支持:
 *    · 不传 value/onChange 时,内部用 defaultValue + ref(同原生 input)
 *    · 传 value/onChange 时正常受控
 *  - 兼容 react-hook-form:
 *    · 透传所有 input 属性(包括 register 返回的 onChange/onBlur/ref/name)
 *    · ref 正确转发到底层 input
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { Input } from '@ihui/ui'
import { cn } from '@/lib/utils'

const EYE_OPEN_PATH =
  'M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z'
const EYE_SLASH_PATH =
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
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          // 留出右侧切换按钮空间(按钮 36px + 4px 内边距)
          className={cn('pr-10', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? a11yHide : a11yShow}
          aria-pressed={visible}
          data-testid="password-toggle"
          className={cn(
            'absolute inset-y-0 right-0 flex w-9 items-center justify-center',
            'text-muted-foreground transition-colors duration-200',
            'hover:text-foreground focus-visible:text-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background rounded-md',
          )}
        >
          {/*
           * 双 SVG 容器:同一坐标内只显示其中一个,切换时整组带 eye-fill 动画。
           * 用 absolute 让两个图标完全重叠,显示控制由 visibility(非 display,保留动画空间)。
           */}
          <span
            key={visible ? 'on' : 'off'}
            className="relative inline-flex h-4 w-4 items-center justify-center"
            style={{ animation: 'eye-fill 0.5s ease' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 576 512"
              fill="currentColor"
              className={cn(
                'absolute inset-0 m-auto h-4 w-4',
                visible ? 'hidden' : 'block',
              )}
              aria-hidden="true"
            >
              <path d={EYE_OPEN_PATH} />
            </svg>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 512"
              fill="currentColor"
              className={cn(
                'absolute inset-0 m-auto h-4 w-4',
                visible ? 'block' : 'hidden',
              )}
              aria-hidden="true"
            >
              <path d={EYE_SLASH_PATH} />
            </svg>
          </span>
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'
