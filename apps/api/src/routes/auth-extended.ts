import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { signAccessToken, signRefreshToken, createFamilyId, type JWTPayload } from '@ihui/auth';
import { authenticate } from '../plugins/auth.js';
import { success, error } from '../utils/response.js';
import {
  findUserByPhone,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  createUser,
  updateUser,
  checkPhoneExists,
  cancelUserAccount,
  saveRefreshToken,
} from '../db/queries.js';
import {
  findOAuthAppByClientId,
  createOAuthApp,
  listOAuthApps,
  deleteOAuthApp,
  createOAuthSession,
  findSessionByCode,
  markSessionUsed,
  listUserSessions,
  deleteSession,
  listActiveScopeMeta,
  findThirdPartyAccount,
  listUserBindings,
  createThirdPartyBinding,
  removeBinding,
  removeBindingByPlatform,
  createUserSk,
  listUserSk,
  updateUserSk,
  deleteUserSk,
  createAuditLog,
} from '../db/oauth-queries.js';
import { sendSmsCode } from '../services/sms.js';
import {
  generateCaptchaKey,
  generateCaptchaCode,
  generateCaptchaImage,
  verifyCaptcha,
} from '../services/captcha.js';
import { saveCaptcha, findCaptcha, deleteCaptcha } from '../db/captcha-queries.js';
import {
  exchangeGoogleCode,
  verifyGoogleIdToken,
  isGoogleConfigured,
  jscode2session,
  getPhoneNumber,
  isWechatMiniConfigured,
  wecomCode2session,
  isWecomConfigured,
  generateAuthCode,
  generateClientId,
  generateClientSecret,
  generateUserSk,
} from '../services/oauth-providers.js';

const ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7d
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30d

async function buildTokenPair(user: {
  id: string;
  phone: string | null;
  roleId: number | null;
  familyId: string | null;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number }> {
  const familyId = user.familyId ?? createFamilyId();
  const payload: JWTPayload = {
    userId: user.id,
    phone: user.phone ?? '',
    familyId,
    roleId: user.roleId ?? 0,
  };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload),
  ]);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  await saveRefreshToken(refreshToken, user.id, familyId, expiresAt);
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS, refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS };
}

const loginByEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const loginByUsernameSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const emailCodeSchema = z.object({
  email: z.string().email(),
});

const smsCodeSchema = z.object({
  phone: z.string().min(1),
});

const captchaVerifySchema = z.object({
  captchaKey: z.string().min(1),
  code: z.string().min(1),
});

const oauthAppCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  redirectUris: z.array(z.string().url()).min(1),
  scopes: z.array(z.string()).optional(),
  icon: z.string().optional(),
});

const bindingRemoveSchema = z.object({
  uuid: z.string().min(1),
  platform: z.string().min(1),
});

