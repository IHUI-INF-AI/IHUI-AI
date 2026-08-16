import type { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: '成绩管理',
}

export default function Page() {
  return <PageClient />
}
