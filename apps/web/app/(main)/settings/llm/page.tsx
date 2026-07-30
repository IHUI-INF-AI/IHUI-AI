import { Suspense } from 'react'
import PageClient from './PageClient'
import { ByokWizard } from './byok-wizard'

// A 套壳:output:'export' 模式要求 useSearchParams() 被 <Suspense> 边界包裹
// ByokWizard 挂载浮动按钮(小白一键配置向导),FAB fixed 定位不干扰现有布局
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
      <ByokWizard />
    </Suspense>
  )
}
