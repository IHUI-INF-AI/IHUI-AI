import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { getTokens, type AppThemeMode } from '../theme/tokens'

/**
 * Toolbar 横向操作按钮组(跨端共享层)。
 *
 * 对齐 mobile-rn/Toolbar.tsx 的"32×32 工具按钮阵列 + 分隔条"模式。
 *
 * 平台无关:
 * - 不依赖 @tarojs/* 或 react-native,使用 div/span/img + onClick
 * - active 态有独立 backgroundColor + border + boxShadow(替代 RN shadow/elevation)
 * - icon 字段:URL/绝对路径视为图片,其他短文本视为 emoji/字符
 */
export interface ToolbarItem {
  /** 唯一标识(用于 activeKey 匹配 + React key) */
  key: string
  /** 图标:http(s) URL / 绝对路径视为图片;其他短文本视为 emoji/字符 */
  icon: string
  /** 单项激活态(activeKey 缺省时生效) */
  active?: boolean
  /** 点击回调 */
  onPress: () => void
}

export interface ToolbarProps {
  items: ToolbarItem[]
  /** 分隔条位置:在指定 key 之后插入分隔条 */
  separators?: string[]
  /** 全局激活 key(覆盖 items[].active) */
  activeKey?: string
  className?: string
  /** 已解析主题,默认 'light' */
  colorScheme?: AppThemeMode
}

/** 判断 icon 是否为图片路径(URL / 绝对路径) */
function isImagePath(icon: string): boolean {
  return /^(https?:)?\/\//.test(icon) || icon.startsWith('/')
}

const viewStyles = {
  container: (tk: ReturnType<typeof getTokens>): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: tk.surface.muted,
    borderRadius: 12,
    gap: 4,
  }),
  rowItem: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  tool: (): CSSProperties => ({
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  }),
  toolInactive: (): CSSProperties => ({
    backgroundColor: 'transparent',
  }),
  toolActive: (tk: ReturnType<typeof getTokens>): CSSProperties => ({
    backgroundColor: tk.surface.light,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tk.border.light,
    boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
  }),
  toolPressed: (tk: ReturnType<typeof getTokens>): CSSProperties => ({
    backgroundColor: tk.surface.light,
  }),
  icon: (): CSSProperties => ({
    width: 18,
    height: 18,
    objectFit: 'contain',
    display: 'block',
  }),
  separator: (tk: ReturnType<typeof getTokens>): CSSProperties => ({
    width: 1,
    height: 20,
    backgroundColor: tk.border.medium,
    marginLeft: 4,
    marginRight: 4,
  }),
}

const textStyles = {
  iconEmoji: (tk: ReturnType<typeof getTokens>): CSSProperties => ({
    fontSize: 16,
    lineHeight: '20px',
    color: tk.text.primary,
  }),
}

export function Toolbar({
  items,
  separators,
  activeKey,
  className,
  colorScheme = 'light',
}: ToolbarProps) {
  const tk = getTokens(colorScheme)
  const separatorSet = useMemo<Set<string>>(() => new Set(separators ?? []), [separators])

  return (
    <div className={className} style={viewStyles.container(tk)}>
      {items.map((item) => {
        const isActive = activeKey !== undefined ? activeKey === item.key : item.active === true
        const showSeparator = separatorSet.has(item.key)
        return (
          <div key={item.key} style={viewStyles.rowItem()}>
            <div
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onClick={item.onPress}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  item.onPress()
                }
              }}
              style={{
                ...viewStyles.tool(),
                ...(isActive ? viewStyles.toolActive(tk) : viewStyles.toolInactive()),
              }}
            >
              {isImagePath(item.icon) ? (
                <img src={item.icon} alt="" style={viewStyles.icon()} />
              ) : (
                <span style={textStyles.iconEmoji(tk)}>{item.icon}</span>
              )}
            </div>
            {showSeparator ? <div style={viewStyles.separator(tk)} /> : null}
          </div>
        )
      })}
    </div>
  )
}
