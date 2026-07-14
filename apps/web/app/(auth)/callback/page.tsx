import { Suspense } from 'react'
import { OAuthCallbackHandler } from './OAuthCallbackHandler'

export default function CallbackPage() {
  return (
    <Suspense fallback={<OAuthCallbackHandlerLoading />}>
      <OAuthCallbackHandler provider="generic" />
    </Suspense>
  )
}

function OAuthCallbackHandlerLoading() {
  return (
    <div className="space-y-4 p-6 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">正在处理登录...</p>
    </div>
  )
}
