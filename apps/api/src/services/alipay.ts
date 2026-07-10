/**
 * 支付宝支付服务。
 * 密钥配置留空时降级为 mock 模式（DEV 环境）。
 * 生产环境填入 .env 真实密钥即激活真实网关调用。
 *
 * 密钥配置（.env）:
 * - ALIPAY_APP_ID: 应用 appid
 * - ALIPAY_GATEWAY: 网关（默认 https://openapi.alipay.com/gateway.do）
 * - ALIPAY_PRIVATE_KEY: 应用私钥 PEM（或 ALIPAY_PRIVATE_KEY_PATH）
 * - ALIPAY_PUBLIC_KEY: 支付宝公钥 PEM（或 ALIPAY_PUBLIC_KEY_PATH）
 * - ALIPAY_NOTIFY_URL: 异步回调
 * - ALIPAY_RETURN_URL: 同步返回
 */

import { createSign, createVerify, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { env } from 'node:process';

const GATEWAY = env.ALIPAY_GATEWAY ?? 'https://openapi.alipay.com/gateway.do';

export function isAlipayConfigured(): boolean {
  return Boolean(env.ALIPAY_APP_ID && (env.ALIPAY_PRIVATE_KEY || env.ALIPAY_PRIVATE_KEY_PATH));
}

function getPrivateKey(): string {
  if (env.ALIPAY_PRIVATE_KEY) return env.ALIPAY_PRIVATE_KEY;
  if (env.ALIPAY_PRIVATE_KEY_PATH) return readFileSync(env.ALIPAY_PRIVATE_KEY_PATH, 'utf-8');
  return '';
}

function getPublicKey(): string {
  if (env.ALIPAY_PUBLIC_KEY) return env.ALIPAY_PUBLIC_KEY;
  if (env.ALIPAY_PUBLIC_KEY_PATH) return readFileSync(env.ALIPAY_PUBLIC_KEY_PATH, 'utf-8');
  return '';
}

/** 参数排序 + URL 编码拼接（签名串） */
function buildSignContent(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return sorted;
}

/** RSA2 签名 */
function signParams(params: Record<string, string>): string {
  const signContent = buildSignContent(params);
  const sign = createSign('RSA-SHA256');
  sign.update(signContent, 'utf-8');
  return sign.sign(getPrivateKey(), 'base64');
}

/** 验证支付宝回调签名 */
export function verifyNotify(params: Record<string, string>): boolean {
  const pub = getPublicKey();
  if (!pub) {
    // DEV 环境跳过验签（生产必须配置）
    return env.NODE_ENV !== 'production';
  }
  const sign = params.sign;
  const signType = params.sign_type;
  if (!sign || signType !== 'RSA2') return false;
  // 移除 sign/sign_type，用剩余参数排序拼接验签
  const { sign: _s, sign_type: _st, ...rest } = params;
  const signContent = buildSignContent(rest);
  const verify = createVerify('RSA-SHA256');
  verify.update(signContent, 'utf-8');
  return verify.verify(pub, Buffer.from(sign, 'base64'));
}

/** 构造已签名 URL（PC/H5 网页支付） */
export function buildSignedUrl(bizContent: Record<string, unknown>, method = 'alipay.trade.page.pay'): string {
  const params: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method,
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  };
  const sign = signParams(params);
  params.sign = sign;
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `${GATEWAY}?${query}`;
}

/** APP 支付（返回 orderStr） */
export function appPayOrder(params: {
  outTradeNo: string;
  amount: number; // 元
  subject: string;
}): string {
  const bizContent = {
    out_trade_no: params.outTradeNo,
    total_amount: params.amount.toFixed(2),
    subject: params.subject,
    product_code: 'QUICK_MSECURITY_PAY',
  };
  const paramsObj: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.trade.app.pay',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  };
  const sign = signParams(paramsObj);
  paramsObj.sign = sign;
  return Object.entries(paramsObj)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

/** 查询订单 */
export async function queryOrder(outTradeNo: string): Promise<Record<string, unknown>> {
  const bizContent = { out_trade_no: outTradeNo };
  const params: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.trade.query',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  };
  params.sign = signParams(params);
  const body = new URLSearchParams(params).toString();
  const resp = await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  return (await resp.json()) as Record<string, unknown>;
}

/** 退款 */
export async function refundOrder(params: {
  outTradeNo: string;
  refundAmount: number; // 元
  reason: string;
}): Promise<{ success: boolean; response: Record<string, unknown> }> {
  const outRequestNo = `r${Date.now()}${randomBytes(3).toString('hex')}`;
  const bizContent = {
    out_trade_no: params.outTradeNo,
    refund_amount: params.refundAmount.toFixed(2),
    refund_reason: params.reason,
    out_request_no: outRequestNo,
  };
  const paramsObj: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.trade.refund',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  };
  paramsObj.sign = signParams(paramsObj);
  const body = new URLSearchParams(paramsObj).toString();
  const resp = await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const data = (await resp.json()) as { alipay_trade_refund_response: Record<string, unknown> };
  const refundResp = data.alipay_trade_refund_response ?? {};
  return { success: refundResp.code === '10000', response: refundResp };
}

/** 关闭订单 */
export async function closeOrder(outTradeNo: string): Promise<void> {
  const bizContent = { out_trade_no: outTradeNo };
  const params: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.trade.close',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  };
  params.sign = signParams(params);
  const body = new URLSearchParams(params).toString();
  await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
}

/** 下载账单 URL（对账用） */
export async function downloadBillUrl(billDate: string, billType: 'trade' | 'signcustomer' = 'trade'): Promise<string> {
  const bizContent = { bill_date: billDate, bill_type: billType };
  const params: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.data.dataservice.bill.downloadurl.query',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  };
  params.sign = signParams(params);
  const body = new URLSearchParams(params).toString();
  const resp = await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const data = (await resp.json()) as { alipay_data_dataservice_bill_downloadurl_query_response: { bill_download_url: string } };
  return data.alipay_data_dataservice_bill_downloadurl_query_response.bill_download_url;
}

function formatTimestamp(d: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
