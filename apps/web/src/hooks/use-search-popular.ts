'use client'

// 2026-07-28 立:SearchBar 三段式搜索面板的"热门"段 hook。
// 当前为 const 直接返回(项目硬编码基线),预留 i18n / API 远程拉取扩展点。
// 后续若改为远端拉取,只需在此 hook 内 useEffect + useState,签名保持稳定。

import { POPULAR_SEARCHES } from '@/lib/search-suggestions'

export function useSearchPopular(): string[] {
  return [...POPULAR_SEARCHES]
}
