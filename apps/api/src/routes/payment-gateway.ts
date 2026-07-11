import type { FastifyPluginAsync } from 'fastify';
import { env } from 'node:process';
import { authenticate } from '../plugins/auth.js';
import { success, error } from '../utils/response.js';
import { queryPendingOrders } from '../db/payment-queries.js';
import {
  placeOrder,
  getOrder,
  completeOrder,
  cancelOrder,
  refundOrder,
} from '../services/order-service.js';
import { feedbackInvite } from '../services/commission-service.js';
import {
  isWechatPayConfigured,
  jsapiPrepay,
  appPrepay,
  buildJsapiSign,
  verifyCallbackSignature,
  decryptCallback,
  queryOrder as wxQueryOrder,
  closeOrder as wxCloseOrder,
  refund as wxRefund,
  downloadBill as wxDownloadBill,
} from '../services/wechat-pay.js';
import {
  isAlipayConfigured,
  buildSignedUrl,
  appPayOrder,
  verifyNotify,
  queryOrder as aliQueryOrder,
  refundOrder as aliRefundOrder,
  closeOrder as aliCloseOrder,
  downloadBillUrl as aliDownloadBillUrl,
} from '../services/alipay.js';
import { applyWithdrawal, getBalance } from '../db/commission-queries.js';

const notifyUrl = (type?: string): string => {
  if (type === 'course') return env.WX_PAY_COURSE_NOTIFY_URL ?? env.WX_PAY_NOTIFY_URL ?? '';
  if (type === 'android') return env.WX_ANDROID_NOTIFY_URL ?? env.WX_PAY_NOTIFY_URL ?? '';
  return env.WX_PAY_NOTIFY_URL ?? '';
};

const ADMIN_ROLE_ID = 1;

