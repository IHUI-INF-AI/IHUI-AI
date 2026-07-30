import { Suspense } from 'react'
import PageClient from './PageClient'

// /login 是软路由:不渲染独立页面,挂载时打开全局 LoginDialog + 回到前一页。
// output:'export' 模式要求 useSearchParams() 被 <Suspense> 边界包裹。
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  )
}
