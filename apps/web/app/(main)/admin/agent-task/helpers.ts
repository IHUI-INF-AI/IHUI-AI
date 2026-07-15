import { fetchApi } from '@/lib/api'
import { TONE } from '@/lib/status-colors'
import type { AgentTask, AgentTaskForm } from './types'

export const PAGE_SIZE = 10

export const STATUS_STYLE: Record<number, string> = {
  0: TONE.amber,
  1: TONE.red,
  2: TONE.emerald,
  3: TONE.amber,
  4: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  5: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  6: TONE.muted,
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: AgentTaskForm = {
  title: '',
  context: '',
  lowestPrice: '',
  peakPrice: '',
  cycle: '',
  cycleUnit: '',
  closingTime: '',
}

export function getStatusMap(t: (key: string) => string): Record<number, string> {
  return {
    0: t('status0'),
    1: t('status1'),
    2: t('status2'),
    3: t('status3'),
    4: t('status4'),
    5: t('status5'),
    6: t('status6'),
  }
}

export function getExportColumns(t: (key: string) => string) {
  const statusMap = getStatusMap(t)
  return [
    { key: 'id', title: 'ID' },
    { key: 'title', title: t('colTitle') },
    { key: 'context', title: t('colContext') },
    { key: 'createdName', title: t('colCreator') },
    { key: 'closingTime', title: t('colClosingTime') },
    { key: 'cycle', title: t('colCycleFull') },
    { key: 'lowestPrice', title: t('colLowestPrice') },
    { key: 'peakPrice', title: t('colPeakPrice') },
    {
      key: 'status',
      title: t('colStatus'),
      formatter: (v: unknown) => statusMap[v as number] ?? '-',
    },
    { key: 'createdAt', title: t('colCreatedAt') },
  ]
}

export function agentTaskToForm(item: AgentTask): AgentTaskForm {
  return {
    title: item.title ?? '',
    context: item.context ?? '',
    lowestPrice: item.lowestPrice ?? '',
    peakPrice: item.peakPrice ?? '',
    cycle: item.cycle ?? '',
    cycleUnit: item.cycleUnit ?? '',
    closingTime: item.closingTime ?? '',
  }
}
