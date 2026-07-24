'use client'

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui-react'
import { selectClass, STATUS_LABEL } from './helpers'

interface Props {
  level: string
  setLevel: (v: string) => void
  status: string
  setStatus: (v: string) => void
}

export function AlertFilter({ level, setLevel, status, setStatus }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={level} onValueChange={setLevel}>
        <SelectTrigger className={selectClass} aria-label="级别">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部级别</SelectItem>
          <SelectItem value="critical">严重</SelectItem>
          <SelectItem value="warning">警告</SelectItem>
          <SelectItem value="info">信息</SelectItem>
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className={selectClass} aria-label="状态">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部状态</SelectItem>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
