'use client'

import * as React from 'react'
import Link from 'next/link'
import { User } from 'lucide-react'

import { useAuthStore } from '@/stores/auth'
import { Avatar } from '@/components/data/Avatar'

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <header className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <Avatar src={user?.avatar ?? undefined} name={user?.nickname ?? 'U'} size="md" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold">{user?.nickname ?? '会员'}</p>
          <p className="break-words text-xs text-muted-foreground">
            {user?.phone ?? user?.id ?? '-'}
          </p>
        </div>
        <Link
          href="/vip"
          className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
        >
          <User className="h-3.5 w-3.5" />
          升级会员
        </Link>
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