export const paymentGatewayRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 微信支付
  // ==========================================================================

  server.post('/payments/wechat/create', async (request, reply) => {
    await authenticate(request);
    const { amount, openId, orderType = '0', productId, description = 'Purchase' } = request.query as {
      amount: string;
      openId: string;
      orderType?: string;
      productId?: string;
      description?: string;
    };
    const userId = request.userId!;
    const resolvedOpenId = openId || userId;
    const amountCents = parseInt(amount, 10);
    if (!amountCents || amountCents <= 0) return reply.status(400).send(error(400, '金额必须为正'));
    const order = await placeOrder({
      userId,
      amount: amountCents,
      orderType: parseInt(orderType, 10),
      productId,
      payType: 'wechat',
      openId: resolvedOpenId,
      description,
    });
    if (!isWechatPayConfigured()) {
      return reply.send(success({ outTradeNo: order.orderNo, amount: amountCents, mock: true }));
    }
    const prepayId = await jsapiPrepay({
      outTradeNo: order.orderNo,
      amount: amountCents,
      description,
      openId: resolvedOpenId,
      notifyUrl: notifyUrl(),
    });
    const sign = buildJsapiSign(prepayId);
    return reply.send(success({ outTradeNo: order.orderNo, amount: amountCents, ...sign }));
  });

  server.post('/payments/wechat/android/create', async (request, reply) => {
    await authenticate(request);
    const { amount, orderType = '0', description = 'Purchase' } = request.query as {
      amount: string;
      orderType?: string;
      description?: string;
    };
    const userId = request.userId!;
    const amountCents = parseInt(amount, 10);
    const order = await placeOrder({
      userId,
      amount: amountCents,
      orderType: parseInt(orderType, 10),
      payType: 'wechat_android',
      description,
    });
    if (!isWechatPayConfigured()) return reply.send(success({ outTradeNo: order.orderNo, mock: true }));
    const prepay = await appPrepay({
      outTradeNo: order.orderNo,
      amount: amountCents,
      description,
      notifyUrl: notifyUrl('android'),
    });
    return reply.send(success({ outTradeNo: order.orderNo, amount: amountCents, prepayData: prepay }));
  });

  server.post('/payments/wechat/course/create', async (request, reply) => {
    await authenticate(request);
    const { amount, courseId } = request.query as { amount: string; courseId: string };
    const userId = request.userId!;
    const amountCents = parseInt(amount, 10);
    const order = await placeOrder({
      userId,
      amount: amountCents,
      orderType: 1,
      productId: courseId,
      payType: 'wechat',
    });
    if (!isWechatPayConfigured()) return reply.send(success({ outTradeNo: order.orderNo, mock: true }));
    const prepayId = await jsapiPrepay({
      outTradeNo: order.orderNo,
      amount: amountCents,
      description: '课程购买',
      openId: '',
      notifyUrl: notifyUrl('course'),
    });
    return reply.send(success({ outTradeNo: order.orderNo, ...buildJsapiSign(prepayId) }));
  });

  server.post('/payments/wechat/notify', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const timestamp = request.headers['wechatpay-timestamp'] as string;
    const nonce = request.headers['wechatpay-nonce'] as string;
    const signature = request.headers['wechatpay-signature'] as string;
    if (!verifyCallbackSignature(timestamp, nonce, JSON.stringify(body), signature)) {
      return reply.code(400).send({ code: 'FAIL', message: '签名验证失败' });
    }
    const resource = (body as { resource?: { ciphertext: string; nonce: string; associated_data: string } }).resource;
    if (!resource) return reply.send({ code: 'SUCCESS', message: 'No resource' });
    const decrypted = decryptCallback(resource.ciphertext, resource.nonce, resource.associated_data) as {
      out_trade_no: string;
      trade_state: string;
      transaction_id?: string;
    };
    const { out_trade_no, trade_state, transaction_id } = decrypted;
    if (trade_state === 'SUCCESS') {
      // 支付幂等：用 transaction_id 作幂等键，防止微信重复回调导致重复处理
      const idemKey = transaction_id ?? out_trade_no;
      const idem = await server.paymentIdempotency.acquire(out_trade_no, idemKey);
      if (idem.status === 'completed') {
        return reply.send({ code: 'SUCCESS', message: 'OK (duplicate)' });
      }
      if (idem.status === 'processing') {
        // 上次回调仍在处理，ack SUCCESS 让微信停止重试
        return reply.send({ code: 'SUCCESS', message: 'OK (processing)' });
      }
      try {
        const result = await completeOrder(out_trade_no, transaction_id);
        // 支付成功后触发返佣（失败不阻塞支付完成）
        if (result.success && result.order) {
          try {
            const tokenQuantity = await getBalance(result.order.userId);
            await feedbackInvite(
              { id: result.order.userId, tokenQuantity },
              { id: result.order.id, amount: result.order.amount, orderType: result.order.orderType, productId: result.order.productId ?? null },
            );
          } catch (ce) {
            request.log.warn({ err: ce, orderNo: out_trade_no }, 'commission feedback failed');
          }
        }
        await server.paymentIdempotency.complete(out_trade_no, idemKey, { out_trade_no, trade_state });
      } catch (e) {
        await server.paymentIdempotency.fail(out_trade_no, idemKey, (e as Error).message);
        return reply.code(500).send({ code: 'FAIL', message: '处理失败' });
      }
    }
    return reply.send({ code: 'SUCCESS', message: 'OK' });
  });

  server.post('/payments/wechat/notify/refund', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const timestamp = request.headers['wechatpay-timestamp'] as string;
    const nonce = request.headers['wechatpay-nonce'] as string;
    const signature = request.headers['wechatpay-signature'] as string;
    if (!verifyCallbackSignature(timestamp, nonce, JSON.stringify(body), signature)) {
      return reply.code(400).send({ code: 'FAIL', message: '签名验证失败' });
    }
    const resource = (body as { resource?: { ciphertext: string; nonce: string; associated_data: string } }).resource;
    if (resource) {
      const decrypted = decryptCallback(resource.ciphertext, resource.nonce, resource.associated_data) as {
        out_trade_no: string;
        refund_status: string;
      };
      if (['SUCCESS', 'CHANGE'].includes(decrypted.refund_status)) {
        await refundOrder(decrypted.out_trade_no);
      }
    }
    return reply.send({ code: 'SUCCESS', message: 'OK' });
  });

  server.post('/payments/wechat/query', async (request, reply) => {
    const payload = await authenticate(request);
    const { outTradeNo } = request.query as { outTradeNo: string };
    const local = await getOrder(outTradeNo);
    if (!local) return reply.status(404).send(error(404, '订单不存在'));
    if (payload.roleId < ADMIN_ROLE_ID && local.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权操作此订单'));
    }
    if (!isWechatPayConfigured()) return reply.send(success({ local }));
    const wechat = await wxQueryOrder(outTradeNo);
    return reply.send(success({ local, wechat }));
  });

  server.post('/payments/wechat/close', async (request, reply) => {
    const payload = await authenticate(request);
    const { outTradeNo } = request.query as { outTradeNo: string };
    const order = await getOrder(outTradeNo);
    if (!order) return reply.status(404).send(error(404, '订单不存在'));
    if (payload.roleId < ADMIN_ROLE_ID && order.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权操作此订单'));
    }
    if (isWechatPayConfigured()) await wxCloseOrder(outTradeNo);
    await cancelOrder(outTradeNo);
    return reply.send(success({ outTradeNo }));
  });

  server.post('/payments/wechat/refund', async (request, reply) => {
    const payload = await authenticate(request);
    const { outTradeNo, refundAmount, reason = 'User requested refund' } = request.query as {
      outTradeNo: string;
      refundAmount: string;
      reason?: string;
    };
    const order = await getOrder(outTradeNo);
    if (!order) return reply.status(404).send(error(404, '订单不存在'));
    if (payload.roleId < ADMIN_ROLE_ID && order.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权操作此订单'));
    }
    if (order.status !== 'paid') return reply.status(400).send(error(400, '订单状态不允许退款'));
    const refundNo = `refund_${outTradeNo}`;
    const amount = parseInt(refundAmount, 10);
    if (isWechatPayConfigured()) {
      await wxRefund({
        outTradeNo,
        refundNo,
        refundAmount: amount,
        totalAmount: order.amount,
        reason,
        notifyUrl: env.WX_PAY_NOTIFY_URL ?? '',
      });
    }
    await refundOrder(outTradeNo);
    return reply.send(success({ outTradeNo, refundNo }));
  });

  server.get('/payments/wechat/status/:outTradeNo', async (request, reply) => {
    const { outTradeNo } = request.params as { outTradeNo: string };
    const order = await getOrder(outTradeNo);
    return reply.send(success(order));
  });

  // ==========================================================================
  // 支付宝支付
  // ==========================================================================

  server.post('/payments/alipay/create', async (request, reply) => {
    await authenticate(request);
    const { amount, orderType = '0', subject = '订单支付' } = request.query as {
      amount: string;
      orderType?: string;
      subject?: string;
    };
    const userId = request.userId!;
    const amountYuan = parseFloat(amount);
    const amountCents = Math.round(amountYuan * 100);
    const order = await placeOrder({
      userId,
      amount: amountCents,
      orderType: parseInt(orderType, 10),
      payType: 'alipay',
    });
    if (!isAlipayConfigured()) return reply.send(success({ outTradeNo: order.orderNo, mock: true }));
    const bizContent = {
      out_trade_no: order.orderNo,
      total_amount: amountYuan.toFixed(2),
      subject,
      product_code: 'FAST_INSTANT_TRADE_PAY',
    };
    const payUrl = buildSignedUrl(bizContent, 'alipay.trade.page.pay');
    return reply.send(success({ outTradeNo: order.orderNo, payUrl }));
  });

  server.post('/payments/alipay/app/create', async (request, reply) => {
    await authenticate(request);
    const { amount, orderType = '0', subject = '订单支付' } = request.query as {
      amount: string;
      orderType?: string;
      subject?: string;
    };
    const userId = request.userId!;
    const amountYuan = parseFloat(amount);
    const amountCents = Math.round(amountYuan * 100);
    const order = await placeOrder({
      userId,
      amount: amountCents,
      orderType: parseInt(orderType, 10),
      payType: 'alipay_app',
    });
    if (!isAlipayConfigured()) return reply.send(success({ outTradeNo: order.orderNo, mock: true }));
    const orderStr = appPayOrder({ outTradeNo: order.orderNo, amount: amountYuan, subject });
    return reply.send(success({ outTradeNo: order.orderNo, orderStr }));
  });

  server.post('/payments/alipay/notify', async (request, reply) => {
    const params = request.body as Record<string, string>;
    if (!verifyNotify(params)) return reply.type('text/plain').send('fail');
    const tradeStatus = params.trade_status ?? '';
    const outTradeNo = params.out_trade_no ?? '';
    if (['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(tradeStatus)) {
      // 支付幂等：用支付宝 trade_no 作幂等键，防止重复回调
      const idemKey = params.trade_no ?? outTradeNo;
      const idem = await server.paymentIdempotency.acquire(outTradeNo, idemKey);
      if (idem.status === 'completed' || idem.status === 'processing') {
        return reply.type('text/plain').send('success');
      }
      try {
        const result = await completeOrder(outTradeNo, params.trade_no);
        // 支付成功后触发返佣（失败不阻塞支付完成）
        if (result.success && result.order) {
          try {
            const tokenQuantity = await getBalance(result.order.userId);
            await feedbackInvite(
              { id: result.order.userId, tokenQuantity },
              { id: result.order.id, amount: result.order.amount, orderType: result.order.orderType, productId: result.order.productId ?? null },
            );
          } catch (ce) {
            request.log.warn({ err: ce, orderNo: outTradeNo }, 'commission feedback failed');
          }
        }
        await server.paymentIdempotency.complete(outTradeNo, idemKey, { outTradeNo, tradeStatus });
      } catch (e) {
        await server.paymentIdempotency.fail(outTradeNo, idemKey, (e as Error).message);
        return reply.type('text/plain').send('fail');
      }
    }
    return reply.type('text/plain').send('success');
  });

  server.post('/payments/alipay/query', async (request, reply) => {
    const payload = await authenticate(request);
    const { outTradeNo } = request.query as { outTradeNo: string };
    const local = await getOrder(outTradeNo);
    if (!local) return reply.status(404).send(error(404, '订单不存在'));
    if (payload.roleId < ADMIN_ROLE_ID && local.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权操作此订单'));
    }
    if (!isAlipayConfigured()) return reply.send(success({ local }));
    const alipay = await aliQueryOrder(outTradeNo);
    return reply.send(success({ local, alipay }));
  });

  server.post('/payments/alipay/refund', async (request, reply) => {
    const payload = await authenticate(request);
    const { outTradeNo, refundAmount, reason = '用户申请退款' } = request.query as {
      outTradeNo: string;
      refundAmount: string;
      reason?: string;
    };
    const order = await getOrder(outTradeNo);
    if (!order) return reply.status(404).send(error(404, '订单不存在'));
    if (payload.roleId < ADMIN_ROLE_ID && order.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权操作此订单'));
    }
    if (order.status !== 'paid') return reply.status(400).send(error(400, '订单状态不允许退款'));
    const amountYuan = parseFloat(refundAmount);
    if (isAlipayConfigured()) {
      const result = await aliRefundOrder({ outTradeNo, refundAmount: amountYuan, reason });
      if (!result.success) return reply.status(500).send(error(500, '退款失败'));
    }
    await refundOrder(outTradeNo);
    return reply.send(success({ outTradeNo }));
  });

  // ==========================================================================
  // 基金（转账/提现）
  // ==========================================================================

  server.post('/payments/createOrder', async (request, reply) => {
    await authenticate(request);
    const { amount, orderType = '0', productId } = request.query as {
      amount: string;
      orderType?: string;
      productId?: string;
    };
    const userId = request.userId!;
    const amountYuan = parseFloat(amount);
    const amountCents = Math.round(amountYuan * 100);
    const order = await placeOrder({
      userId,
      amount: amountCents,
      orderType: parseInt(orderType, 10),
      productId,
      payType: 'fund',
    });
    return reply.send(success({ outTradeNo: order.orderNo, amount: amountCents }));
  });

  server.post('/payments/wechatPay', async (request, reply) => {
    await authenticate(request);
    const { outTradeNo, totalFee } = request.query as { outTradeNo: string; totalFee: string };
    if (!isWechatPayConfigured()) return reply.send(success({ outTradeNo, mock: true }));
    const prepayId = await jsapiPrepay({
      outTradeNo,
      amount: parseInt(totalFee, 10),
      description: '基金充值',
      openId: '',
      notifyUrl: notifyUrl(),
    });
    return reply.send(success({ outTradeNo, prepayId }));
  });

  server.post('/payments/transfer', async (request, reply) => {
    await authenticate(request);
    const { amount, bankAccount, bankName = '' } = request.query as {
      amount: string;
      bankAccount: string;
      bankName?: string;
    };
    const userId = request.userId!;
    const flow = await applyWithdrawal({
      userId,
      amount: parseInt(amount, 10),
      method: 'bank',
      accountInfo: { bankAccount, bankName },
    });
    return reply.send(success(flow));
  });

  server.post('/payments/withdrawal', async (request, reply) => {
    await authenticate(request);
    const { amount } = request.query as { amount: string };
    const userId = request.userId!;
    const flow = await applyWithdrawal({
      userId,
      amount: parseInt(amount, 10),
      method: 'wechat',
      accountInfo: {},
    });
    return reply.send(success(flow));
  });

  server.get('/payments/success', async (request, reply) => {
    const { orderNo } = request.query as { orderNo?: string };
    return reply.send(success({ orderNo, msg: 'Payment success' }));
  });

  server.get('/payments/fail', async (_request, reply) => {
    return reply.status(500).send(error(500, 'Payment failed, please retry'));
  });

  // 对账（用户级）
  server.get('/payments/reconciliation/pending', async (request, reply) => {
    await authenticate(request);
    const items = await queryPendingOrders();
    return reply.send(success({ count: items.length, items }));
  });

  server.post('/payments/reconciliation/close_expired', async (request, reply) => {
    await authenticate(request);
    const pending = await queryPendingOrders();
    const closed: string[] = [];
    const failed: Array<{ outTradeNo: string; error: string }> = [];
    for (const order of pending) {
      try {
        const payType = order.paymentMethod ?? '';
        if (payType.startsWith('alipay') && isAlipayConfigured()) {
          await aliCloseOrder(order.orderNo);
        } else if (payType.startsWith('wechat') && isWechatPayConfigured()) {
          await wxCloseOrder(order.orderNo);
        }
        await cancelOrder(order.orderNo);
        closed.push(order.orderNo);
      } catch (e) {
        failed.push({ outTradeNo: order.orderNo, error: (e as Error).message });
      }
    }
    return reply.send(success({ scanned: pending.length, closed, failed }));
  });
};

