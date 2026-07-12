import { z } from 'zod'

export const MOCK_ROUTINES = [
  { id: 'r1', name: '每日早报摘要', schedule: '每天 08:00', enabled: true, lastRun: '今日 08:00' },
  { id: 'r2', name: '周报自动生成', schedule: '每周一 09:00', enabled: false },
]

export const profileSchema = z.object({
  nickname: z.string().min(2).max(20),
  email: z.string().email(),
  bio: z.string().max(200).optional().or(z.literal('')),
})

export type ProfileForm = z.infer<typeof profileSchema>

export interface UserStats {
  followingCount: number
  followersCount: number
  favoritesCount: number
}

export interface ProfileResponse {
  user: {
    nickname: string
    phone: string
    email: string
    bio: string
  }
  stats: UserStats
}

export interface ChatHistoryItem {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  model: string
}

export interface ChatHistoryData {
  list: ChatHistoryItem[]
  total: number
}
