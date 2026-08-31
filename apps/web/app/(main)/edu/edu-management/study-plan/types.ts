// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi } from '@/lib/api'

/* ─── Types ─── */

export interface Term {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  createdAt: string
  updatedAt: string
}

export interface EduClass {
  id: string
  termId: string
  name: string
  grade: string | null
  createdAt: string
  updatedAt: string
}

export type PlanType = 'monthly' | 'weekly'
export type PlanStatus = 'draft' | 'active' | 'completed' | 'archived'

export interface StudyPlan {
  id: string
  title: string
  planType: PlanType
  classId: string
  termId: string
  startDate: string
  endDate: string
  description: string | null
  status: PlanStatus
  parentPlanId: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PlanItem {
  id: string
  planId: string
  content: string
  objective: string | null
  notes: string | null
  dueDate: string | null
  studentId: string | null
  parentItemId: string | null
  completed: boolean
  completedAt: string | null
  sortOrder: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

/* ─── API helper ─── */

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/* ─── Constants ─── */

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  monthly: '月计划',
  weekly: '周计划',
}

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: '草稿',
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
}

export const PLAN_STATUS_VARIANTS: Record<PlanStatus, string> = {
  draft: 'bg-gray-200 text-gray-700 border-gray-300',
  active: 'bg-blue-100 text-blue-700 border-blue-300',
  completed: 'bg-green-100 text-green-700 border-green-300',
  archived: 'bg-gray-100 text-gray-500 border-gray-200',
}

export const STATUS_ORDER: PlanStatus[] = ['draft', 'active', 'completed', 'archived']

/* ─── Helpers ─── */

export function formatDateDisplay(dateStr: string): string {
  return dateStr.split('-').slice(0, 2).join('-')
}

export function formatDateFull(dateStr: string): string {
  return dateStr
}

export function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ─── Types for form data ─── */

export interface StudyPlanFormData {
  title: string
  planType: PlanType
  classId: string
  termId: string
  startDate: string
  endDate: string
  description: string
}

export const emptyPlanForm: StudyPlanFormData = {
  title: '',
  planType: 'monthly',
  classId: '',
  termId: '',
  startDate: '',
  endDate: '',
  description: '',
}

export interface PlanItemFormData {
  content: string
  objective: string
  dueDate: string
  notes: string
  completed: boolean
}

export const emptyItemForm: PlanItemFormData = {
  content: '',
  objective: '',
  dueDate: '',
  notes: '',
  completed: false,
}

/* ─── API response types ─── */

export interface CompletionStatsResponse {
  overallRate: number
  totalItems: number
  totalCompleted: number
  plans: Array<{
    planId: string
    planTitle: string
    planType: string
    status: string
    totalItems: number
    completedItems: number
    completionRate: number
  }>
}

export interface ProgressTimelineResponse {
  plan: { id: string; title: string; planType: string; startDate: string; endDate: string }
  totalItems: number
  completedItems: number
  completionRate: number
  timeline: Array<{
    date: string
    items: Array<{ id: string; content: string; completedAt: string }>
  }>
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