export const authExtendedRoutes: FastifyPluginAsync = async (server) => {
  // 邮箱登录
  server.post('/auth/login/email', async (request, reply) => {
    const parsed = loginByEmailSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const { email, code } = parsed.data;
    const { verifyCode } = await import('../utils/code-store.js');
    if (!verifyCode(email, code)) return reply.status(400).send(error(400, '验证码错误或已过期'));
    let user = await findUserByEmail(email);
    if (!user) {
      const emailPrefix = email.split('@')[0] ?? 'user';
      user = await createUser({
        email,
        nickname: `用户${emailPrefix.slice(0, 20)}`,
        roleId: 0,
        status: 1,
      });
    } else if (user.status !== 1) {
      return reply.status(403).send(error(403, '账号已被禁用'));
    }
    const { accessToken, refreshToken } = await buildTokenPair(user);
    return reply.send(success({ userId: user.id, accessToken, refreshToken, tokenType: 'Bearer' }));
  });

  // 用户名登录
  server.post('/auth/login/username', async (request, reply) => {
    const parsed = loginByUsernameSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const { username, password } = parsed.data;
    const user = await findUserByUsername(username);
    if (!user || !user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
      return reply.status(401).send(error(401, '用户名或密码错误'));
    }
    if (user.status !== 1) return reply.status(403).send(error(403, '账号已被禁用'));
    const { accessToken, refreshToken } = await buildTokenPair(user);
    return reply.send(success({ userId: user.id, accessToken, refreshToken, tokenType: 'Bearer' }));
  });

  // 邮箱验证码
  server.post('/auth/email/code', async (request, reply) => {
    const parsed = emailCodeSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const result = await sendSmsCode(parsed.data.email);
    if (!result.success) return reply.status(429).send(error(429, result.msg));
    return reply.send(success({ sent: true }));
  });

  // 检查手机号
  server.get('/auth/exist/:phone', async (request, reply) => {
    const { phone } = request.params as { phone: string };
    return reply.send(success({ exists: await checkPhoneExists(phone) }));
  });

  // 用户信息
  server.get('/auth/info', async (request, reply) => {
    await authenticate(request);
    const user = await findUserById(request.userId!);
    if (!user) return reply.status(404).send(error(404, '用户不存在'));
    return reply.send(success({
      id: user.id,
      phone: user.phone,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar,
      gender: user.gender,
      isVip: user.isVip,
    }));
  });

  // 更新资料
  server.put('/auth/profile', async (request, reply) => {
    await authenticate(request);
    const { nickname, email, gender } = request.body as { nickname?: string; email?: string; gender?: number };
    if (nickname !== undefined || email !== undefined) {
      await updateUser(request.userId!, { nickname, email });
    }
    if (gender !== undefined) {
      const { db } = await import('../db/index.js');
      const { users } = await import('@ihui/database');
      const { eq } = await import('drizzle-orm');
      await db.update(users).set({ gender, updatedAt: new Date() }).where(eq(users.id, request.userId!));
    }
    return reply.send(success({ updated: true }));
  });

  // 修改密码
  server.put('/auth/profile/password', async (request, reply) => {
    await authenticate(request);
    const { old_password, new_password } = request.body as { old_password: string; new_password: string };
    if (new_password.length < 6) return reply.status(400).send(error(400, '新密码至少 6 位'));
    const user = await findUserById(request.userId!);
    if (!user?.passwordHash || !bcrypt.compareSync(old_password, user.passwordHash)) {
      return reply.status(400).send(error(400, '旧密码错误'));
    }
    await updateUser(request.userId!, { passwordHash: bcrypt.hashSync(new_password, 10) });
    return reply.send(success({ updated: true }));
  });

  // 注销
  server.delete('/auth/cancel', async (request, reply) => {
    await authenticate(request);
    await cancelUserAccount(request.userId!);
    return reply.send(success({ cancelled: true }));
  });

  // Google OAuth
  server.get('/auth/google/pc/wxCode', async (request, reply) => {
    const { code } = request.query as { code: string };
    if (!isGoogleConfigured()) return reply.send(success({ mock: true, msg: 'Google OAuth 未配置' }));
    const info = await exchangeGoogleCode(code);
    return reply.send(success(info));
  });

  server.get('/auth/google/android/wxCode', async (request, reply) => {
    const { id_token } = request.query as { id_token: string };
    if (!isGoogleConfigured()) return reply.send(success({ mock: true, msg: 'Google OAuth 未配置' }));
    const info = await verifyGoogleIdToken(id_token);
    return reply.send(success(info));
  });

  server.get('/auth/google/config', async (_request, reply) => {
    return reply.send(success({ configured: isGoogleConfigured() }));
  });

  // 微信小程序登录
  server.get('/auth/wechat/mini/login', async (request, reply) => {
    const { code } = request.query as { code: string };
    if (!isWechatMiniConfigured()) return reply.send(success({ mock: true, msg: '微信小程序未配置' }));
    const session = await jscode2session(code);
    const binding = await findThirdPartyAccount('wechat', session.openId);
    if (!binding) {
      return reply.send(success({ needPhone: true, openId: session.openId, unionId: session.unionId }));
    }
    const user = await findUserById(binding.userId);
    if (!user) return reply.status(404).send(error(404, '用户不存在'));
    if (user.status !== 1) return reply.status(403).send(error(403, '账号已被禁用'));
    const { accessToken, refreshToken } = await buildTokenPair(user);
    return reply.send(success({ userId: user.id, accessToken, refreshToken }));
  });

  server.post('/auth/wechat/mini/phone', async (request, reply) => {
    await authenticate(request);
    const { code } = request.query as { code: string };
    if (!isWechatMiniConfigured()) return reply.send(success({ mock: true }));
    const phone = await getPhoneNumber(code);
    let user = await findUserByPhone(phone);
    if (!user) {
      user = await createUser({
        phone,
        nickname: `用户${phone.slice(-4)}`,
        roleId: 0,
        status: 1,
      });
    }
    return reply.send(success({ userId: user.id, phone }));
  });

  server.post('/auth/wechat/mini/rebind', async (request, reply) => {
    await authenticate(request);
    const { code } = request.query as { code: string };
    if (!isWechatMiniConfigured()) return reply.send(success({ mock: true }));
    const session = await jscode2session(code);
    const existing = await findThirdPartyAccount('wechat', session.openId);
    if (existing && existing.userId !== request.userId) {
      return reply.status(409).send(error(409, '该微信已绑定其他账号'));
    }
    await removeBindingByPlatform(request.userId!, 'wechat');
    await createThirdPartyBinding({
      userId: request.userId!,
      openId: session.openId,
      unionId: session.unionId,
      platform: 'wechat',
    });
    return reply.send(success({ rebound: true }));
  });

  // 企业微信
  server.get('/auth/login/enterprise/pc/wxCode', async (request, reply) => {
    const { code } = request.query as { code: string };
    if (!isWecomConfigured()) return reply.send(success({ mock: true, msg: '企业微信未配置' }));
    const session = await wecomCode2session(code);
    return reply.send(success(session));
  });

  // 图形验证码
  server.get('/auth/captcha', async (_request, reply) => {
    const captchaKey = generateCaptchaKey();
    const code = generateCaptchaCode();
    const img = generateCaptchaImage(code);
    await saveCaptcha(captchaKey, code);
    return reply.send(success({ captchaKey, img }));
  });

  server.post('/auth/captcha/verify', async (request, reply) => {
    const parsed = captchaVerifySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const stored = await findCaptcha(parsed.data.captchaKey);
    if (!stored) return reply.status(400).send(error(400, '验证码不存在或已过期'));
    const ok = verifyCaptcha(stored.code, parsed.data.code);
    await deleteCaptcha(parsed.data.captchaKey);
    if (!ok) return reply.status(400).send(error(400, '验证码错误'));
    return reply.send(success({ verified: true }));
  });

  // SMS
  server.post('/auth/sms/code', async (request, reply) => {
    const parsed = smsCodeSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const result = await sendSmsCode(parsed.data.phone);
    if (!result.success) return reply.status(429).send(error(429, result.msg));
    return reply.send(success({ sent: true }));
  });

  // OAuth2 授权
  server.get('/auth/oauth/authorize', async (request, reply) => {
    await authenticate(request);
    const { client_id, redirect_uri, state, scope, code_challenge, code_challenge_method } = request.query as {
      client_id: string;
      redirect_uri: string;
      state: string;
      scope?: string;
      code_challenge?: string;
      code_challenge_method?: string;
    };
    if (!state) return reply.status(400).send(error(400, 'state 不能为空'));
    const app = await findOAuthAppByClientId(client_id);
    if (!app || app.isActive !== 1) return reply.status(404).send(error(404, '应用不存在或已禁用'));
    const redirectUris = (app.redirectUris as string[]) ?? [];
    if (!redirectUris.includes(redirect_uri)) return reply.status(400).send(error(400, 'redirect_uri 不在白名单'));
    const code = generateAuthCode();
    await createOAuthSession({
      code,
      clientId: client_id,
      userId: request.userId!,
      state,
      scope,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
    });
    await createAuditLog({ event: 'authorize', clientId: client_id, userId: request.userId!, status: 'success' });
    const sep = redirect_uri.includes('?') ? '&' : '?';
    return reply.send(success({ code, state, redirect_uri: `${redirect_uri}${sep}code=${code}&state=${state}` }));
  });

  server.post('/auth/oauth/token', async (request, reply) => {
    const { code, client_id, client_secret, state } = request.body as {
      code: string;
      client_id: string;
      client_secret: string;
      state?: string;
    };
    const app = await findOAuthAppByClientId(client_id);
    if (!app || app.clientSecret !== client_secret) {
      return reply.status(401).send(error(401, '应用凭证错误'));
    }
    const session = await findSessionByCode(code);
    if (!session || session.isUsed || session.expiresAt < new Date()) {
      return reply.status(400).send(error(400, '授权码无效或已过期'));
    }
    if (state && session.state !== state) return reply.status(400).send(error(400, 'state 不匹配'));
    await markSessionUsed(code);
    const user = await findUserById(session.userId);
    if (!user) return reply.status(404).send(error(404, '用户不存在'));
    const { accessToken } = await buildTokenPair(user);
    await createAuditLog({ event: 'token', clientId: client_id, userId: user.id, status: 'success' });
    return reply.send(success({ access_token: accessToken, token_type: 'Bearer' }));
  });

  // OAuth2 应用管理
  server.post('/auth/oauth/apps/create', async (request, reply) => {
    await authenticate(request);
    const parsed = oauthAppCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const clientId = generateClientId();
    const clientSecret = generateClientSecret();
    const app = await createOAuthApp({
      clientId,
      clientSecret,
      name: parsed.data.name,
      description: parsed.data.description,
      redirectUris: parsed.data.redirectUris,
      scopes: parsed.data.scopes,
      icon: parsed.data.icon,
      ownerUuid: request.userId!,
    });
    return reply.send(success(app));
  });

  server.get('/auth/oauth/apps/list', async (request, reply) => {
    await authenticate(request);
    const { page = '1', limit = '20' } = request.query as { page: string; limit: string };
    const result = await listOAuthApps(request.userId!, parseInt(page, 10), parseInt(limit, 10));
    return reply.send(success(result));
  });

  server.delete('/auth/oauth/apps/:clientId', async (request, reply) => {
    await authenticate(request);
    const { clientId } = request.params as { clientId: string };
    await deleteOAuthApp(clientId, request.userId!);
    return reply.send(success({ deleted: true }));
  });

  // 已授权应用
  server.get('/auth/oauth/my-authorized', async (request, reply) => {
    await authenticate(request);
    const sessions = await listUserSessions(request.userId!);
    return reply.send(success({ items: sessions }));
  });

  server.delete('/auth/oauth/my-authorized/:sessionId', async (request, reply) => {
    await authenticate(request);
    const { sessionId } = request.params as { sessionId: string };
    await deleteSession(sessionId);
    return reply.send(success({ deleted: true }));
  });

  // Scope 元数据
  server.get('/auth/oauth/scope-meta', async (_request, reply) => {
    const scopes = await listActiveScopeMeta();
    return reply.send(success({ items: scopes }));
  });

  // 第三方绑定
  server.get('/auth/bindings', async (request, reply) => {
    await authenticate(request);
    const bindings = await listUserBindings(request.userId!);
    return reply.send(success({ items: bindings }));
  });

  server.delete('/auth/bindings/:id', async (request, reply) => {
    await authenticate(request);
    const { id } = request.params as { id: string };
    await removeBinding(id, request.userId!);
    return reply.send(success({ deleted: true }));
  });

  server.post('/auth/bindings/remove', async (request, reply) => {
    await authenticate(request);
    const parsed = bindingRemoveSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    if (parsed.data.uuid !== request.userId) {
      return reply.status(403).send(error(403, '无权操作此绑定'));
    }
    await removeBindingByPlatform(parsed.data.uuid, parsed.data.platform);
    return reply.send(success({ removed: true }));
  });

  // 用户 SK
  server.post('/auth/user-sk/create', async (request, reply) => {
    await authenticate(request);
    const key = generateUserSk();
    const sk = await createUserSk(request.userId!, key);
    return reply.send(success(sk));
  });

  server.get('/auth/user-sk/list', async (request, reply) => {
    await authenticate(request);
    const { page = '1', limit = '20' } = request.query as { page: string; limit: string };
    const result = await listUserSk(request.userId!, parseInt(page, 10), parseInt(limit, 10));
    return reply.send(success(result));
  });

  server.put('/auth/user-sk/:skId', async (request, reply) => {
    await authenticate(request);
    const { skId } = request.params as { skId: string };
    const { status } = request.body as { status: number };
    await updateUserSk(skId, request.userId!, status);
    return reply.send(success({ updated: true }));
  });

  server.delete('/auth/user-sk/:skId', async (request, reply) => {
    await authenticate(request);
    const { skId } = request.params as { skId: string };
    await deleteUserSk(skId, request.userId!);
    return reply.send(success({ deleted: true }));
  });
};
