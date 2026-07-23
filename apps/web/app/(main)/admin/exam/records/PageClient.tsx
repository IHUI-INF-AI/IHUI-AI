'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * A 套壳:output:export 不支持 searchParams: Promise + redirect() SSR API
 * 改为客户端重定向:读 URLSearchParams → router.replace 到新路径
 */
export default function ExamRecordsRedirectClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const qs = new URLSearchParams()
    searchParams.forEach((value, key) => {
      qs.append(key, value)
    })
    const query = qs.toString()
    router.replace(`/admin/edu/exam/records${query ? `?${query}` : ''}`)
  }, [router, searchParams])

  return null
}
