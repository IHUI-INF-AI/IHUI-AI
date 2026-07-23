/**
 * Plan 模式本地状态管理(zustand + persist localStorage)。
 *
 * 由于 API 端 plan 路由尚未补齐,前端先用本地状态管理 + localStorage 持久化,
 * 后续接入 API 时可平滑迁移到服务端数据源。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  PlanDocument,
  PlanCreateInput,
  PlanStep,
  PlanStepUpdateInput,
  PlanProgressStats,
} from '@ihui/shared/plan/index'
import { createPersistConfig } from '@/stores/persist-helpers'

interface PlanState {
  plans: PlanDocument[]
  create: (input: PlanCreateInput) => string
  update: (id: string, patch: Partial<PlanDocument>) => void
  remove: (id: string) => void
  addStep: (planId: string, step: Omit<PlanStep, 'id' | 'order'>) => void
  updateStep: (planId: string, stepId: string, patch: PlanStepUpdateInput) => void
  removeStep: (planId: string, stepId: string) => void
  reorderSteps: (planId: string, stepIds: string[]) => void
  getStats: (planId: string) => PlanProgressStats
}

/** 浏览器安全的 ID 生成器(crypto.randomUUID 优先,fallback 到时间戳+随机) */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function computeStats(steps: PlanStep[]): PlanProgressStats {
  const total = steps.length
  const completed = steps.filter((s) => s.status === 'completed').length
  const inProgress = steps.filter((s) => s.status === 'in_progress').length
  const blocked = steps.filter((s) => s.status === 'blocked').length
  const pending = steps.filter((s) => s.status === 'pending').length
  return {
    total,
    completed,
    inProgress,
    blocked,
    pending,
    completionPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      plans: [],
      create: (input) => {
        const id = generateId()
        const now = new Date().toISOString()
        const plan: PlanDocument = {
          id,
          title: input.title,
          goal: input.goal,
          scope: input.scope,
          constraints: input.constraints,
          steps: (input.steps ?? []).map((s, i) => ({
            ...s,
            id: generateId(),
            order: i,
          })),
          status: 'draft',
          createdAt: now,
          updatedAt: now,
          tags: input.tags,
        }
        set((s) => ({ plans: [plan, ...s.plans] }))
        return id
      },
      update: (id, patch) =>
        set((s) => ({
          plans: s.plans.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
          ),
        })),
      remove: (id) => set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })),
      addStep: (planId, step) =>
        set((s) => ({
          plans: s.plans.map((p) => {
            if (p.id !== planId) return p
            const newStep: PlanStep = { ...step, id: generateId(), order: p.steps.length }
            return { ...p, steps: [...p.steps, newStep], updatedAt: new Date().toISOString() }
          }),
        })),
      updateStep: (planId, stepId, patch) =>
        set((s) => ({
          plans: s.plans.map((p) => {
            if (p.id !== planId) return p
            return {
              ...p,
              steps: p.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st)),
              updatedAt: new Date().toISOString(),
            }
          }),
        })),
      removeStep: (planId, stepId) =>
        set((s) => ({
          plans: s.plans.map((p) => {
            if (p.id !== planId) return p
            const filtered = p.steps.filter((st) => st.id !== stepId)
            const reordered = filtered.map((st, i) => ({ ...st, order: i }))
            return { ...p, steps: reordered, updatedAt: new Date().toISOString() }
          }),
        })),
      reorderSteps: (planId, stepIds) =>
        set((s) => ({
          plans: s.plans.map((p) => {
            if (p.id !== planId) return p
            const map = new Map(p.steps.map((st) => [st.id, st]))
            const reordered: PlanStep[] = []
            stepIds.forEach((id, i) => {
              const step = map.get(id)
              if (step) reordered.push({ ...step, order: i })
            })
            return { ...p, steps: reordered, updatedAt: new Date().toISOString() }
          }),
        })),
      getStats: (planId) => {
        const plan = get().plans.find((p) => p.id === planId)
        return plan ? computeStats(plan.steps) : {
          total: 0, completed: 0, inProgress: 0, blocked: 0, pending: 0, completionPercent: 0,
        }
      },
    }),
    createPersistConfig<PlanState>('ihui-plans', (s) => ({ plans: s.plans })),
  ),
)
