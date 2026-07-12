'use client'

import { Input, Button } from '@ihui/ui'
import type { Search } from './types'

interface Props {
  q: Search
  onChange: (k: keyof Search, v: string) => void
  onReset: () => void
}

const inputCls = 'h-9 w-36'

export function ZhsIdentityFilter({ q, onChange, onReset }: Props) {
  return (
    <>
      <Input
        placeholder="UUID"
        value={q.uuid}
        onChange={(e) => onChange('uuid', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder="名称"
        value={q.name}
        onChange={(e) => onChange('name', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder="平台ID"
        value={q.platformId}
        onChange={(e) => onChange('platformId', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder="组织ID"
        value={q.organizationId}
        onChange={(e) => onChange('organizationId', e.target.value)}
        className={inputCls}
      />
      <Button variant="outline" size="sm" onClick={onReset}>
        重置
      </Button>
    </>
  )
}
