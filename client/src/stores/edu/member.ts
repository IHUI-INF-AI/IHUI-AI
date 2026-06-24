/**
 * Edu Member store - Member profile + points
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { memberApi, pointApi } from '@/api/edu'
import type { EduMember, EduPointAccount } from '@/api/edu'

export const useEduMemberStore = defineStore('edu-member', () => {
  const member = ref<EduMember | null>(null)
  const pointAccount = ref<EduPointAccount | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadMember() {
    loading.value = true
    try {
      const res = await memberApi.me()
      member.value = res.data?.data ?? null
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function updateMember(data: Partial<EduMember>) {
    try {
      const res = await memberApi.updateMe(data)
      if (res.data?.data) {
        member.value = { ...member.value, ...res.data.data }
      }
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function loadPointAccount() {
    try {
      const res = await pointApi.myAccount()
      pointAccount.value = res.data?.data ?? null
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function earnPoints(amount: number, source: string, remark?: string) {
    try {
      const res = await pointApi.earn({ amount, source, remark })
      if (res.data?.data) {
        pointAccount.value = res.data.data
      }
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function spendPoints(amount: number, source: string, remark?: string) {
    try {
      const res = await pointApi.spend({ amount, source, remark })
      if (res.data?.data) {
        pointAccount.value = res.data.data
      }
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  function reset() {
    member.value = null
    pointAccount.value = null
    error.value = null
  }

  return {
    member,
    pointAccount,
    loading,
    error,
    loadMember,
    updateMember,
    loadPointAccount,
    earnPoints,
    spendPoints,
    reset,
  }
})