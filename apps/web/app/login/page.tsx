import { Suspense } from 'react'
import PageClient from './PageClient'
import { LoginWithTurnstile } from '@/components/login/LoginWithTurnstile'

// /login 是软路由:不渲染独立页面,挂载时打开全局 LoginDialog + 回到前一页。
// output:'export' 模式要求 useSearchParams() 被 <Suspense> 边界包裹。
//
// Turnstile 集成(2026-07-31):用 LoginWithTurnstile 包裹 PageClient(方案 B - HOC wrapper)。
// - 配置 NEXT_PUBLIC_TURNSTILE_SITE_KEY 时:建立 TurnstileContext + 渲染 TurnstileWidget,
//   深层登录表单可通过 useTurnstile() 拿 token 附带到登录请求;onSubmitCapture 拦截未验证提交。
// - 未配置时:LoginWithTurnstile 直接返回 children,行为完全不变(向后兼容,不阻塞登录)。
export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginWithTurnstile>
        <PageClient />
      </LoginWithTurnstile>
    </Suspense>
  )
}