'use client'
import Link from 'next/link'
import { Plus, ChevronLeft, Search } from 'lucide-react'
import { selectClass } from '@/lib/edu'
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { useTranslations } from 'next-intl'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  status: string
  onStatusChange: (v: string) => void
  onCreate: () => void
}

export function CertificateFilter({
  search,
  onSearchChange,
  status,
  onStatusChange,
  onCreate,
}: Props) {
  const t = useTranslations('admin.edu.certificate')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu">
          <ChevronLeft className="h-4 w-4" />
          {t('backToEdu')}
        </Link>
      </Button>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
        />
      </div>
      <div className="w-full max-w-[140px]">
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className={selectClass} aria-label={t('status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatus')}</SelectItem>
            <SelectItem value="1">{t('statusValid')}</SelectItem>
            <SelectItem value="0">{t('statusRevoked')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={onCreate} size="sm" className="ml-auto">
        <Plus className="h-4 w-4" />
        {t('issueCertificate')}
      </Button>
    </div>
  )
}