export const adminPaymentGatewayRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request) => {
    const payload = await authenticate(request);
    if (payload.roleId < ADMIN_ROLE_ID) {
      const err = new Error('需要管理员权限');
      (err as Error & { statusCode: number }).statusCode = 403;
      throw err;
    }
  });

  server.get('/payments/reconciliation/alipay', async (request, reply) => {
    const { billDate } = request.query as { billDate?: string };
    const date = billDate ?? new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    if (!isAlipayConfigured()) return reply.send(success({ billDate: date, mock: true }));
    const billUrl = await aliDownloadBillUrl(date, 'trade');
    return reply.send(success({ billDate: date, billUrl }));
  });

  server.get('/payments/reconciliation/wechat', async (request, reply) => {
    const { billDate } = request.query as { billDate?: string };
    const date = billDate ?? new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    if (!isWechatPayConfigured()) return reply.send(success({ billDate: date, mock: true }));
    const csv = await wxDownloadBill(date, 'ALL');
    return reply.send(success({ billDate: date, csv }));
  });

  server.get('/payments/reconciliation/all', async (request, reply) => {
    const { billDate } = request.query as { billDate?: string };
    const date = billDate ?? new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    const result: Record<string, unknown> = { billDate: date };
    if (isAlipayConfigured()) {
      try {
        result.alipay = await aliDownloadBillUrl(date, 'trade');
      } catch (e) {
        result.alipayError = (e as Error).message;
      }
    }
    if (isWechatPayConfigured()) {
      try {
        result.wechat = await wxDownloadBill(date, 'ALL');
      } catch (e) {
        result.wechatError = (e as Error).message;
      }
    }
    return reply.send(success(result));
  });
};
