'use client'

import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ihui/ui'
import { DatePicker } from '@/components/form/DatePicker'
import type { NotificationLogSearch } from './types'

interface Props {
  search: NotificationLogSearch
  onSearchChange: (patch: Partial<NotificationLogSearch>) => void
  onReset: () => void
  onQuery: () => void
}

export function NotificationLogFilter({ search, onSearchChange, onReset, onQuery }: Props) {
  const t = useTranslations('admin.notificationLogs')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">{t('channel')}</Label>
        <Select value={search.channel} onValueChange={(v) => onSearchChange({ channel: v })}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            <SelectItem value="email">{t('channelEmail')}</SelectItem>
            <SelectItem value="sms">{t('channelSms')}</SelectItem>
            <SelectItem value="push">{t('channelPush')}</SelectItem>
            <SelectItem value="in_app">{t('channelInApp')}</SelectItem>
            <SelectItem value="webhook">{t('channelWebhook')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('status')}</Label>
        <Select value={search.status} onValueChange={(v) => onSearchChange({ status: v })}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            <SelectItem value="sent">{t('sent')}</SelectItem>
            <SelectItem value="failed">{t('failed')}</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('userId')}</Label>
        <Input
          className="h-9 w-48"
          placeholder={t('userId')}
          value={search.userId}
          onChange={(e) => onSearchChange({ userId: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <DatePicker
          label={t('startTime')}
          value={search.startDate}
          onChange={(v) => onSearchChange({ startDate: v })}
        />
      </div>
      <div className="space-y-1">
        <DatePicker
          label={t('endTime')}
          value={search.endDate}
          min={search.startDate || undefined}
          onChange={(v) => onSearchChange({ endDate: v })}
        />
      </div>
      <Button size="sm" onClick={onQuery}>
        <Search className="h-4 w-4" />
        {t('search')}
      </Button>
      <Button variant="outline" size="sm" onClick={onReset}>
        {t('reset')}
      </Button>
    </div>
  )
}
