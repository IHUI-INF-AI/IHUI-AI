'use client'
import Link from 'next/link'
import { ChevronLeft, UserPlus } from 'lucide-react'
import { Button, Input } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'

interface Props {
  classId: string
  onClassIdChange: (v: string) => void
  onAddMember: () => void
}

export function MemberFilter({ classId, onClassIdChange, onAddMember }: Props) {
  const t = useTranslations('admin.eduClassMembers')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu/class">
          <ChevronLeft className="h-4 w-4" />
          {t('backToClass')}
        </Link>
      </Button>
      <div className="w-full max-w-xs">
        <Input
          value={classId}
          onChange={(e) => onClassIdChange(e.target.value)}
          placeholder={t('placeholderClassId')}
          className="h-9"
        />
      </div>
      {classId && (
        <Button onClick={onAddMember} size="sm" className="ml-auto">
          <UserPlus className="h-4 w-4" />
          {t('addMember')}
        </Button>
      )}
    </div>
  )
}
