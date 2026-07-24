import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ShieldAlert } from 'lucide-react'

import { NotFound } from '@/components/common/NotFound'
import { Button } from '@ihui/ui-react'

export default async function ForbiddenPage() {
  const t = await getTranslations('forbidden')

  return (
    <NotFound
      code={403}
      title={t('title')}
      description={t('description')}
      action={
        <Button asChild>
          <Link href="/">
            <ShieldAlert className="h-4 w-4" />
            {t('backToHome')}
          </Link>
        </Button>
      }
    />
  )
}
