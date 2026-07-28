import * as React from 'react'

export interface UseAutoPlayReturn {
  current: number
  setCurrent: React.Dispatch<React.SetStateAction<number>>
}

/**
 * 自动播放 Hook(跨端共享),用于 Carousel 轮播组件。
 *
 * 两端(mobile-rn + miniapp-taro)原本各自实现:
 *   setInterval(() => setCurrent((prev) => (prev + 1) % total), interval)
 * 逻辑完全相同,提取为共享 hook 消除重复。
 *
 * @param total 总项数(<=1 时不启动自动播放)
 * @param interval 切换间隔(ms)
 * @param enabled 是否启用自动播放
 */
export function useAutoPlay(total: number, interval: number, enabled: boolean): UseAutoPlayReturn {
  const [current, setCurrent] = React.useState(0)

  React.useEffect(() => {
    if (!enabled || total <= 1) return
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % total)
    }, interval)
    return () => clearInterval(timer)
  }, [enabled, interval, total])

  return { current, setCurrent }
}
