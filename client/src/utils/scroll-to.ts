/**
 * 平滑滚动工具
 * 用于分页等组件的回到顶部/指定位置功能
 */

/**
 * 平滑滚动到指定 Y 位置
 * @param position 目标 Y 位置（0 = 页面顶部）
 * @param duration 动画时长（毫秒），默认 400
 */
export function scrollTo(position: number, duration: number = 400): void {
  if (typeof window === 'undefined') return

  const start = window.scrollY
  const distance = position - start

  // 距离太小时直接跳转
  if (Math.abs(distance) < 1) {
    window.scrollTo(0, position)
    return
  }

  const startTime = performance.now()

  function animate(currentTime: number) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)

    // easeInOutQuad 缓动函数
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2

    window.scrollTo(0, start + distance * eased)

    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }

  requestAnimationFrame(animate)
}

export default scrollTo
