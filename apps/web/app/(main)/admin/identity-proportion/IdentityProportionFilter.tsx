'use client'

import { DatePicker } from '@/components/form/DatePicker'

interface Props {
  searchBegin: string
  setSearchBegin: (v: string) => void
  searchEnd: string
  setSearchEnd: (v: string) => void
}

export function IdentityProportionFilter({
  searchBegin,
  setSearchBegin,
  searchEnd,
  setSearchEnd,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DatePicker
        value={searchBegin}
        onChange={(v) => setSearchBegin(v as string)}
        placeholder="开始时间"
      />
      <DatePicker
        value={searchEnd}
        onChange={(v) => setSearchEnd(v as string)}
        placeholder="结束时间"
      />
    </div>
  )
}
