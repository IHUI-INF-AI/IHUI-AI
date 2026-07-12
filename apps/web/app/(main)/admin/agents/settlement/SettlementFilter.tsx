'use client'

import { useTranslations } from 'next-intl'
import { Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { STATUS_OPTIONS, selectClass } from './helpers'

interface Props {
  orderNo: string
  setOrderNo: (v: string) => void
  agentId: string
  setAgentId: (v: string) => void
  status: string
  setStatus: (v: string) => void
}

export function SettlementFilter({
  orderNo,
  setOrderNo,
  agentId,
  setAgentId,
  status,
  setStatus,
}: Props) {
  const t = useTranslations('admin.agents.settlement')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={orderNo}
        onChange={(e) => setOrderNo(e.target.value)}
        placeholder={t('orderNoPlaceholder')}
        className="h-9 w-full max-w-[200px]"
        aria-label={t('colOrderNo')}
      />
      <Input
        value={agentId}
        onChange={(e) => setAgentId(e.target.value)}
        placeholder={t('agentIdPlaceholder')}
        className="h-9 w-full max-w-[200px]"
        aria-label={t('colAgent')}
      />
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className={selectClass} aria-label={t('colStatus')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
