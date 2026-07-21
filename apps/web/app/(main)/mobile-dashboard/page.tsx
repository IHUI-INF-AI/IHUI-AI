import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { MobileDashboardClient } from './MobileDashboardClient'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('mobileDashboardPage')
  return {
    title: t('title'),
    description: t('subtitle'),
  }
}

export default function MobileDashboardPage() {
  return <MobileDashboardClient />
}
