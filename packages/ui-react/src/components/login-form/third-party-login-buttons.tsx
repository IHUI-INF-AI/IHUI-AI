'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '../button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../tooltip'
import { cn } from '../../lib/utils'
import type { ThirdPartyConfig } from './types'

export interface ThirdPartyLoginButtonsProps {
  /** i18n 翻译函数 */
  t: (key: string, params?: Record<string, string | number>) => string
  /** 第三方登录配置(由调用方注入) */
  config: ThirdPartyConfig
  /** 自定义样式 */
  className?: string
}

/**
 * 第三方登录按钮群(2026-07-26 抽取到共享包)
 *
 * 视觉规范(对标 web 端 ThirdPartyLoginButtons.tsx):
 *   - 标题:"第三方登录" + 居中文本(uppercase + text-muted-foreground)
 *   - 网格:grid grid-cols-3 gap-3(3 列)
 *   - 每个按钮:Button variant="outline" h-10 内含 icon + span label
 *   - 加载中:<Loader2 className="h-4 w-4 animate-spin" />
 *   - forceDisabled:加 grayscale opacity-50
 *   - mono 图标:dark:invert
 *
 * 共享包关键差异(2026-07-26):
 *   - **图标是 ReactNode**(不是 string src),调用方注入 SVG / <img> / Next.js Image
 *   - **isPlatformEnabled / isLoading 状态由调用方管理**(本组件只读 config)
 *   - 不使用 next/image / useSearchParams / useThirdPartyAuth
 *   - 8 平台顺序由 ALL_THIRD_PARTY_PLATFORMS 决定(在 types.ts),调用方需自己排序
 *   - Tooltip 来自共享包(如有 Radix UI Tooltip 依赖,直接用)
 *
 * 接入示例(web):
 *   const providers: ThirdPartyProvider[] = [
 *     { key: 'wechat', label: t('wechatLogin'), icon: <Image src='...' />, enabled: true },
 *     ...
 *   ]
 *   <ThirdPartyLoginButtons t={t} config={{ providers, currentPlatform, onLogin }} />
 */
export function ThirdPartyLoginButtons({ t, config, className }: ThirdPartyLoginButtonsProps) {
  const { providers, currentPlatform, onLogin } = config
  const isLoading = currentPlatform !== null

  return (
    <div className={cn(className)}>
      {/* 标题:居中文本 + 间距 */}
      <div className="mt-3 mb-4 flex justify-center text-xs uppercase">
        <span className="text-muted-foreground">{t('auth.thirdPartyLogin')}</span>
      </div>

      {/* 3 列网格 8 个按钮 */}
      <div className="grid grid-cols-3 gap-3">
        <TooltipProvider delayDuration={200}>
          {providers.map((p) => {
            const disabled = p.forceDisabled || !p.enabled || isLoading
            const isBusy = isLoading && currentPlatform === p.key
            const tooltipContent = p.disabledTooltip
              ?? (p.forceDisabled
                ? t('auth.appleComingSoon')
                : !p.enabled
                  ? t('auth.googleNotConfigured')
                  : undefined)

            const button = (
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => onLogin(p.key)}
                className={cn(p.forceDisabled && 'grayscale opacity-50')}
                data-testid={`third-party-${p.key}`}
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <span
                    className={cn(
                      'inline-flex h-4 w-4 shrink-0 items-center justify-center',
                      p.mono && 'dark:invert',
                    )}
                    aria-hidden="true"
                  >
                    {p.icon}
                  </span>
                )}
                <span>{p.label}</span>
              </Button>
            )

            return tooltipContent ? (
              <Tooltip key={p.key}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent>{tooltipContent}</TooltipContent>
              </Tooltip>
            ) : (
              <React.Fragment key={p.key}>{button}</React.Fragment>
            )
          })}
        </TooltipProvider>
      </div>
    </div>
  )
}
