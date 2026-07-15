import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

import { NotFound } from '@/components/common/NotFound'
import { Button } from '@ihui/ui'

export default function ForbiddenPage() {
  return (
    <NotFound
      code={403}
      title="无权限访问"
      description="抱歉,您没有访问该页面的权限。如需开通权限,请联系管理员。"
      action={
        <Button asChild>
          <Link href="/">
            <ShieldAlert className="h-4 w-4" />
            返回首页
          </Link>
        </Button>
      }
    />
  )
}
