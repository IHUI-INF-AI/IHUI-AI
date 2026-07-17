'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useLoginDialogStore } from '@/stores/login-dialog'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const open = useLoginDialogStore((s) => s.open)

  useEffect(() => {
    open('forgot')
    void router.replace('/')
  }, [open, router])

  return null
}
