import { Suspense } from 'react'
import { OAuthCallbackHandler } from '../../callback/OAuthCallbackHandler'

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackHandler provider="google" />
    </Suspense>
  )
}
