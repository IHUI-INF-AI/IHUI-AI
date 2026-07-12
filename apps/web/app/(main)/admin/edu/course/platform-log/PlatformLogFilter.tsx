'use client'

import { Input, Button } from '@ihui/ui'
import { DatePicker } from '@/components/form/DatePicker'
import type { Search } from './types'

interface Props {
  q: Search
  onChange: (k: keyof Search, v: string) => void
  onReset: () => void
}

const inputCls = 'h-9 w-36'

export function PlatformLogFilter({ q, onChange, onReset }: Props) {
  return (
    <>
      <Input
        placeholder="平台ID"
        value={q.platformId}
        onChange={(e) => onChange('platformId', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder="课程ID"
        value={q.courseId}
        onChange={(e) => onChange('courseId', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder="视频ID"
        value={q.videoId}
        onChange={(e) => onChange('videoId', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder="类型"
        value={q.type}
        onChange={(e) => onChange('type', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder="创建人"
        value={q.creator}
        onChange={(e) => onChange('creator', e.target.value)}
        className={inputCls}
      />
      <DatePicker
        value={q.createdAt}
        onChange={(v) => onChange('createdAt', v)}
        placeholder="创建时间"
        className="w-40"
      />
      <Button variant="outline" size="sm" onClick={onReset}>
        重置
      </Button>
    </>
  )
}
