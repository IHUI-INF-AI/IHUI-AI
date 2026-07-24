'use client'

import { Search } from 'lucide-react'
import { Input } from '@ihui/ui-react'

interface Props {
  fileName: string
  setFileName: (v: string) => void
  uploadDate: string
  setUploadDate: (v: string) => void
}

export function OssFileFilter({ fileName, setFileName, uploadDate, setUploadDate }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder="搜索文件名..."
          className="h-9 pl-8"
        />
      </div>
      <Input
        type="date"
        value={uploadDate}
        onChange={(e) => setUploadDate(e.target.value)}
        className="h-9 w-40"
        aria-label="上传日期"
      />
    </div>
  )
}
