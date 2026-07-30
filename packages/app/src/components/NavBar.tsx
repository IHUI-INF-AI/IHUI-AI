import type { ReactNode, CSSProperties } from 'react'
import { getTokens, type AppThemeMode } from '../theme/tokens'

/**
 * NavBar 顶部导航栏(跨端共享层)。
 *
 * 对齐 mobile-rn/NavBar.tsx 的"返回 + 标题 + 副标题 + 右侧操作"模式。
 *
 * 平台无关:
 * - 不依赖 @tarojs/* 或 react-native,使用 div/span + style + onClick
 * - 状态栏高度通过 `statusBarHeight` prop 注入(替代 RN `StatusBar.currentHeight`),
 *   默认 0(SSR/测试环境);web 端通常为 0,iOS/H5 可由调用方传入安全区域值
 * - i18n 通过 `t: TFunction` prop 注入(可选用,用于未来国际化扩展)
 */
export interface NavBarProps {
  /** 主标题 */
  title?: string
  /** 副标题 */
  subtitle?: string
  /** 返回按钮点击回调(未传则不渲染返回按钮) */
  onBack?: () => void
  /** 右侧操作区节点 */
  rightAction?: ReactNode
  /** 透传模式(无背景色 + 无下边框) */
  transparent?: boolean
  /** 状态栏高度(px,默认 0);web 端通常为 0 */
  statusBarHeight?: number
  className?: string
  /** 已解析主题,默认 'light' */
  colorScheme?: AppThemeMode
}

const HEIGHT_DEFAULT = 44
const HEIGHT_WITH_SUBTITLE = 56
const BACK_BUTTON_SIZE = 32
const SIDE_PLACEHOLDER_WIDTH = 32

const viewStyles = {
  container: (tk: ReturnType<typeof getTokens>, transparent: boolean, statusBarHeight: number): CSSProperties => ({
    width: '100%',
    backgroundColor: transparent ? 'transparent' : tk.surface.card,
    borderBottomWidth: transparent ? 0 : 1,
    borderBottomColor: tk.border.light,
    borderBottomStyle: transparent ? 'none' : 'solid',
    paddingTop: statusBarHeight,
  }),
  row: (contentHeight: number): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    height: contentHeight,
  }),
  backBtn: (): CSSProperties => ({
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }),
  center: (): CSSProperties => ({
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  right: (): CSSProperties => ({
    minWidth: SIDE_PLACEHOLDER_WIDTH,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  }),
  sidePlaceholder: (): CSSProperties => ({
    width: SIDE_PLACEHOLDER_WIDTH,
    flexShrink: 0,
  }),
}

const textStyles = {
  backArrow: (tk: ReturnType<typeof getTokens>): CSSProperties => ({
    fontSize: 28,
    lineHeight: '30px',
    color: tk.text.primary,
  }),
  title: (tk: ReturnType<typeof getTokens>): CSSProperties => ({
    fontSize: 16,
    fontWeight: 600,
    color: tk.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  }),
  subtitle: (tk: ReturnType<typeof getTokens>): CSSProperties => ({
    fontSize: 12,
    color: tk.text.secondary,
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  }),
}

export function NavBar({
  title,
  subtitle,
  onBack,
  rightAction,
  transparent = false,
  statusBarHeight = 0,
  className,
  colorScheme = 'light',
}: NavBarProps) {
  const tk = getTokens(colorScheme)
  const contentHeight = subtitle ? HEIGHT_WITH_SUBTITLE : HEIGHT_DEFAULT

  return (
    <div className={className} style={viewStyles.container(tk, transparent, statusBarHeight)}>
      <div style={viewStyles.row(contentHeight)}>
        {onBack ? (
          <div
            role="button"
            tabIndex={0}
            onClick={onBack}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onBack()
              }
            }}
            style={viewStyles.backBtn()}
            aria-label="返回"
          >
            <span style={textStyles.backArrow(tk)}>{'‹'}</span>
          </div>
        ) : (
          <div style={viewStyles.sidePlaceholder()} />
        )}

        <div style={viewStyles.center()}>
          {title ? <span style={textStyles.title(tk)}>{title}</span> : null}
          {subtitle ? <span style={textStyles.subtitle(tk)}>{subtitle}</span> : null}
        </div>

        {rightAction ? (
          <div style={viewStyles.right()}>{rightAction}</div>
        ) : (
          <div style={viewStyles.sidePlaceholder()} />
        )}
      </div>
    </div>
  )
}
