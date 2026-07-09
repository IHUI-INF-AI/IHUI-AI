import * as React from 'react'
import { Sparkles } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">IHUI AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI SaaS Platform</p>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">{children}</div>
      </div>
    </div>
  )
}
