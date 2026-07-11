'use client'

import * as React from 'react'

import { getInviteInfo, type InviteInfo } from '@/lib/distribution-api'
import { useToast } from '@/hooks/use-toast'

export interface UseDistributionInviteReturn {
  inviteInfo: InviteInfo | null
  loading: boolean
  fetchInviteInfo: () => Promise<void>
  copyInviteCode: () => Promise<boolean>
}

/** 分销邀请 Hook，获取邀请码/链接并支持复制 */
export function useDistributionInvite(): UseDistributionInviteReturn {
  const toast = useToast()
  const [inviteInfo, setInviteInfo] = React.useState<InviteInfo | null>(null)
  const [loading, setLoading] = React.useState(false)

  const fetchInviteInfo = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await getInviteInfo()
      if (res.success) setInviteInfo(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  const copyInviteCode = React.useCallback(async (): Promise<boolean> => {
    if (!inviteInfo) return false
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteInfo.inviteUrl)
      }
      toast.success('邀请链接已复制')
      return true
    } catch {
      toast.error('复制失败，请手动复制')
      return false
    }
  }, [inviteInfo, toast])

  return { inviteInfo, loading, fetchInviteInfo, copyInviteCode }
}
