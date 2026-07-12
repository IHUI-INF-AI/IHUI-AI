import { z } from 'zod'

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
