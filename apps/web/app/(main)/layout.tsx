import * as React from 'react'
import { MainShell } from '@/components/layout/MainShell'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:shadow"
      >
        跳到主内容
      </a>
      <MainShell>{children}</MainShell>
    </>
  )
}
