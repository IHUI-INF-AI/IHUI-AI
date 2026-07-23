import { Suspense } from 'react'
import PageClient from './PageClient'

export function generateStaticParams() {
  return []
}

export default function Page() {
  return (
    <Suspense>
      <PageClient />
    </Suspense>
  )
}
