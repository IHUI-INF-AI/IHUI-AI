import { Suspense } from 'react'
import PageClient from './PageClient'

// output:'export' 模式要求 useSearchParams() / useLocale() 等动态 API 被 <Suspense> 边界包裹
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  )
}
