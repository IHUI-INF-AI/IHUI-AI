import * as React from 'react'

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-6 md:py-6">
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
