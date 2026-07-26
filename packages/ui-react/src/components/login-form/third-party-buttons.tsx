/**
 * ThirdPartyLoginButtons — 共享第三方登录按钮群(2026-07-26 立)
 *
 * 抽到 packages/ui-react,web + extension 共用同一份组件。
 * 视觉规范(对齐 web 端原 ThirdPartyLoginButtons 2026-07-21 修订):
 *   - 顶部 "第三方登录" 标题(margin-top 12px, margin-bottom 16px, text-xs uppercase)
 *   - 3 列网格(grid-cols-3 gap-3)按行铺排
 *   - 每个按钮 shadcn Button variant="outline",icon + label 居中
 *   - loading 时 Loader2 spinner 替代 icon
 *   - 禁用按钮 grayscale opacity-50 + tooltip
 *
 * 共享包不依赖 next/image,扩展端 popup/sidepanel 都用 <img> 即可;
 * 也无依赖 next/search params(由父组件用 useSearchParams 处理 OAuth 回调)。
 */
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Tooltip, TooltipContent, TooltipTrigger, cn } from '../../index'
import type { TFunc, ThirdPartyConfig } from './types'

interface ThirdPartyLoginButtonsProps {
  config: ThirdPartyConfig
  /** i18n 函数 */
  t: TFunc
}

export function ThirdPartyLoginButtons({ config, t }: ThirdPartyLoginButtonsProps) {
  const { providers, currentPlatform, onLogin } = config

  if (providers.length === 0) return null

  return (
    <>
      <div className="mt-3 mb-4 flex justify-center text-xs uppercase">
        <span className="text-muted-foreground">{t('auth.thirdPartyLogin')}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {providers.map((p) => {
          const disabled = p.forceDisabled || !p.enabled
          const isBusy = currentPlatform === p.key
          const tooltipContent = p.tooltip
          const button = (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onLogin(p.key)}
              className={cn(p.forceDisabled && 'grayscale opacity-50')}
              data-testid={`thirdparty-${p.key}`}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <img
                  src={p.icon}
                  alt=""
                  aria-hidden="true"
                  width={16}
                  height={16}
                  className={cn('h-4 w-4 shrink-0', p.mono && 'dark:invert')}
                />
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
      </div>
    </>
  )
}
