'use client'

import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
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
import { cn } from '@/lib/utils'

import { selectClass, inputSm, FLOW_STATUS, FLOW_STATUS_STYLE, FLOW_EXPORT } from './types'
import type { useWithdrawalFlow } from './useWithdrawalFlow'
import { formatDate } from '@/lib/date-utils'

type Props = ReturnType<typeof useWithdrawalFlow>

export function WithdrawalFlowTable(props: Props) {
  const {
    fSearch,
    setFSearch,
    fStatus,
    setFStatus,
    fPage,
    setFPage,
    fList,
    fTotal,
    fTotalPages,
    fLoading,
    openCreateFlow,
    openEditFlow,
    handleDeleteFlow,
    handleResetFlow,
  } = props

  function handleExport() {
    exportToExcel(
      `withdrawal_flow_${Date.now()}`,
      FLOW_EXPORT,
      fList as unknown as Record<string, unknown>[],
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">用户ID</Label>
          <Input
            className={inputSm}
            value={fSearch.userId}
            onChange={(e) => setFSearch({ ...fSearch, userId: e.target.value })}
            placeholder="用户ID"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">金额(分)</Label>
          <Input
            className={inputSm}
            value={fSearch.amount}
            onChange={(e) => setFSearch({ ...fSearch, amount: e.target.value })}
            placeholder="金额"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">外部单号</Label>
          <Input
            className={inputSm}
            value={fSearch.outBillNo}
            onChange={(e) => setFSearch({ ...fSearch, outBillNo: e.target.value })}
            placeholder="外部单号"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">创建时间</Label>
          <Input
            type="date"
            className={inputSm}
            value={fSearch.createdAt}
            onChange={(e) => setFSearch({ ...fSearch, createdAt: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">更新时间</Label>
          <Input
            type="date"
            className={inputSm}
            value={fSearch.updatedAt}
            onChange={(e) => setFSearch({ ...fSearch, updatedAt: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">转账详情</Label>
          <Input
            className={inputSm}
            value={fSearch.transferDetail}
            onChange={(e) => setFSearch({ ...fSearch, transferDetail: e.target.value })}
            placeholder="转账详情"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">状态</Label>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {Object.entries(FLOW_STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={handleResetFlow}>
          <RotateCcw className="h-4 w-4" />
          重置
        </Button>
        <div className="flex-1" />
        <HasPermi code="ai:withdrawal_flow:export">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
        </HasPermi>
        <HasPermi code="ai:withdrawal_flow:add">
          <Button size="sm" onClick={openCreateFlow}>
            <Plus className="h-4 w-4" />
            新增
          </Button>
        </HasPermi>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">ID</th>
              <th className="px-4 py-2.5 font-medium">用户ID</th>
              <th className="px-4 py-2.5 font-medium">金额(分)</th>
              <th className="px-4 py-2.5 font-medium">外部单号</th>
              <th className="px-4 py-2.5 font-medium">状态</th>
              <th className="px-4 py-2.5 font-medium">创建时间</th>
              <th className="px-4 py-2.5 font-medium">更新时间</th>
              <th className="px-4 py-2.5 font-medium">转账详情</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {fLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : fList.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  暂无流水记录
                </td>
              </tr>
            ) : (
              fList.map((w) => (
                <tr key={w.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">{w.id}</td>
                  <td className="px-4 py-2.5">{w.userId}</td>
                  <td className="px-4 py-2.5 font-medium">{w.amount}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{w.outBillNo}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs',
                        FLOW_STATUS_STYLE[w.status] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {FLOW_STATUS[w.status] ?? '-'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {w.createdAt ? formatDate(w.createdAt) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {w.updatedAt ? formatDate(w.updatedAt) : '-'}
                  </td>
                  <td className="max-w-xs break-words px-4 py-2.5">{w.transferDetail ?? '-'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <HasPermi code="ai:withdrawal_flow:edit">
                        <Button size="sm" variant="ghost" onClick={() => openEditFlow(w)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:withdrawal_flow:remove">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDeleteFlow(w)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {fTotalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            共 {fTotal} 条 · 第 {fPage}/{fTotalPages} 页
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFPage((p) => Math.max(1, p - 1))}
              disabled={fPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFPage((p) => Math.min(fTotalPages, p + 1))}
              disabled={fPage >= fTotalPages}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
