'use client'

import { Input } from '@ihui/ui-react'
import type { UserAgentImageSearch } from './types'

interface Props {
  search: UserAgentImageSearch
  onSearchChange: (patch: Partial<UserAgentImageSearch>) => void
}

export function UserAgentImageFilter({ search, onSearchChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={search.userUuid}
        onChange={(e) => onSearchChange({ userUuid: e.target.value })}
        placeholder="用户UUID"
        className="h-9 w-40"
      />
      <Input
        value={search.imageName}
        onChange={(e) => onSearchChange({ imageName: e.target.value })}
        placeholder="图片名称"
        className="h-9 w-40"
      />
      <Input
        value={search.platform}
        onChange={(e) => onSearchChange({ platform: e.target.value })}
        placeholder="平台"
        className="h-9 w-32"
      />
      <Input
        value={search.modelName}
        onChange={(e) => onSearchChange({ modelName: e.target.value })}
        placeholder="模型名称"
        className="h-9 w-40"
      />
    </div>
  )
}
