import * as React from 'react'
import { AdminNav } from '@/components/layout/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminNav>{children}</AdminNav>
}
