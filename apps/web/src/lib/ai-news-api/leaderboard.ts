import { safeApi } from './http'
import type { LeaderboardCategory, LeaderboardEntry } from './types'
import { FALLBACK_LEADERBOARD_PART_1 } from './leaderboard-parts/part-1'
import { FALLBACK_LEADERBOARD_PART_2 } from './leaderboard-parts/part-2'
import { FALLBACK_LEADERBOARD_PART_3 } from './leaderboard-parts/part-3'
import { FALLBACK_LEADERBOARD_PART_4 } from './leaderboard-parts/part-4'
import { FALLBACK_LEADERBOARD_PART_5 } from './leaderboard-parts/part-5'

export const FALLBACK_LEADERBOARD: LeaderboardEntry[] = [
  ...FALLBACK_LEADERBOARD_PART_1,
  ...FALLBACK_LEADERBOARD_PART_2,
  ...FALLBACK_LEADERBOARD_PART_3,
  ...FALLBACK_LEADERBOARD_PART_4,
  ...FALLBACK_LEADERBOARD_PART_5,
]

export async function fetchLeaderboard(
  category: LeaderboardCategory = 'overall',
  subcategory?: string,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams({
    category,
    limit: String(limit),
  })
  if (subcategory) params.set('subcategory', subcategory)
  const data = await safeApi<{ list: LeaderboardEntry[]; total: number }>(
    `/api/model-leaderboard?${params.toString()}`,
  )
  return data?.list ?? []
}

export async function fetchLeaderboardEntry(modelId: string): Promise<LeaderboardEntry | null> {
  const data = await safeApi<{ entry: LeaderboardEntry }>(
    `/api/model-leaderboard/${encodeURIComponent(modelId)}`,
  )
  return data?.entry ?? null
}

export async function fetchAllLeaderboardEntries(): Promise<LeaderboardEntry[]> {
  const cats: Array<[LeaderboardCategory, string?]> = [
    ['overall'],
    ['llm', 'general'],
    ['llm', 'coding'],
    ['llm', 'reasoning'],
    ['image'],
    ['video'],
    ['multimodal'],
    ['audio'],
    ['embedding'],
    ['agent'],
  ]
  const results = await Promise.all(cats.map(([c, s]) => fetchLeaderboard(c, s, 30)))
  const merged = results.flat()
  if (merged.length > 0) return merged
  return FALLBACK_LEADERBOARD
}
