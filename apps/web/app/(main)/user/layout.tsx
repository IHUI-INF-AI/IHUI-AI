import * as React from 'react'
import { UserNav } from '@/components/layout/UserNav'

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <UserNav>{children}</UserNav>
}
