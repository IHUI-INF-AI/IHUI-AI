/**
 * 对账服务。
 * 迁移自旧架构 reconciliation_service.py。
 * 拉取支付宝/微信账单，与本地订单对比，输出差异。
 * 提供自动对账（每日）与自动关单（超时未支付）。
 *
 * P2 遗留(2026-08-06):对账差异(onlyRemote/onlyLocal)仅输出结果,无人工复核闭环——
 * 差异不会进入工单、无确认/销账/告警处理流程。生产上需补"差异 → 人工复核 → 处置"
 * 的工单化流程,否则长期差异可能被忽略导致资金口径不一致。
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

/** CSV 单元格清理:去引号包裹 + 去除 BOM。 */
function cleanCell(raw: string): string {
  return raw.trim().replace(/^`/, '').replace(/\uFEFF/g, '')
}

/** 按列名定位表头行中的索引;找不到返回 -1。 */
function findColumnIndex(header: string[], name: string): number {
  const idx = header.findIndex((h) => h.trim().replace(/^`/, '') === name)
  return idx
}

/**
 * 解析支付宝账单 CSV(业务明细段)。
 *
 * P1 修复(2026-08-06):原实现按固定 index 取列——outTradeNo 取 parts[0](账务流水号,实为
 * 商户订单号前一位)、tradeStatus 取 parts[14](实为"费率"列),且 `#` 段标题后的表头行会被
 * 当成交易记录解析。改为定位表头行(含"商户订单号")建立列名→索引映射,按表头名取列,
 * 避免表头顺序变化导致列错位;表头找不到时回退旧固定索引兼容。
 */
function parseAlipayBill(csvText: string): RemoteTrade[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  const trades: RemoteTrade[] = [];
  let headerIdx: string[] | null = null;
  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const parts = line.split(',').map(cleanCell);
    if (parts.includes('商户订单号')) {
      headerIdx = parts;
      break;
    }
  }

  let inDetail = false;
  for (const line of lines) {
    if (line.startsWith('#')) {
      inDetail = line.includes('明细') || line.includes('记录');
      continue;
    }
    if (!inDetail) continue;
    const parts = line.split(',').map(cleanCell);
    // 跳过表头行本身(表头行也会匹配明细段)
    if (headerIdx && parts.length >= 4 && parts[0] === '账务流水号') continue;
    if (parts.length < 6) continue;
    // 按表头名取列;找不到时回退到标准支付宝账单固定索引(1=商户订单号 5=交易金额 14=费率)
    const outTradeNoIdx = headerIdx ? findColumnIndex(headerIdx, '商户订单号') : -1
    const amountIdx = headerIdx ? findColumnIndex(headerIdx, '交易金额') : -1
    const statusIdx = headerIdx ? findColumnIndex(headerIdx, '交易状态') : -1
    const outTradeNo = outTradeNoIdx >= 0 ? (parts[outTradeNoIdx] ?? '') : (parts[1] ?? '')
    const amount = amountIdx >= 0 ? (parts[amountIdx] ?? '') : (parts[5] ?? '')
    // 支付宝账单无"交易状态"列(明细均为已成交交易),留空即可
    const tradeStatus = statusIdx >= 0 ? (parts[statusIdx] ?? '') : ''
    if (!outTradeNo) continue;
    trades.push({ outTradeNo, amount, tradeStatus });
  }
  return trades;
}

/**
 * 解析微信账单 CSV(跳过表头汇总行)。
 *
 * P1 修复(2026-08-06):原实现按固定 index 取列——outTradeNo 取 parts[9](实为"交易状态")、
 * amount 取 parts[2](实为"商户号")、tradeStatus 取 parts[7](实为"用户标识"),列全部错位,
 * 导致对账把商户号当订单号、把用户标识当状态,对账结果完全失真。改为定位表头行
 * (含"商户订单号")按表头名取列;找不到表头时回退微信 V3 标准固定索引
 * (6=商户订单号 12=应结订单金额 9=交易状态)。
 */
function parseWechatBill(csvText: string): RemoteTrade[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  const trades: RemoteTrade[] = [];
  let headerIdx: string[] | null = null;
  for (const line of lines) {
    if (line.startsWith('总') || line.startsWith('交易时间')) continue;
    const parts = line.split(',').map(cleanCell);
    if (parts.includes('商户订单号')) {
      headerIdx = parts;
      break;
    }
  }
  // 微信账单前 2 行为标题与表头,从第 3 行开始为交易记录
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('总') || line.startsWith('交易时间')) continue;
    const parts = line.split(',').map(cleanCell);
    // 跳过表头行本身
    if (headerIdx && parts.length >= 4 && parts[0] === '交易时间') continue;
    if (parts.length < 13) continue;
    // 按表头名取列;找不到时回退微信 V3 标准固定索引
    const outTradeNoIdx = headerIdx ? findColumnIndex(headerIdx, '商户订单号') : -1
    const amountIdx = headerIdx ? findColumnIndex(headerIdx, '应结订单金额') : -1
    const statusIdx = headerIdx ? findColumnIndex(headerIdx, '交易状态') : -1
    const outTradeNo = outTradeNoIdx >= 0 ? (parts[outTradeNoIdx] ?? '') : (parts[6] ?? '')
    const amount = amountIdx >= 0 ? (parts[amountIdx] ?? '') : (parts[12] ?? '')
    const tradeStatus = statusIdx >= 0 ? (parts[statusIdx] ?? '') : (parts[9] ?? '')
    if (!outTradeNo) continue;
    trades.push({ outTradeNo, amount, tradeStatus });
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
