'use client'

import {
  Loader2,
  Check,
  X,
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

import {
  selectClass,
  inputSm,
  CHANNEL_LABEL,
  STATUS_LABEL,
  STATUS_STYLE,
  DETAIL_EXPORT,
} from './types'
import type { useWithdrawalDetail } from './useWithdrawalDetail'

type Props = ReturnType<typeof useWithdrawalDetail>

export function WithdrawalDetailTable(props: Props) {
  const {
    dStatus,
    setDStatus,
    dSearch,
    setDSearch,
    dAmountRange,
    setDAmountRange,
    dPage,
    setDPage,
    dList,
    dTotal,
    dTotalPages,
    dLoading,
    auditMut,
    openCreateDetail,
    openEditDetail,
    handleDeleteDetail,
    openReview,
    handleResetDetail,
  } = props

  function handleExport() {
    exportToExcel(
      `withdrawals_${Date.now()}`,
      DETAIL_EXPORT,
      dList as unknown as Record<string, unknown>[],
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">用户</Label>
          <Input
            className={inputSm}
            value={dSearch.user}
            onChange={(e) => setDSearch({ ...dSearch, user: e.target.value })}
            placeholder="用户"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">用户名</Label>
          <Input
            className={inputSm}
            value={dSearch.userName}
            onChange={(e) => setDSearch({ ...dSearch, userName: e.target.value })}
            placeholder="用户名"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">外部单号</Label>
          <Input
            className={inputSm}
            value={dSearch.outBillNo}
            onChange={(e) => setDSearch({ ...dSearch, outBillNo: e.target.value })}
            placeholder="外部单号"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">审核人</Label>
          <Input
            className={inputSm}
            value={dSearch.reviewer}
            onChange={(e) => setDSearch({ ...dSearch, reviewer: e.target.value })}
            placeholder="审核人"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">金额范围(分)</Label>
          <div className="flex items-center gap-1">
            <Input
              className={inputSm}
              value={dAmountRange.min}
              onChange={(e) => setDAmountRange({ ...dAmountRange, min: e.target.value })}
              placeholder="最小"
            />
            <span>-</span>
            <Input
              className={inputSm}
              value={dAmountRange.max}
              onChange={(e) => setDAmountRange({ ...dAmountRange, max: e.target.value })}
              placeholder="最大"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">状态</Label>
          <Select value={dStatus} onValueChange={setDStatus}>
            <SelectTrigger className={selectClass}>
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
        <Button variant="outline" size="sm" onClick={handleResetDetail}>
          <RotateCcw className="h-4 w-4" />
          重置
        </Button>
        <div className="flex-1" />
        <HasPermi code="ai:withdrawaldetail:export">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
        </HasPermi>
        <HasPermi code="ai:withdrawaldetail:add">
          <Button size="sm" onClick={openCreateDetail}>
            <Plus className="h-4 w-4" />
            新增
          </Button>
        </HasPermi>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">用户</th>
              <th className="px-4 py-2.5 font-medium">金额</th>
              <th className="px-4 py-2.5 font-medium">渠道</th>
              <th className="px-4 py-2.5 font-medium">账户</th>
              <th className="px-4 py-2.5 font-medium">状态</th>
              <th className="px-4 py-2.5 font-medium">审核人</th>
              <th className="px-4 py-2.5 font-medium">申请时间</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {dLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : dList.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  暂无提现申请
                </td>
              </tr>
            ) : (
              dList.map((w) => (
                <tr key={w.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{w.user ?? w.userName ?? '-'}</td>
                  <td className="px-4 py-2.5 font-medium">¥{(w.amount / 100).toFixed(2)}</td>
                  <td className="px-4 py-2.5">{CHANNEL_LABEL[w.channel] ?? '-'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {w.account}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                        STATUS_STYLE[w.status],
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STATUS_LABEL[w.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{w.reviewer ?? '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(w.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      {w.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={auditMut.isPending}
                            onClick={() => auditMut.mutate({ id: w.id, action: 'approve' })}
                          >
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            通过
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={auditMut.isPending}
                            onClick={() => auditMut.mutate({ id: w.id, action: 'reject' })}
                          >
                            <X className="h-3.5 w-3.5 text-red-600" />
                            驳回
                          </Button>
                          <HasPermi code="ai:withdrawaldetail:edit">
                            <Button size="sm" variant="ghost" onClick={() => openReview(w)}>
                              审核
                            </Button>
                          </HasPermi>
                        </>
                      )}
                      <HasPermi code="ai:withdrawaldetail:edit">
                        <Button size="sm" variant="ghost" onClick={() => openEditDetail(w)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:withdrawaldetail:remove">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDeleteDetail(w)}
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

      {dTotalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            共 {dTotal} 条 · 第 {dPage}/{dTotalPages} 页
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDPage((p) => Math.max(1, p - 1))}
              disabled={dPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDPage((p) => Math.min(dTotalPages, p + 1))}
              disabled={dPage >= dTotalPages}
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
