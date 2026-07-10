/**
 * 短信验证码服务。
 * 发送策略优先级：阿里云（配置密钥）→ 代理（SMS_API_BASE_URL）→ dev console（日志）。
 * 限速：60s 1 次 / 1h 5 次 / 24h 20 次。
 * 验证码存储复用 code-store.ts（内存 Map，生产应迁移 Redis）。
 */

import { env } from 'node:process';
import { generateCode, codeStore, CODE_TTL_MS, CODE_RESEND_INTERVAL_MS } from '../utils/code-store.js';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimit60s = new Map<string, RateLimitEntry>();
const rateLimit1h = new Map<string, RateLimitEntry>();
const rateLimit24h = new Map<string, RateLimitEntry>();

function checkRateLimit(phone: string): { ok: boolean; msg: string } {
  const now = Date.now();
  // 60s 1 次
  const r60 = rateLimit60s.get(phone) ?? { count: 0, windowStart: now };
  if (now - r60.windowStart > 60_000) {
    r60.count = 0;
    r60.windowStart = now;
  }
  r60.count++;
  rateLimit60s.set(phone, r60);
  if (r60.count > 1) return { ok: false, msg: '验证码已发送,请稍候' };

  // 1h 5 次
  const r1h = rateLimit1h.get(phone) ?? { count: 0, windowStart: now };
  if (now - r1h.windowStart > 3_600_000) {
    r1h.count = 0;
    r1h.windowStart = now;
  }
  r1h.count++;
  rateLimit1h.set(phone, r1h);
  if (r1h.count > 5) return { ok: false, msg: '一小时内发送次数过多' };

  // 24h 20 次
  const r24 = rateLimit24h.get(phone) ?? { count: 0, windowStart: now };
  if (now - r24.windowStart > 86_400_000) {
    r24.count = 0;
    r24.windowStart = now;
  }
  r24.count++;
  rateLimit24h.set(phone, r24);
  if (r24.count > 20) return { ok: false, msg: '今日发送次数过多' };

  return { ok: true, msg: '' };
}

/** 发送短信验证码 */
export async function sendSmsCode(phone: string): Promise<{ success: boolean; msg: string }> {
  const rl = checkRateLimit(phone);
  if (!rl.ok) return { success: false, msg: rl.msg };

  const code = generateCode();
  const now = Date.now();

  // 检查重发间隔
  const existing = codeStore.get(phone);
  if (existing && now - existing.sentAt < CODE_RESEND_INTERVAL_MS) {
    return { success: false, msg: '验证码已发送,请稍候' };
  }

  // 存储验证码
  codeStore.set(phone, {
    code,
    expiresAt: now + CODE_TTL_MS,
    sentAt: now,
  });

  // 实际发送
  await dispatchSms(phone, code);

  return { success: true, msg: '验证码已发送' };
}

async function dispatchSms(phone: string, code: string): Promise<void> {
  // 策略 1：阿里云
  if (env.ALI_SMS_ACCESS_KEY_ID && env.ALI_SMS_ACCESS_KEY_SECRET) {
    await sendViaAliyun(phone, code);
    return;
  }
  // 策略 2：代理
  if (env.SMS_API_BASE_URL) {
    await sendViaProxy(phone, code);
    return;
  }
  // 策略 3：dev console
  console.info(`[DEV SMS] phone=${phone} code=${code}`);
}

async function sendViaAliyun(phone: string, code: string): Promise<void> {
  // 阿里云短信 SDK 调用（简化实现，生产可安装 @alicloud/sms20170525）
  // 此处为占位，密钥配置后实际接入
  console.info(`[Aliyun SMS] phone=${phone} code=${code} (待接入 SDK)`);
}

async function sendViaProxy(phone: string, code: string): Promise<void> {
  const base = env.SMS_API_BASE_URL!;
  const endpoint = env.SMS_VERIFY_ENDPOINT ?? '/ai/login/pwd/smsVerify';
  await fetch(`${base}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
}

/** 邮箱验证码发送（复用 email-service） */
export function isSmsConfigured(): boolean {
  return Boolean(
    (env.ALI_SMS_ACCESS_KEY_ID && env.ALI_SMS_ACCESS_KEY_SECRET) || env.SMS_API_BASE_URL,
  );
}
