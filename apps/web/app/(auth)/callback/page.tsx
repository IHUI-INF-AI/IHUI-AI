import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
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
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">正在处理登录...</p>
    </div>
  )
}
