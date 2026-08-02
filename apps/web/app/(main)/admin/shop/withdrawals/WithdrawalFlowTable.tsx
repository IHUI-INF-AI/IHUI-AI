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
import { useTranslations } from 'next-intl'

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
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'

import { selectClass, inputSm, FLOW_STATUS, FLOW_STATUS_STYLE, getFlowExport } from './types'
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

  const t = useTranslations('admin.shop')

  function handleExport() {
    exportToExcel(
      `withdrawal_flow_${Date.now()}`,
      getFlowExport(t),
      fList as unknown as Record<string, unknown>[],
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('withdrawals.flow.searchUserId')}</Label>
          <Input
            className={inputSm}
            value={fSearch.userId}
            onChange={(e) => setFSearch({ ...fSearch, userId: e.target.value })}
            placeholder={t('withdrawals.flow.searchUserId')}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('withdrawals.flow.searchAmount')}</Label>
          <Input
            className={inputSm}
            value={fSearch.amount}
            onChange={(e) => setFSearch({ ...fSearch, amount: e.target.value })}
            placeholder={t('withdrawals.flow.amountPlaceholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('withdrawals.flow.searchOutBillNo')}</Label>
          <Input
            className={inputSm}
            value={fSearch.outBillNo}
            onChange={(e) => setFSearch({ ...fSearch, outBillNo: e.target.value })}
            placeholder={t('withdrawals.flow.searchOutBillNo')}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('withdrawals.flow.searchCreatedAt')}</Label>
          <Input
            type="date"
            className={inputSm}
            value={fSearch.createdAt}
            onChange={(e) => setFSearch({ ...fSearch, createdAt: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('withdrawals.flow.searchUpdatedAt')}</Label>
          <Input
            type="date"
            className={inputSm}
            value={fSearch.updatedAt}
            onChange={(e) => setFSearch({ ...fSearch, updatedAt: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('withdrawals.flow.searchTransferDetail')}</Label>
          <Input
            className={inputSm}
            value={fSearch.transferDetail}
            onChange={(e) => setFSearch({ ...fSearch, transferDetail: e.target.value })}
            placeholder={t('withdrawals.flow.searchTransferDetail')}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('withdrawals.flow.table.status')}</Label>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('withdrawals.allStatus')}</SelectItem>
              {Object.entries(FLOW_STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {t(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={handleResetFlow}>
          <RotateCcw className="h-4 w-4" />
          {t('withdrawals.reset')}
        </Button>
        <div className="flex-1" />
        <HasPermi code="ai:withdrawal_flow:export">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            {t('withdrawals.export')}
          </Button>
        </HasPermi>
        <HasPermi code="ai:withdrawal_flow:add">
          <Button size="sm" onClick={openCreateFlow}>
            <Plus className="h-4 w-4" />
            {t('withdrawals.create')}
          </Button>
        </HasPermi>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">ID</th>
              <th className="px-4 py-2.5 font-medium">{t('withdrawals.flow.table.userId')}</th>
              <th className="px-4 py-2.5 font-medium">{t('withdrawals.flow.table.amount')}</th>
              <th className="px-4 py-2.5 font-medium">{t('withdrawals.flow.table.outBillNo')}</th>
              <th className="px-4 py-2.5 font-medium">{t('withdrawals.flow.table.status')}</th>
              <th className="px-4 py-2.5 font-medium">{t('withdrawals.flow.table.createdAt')}</th>
              <th className="px-4 py-2.5 font-medium">{t('withdrawals.flow.table.updatedAt')}</th>
              <th className="px-4 py-2.5 font-medium">
                {t('withdrawals.flow.table.transferDetail')}
              </th>
              <th className="px-4 py-2.5 text-right font-medium">
                {t('withdrawals.flow.table.action')}
              </th>
            </tr>
          </thead>
          <tbody>
            {fLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : fList.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  {t('withdrawals.flow.noData')}
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
                      {t(FLOW_STATUS[w.status] ?? '')}
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
            {t('withdrawals.total', { total: fTotal, page: fPage, totalPages: fTotalPages })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFPage((p) => Math.max(1, p - 1))}
              disabled={fPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              {t('withdrawals.prev')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFPage((p) => Math.min(fTotalPages, p + 1))}
              disabled={fPage >= fTotalPages}
            >
              {t('withdrawals.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
