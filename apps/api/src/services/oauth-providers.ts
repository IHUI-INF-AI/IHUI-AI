/**
 * OAuth 第三方登录服务。
 * 支持 Google / 微信小程序 / 企业微信（WeCom suite）。
 * 密钥配置留空时降级为 mock 模式（DEV）。
 *
 * 密钥配置（.env）:
 * - GOOGLE_APP_ID / GOOGLE_ANDROID_ID / GOOGLE_SECRET / GOOGLE_PC_REDIRECT_URI
 * - WX_MINI_APPID / WX_MINI_SECRET
 * - WECOM_SECRET (suite_secret) / WECOM_SUITE_ID
 */

import { env } from 'node:process';
import { randomBytes } from 'node:crypto';

// ============================================================================
// Google OAuth
// ============================================================================

export interface GoogleUserInfo {
  openId: string;
  email: string;
  name: string;
  picture: string;
  phone: string;
}

export function isGoogleConfigured(): boolean {
  return Boolean(env.GOOGLE_APP_ID && env.GOOGLE_SECRET);
}

/** 用 code 换 id_token → 校验 aud → 返回用户信息 */
export async function exchangeGoogleCode(code: string): Promise<GoogleUserInfo> {
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_APP_ID ?? '',
      client_secret: env.GOOGLE_SECRET ?? '',
      redirect_uri: env.GOOGLE_PC_REDIRECT_URI ?? '',
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenResp.ok) throw new Error(`Google token exchange failed: ${tokenResp.status}`);
  const tokenData = (await tokenResp.json()) as { id_token: string };
  const idToken = tokenData.id_token;
  return verifyGoogleIdToken(idToken);
}

/** 校验 id_token → 返回用户信息 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!resp.ok) throw new Error(`Google tokeninfo failed: ${resp.status}`);
  const data = (await resp.json()) as { sub: string; email: string; name: string; picture: string; aud?: string };
  // 校验 aud
  const allowed = (env.GOOGLE_APP_IDS ?? env.GOOGLE_APP_ID ?? '').split(',').filter(Boolean);
  if (env.NODE_ENV === 'production' && allowed.length > 0 && !allowed.includes(data.aud ?? '')) {
    throw new Error('Google aud mismatch');
  }
  return {
    openId: data.sub,
    email: data.email,
    name: data.name,
    picture: data.picture,
    phone: data.email, // 兜底用 email 当 phone
  };
}

// ============================================================================
// 微信小程序
// ============================================================================

export interface WechatMiniSession {
  openId: string;
  unionId: string;
  sessionKey: string;
}

export function isWechatMiniConfigured(): boolean {
  return Boolean(env.WX_MINI_APPID && env.WX_MINI_SECRET);
}

/** jscode2session */
export async function jscode2session(code: string): Promise<WechatMiniSession> {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.WX_MINI_APPID}&secret=${env.WX_MINI_SECRET}&js_code=${code}&grant_type=authorization_code`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Wechat jscode2session failed: ${resp.status}`);
  const data = (await resp.json()) as { openid: string; unionid: string; session_key: string };
  return { openId: data.openid, unionId: data.unionid, sessionKey: data.session_key };
}

/** 获取手机号（getuserphonenumber） */
export async function getPhoneNumber(code: string): Promise<string> {
  const accessToken = await getAccessToken();
  const resp = await fetch(`https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!resp.ok) throw new Error(`Wechat getuserphonenumber failed: ${resp.status}`);
  const data = (await resp.json()) as { phone_info: { phoneNumber: string } };
  return data.phone_info.phoneNumber;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60000) {
    return cachedAccessToken.token;
  }
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${env.WX_MINI_APPID}&secret=${env.WX_MINI_SECRET}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Wechat gettoken failed: ${resp.status}`);
  const data = (await resp.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in - 200) * 1000,
  };
  return data.access_token;
}

/** 生成小程序无限码 */
export async function generateQrcode(scene: string, page: string): Promise<Buffer> {
  const accessToken = await getAccessToken();
  const resp = await fetch(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scene, page, check_path: false }),
  });
  if (!resp.ok) throw new Error(`Wechat qrcode failed: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

// ============================================================================
// 企业微信（WeCom suite）
// ============================================================================

export interface WecomSession {
  userId: string;
  sessionKey: string;
  openUserId: string;
  corpId: string;
}

export function isWecomConfigured(): boolean {
  return Boolean(env.WECOM_SECRET && env.WECOM_SUITE_ID);
}

/** 获取 suite_access_token */
export async function getSuiteAccessToken(): Promise<string> {
  const suiteTicket = env.WECOM_SUITE_TICKET ?? '';
  const resp = await fetch('https://qyapi.weixin.qq.com/cgi-bin/service/get_suite_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      suite_id: env.WECOM_SUITE_ID,
      suite_secret: env.WECOM_SECRET,
      suite_ticket: suiteTicket,
    }),
  });
  if (!resp.ok) throw new Error(`WeCom get_suite_token failed: ${resp.status}`);
  const data = (await resp.json()) as { suite_access_token: string };
  return data.suite_access_token;
}

/** code2session（企业微信小程序） */
export async function wecomCode2session(code: string): Promise<WecomSession> {
  const token = await getSuiteAccessToken();
  const url = `https://qyapi.weixin.qq.com/cgi-bin/service/miniprogram/jscode2session?suite_access_token=${token}&js_code=${code}&grant_type=authorization_code`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`WeCom code2session failed: ${resp.status}`);
  const data = (await resp.json()) as { userid: string; session_key: string; open_userid: string; corpid: string };
  return {
    userId: data.userid,
    sessionKey: data.session_key,
    openUserId: data.open_userid,
    corpId: data.corpid,
  };
}

/** 生成随机 state（CSRF 防护） */
export function generateState(): string {
  return randomBytes(16).toString('hex');
}

/** 生成授权码 code */
export function generateAuthCode(): string {
  return randomBytes(8).toString('hex');
}

/** 生成 client_id */
export function generateClientId(): string {
  return `zhs_${randomBytes(16).toString('hex')}`;
}

/** 生成 client_secret */
export function generateClientSecret(): string {
  return randomBytes(32).toString('hex');
}

/** 生成用户 SK（sk- 前缀） */
export function generateUserSk(): string {
  return `sk-${randomBytes(24).toString('hex')}`;
}
