import { ref } from 'vue'

/** 仅占位，不监听鼠标，光效通过 CSS 隐藏避免卡顿 */
export function useMouseGlow() {
  const isMouseInViewport = ref(false)
  return {
    isMouseInViewport,
    handleMouseMove: () => {},
    handleMouseLeave: () => {},
  }
}
