import * as React from 'react'

import { ModelsSidebar } from './ModelsSidebar'

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl gap-0 px-0 md:px-4 md:py-2">
      <ModelsSidebar />
      <main className="min-w-0 flex-1 px-4 py-2 md:px-6 md:py-4">{children}</main>
    </div>
  )
}
