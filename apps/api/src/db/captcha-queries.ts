/**
 * 验证码查询（DB fallback）。
 * 主存储为内存 code-store.ts，此模块仅在 Redis/DB 持久化时使用。
 */
import { eq, lt } from 'drizzle-orm';
import { db } from './index.js';
import { captchas } from '@ihui/database';

export async function saveCaptcha(captchaKey: string, code: string): Promise<void> {
  await db.insert(captchas).values({
    captchaKey,
    code,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
}

export async function findCaptcha(captchaKey: string) {
  const rows = await db.select().from(captchas).where(eq(captchas.captchaKey, captchaKey)).limit(1);
  return rows[0];
}

export async function deleteCaptcha(captchaKey: string): Promise<void> {
  await db.delete(captchas).where(eq(captchas.captchaKey, captchaKey));
}

export async function cleanupExpiredCaptchas(): Promise<void> {
  await db.delete(captchas).where(lt(captchas.expiresAt, new Date()));
}
