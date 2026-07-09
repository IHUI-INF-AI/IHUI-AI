import type { UserPoints, PointTransaction } from '@ihui/database';
import { adjustPoints } from '../db/gamification-queries.js';

export interface PointsResult {
  points: UserPoints;
  transaction: PointTransaction;
}

/**
 * 获得积分：增加余额、累计、经验，记录流水，并按经验更新等级。
 * 等级更新已在 adjustPoints 事务内同步完成,无需外部调用 updateLevel。
 */
export async function earnPoints(
  userId: string,
  amount: number,
  source: string,
  description?: string,
  referenceId?: string,
): Promise<PointsResult> {
  if (amount <= 0) throw new Error('获得积分必须为正数');
  return adjustPoints({
    userId,
    type: 'earn',
    amount,
    source,
    description,
    referenceId,
  });
}

/**
 * 消费积分：检查余额，扣减余额与累计消费，记录流水（不影响经验）。
 */
export async function spendPoints(
  userId: string,
  amount: number,
  source: string,
  description?: string,
  referenceId?: string,
): Promise<PointsResult> {
  if (amount <= 0) throw new Error('消费积分必须为正数');
  return adjustPoints({
    userId,
    type: 'spend',
    amount,
    source,
    description,
    referenceId,
  });
}
