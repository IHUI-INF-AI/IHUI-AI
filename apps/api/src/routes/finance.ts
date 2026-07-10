import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../plugins/auth.js';
import { success, error } from '../utils/response.js';
import {
  getBalance,
  rechargeToken,
  deductToken,
  refundToken,
  expireToken,
  listTokenFlows,
  listCommissionFlows,
  commissionSummary,
  applyWithdrawal,
  listWithdrawals,
  withdrawalSummary,
  availableWithdrawal,
  listSubordinates,
  teamCenter,
} from '../db/commission-queries.js';
import { feedbackInvite } from '../services/commission-service.js';
import { orders } from '@ihui/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';

export const financeRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // Token 钱包余额
  // ==========================================================================

  server.get('/finance/margin/balance', async (request, reply) => {
    await authenticate(request);
    const userId = request.userId!;
    const balance = await getBalance(userId);
    return reply.send(success({ balance }));
  });

  server.get('/finance/margin/check', async (request, reply) => {
    await authenticate(request);
    const { minTokens } = request.query as { minTokens: string };
    const userId = request.userId!;
    const balance = await getBalance(userId);
    return reply.send(success({ sufficient: balance >= parseInt(minTokens, 10), balance }));
  });

  server.post('/finance/margin/deduct', async (request, reply) => {
    await authenticate(request);
    const { quantity, remark = '' } = request.query as { quantity: string; remark?: string };
    const userId = request.userId!;
    const balance = await deductToken(userId, parseInt(quantity, 10), remark);
    return reply.send(success({ balance }));
  });

  server.post('/finance/margin/recharge', async (request, reply) => {
    await authenticate(request);
    const { quantity, outTradeNo } = request.query as { quantity: string; outTradeNo: string };
    const userId = request.userId!;
    const balance = await rechargeToken(userId, parseInt(quantity, 10), outTradeNo);
    return reply.send(success({ balance }));
  });

  server.post('/finance/margin/expire', async (request, reply) => {
    await authenticate(request);
    const { quantity, source = '到期清零' } = request.query as { quantity: string; source?: string };
    const userId = request.userId!;
    const balance = await expireToken(userId, parseInt(quantity, 10), source);
    return reply.send(success({ balance }));
  });

  server.post('/finance/margin/commission', async (request, reply) => {
    await authenticate(request);
    const { quantity, invitedUserId = '', source = 'invite' } = request.query as {
      quantity: string;
      invitedUserId?: string;
      source?: string;
    };
    void invitedUserId;
    const userId = request.userId!;
    const balance = await rechargeToken(userId, parseInt(quantity, 10), undefined, source);
    return reply.send(success({ balance }));
  });

  server.post('/finance/margin/refund', async (request, reply) => {
    await authenticate(request);
    const { quantity, remark = '' } = request.query as { quantity: string; remark?: string };
    const userId = request.userId!;
    const balance = await refundToken(userId, parseInt(quantity, 10), remark);
    return reply.send(success({ balance }));
  });

  server.get('/finance/margin/flows', async (request, reply) => {
    await authenticate(request);
    const { page = '1', limit = '20', opType } = request.query as {
      page: string;
      limit: string;
      opType?: string;
    };
    const userId = request.userId!;
    const result = await listTokenFlows(userId, parseInt(page, 10), parseInt(limit, 10), opType ? parseInt(opType, 10) : undefined);
    return reply.send(success(result));
  });

  // ==========================================================================
  // 佣金
  // ==========================================================================

  server.get('/finance/commission/list', async (request, reply) => {
    await authenticate(request);
    const { page = '1', limit = '20' } = request.query as { page: string; limit: string };
    const userId = request.userId!;
    const result = await listCommissionFlows(userId, parseInt(page, 10), parseInt(limit, 10));
    return reply.send(success(result));
  });

  server.get('/finance/commission/summary', async (request, reply) => {
    await authenticate(request);
    const userId = request.userId!;
    const summary = await commissionSummary(userId);
    return reply.send(success(summary));
  });

  server.get('/finance/commission/orders', async (request, reply) => {
    await authenticate(request);
    const { page = '1', limit = '20', orderType, status } = request.query as {
      page: string;
      limit: string;
      orderType?: string;
      status?: string;
    };
    const userId = request.userId!;
    const conditions = [eq(orders.userId, userId)];
    if (orderType) conditions.push(eq(orders.paymentMethod, orderType));
    if (status) conditions.push(eq(orders.status, status));
    const where = conditions.length === 1 ? conditions[0] : and(...conditions);
    const rows = await db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(parseInt(limit, 10)).offset((parseInt(page, 10) - 1) * parseInt(limit, 10));
    const countRows = await db.select({ count: sql<number>`count(*)::int` }).from(orders).where(where);
    return reply.send(success({ items: rows, total: countRows[0]?.count ?? 0 }));
  });

  // ==========================================================================
  // 分销
  // ==========================================================================

  server.get('/finance/distribution/subordinates', async (request, reply) => {
    await authenticate(request);
    const { page = '1', limit = '20' } = request.query as { page: string; limit: string };
    const userId = request.userId!;
    const result = await listSubordinates(userId, parseInt(page, 10), parseInt(limit, 10));
    return reply.send(success(result));
  });

  server.get('/finance/distribution/team/center', async (request, reply) => {
    await authenticate(request);
    const userId = request.userId!;
    const center = await teamCenter(userId);
    return reply.send(success(center));
  });

  server.get('/finance/distribution/invitee-stats', async (request, reply) => {
    await authenticate(request);
    const userId = request.userId!;
    const center = await teamCenter(userId);
    return reply.send(success({ totalInvitees: center.totalInvitees, vipInvitees: center.vipInvitees }));
  });

  // ==========================================================================
  // 提现
  // ==========================================================================

  server.post('/finance/withdrawal/apply', async (request, reply) => {
    await authenticate(request);
    const { amount } = request.query as { amount: string };
    const userId = request.userId!;
    const amountCents = parseInt(amount, 10);
    if (amountCents <= 0) return reply.status(400).send(error(400, '提现金额必须为正'));
    const available = await availableWithdrawal(userId);
    if (amountCents > available) return reply.status(400).send(error(400, '可提现余额不足'));
    const flow = await applyWithdrawal({
      userId,
      amount: amountCents,
      method: 'wechat',
      accountInfo: {},
    });
    return reply.send(success(flow));
  });

  server.get('/finance/withdrawal/list', async (request, reply) => {
    await authenticate(request);
    const { page = '1', limit = '20' } = request.query as { page: string; limit: string };
    const userId = request.userId!;
    const result = await listWithdrawals(userId, parseInt(page, 10), parseInt(limit, 10));
    return reply.send(success(result));
  });

  server.get('/finance/withdrawal/summary', async (request, reply) => {
    await authenticate(request);
    const userId = request.userId!;
    const summary = await withdrawalSummary(userId);
    return reply.send(success(summary));
  });

  server.get('/finance/withdrawal/available', async (request, reply) => {
    await authenticate(request);
    const userId = request.userId!;
    const available = await availableWithdrawal(userId);
    return reply.send(success({ available }));
  });
};

// 佣金自动分账（支付成功后调用）
export async function feedbackInviteByOrder(orderId: string, orderAmount: number, buyerId: string): Promise<void> {
  const tokenQuantity = await getBalance(buyerId);
  await feedbackInvite(
    { id: buyerId, tokenQuantity },
    { id: orderId, amount: orderAmount, orderType: 0, productId: null },
  );
}
