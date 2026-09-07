// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '../button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../tooltip'
import { cn } from '../../lib/utils'
import type { ThirdPartyConfig, ThirdPartyPlatform, ThirdPartyProvider } from './types'

export interface ThirdPartyLoginButtonsProps {
  /** i18n 翻译函数 */
  t: (key: string, params?: Record<string, string | number>) => string
  /** 第三方登录配置(由调用方注入) */
  config: ThirdPartyConfig
  /** 自定义样式 */
  className?: string
  /**
   * 主推平台(如 wechat):渲染为整行大按钮,其余平台留图标网格(FS"微信一键登录")。
   * 设值后隐藏"第三方登录"标题,改为 大按钮 + "或" 分隔线 + 网格,对齐 RN WeChatLoginButton。
   * 未设置时维持原有 3 列网格。2026-09-06 立。
   */
  featuredPlatform?: ThirdPartyPlatform
  /** 主推大按钮背景色(品牌色,如 OAUTH_BRAND_COLORS.wechat) */
  featuredBackground?: string
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
export function ThirdPartyLoginButtons({
  t,
  config,
  className,
  featuredPlatform,
  featuredBackground,
}: ThirdPartyLoginButtonsProps) {
  const { providers, currentPlatform, onLogin } = config
  const isLoading = currentPlatform !== null

  const featuredProvider = featuredPlatform
    ? providers.find((p) => p.key === featuredPlatform)
    : null
  const restProviders = featuredProvider
    ? providers.filter((p) => p.key !== featuredProvider.key)
    : providers

  return (
    <div className={cn(className)}>
      {/* 主推平台大按钮模式(对齐 RN WeChatLoginButton):大按钮 + "或"分隔线 + 其余网格 */}
      {featuredProvider ? (
        <div className="mt-3">
          <FeaturedPlatformButton
            provider={featuredProvider}
            isLoading={isLoading}
            backgroundColor={featuredBackground}
            onLogin={onLogin}
          />
          {restProviders.length > 0 && (
            <>
              <div className="my-4 flex items-center gap-3 text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs">{'或'}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ThirdPartyGrid
                t={t}
                providers={restProviders}
                currentPlatform={currentPlatform}
                onLogin={onLogin}
              />
            </>
          )}
        </div>
      ) : (
        <>
          {/* 标题:居中文本 + 间距 */}
          <div className="mt-3 mb-4 flex justify-center text-xs uppercase">
            <span className="text-muted-foreground">{t('auth.thirdPartyLogin')}</span>
          </div>
          <ThirdPartyGrid
            t={t}
            providers={providers}
            currentPlatform={currentPlatform}
            onLogin={onLogin}
          />
        </>
      )}
    </div>
  )
}

/** 主推平台整行大按钮(2026-09-06 立):h-10 全宽 + 品牌背景 + 白色反相图标(对齐主登录按钮) */
function FeaturedPlatformButton({
  provider,
  isLoading,
  backgroundColor,
  onLogin,
}: {
  provider: ThirdPartyProvider
  isLoading: boolean
  backgroundColor?: string
  onLogin: (platform: ThirdPartyPlatform) => void
}) {
  const disabled = provider.forceDisabled || !provider.enabled || isLoading
  const isBusy = isLoading
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onLogin(provider.key)}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      style={backgroundColor ? { backgroundColor } : undefined}
      data-testid={`third-party-featured-${provider.key}`}
    >
      {isBusy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <>
          {/* brightness-0 invert:把彩色品牌图标反白,保证绿底上可见(仅主推大按钮场景) */}
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center brightness-0 invert"
            aria-hidden="true"
          >
            {provider.icon}
          </span>
          <span>{provider.label}</span>
        </>
      )}
    </button>
  )
}

/** 3 列图标网格(主推模式与普通模式的公共渲染) */
function ThirdPartyGrid({
  t,
  providers,
  currentPlatform,
  onLogin,
}: {
  t: (key: string, params?: Record<string, string | number>) => string
  providers: ThirdPartyProvider[]
  currentPlatform: ThirdPartyPlatform | null
  onLogin: (platform: ThirdPartyPlatform) => void
}) {
  const isLoading = currentPlatform !== null
  return (
    <div className="grid grid-cols-3 gap-2">
      <TooltipProvider delayDuration={200}>
        {providers.map((p) => {
          const disabled = p.forceDisabled || !p.enabled || isLoading
          const isBusy = isLoading && currentPlatform === p.key
          const tooltipContent =
            p.disabledTooltip ??
            (p.forceDisabled
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
              className={cn(
                // 暗色模式 hover:纯黑底 + 纯白字,高对比高亮突出
                // (覆盖 outline variant 默认的 hover:bg-accent 灰底,不够醒目)
                'dark:hover:bg-black dark:hover:text-white',
                // w-full:让按钮撑满 grid cell(grid-cols-3 等分列宽,span 已被
                // justify-items: stretch 拉伸到列宽,但内层 inline-flex 按钮默认
                // 不自动 grow,文本长短不一导致按钮宽度不一致)
                'w-full',
                p.forceDisabled && 'grayscale opacity-50',
              )}
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
              <TooltipTrigger asChild>
                <span className="inline-flex">{button}</span>
              </TooltipTrigger>
              <TooltipContent>{tooltipContent}</TooltipContent>
            </Tooltip>
          ) : (
            <React.Fragment key={p.key}>{button}</React.Fragment>
          )
        })}
      </TooltipProvider>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
