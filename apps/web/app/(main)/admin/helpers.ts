import { fetchApi } from '@/lib/api'
import type { AdminStatsResponse, DetailedStats, RawDetailedStats } from './types'

export const EMPTY_STATS: DetailedStats = {
  totals: {
    users: 0,
    projects: 0,
    files: 0,
    orders: 0,
    usersChange: 0,
    projectsChange: 0,
    filesChange: 0,
    ordersChange: 0,
  },
  userGrowth: [],
  projectStatus: [],
  fileTypes: [],
  orderStats: { totalAmount: 0, totalCount: 0, paidCount: 0, pendingCount: 0 },
}

export const RING_COLORS = [
  'var(--color-emerald-500)',
  'var(--color-primary)',
  'var(--color-muted-foreground)',
]

export const RADAR_DATA = [
  { label: 'Sales', value: 5000, max: 10000 },
  { label: 'Administration', value: 7000, max: 20000 },
  { label: 'Information Techology', value: 12000, max: 20000 },
  { label: 'Customer Support', value: 11000, max: 20000 },
  { label: 'Development', value: 15000, max: 20000 },
  { label: 'Marketing', value: 14000, max: 20000 },
]

export const LINE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const EXPECTED_DATA = [120, 82, 91, 154, 162, 140, 145]
export const ACTUAL_DATA = [100, 90, 85, 120, 110, 130, 135]

function projectStatusKey(status: number): string {
  if (status === 1) return 'active'
  if (status === 2) return 'completed'
  return 'archived'
}

function fileTypeKey(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (/^(text\/|application\/(pdf|msword|vnd\.openxmlformats-officedocument))/.test(mimeType))
    return 'document'
  return 'other'
}

function aggregateByKey<T>(rows: T[], keyFn: (r: T) => string): { key: string; value: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = keyFn(r)
    map.set(k, (map.get(k) ?? 0) + ((r as { count: number }).count ?? 0))
  }
  return Array.from(map, ([key, value]) => ({ key, value }))
}

export async function fetchDetailedStats(): Promise<DetailedStats> {
  const [basicRes, detailedRes] = await Promise.all([
    fetchApi<AdminStatsResponse>('/api/admin/stats'),
    fetchApi<RawDetailedStats>('/api/admin/stats/detailed'),
  ])
  if (!basicRes.success) throw new Error(basicRes.error)
  if (!detailedRes.success) throw new Error(detailedRes.error)
  const b = basicRes.data
  const d = detailedRes.data

  const userGrowth = d.userGrowthTrend.map((r) => r.count)
  const projectStatus = aggregateByKey(d.projectDistribution, (r) => projectStatusKey(r.status))
  const fileTypes = aggregateByKey(d.fileTypeDistribution, (r) => fileTypeKey(r.mimeType))
  const totalFiles = d.fileTypeDistribution.reduce((s, r) => s + r.count, 0)

  return {
    totals: {
      users: b.totalUsers,
      projects: b.totalProjects,
      files: totalFiles,
      orders: d.orderStats.total,
      usersChange: b.totalUsersChange,
      projectsChange: b.totalProjectsChange,
      filesChange: 0,
      ordersChange: b.todayRevenueChange,
    },
    userGrowth,
    projectStatus,
    fileTypes,
    orderStats: {
      totalAmount: d.orderStats.totalRevenue,
      totalCount: d.orderStats.total,
      paidCount: d.orderStats.paid,
      pendingCount: d.orderStats.pending,
    },
  }
}

export function buildConic(segments: { value: number }[]): string {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  let acc = 0
  const stops = segments.map((seg, i) => {
    const start = acc
    acc += (seg.value / total) * 100
    return `${RING_COLORS[i % RING_COLORS.length]!} ${start}% ${acc}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}
