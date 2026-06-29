import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import type { UserFundInfo } from '@/api/user'
import { getStoredData } from '@/utils/request'

export const useWalletStore = defineStore('wallet', () => {
  const fundInfo = ref<UserFundInfo | null>(null)

  const balance = computed(() => fundInfo.value?.balance || 0)
  const frozenAmount = computed(() => fundInfo.value?.frozenAmount || 0)
  const totalRecharge = computed(() => fundInfo.value?.totalRecharge || 0)
  const totalConsumption = computed(() => fundInfo.value?.totalConsumption || 0)

  const setFundInfo = (info: UserFundInfo) => {
    fundInfo.value = info
    const storedData = getStoredData()
    if (storedData) {
      ;(storedData as Record<string, unknown>).fundInfo = info
      StorageManager.setItem(STORAGE_KEYS.USER_DATA, storedData)
    }
  }

  const updateBalance = (newBalance: number) => {
    if (fundInfo.value) {
      fundInfo.value.balance = newBalance
      setFundInfo(fundInfo.value)
    }
  }

  const consumeBalance = (amount: number): boolean => {
    if (fundInfo.value && fundInfo.value.balance >= amount) {
      fundInfo.value.balance -= amount
      fundInfo.value.totalConsumption += amount
      setFundInfo(fundInfo.value)
      return true
    }
    return false
  }

  const rechargeBalance = (amount: number) => {
    if (fundInfo.value) {
      fundInfo.value.balance += amount
      fundInfo.value.totalRecharge += amount
      setFundInfo(fundInfo.value)
    }
  }

  const restoreFundInfo = () => {
    const storedUserData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
    if (storedUserData?.fundInfo) {
      fundInfo.value = storedUserData.fundInfo as UserFundInfo
    }
  }

  const clearFundInfo = () => {
    fundInfo.value = null
  }

  return {
    fundInfo,
    balance,
    frozenAmount,
    totalRecharge,
    totalConsumption,
    setFundInfo,
    updateBalance,
    consumeBalance,
    rechargeBalance,
    restoreFundInfo,
    clearFundInfo,
  }
})
