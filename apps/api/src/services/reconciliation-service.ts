/**
 * 对账服务。
 * 迁移自旧架构 reconciliation_service.py。
 * 拉取支付宝/微信账单，与本地订单对比，输出差异。
 * 提供自动对账（每日）与自动关单（超时未支付）。
 */

import { downloadBillUrl } from './alipay.js';
import { downloadBill as wxDownloadBill, closeOrder as wxCloseOrder } from './wechat-pay.js';
import { closeOrder as aliCloseOrder } from './alipay.js';
import { findPaidOrdersByDate, findExpiredOrders } from './order-service.js';
import { updateOrderStatus } from '../db/payment-queries.js';
import type { Order } from '@ihui/database';

export interface ReconcileDiff {
  onlyRemote: Array<{ outTradeNo: string; amount: string; tradeStatus: string }>;
  onlyLocal: Array<{ orderNo: string; amount: number }>;
}

export interface ReconcileResult {
  date: string;
  platform: string;
  localCount: number;
  remoteCount: number;
  diff: ReconcileDiff;
  error?: string;
}

/**
 * 支付宝对账：拉取账单 CSV → 解析 → 与本地 paid 订单对比。
 */
export async function reconcileAlipay(billDate: string): Promise<ReconcileResult> {
  try {
    const billUrl = await downloadBillUrl(billDate, 'trade');
    const resp = await fetch(billUrl);
    const csvText = await resp.text();

    const remoteTrades = parseAlipayBill(csvText);
    const localOrders = await findPaidOrdersByDate(billDate);
    return buildDiff(billDate, 'alipay', localOrders, remoteTrades);
  } catch (e) {
    return {
      date: billDate,
      platform: 'alipay',
      localCount: 0,
      remoteCount: 0,
      diff: { onlyRemote: [], onlyLocal: [] },
      error: (e as Error).message,
    };
  }
}

/**
 * 微信对账：拉取账单 CSV → 解析 → 与本地 paid 订单对比。
 */
export async function reconcileWechat(billDate: string): Promise<ReconcileResult> {
  try {
    const csvText = await wxDownloadBill(billDate, 'ALL');
    const remoteTrades = parseWechatBill(csvText);
    const localOrders = await findPaidOrdersByDate(billDate);
    return buildDiff(billDate, 'wechat', localOrders, remoteTrades);
  } catch (e) {
    return {
      date: billDate,
      platform: 'wechat',
      localCount: 0,
      remoteCount: 0,
      diff: { onlyRemote: [], onlyLocal: [] },
      error: (e as Error).message,
    };
  }
}

/** 支付宝 + 微信合并对账。 */
export async function reconcileAll(billDate: string): Promise<{
  date: string;
  alipay: ReconcileResult;
  wechat: ReconcileResult;
}> {
  const [alipay, wechat] = await Promise.all([
    reconcileAlipay(billDate),
    reconcileWechat(billDate),
  ]);
  return { date: billDate, alipay, wechat };
}

/** 自动对账昨天（供定时任务每日 03:00 调用）。 */
export async function autoReconcileYesterday(): Promise<{
  date: string;
  alipay: ReconcileResult;
  wechat: ReconcileResult;
}> {
  const yesterday = new Date(Date.now() - 86400_000);
  const billDate = formatDate(yesterday);
  return reconcileAll(billDate);
}

/**
 * 自动关闭超时未支付订单（默认 30 分钟）。
 * 供定时任务每 10 分钟调用。
 */
export async function autoCloseExpiredOrders(): Promise<{
  scanned: number;
  closed: string[];
  failed: Array<{ orderNo: string; error: string }>;
}> {
  const pending = await findExpiredOrders();
  const closed: string[] = [];
  const failed: Array<{ orderNo: string; error: string }> = [];

  for (const order of pending) {
    try {
      // 调用对应支付渠道关单接口
      if (order.paymentMethod === 'alipay') {
        await aliCloseOrder(order.orderNo);
      } else if (
        order.paymentMethod === 'wechat' ||
        order.paymentMethod === 'wechat_android' ||
        order.paymentMethod === 'wechat_course'
      ) {
        await wxCloseOrder(order.orderNo);
      }
      await updateOrderStatus(order.orderNo, 'cancelled');
      closed.push(order.orderNo);
    } catch (e) {
      failed.push({ orderNo: order.orderNo, error: (e as Error).message });
    }
  }

  return { scanned: pending.length, closed, failed };
}

// =============================================================================
// 内部工具
// =============================================================================

interface RemoteTrade {
  outTradeNo: string;
  amount: string;
  tradeStatus: string;
}

/** 解析支付宝账单 CSV（业务明细段）。 */
function parseAlipayBill(csvText: string): RemoteTrade[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  const trades: RemoteTrade[] = [];
  // 支付宝账单：明细从 "#明细" 段开始，字段以逗号分隔
  let inDetail = false;
  for (const line of lines) {
    if (line.startsWith('#')) {
      inDetail = line.includes('明细') || line.includes('记录');
      continue;
    }
    if (!inDetail) continue;
    const parts = line.split(',').map((p) => p.trim().replace(/^`/, ''));
    if (parts.length >= 10) {
      trades.push({
        outTradeNo: parts[0] ?? '',
        amount: parts[5] ?? '',
        tradeStatus: parts[14] ?? '',
      });
    }
  }
  return trades;
}

/** 解析微信账单 CSV（跳过表头汇总行）。 */
function parseWechatBill(csvText: string): RemoteTrade[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  const trades: RemoteTrade[] = [];
  // 微信账单前 2 行为标题与表头，从第 3 行开始为交易记录
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('总') || line.startsWith('交易时间')) continue;
    const parts = line.split(',').map((p) => p.trim().replace(/^`/, ''));
    if (parts.length >= 8) {
      trades.push({
        outTradeNo: parts[9] ?? '', // 商户订单号
        amount: parts[2] ?? '', // 收入/支出金额
        tradeStatus: parts[7] ?? '', // 交易状态
      });
    }
  }
  return trades;
}

/** 构建对账差异结果。 */
function buildDiff(
  billDate: string,
  platform: string,
  localOrders: Order[],
  remoteTrades: RemoteTrade[],
): ReconcileResult {
  const localMap = new Map(localOrders.map((o) => [o.orderNo, o]));
  const remoteMap = new Map(remoteTrades.map((t) => [t.outTradeNo, t]));

  const onlyRemote = remoteTrades
    .filter((t) => !localMap.has(t.outTradeNo))
    .slice(0, 50)
    .map((t) => ({ outTradeNo: t.outTradeNo, amount: t.amount, tradeStatus: t.tradeStatus }));

  const onlyLocal = localOrders
    .filter((o) => !remoteMap.has(o.orderNo))
    .slice(0, 50)
    .map((o) => ({ orderNo: o.orderNo, amount: o.amount }));

  return {
    date: billDate,
    platform,
    localCount: localOrders.length,
    remoteCount: remoteTrades.length,
    diff: { onlyRemote, onlyLocal },
  };
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
