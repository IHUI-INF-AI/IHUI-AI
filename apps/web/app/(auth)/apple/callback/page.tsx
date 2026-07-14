import { Suspense } from 'react'
import { OAuthCallbackHandler } from '../../callback/OAuthCallbackHandler'

export default function AppleCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackHandler provider="apple" />
    </Suspense>
  )
}
