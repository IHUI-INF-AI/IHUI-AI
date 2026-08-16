import type { ReactNode, CSSProperties } from 'react'
import { getTokens, type AppThemeTokens, type AppThemeMode } from '../theme/tokens'
import type { TFunction } from '@ihui/types'

/**
 * 通用"标题 + 查看更多"区块头部组件 — 跨端共享层。
 *
 * 对齐原项目 components/MoreTitles/index.vue:左侧标题(可选副标题)+ 右侧"查看更多 >"。
 *
 * - 平台无关:不依赖 @tarojs/* 或 react-native,使用 div/span + style + className
 * - i18n 通过 `t: TFunction` 注入,fallback 硬编码中文(对齐 miniapp-taro 源行为)
 * - 颜色通过 `getTokens(colorScheme)` 注入,支持 light/dark 双主题
 */
export interface SectionHeaderProps {
  title: string
  subtitle?: string
  moreText?: string
  showMore?: boolean
  onMore?: () => void
  extra?: ReactNode
  className?: string
  /** 已解析主题,默认 'light' */
  colorScheme?: AppThemeMode
  /** i18n 翻译函数(可选),未传则用硬编码 fallback */
  t?: TFunction
}

const SUBTITLE_GAP = 8
const ARROW_GAP = 4
const DEFAULT_FALLBACK = '查看更多'

/** view container 样式 */
const viewStyles = (): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
})

/** text 样式(集中管理,避免 style 联合类型) */
const textStyles = {
  title: (tk: AppThemeTokens): CSSProperties => ({
    fontSize: 16,
    fontWeight: 700,
    color: tk.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  subtitle: (tk: AppThemeTokens): CSSProperties => ({
    marginLeft: SUBTITLE_GAP,
    fontSize: 12,
    color: tk.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  moreLabel: (tk: AppThemeTokens): CSSProperties => ({
    fontSize: 12,
    color: tk.brand.DEFAULT,
  }),
  moreArrow: (tk: AppThemeTokens): CSSProperties => ({
    marginLeft: ARROW_GAP,
    fontSize: 12,
    color: tk.brand.DEFAULT,
  }),
}

export function SectionHeader({
  title,
  subtitle,
  moreText,
  showMore = true,
  onMore,
  extra,
  className,
  colorScheme = 'light',
  t,
}: SectionHeaderProps) {
  const tk = getTokens(colorScheme)
  const moreLabel = moreText ?? (t ? t('common.viewMore') : DEFAULT_FALLBACK)

  const containerStyle: CSSProperties = {
    ...viewStyles(),
  }

  return (
    <div className={className} style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
        <span style={textStyles.title(tk)}>{title}</span>
        {subtitle ? <span style={textStyles.subtitle(tk)}>{subtitle}</span> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {extra}
        {showMore ? (
          <div
            role="button"
            tabIndex={0}
            onClick={onMore}
            onKeyDown={(e) => {
              if (onMore && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onMore()
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: 8,
              cursor: onMore ? 'pointer' : 'default',
            }}
          >
            <span style={textStyles.moreLabel(tk)}>{moreLabel}</span>
            <span style={textStyles.moreArrow(tk)}>{'>'}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
