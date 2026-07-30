import { Suspense } from 'react'
import PageClient from './PageClient'

export default function Page() {
  return (
    <Suspense>
      <PageClient />
    </Suspense>
  )
}
