import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import type { UserVipInfo } from '@/api/user/user'
import { getStoredData } from '@/utils/request'

export const useVipStore = defineStore('vip', () => {
  const vipInfo = ref<UserVipInfo | null>(null)

  const vipLevel = computed(() => vipInfo.value?.vipLevelName || vipInfo.value?.vipLevelId || '')
  const isVipActive = computed(() => vipInfo.value?.isActive || false)
  const vipEndTime = computed(() => vipInfo.value?.endTime || '')

  const setVipInfo = (info: UserVipInfo) => {
    vipInfo.value = info
    const storedData = getStoredData()
    if (storedData) {
      ;(storedData as Record<string, unknown>).vipInfo = info
      StorageManager.setItem(STORAGE_KEYS.USER_DATA, storedData)
    }
  }

  const restoreVipInfo = () => {
    const storedUserData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
    if (storedUserData?.vipInfo) {
      vipInfo.value = storedUserData.vipInfo as UserVipInfo
    }
  }

  const clearVipInfo = () => {
    vipInfo.value = null
  }

  return {
    vipInfo,
    vipLevel,
    isVipActive,
    vipEndTime,
    setVipInfo,
    restoreVipInfo,
    clearVipInfo,
  }
})
