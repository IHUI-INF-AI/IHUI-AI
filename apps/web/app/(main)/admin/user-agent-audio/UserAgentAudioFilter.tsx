'use client'

import { Input } from '@ihui/ui'
import type { UserAgentAudioSearch } from './types'

interface Props {
  search: UserAgentAudioSearch
  onSearchChange: (patch: Partial<UserAgentAudioSearch>) => void
}

export function UserAgentAudioFilter({ search, onSearchChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={search.uuid}
        onChange={(e) => onSearchChange({ uuid: e.target.value })}
        placeholder="用户UUID"
        className="h-9 w-40"
      />
      <Input
        value={search.audioId}
        onChange={(e) => onSearchChange({ audioId: e.target.value })}
        placeholder="音频ID"
        className="h-9 w-40"
      />
      <Input
        value={search.agentId}
        onChange={(e) => onSearchChange({ agentId: e.target.value })}
        placeholder="AgentID"
        className="h-9 w-40"
      />
      <Input
        value={search.source}
        onChange={(e) => onSearchChange({ source: e.target.value })}
        placeholder="来源"
        className="h-9 w-32"
      />
      <Input
        value={search.platform}
        onChange={(e) => onSearchChange({ platform: e.target.value })}
        placeholder="平台"
        className="h-9 w-32"
      />
    </div>
  )
}
