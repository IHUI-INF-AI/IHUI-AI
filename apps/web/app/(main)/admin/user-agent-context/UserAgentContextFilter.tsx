// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'

import {} from 'lucide-react'
import { SearchInput } from '@ihui/ui-react'

interface Props {
  search: string
  setSearch: (v: string) => void
}

export function UserAgentContextFilter({ search, setSearch }: Props) {
  return (
    <SearchInput
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="搜索问题"
      size="lg"
      wrapperClassName="w-full max-w-xs"
    />
  )
}
