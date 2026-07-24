import { Suspense } from 'react'
import PageClient from './PageClient'

// A 套壳:output:'export' 模式要求 useSearchParams() 被 <Suspense> 边界包裹
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  )
}
