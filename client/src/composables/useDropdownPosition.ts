import { ref, nextTick } from 'vue'

/**
 * 下拉菜单智能定位 composable
 *
 * 收敛 LanguageSwitcher / AppDownload 等下拉菜单的定位逻辑:
 *  - 智能上下方向判断(下方放不下且上方更宽裕时向上弹出)
 *  - 左右边界约束(防止菜单溢出视口)
 *  - menuHeight 多重兜底测量(offsetHeight → getBoundingClientRect → 估算)
 *  - 暴露 menuAbove ref 供调用方同步箭头方向与动画方向
 *
 * 用法:
 * const { menuAbove, updatePosition } = useDropdownPosition({ fallbackHeight: 196 })
 * watch(visible, v => v && updatePosition(selectorEl.value, menuEl.value))
 * // 模板: :class="{ 'arrow-rotate': visible && !menuAbove }"
 * // 模板: :class="{ 'menu-above': menuAbove }"
 */
export interface UseDropdownPositionOptions {
  /** 菜单高度估算值(测不到时兜底),默认 196(5 项 × 36 + padding 16) */
  fallbackHeight?: number
  /** 菜单宽度估算值(测不到时兜底),默认 160 */
  fallbackWidth?: number
  /** 菜单与触发器的垂直间距,默认 2 */
  gap?: number
  /** 视口右边距留白,默认 8 */
  viewportRightMargin?: number
  /** 视口左边距留白,默认 8 */
  viewportLeftMargin?: number
}

export interface UseDropdownPositionReturn {
  /** 菜单是否向上弹出(供调用方同步箭头/动画方向) */
  menuAbove: import('vue').Ref<boolean>
  /**
   * 计算并设置菜单位置(智能上下方向判断 + 左右边界约束)
   * @param selectorEl 触发器元素
   * @param menuEl 菜单元素(已渲染)
   * @returns 是否成功设置位置(false 表示参数为空)
   */
  updatePosition: (selectorEl: HTMLElement | null, menuEl: HTMLElement | null) => Promise<boolean>
}

export function useDropdownPosition(
  options: UseDropdownPositionOptions = {},
): UseDropdownPositionReturn {
  const {
    fallbackHeight = 196,
    fallbackWidth = 160,
    gap = 2,
    viewportRightMargin = 8,
    viewportLeftMargin = 8,
  } = options

  const menuAbove = ref(false)

  const updatePosition = async (
    selectorEl: HTMLElement | null,
    menuEl: HTMLElement | null,
  ): Promise<boolean> => {
    if (!selectorEl || !menuEl) return false
    // 等待菜单渲染完成(调用方通常已 nextTick,这里再保险一次)
    await nextTick()
    const rect = selectorEl.getBoundingClientRect()
    const menuWidth = menuEl.offsetWidth || fallbackWidth
    // 多重兜底测量高度:offsetHeight → getBoundingClientRect → 估算
    let menuHeight = menuEl.offsetHeight || 0
    if (!menuHeight) menuHeight = menuEl.getBoundingClientRect().height || 0
    if (!menuHeight) menuHeight = fallbackHeight
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    // 下方放不下且上方更宽裕时向上弹出,否则默认向下
    const openAbove = spaceBelow < menuHeight && spaceAbove >= menuHeight
    menuAbove.value = openAbove
    const top = openAbove ? rect.top - menuHeight - gap : rect.bottom + gap
    const maxLeft = window.innerWidth - menuWidth - viewportRightMargin
    const left = Math.max(viewportLeftMargin, Math.min(rect.left, maxLeft))
    menuEl.style.left = `${Math.round(left)}px`
    menuEl.style.top = `${Math.round(top)}px`
    menuEl.style.right = 'auto'
    return true
  }

  return { menuAbove, updatePosition }
}
