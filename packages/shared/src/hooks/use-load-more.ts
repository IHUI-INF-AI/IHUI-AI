import { useCallback, useRef } from 'react'

export function useLoadMore(fetch: (page: number) => Promise<boolean>) {
  const pageRef = useRef(1)
  const loadingRef = useRef(false)
  const loadMore = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    const hasMore = await fetch(pageRef.current)
    if (hasMore) pageRef.current++
    loadingRef.current = false
  }, [fetch])
  const reset = useCallback(() => { pageRef.current = 1 }, [])
  return { loadMore, reset }
}
