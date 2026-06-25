/**
 * 积分奖励服务
 * @description 管理用户积分奖励
 */

import { useAuthStore } from '@/stores/auth'
import { getUserTokenBalance, updateUserTokenBalance } from '@/api/agent/agent/agents'
import { logger } from '@/utils/logger'
import { StorageManager } from '@/utils/storage'

export interface RewardConfig {
  tourCompletion: number
  dailyLogin: number
  firstChat: number
}

export interface RewardRecord {
  type: string
  points: number
  timestamp: number
  claimed: boolean
}

const REWARD_CONFIG: RewardConfig = {
  tourCompletion: 100,
  dailyLogin: 10,
  firstChat: 50,
}

const rewardRecordsKey = 'reward_records'

const getRewardRecords = (): RewardRecord[] => {
  return StorageManager.getItem<RewardRecord[]>(rewardRecordsKey) || []
}

const saveRewardRecords = (records: RewardRecord[]) => {
  StorageManager.setItem(rewardRecordsKey, records)
}

const hasClaimedReward = (type: string): boolean => {
  const records = getRewardRecords()
  return records.some(r => r.type === type && r.claimed)
}

const claimReward = async (type: string, points: number): Promise<boolean> => {
  const authStore = useAuthStore()
  const user = authStore.user

  if (!user?.uuid) {
    logger.warn('[RewardService] User not logged in, cannot claim reward')
    return false
  }

  if (hasClaimedReward(type)) {
    logger.debug(`[RewardService] Reward claimed`)
    return false
  }

  try {
    const balanceResponse = await getUserTokenBalance(user.uuid)
    if (balanceResponse.code !== 200 && !balanceResponse.success) {
      logger.error('[RewardService] Failed to get balance')
      return false
    }

    const currentBalance = balanceResponse.data?.balance || 0
    const currentEarned = balanceResponse.data?.total_earned || 0

    const updateResponse = await updateUserTokenBalance(user.uuid, {
      balance: currentBalance + points,
      total_earned: currentEarned + points,
    })

    if (updateResponse.code !== 200 && !updateResponse.success) {
      logger.error('[RewardService] Failed to update balance')
      return false
    }

    const records = getRewardRecords()
    records.push({
      type,
      points,
      timestamp: Date.now(),
      claimed: true,
    })
    saveRewardRecords(records)

    logger.debug(`[RewardService] Reward claimed successfully: ${type}, +${points} points`)
    return true
  } catch (error) {
    logger.error('[RewardService] Failed to claim reward:', error)
    return false
  }
}

export function useRewardService() {
  const claimTourCompletionReward = async (): Promise<{ success: boolean; points: number }> => {
    const points = REWARD_CONFIG.tourCompletion
    const success = await claimReward('tour_completion', points)
    return { success, points }
  }

  const claimDailyLoginReward = async (): Promise<{ success: boolean; points: number }> => {
    const today = new Date().toDateString()
    const type = `daily_login_${today}`
    const points = REWARD_CONFIG.dailyLogin
    const success = await claimReward(type, points)
    return { success, points }
  }

  const claimFirstChatReward = async (): Promise<{ success: boolean; points: number }> => {
    const points = REWARD_CONFIG.firstChat
    const success = await claimReward('first_chat', points)
    return { success, points }
  }

  const getRewardConfig = () => REWARD_CONFIG

  const hasClaimedTourReward = () => hasClaimedReward('tour_completion')

  return {
    claimTourCompletionReward,
    claimDailyLoginReward,
    claimFirstChatReward,
    getRewardConfig,
    hasClaimedTourReward,
  }
}

export const rewardService = {
  config: REWARD_CONFIG,
  hasClaimedReward,
  claimReward,
}
