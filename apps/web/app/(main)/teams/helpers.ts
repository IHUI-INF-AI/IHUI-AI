import { fetchApi } from '@/lib/api'
import type { TeamItem } from './types'

export async function fetchTeams(): Promise<TeamItem[]> {
  const res = await fetchApi<{ teams: TeamItem[] }>('/api/teams')
  if (!res.success) throw new Error(res.error)
  return res.data.teams
}

export async function createTeam(input: {
  name: string
  slug: string
  description?: string
}): Promise<TeamItem> {
  const res = await fetchApi<{ team: TeamItem }>('/api/teams', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data.team
}
