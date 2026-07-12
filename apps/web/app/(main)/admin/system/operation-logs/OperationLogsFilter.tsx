'use client'

import { Search } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { BIZ_TYPE, inputCls } from './helpers'

interface OperationLogsFilterProps {
  value: { title: string; operName: string; businessType: string }
  onChange: (v: { title: string; operName: string; businessType: string }) => void
  onSearch: () => void
  onReset: () => void
}

export function OperationLogsFilter({
  value,
  onChange,
  onSearch,
  onReset,
}: OperationLogsFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">模块</Label>
        <Input
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="操作模块"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">操作人</Label>
        <Input
          value={value.operName}
          onChange={(e) => onChange({ ...value, operName: e.target.value })}
          placeholder="操作人"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">类型</Label>
        <Select
          value={value.businessType}
          onValueChange={(v) => onChange({ ...value, businessType: v === 'all' ? '' : v })}
        >
          <SelectTrigger className={inputCls}>
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {Object.entries(BIZ_TYPE).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSearch}>
          <Search className="h-4 w-4" />
          搜索
        </Button>
        <Button size="sm" variant="outline" onClick={onReset}>
          重置
        </Button>
      </div>
    </div>
  )
}
