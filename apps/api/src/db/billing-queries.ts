import { eq, asc } from 'drizzle-orm';
import { db } from './index.js';
import { plans } from '@ihui/database';

// =============================================================================
// 公开字段选择：精确选字段，避免泄露敏感信息
// =============================================================================

const planFields = {
  id: plans.id,
  name: plans.name,
  description: plans.description,
  price: plans.price,
  interval: plans.interval,
  features: plans.features,
  isActive: plans.isActive,
  sortOrder: plans.sortOrder,
  createdAt: plans.createdAt,
  updatedAt: plans.updatedAt,
};

export type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: string;
  features: unknown;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

// =============================================================================
// Plans
// =============================================================================

/**
 * 查询所有启用的订阅方案（按 sort_order 升序）。
 */
export async function findPlans(): Promise<PlanRow[]> {
  return db
    .select(planFields)
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(asc(plans.sortOrder));
}

/**
 * 按 id 查询方案。
 */
export async function findPlanById(id: string): Promise<PlanRow | undefined> {
  const rows = await db.select(planFields).from(plans).where(eq(plans.id, id)).limit(1);
  return rows[0];
}
