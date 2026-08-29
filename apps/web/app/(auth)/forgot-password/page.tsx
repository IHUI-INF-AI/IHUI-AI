'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useLoginDialogStore } from '@/stores/login-dialog'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const open = useLoginDialogStore((s) => s.open)

  useEffect(() => {
    open('forgot')
    // 延迟一帧导航(2026-08-29):与 login 页同一治理——挂载期立即 replace
    // 会命中 Next.js Router 初始化窗口("Router action dispatched before initialization")。
    const raf = requestAnimationFrame(() => {
      void router.replace('/')
    })
    return () => cancelAnimationFrame(raf)
  }, [open, router])

  return null
}
