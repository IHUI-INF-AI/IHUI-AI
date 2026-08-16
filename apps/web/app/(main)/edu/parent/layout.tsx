import * as React from 'react'

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
}
