/**
 * 佣金计算服务。
 * 迁移自旧架构 commission_service.py（Java ZhsUserServiceImpl.feedbackInvite）。
 * 处理两级分销佣金：父级(parent) + 祖父级(grandparent)。
 *
 * 规则：
 * - 普通用户父级：按被邀请人 token 数 × tokenProportion 返佣
 * - VIP/操盘手父级：按订单金额 × 比例返佣（区分订单类型）
 * - 祖父级（必须为操盘手）：按订单金额 × grand 比例返佣
 */

import {
  createCommissionFlow,
  getParentUsers,
  getActiveProportion,
} from '../db/commission-queries.js';
import { type IdentityProportion } from '@ihui/database';

/** 订单类型映射（与旧架构一致）。 */
const ORDER_TYPE_MEMBERSHIP = 1;
const ORDER_TYPE_TOKEN = 2;
const ORDER_TYPE_ACTIVITY = 3;
const ORDER_TYPE_IDENTITY = 4;

export interface OrderLike {
  id: string;
  amount: number;
  orderType: number;
  productId?: string | null;
}

export interface UserLike {
  id: string;
  tokenQuantity?: number;
}

export interface CommissionFlowInput {
  beneficiaryId: string;
  invitedUserId: string;
  orderId: string;
  amount: number;
  token: number;
  type: number; // 0=regular 1=vip 2=trader
  remark?: string;
}

/** 普通用户父级返佣：token_quantity × tokenProportion / 100。 */
export function calcReturnToken(tokenQuantity: number, proportion: IdentityProportion): number {
  return Math.floor((tokenQuantity * (proportion.tokenProportion ?? 0)) / 100);
}

/**
 * VIP/操盘手父级返佣：按订单金额 × 比例。
 * order_type: 1=会员 2=token 3=活动 4=身份
 */
export function calcReturnVip(
  orderAmount: number,
  orderType: number,
  productId: string,
  isTrader: boolean,
  proportion: IdentityProportion,
): number {
  let ratio = 0;
  if (orderType === ORDER_TYPE_MEMBERSHIP) {
    ratio = isTrader ? proportion.traderVipProportion : proportion.vipProportion;
  } else if (orderType === ORDER_TYPE_TOKEN || orderType === ORDER_TYPE_ACTIVITY) {
    ratio = isTrader ? proportion.traderRoutineProportion : proportion.routineProportion;
  } else if (orderType === ORDER_TYPE_IDENTITY) {
    if (productId === 'VIP') {
      ratio = isTrader ? proportion.traderVipProportion : proportion.vipProportion;
    } else if (productId === 'OPERATE' || productId === 'TRADER') {
      ratio = isTrader ? proportion.traderTraderProportion : proportion.traderProportion;
    }
  }
  return Math.floor((orderAmount * (ratio ?? 0)) / 100);
}

/** 祖父级（操盘手）返佣：按订单金额 × grand 比例。 */
export function calcReturnTrader(
  orderAmount: number,
  orderType: number,
  productId: string,
  proportion: IdentityProportion,
): number {
  let ratio = 0;
  if (orderType === ORDER_TYPE_MEMBERSHIP) {
    ratio = proportion.grandVipProportion;
  } else if (orderType === ORDER_TYPE_TOKEN || orderType === ORDER_TYPE_ACTIVITY) {
    ratio = proportion.grandRoutineProportion;
  } else if (orderType === ORDER_TYPE_IDENTITY) {
    if (productId === 'VIP') {
      ratio = proportion.grandVipProportion;
    } else if (productId === 'OPERATE' || productId === 'TRADER') {
      ratio = proportion.grandTraderProportion;
    }
  }
  return Math.floor((orderAmount * (ratio ?? 0)) / 100);
}

/**
 * 为一笔已支付订单创建佣金流水。
 * @returns 创建的流水数量（0 = 无父级或无配置）
 */
export async function createCommissionFlows(
  user: UserLike,
  order: OrderLike,
): Promise<number> {
  const proportion = await getActiveProportion();
  if (!proportion) return 0;

  const parentUsers = await getParentUsers(user.id);
  if (parentUsers.length === 0) return 0;

  const productId = order.productId ?? '';
  let created = 0;

  // 父级（level 1）
  const parent = parentUsers[0]!;
  const parentIsVip = parent.isVip >= 1;
  if (!parentIsVip) {
    // 普通用户：按 token 返佣
    const token = calcReturnToken(user.tokenQuantity ?? 0, proportion);
    await createCommissionFlow({
      beneficiaryId: parent.userId,
      invitedUserId: user.id,
      orderId: order.id,
      amount: 0,
      token,
      type: 0,
      remark: '普通用户返佣',
    }, null); // 系统自动分佣,operatorId = null
  } else {
    // VIP/操盘手：按金额返佣
    const isTrader = parent.isVip === 2;
    const amount = calcReturnVip(order.amount, order.orderType, productId, isTrader, proportion);
    await createCommissionFlow(
      {
        beneficiaryId: parent.userId,
        invitedUserId: user.id,
        orderId: order.id,
        amount,
        token: 0,
        type: 1,
        remark: isTrader ? '操盘手返佣' : 'VIP返佣',
      },
      null,
    ); // 系统自动分佣,operatorId = null
  }
  created++;

  // 祖父级（level 2，必须存在且为操盘手）
  if (parentUsers.length >= 2) {
    const grand = parentUsers[1]!;
    if (grand.isVip === 2) {
      const amount = calcReturnTrader(order.amount, order.orderType, productId, proportion);
      await createCommissionFlow({
        beneficiaryId: grand.userId,
        invitedUserId: user.id,
        orderId: order.id,
        amount,
        token: 0,
        type: 2,
        remark: '祖父级返佣',
      }, null); // 系统自动分佣,operatorId = null
      created++;
    }
  }

  return created;
}

/**
 * 支付成功后触发返佣（对应旧架构 feedbackInvite）。
 * @returns 创建的流水数量
 */
export async function feedbackInvite(user: UserLike, order: OrderLike): Promise<number> {
  return createCommissionFlows(user, order);
}
