'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@ihui/ui-react'

interface BackButtonProps {
  /** 无浏览器历史(直接打开/新标签页)时的降级路由,默认 '/' */
  fallbackHref?: string
  className?: string
}

/**
 * BackButton — 统一的页面返回按钮(2026-08-01 立,修复"子页面无返回按钮"缺陷)
 *
 * 行为:
 * - 优先 router.back()(保留滚动位置 + 浏览器历史)
 * - 无 history(直接打开/新标签页)时降级到 fallbackHref
 * - 复用 common.back i18n key(5 语言 parity,shared 层)
 *
 * 用法:在子页面内容容器顶部插入 `<BackButton />` 作为第一个子元素。
 */
export function BackButton({ fallbackHref = '/', className }: BackButtonProps) {
  const router = useRouter()
  const t = useTranslations('common')

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <Button variant="ghost" size="sm" className={className} onClick={handleBack}>
      <ArrowLeft className="mr-1.5 h-4 w-4 shrink-0" />
      {t('back')}
    </Button>
  )
}
