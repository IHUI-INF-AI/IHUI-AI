// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plan 本地 store 纯逻辑核心(与 web 端 apps/web/src/lib/plan-store.ts 同源语义)。
 *
 * web 端用 zustand + persist(localStorage);RN 端无 zustand 依赖需求,这里提供
 * 框架无关的最小实现:内存 plans 数组 + subscribe/getSnapshot(useSyncExternalStore 兼容)
 * + 可注入异步 storage(AsyncStorage 由 RN 薄壳传入,共享层不引 RN 存储依赖)。
 * 持久化键与 partialize 形态与 web 端一致({ plans } 单键 'ihui-plans'),
 * 后续 API 端 plan 路由补齐时可平滑迁移到服务端数据源。
 */
import type {
  PlanCreateInput,
  PlanDocument,
  PlanProgressStats,
  PlanStep,
  PlanStepUpdateInput,
} from '@ihui/shared/plan'

/** 异步键值存储契约(AsyncStorage / localStorage 均可适配;getItem 缺键返回 null)。 */
export interface PlanStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

/** 与 web 端 plan-store.ts generateId 同语义(crypto.randomUUID 优先,回退时间戳+随机)。 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** 进度统计(与 web 端 computeStats 逐行同口径)。 */
export function computePlanStats(steps: PlanStep[]): PlanProgressStats {
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

const EMPTY_STATS: PlanProgressStats = {
  total: 0,
  completed: 0,
  inProgress: 0,
  blocked: 0,
  pending: 0,
  completionPercent: 0,
}

/** 持久化载荷防御校验(坏数据整条丢弃,与 web 端 persist 反序列化容错同思路)。 */
function isValidPlan(value: unknown): value is PlanDocument {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['id'] === 'string' &&
    typeof v['title'] === 'string' &&
    typeof v['goal'] === 'string' &&
    typeof v['status'] === 'string' &&
    Array.isArray(v['steps'])
  )
}

export interface PlanLocalStoreOptions {
  storage?: PlanStorage
  /** 与 web 端 createPersistConfig('ihui-plans') 同键 */
  storageKey?: string
}

/**
 * 创建本地计划 store(单例语义由调用方保证:RN 薄壳在模块层建一次,三屏共享)。
 *
 * 变更操作全部同步改内存并通知订阅者,持久化为 fire-and-forget;
 * 未 hydrate 前的写入只改内存,hydrate 完成后统一补写一次,
 * 避免「冷启动直接进新建页 → 空数组覆盖已存数据」。
 */
export function createPlanLocalStore(options: PlanLocalStoreOptions = {}) {
  const storage = options.storage
  const storageKey = options.storageKey ?? 'ihui-plans'

  let plans: PlanDocument[] = []
  let hydrated = false
  let hydrating = false
  let dirtyBeforeHydrate = false
  const listeners = new Set<() => void>()

  function notify() {
    listeners.forEach((fn) => fn())
  }

  function persist() {
    if (storage === undefined) return
    if (!hydrated) {
      dirtyBeforeHydrate = true
      return
    }
    void storage.setItem(storageKey, JSON.stringify({ plans })).catch(() => {
      /* 存储失败不回滚内存态(与 web 端 localStorage 配额失败口径一致) */
    })
  }

  function setPlans(next: PlanDocument[]) {
    plans = next
    notify()
    persist()
  }

  return {
    /** useSyncExternalStore 快照:引用在未变更前保持稳定。 */
    getSnapshot(): PlanDocument[] {
      return plans
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /**
     * 从 storage 读回(幂等,多屏共用单例时只生效一次;并发调用去重)。
     * 水合完成前若已有写入(冷启动深链直达新建页),以内存态为准补写存储,
     * 不用旧存储覆盖新计划;薄壳在 hydrate resolve 前不渲染可写表单。
     */
    async hydrate(): Promise<void> {
      if (hydrated || hydrating || storage === undefined) return
      hydrating = true
      try {
        const raw = await storage.getItem(storageKey)
        if (!dirtyBeforeHydrate && raw !== null) {
          const parsed: unknown = JSON.parse(raw)
          const list =
            typeof parsed === 'object' && parsed !== null
              ? (parsed as { plans?: unknown }).plans
              : undefined
          if (Array.isArray(list)) {
            plans = list.filter(isValidPlan)
            notify()
          }
        }
      } catch {
        /* 解析失败保持空列表,等同首次使用 */
      } finally {
        hydrating = false
        hydrated = true
      }
      if (dirtyBeforeHydrate) {
        void storage.setItem(storageKey, JSON.stringify({ plans })).catch(() => undefined)
      }
    },

    /** 与 web 端 usePlanStore.create 同语义:新计划置顶,status=draft,返回 id。 */
    create(input: PlanCreateInput): string {
      const id = generateId()
      const now = new Date().toISOString()
      const plan: PlanDocument = {
        id,
        title: input.title,
        goal: input.goal,
        scope: input.scope,
        constraints: input.constraints,
        steps: (input.steps ?? []).map((s, i) => ({ ...s, id: generateId(), order: i })),
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        tags: input.tags,
      }
      setPlans([plan, ...plans])
      return id
    },

    update(id: string, patch: Partial<PlanDocument>) {
      setPlans(
        plans.map((p) =>
          p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
        ),
      )
    },

    remove(id: string) {
      setPlans(plans.filter((p) => p.id !== id))
    },

    addStep(planId: string, step: Omit<PlanStep, 'id' | 'order'>) {
      setPlans(
        plans.map((p) => {
          if (p.id !== planId) return p
          const newStep: PlanStep = { ...step, id: generateId(), order: p.steps.length }
          return { ...p, steps: [...p.steps, newStep], updatedAt: new Date().toISOString() }
        }),
      )
    },

    updateStep(planId: string, stepId: string, patch: PlanStepUpdateInput) {
      setPlans(
        plans.map((p) => {
          if (p.id !== planId) return p
          return {
            ...p,
            steps: p.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st)),
            updatedAt: new Date().toISOString(),
          }
        }),
      )
    },

    removeStep(planId: string, stepId: string) {
      setPlans(
        plans.map((p) => {
          if (p.id !== planId) return p
          const reordered = p.steps
            .filter((st) => st.id !== stepId)
            .map((st, i) => ({ ...st, order: i }))
          return { ...p, steps: reordered, updatedAt: new Date().toISOString() }
        }),
      )
    },

    reorderSteps(planId: string, stepIds: string[]) {
      setPlans(
        plans.map((p) => {
          if (p.id !== planId) return p
          const map = new Map(p.steps.map((st) => [st.id, st]))
          const reordered: PlanStep[] = []
          stepIds.forEach((sid, i) => {
            const step = map.get(sid)
            if (step) reordered.push({ ...step, order: i })
          })
          return { ...p, steps: reordered, updatedAt: new Date().toISOString() }
        }),
      )
    },

    getStats(planId: string): PlanProgressStats {
      const plan = plans.find((p) => p.id === planId)
      return plan ? computePlanStats(plan.steps) : EMPTY_STATS
    },
  }
}

export type PlanLocalStore = ReturnType<typeof createPlanLocalStore>
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
