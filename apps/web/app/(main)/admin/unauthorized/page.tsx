'use client'

import { ShieldX, ArrowLeft, Home } from 'lucide-react'
import { Button } from '@ihui/ui'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <ShieldX className="mx-auto h-16 w-16 text-muted-foreground/40" />
          <h1 className="text-6xl font-bold tracking-tight text-muted-foreground">401</h1>
          <h2 className="text-lg font-semibold">无访问权限</h2>
          <p className="text-sm text-muted-foreground">
            抱歉,您没有权限访问此页面。请联系管理员获取相应权限。
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
            返回上一页
          </Button>
          <Button asChild>
            <a href="/admin">
              <Home className="h-4 w-4" />
              返回首页
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
