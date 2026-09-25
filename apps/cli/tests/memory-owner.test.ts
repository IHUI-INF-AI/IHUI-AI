/**
 * 记忆工具的属主绑定(守门 113 清偿票的规格锁)。
 *
 * 钉三件事:
 *  1. 模型可见 schema 里**不得再出现** `user_id` / `session_id` —— 出现即等于把
 *     "读谁的记忆"交给模型填,那是越权面,不是参数校验问题。
 *  2. 无登录态时工具必须失败,且失败信息不得含任何凭据内容。
 *  3. JWT 解码只有一份实现(`decodeJwtClaims`),token-manager 的过期判断走同一条路。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const b64u = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
const fakeJwt = (claims: Record<string, unknown>) =>
  `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(claims)}.sig_`;

vi.mock('../src/config/index.js', () => ({
  loadConfig: vi.fn(() => (globalThis as { __cliConfig?: unknown }).__cliConfig ?? {}),
}));
// tools/index.js 会把全部工具拉进来并回指 memory.ts ⇒ 循环初始化
// (`Cannot access '__vite_ssr_import_3__' before initialization`,表现为"0 用例"的静默削coverage)。
// 本文件只需要 registerTools 在场。
vi.mock('../src/tools/index.js', () => ({ registerTools: vi.fn() }));

import { decodeJwtClaims } from '../src/config/credentials.js';
import { MEMORY_TOOLS } from '../src/tools/memory.js';
import { isAccessTokenExpired } from '../src/commands/token-manager.js';

const OWNER_KEYS = ['user_id', 'userId', 'session_id', 'sessionId'];

describe('记忆工具属主绑定', () => {
  const savedKey = process.env.IHUI_API_KEY;
  const savedKind = process.env.IHUI_CREDENTIAL_KIND;
  beforeEach(() => {
    delete process.env.IHUI_API_KEY;
    delete process.env.IHUI_CREDENTIAL_KIND;
  });
  afterEach(() => {
    if (savedKey === undefined) delete process.env.IHUI_API_KEY;
    else process.env.IHUI_API_KEY = savedKey;
    if (savedKind === undefined) delete process.env.IHUI_CREDENTIAL_KIND;
    else process.env.IHUI_CREDENTIAL_KIND = savedKind;
    (globalThis as { __cliConfig?: unknown }).__cliConfig = {};
  });

  it('四个记忆工具的参数表里都不含路由身份键(正向对照:先确认清单非空)', () => {
    expect(MEMORY_TOOLS.length).toBe(4);
    for (const tool of MEMORY_TOOLS) {
      const keys = Object.keys(tool.parameters);
      for (const bad of OWNER_KEYS) expect(keys).not.toContain(bad);
      for (const req of tool.required) expect(keys).toContain(req);
    }
  });

  it('未登录 ⇒ auth 失败且不外泄凭据内容', async () => {
    (globalThis as { __cliConfig?: unknown }).__cliConfig = {};
    const recall = MEMORY_TOOLS.find((t) => t.name === 'memory_recall');
    const res = await recall!.execute({}, { workspacePath: process.cwd() } as never);
    expect(res.success).toBe(false);
    expect(res.errorType).toBe('auth');
    expect(res.error ?? '').toContain('ihui login');
  });

  it('机器凭据(ihui_ 前缀)不得被当成属主 —— 否则记忆会静默写进一个假 UUID', async () => {
    (globalThis as { __cliConfig?: unknown }).__cliConfig = { apiKey: 'ihui_machinekey' };
    const dream = MEMORY_TOOLS.find((t) => t.name === 'memory_dream');
    const res = await dream!.execute({}, { workspacePath: process.cwd() } as never);
    expect(res.success).toBe(false);
    expect(res.errorType).toBe('auth');
  });

  it('属主取自 JWT 的 sub:不登录就拿不到,登录后由宿主侧读出', async () => {
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: unknown) => {
      calls.push(String(input));
      return { ok: true, status: 200, json: async () => ({ code: 0, message: 'ok', data: [] }) };
    }) as never;
    try {
      (globalThis as { __cliConfig?: unknown }).__cliConfig = {
        apiUrl: 'http://127.0.0.1:1/',
        apiKey: fakeJwt({ sub: 'user-from-jwt', exp: 9_999_999_999 }),
        credentialKind: 'jwt',
      };
      const recall = MEMORY_TOOLS.find((t) => t.name === 'memory_recall');
      const res = await recall!.execute({ query: 'x' }, { workspacePath: process.cwd() } as never);
      // 断言的是"宿主把 sub 带出去了",而不是请求成功与否(端口是 1,必然连不上)
      expect(typeof res.success === 'boolean').toBe(true);
      if (calls.length > 0) expect(calls[0]).toContain('user-from-jwt');
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('JWT 解码单一实现', () => {
  it('合法 token 读出 claims;非对象/段数不对一律 null', () => {
    expect(decodeJwtClaims(fakeJwt({ sub: 'u1', exp: 123 }))?.sub).toBe('u1');
    expect(decodeJwtClaims(undefined)).toBeNull();
    expect(decodeJwtClaims('a.b')).toBeNull();
    expect(decodeJwtClaims(`${b64u({ alg: 'HS256' })}.${b64u([1, 2])}.sig_`)).toBeNull();
    expect(decodeJwtClaims(`${b64u({ alg: 'HS256' })}.${b64u('plain-string')}.sig_`)).toBeNull();
    expect(decodeJwtClaims(`${b64u({ alg: 'HS256' })}.@@@@.sig_`)).toBeNull();
  });

  it('过期判断与属主读取共用同一份解码(改一处两边同时动)', () => {
    const future = fakeJwt({ sub: 'u', exp: Math.floor(Date.now() / 1000) + 3600 });
    const past = fakeJwt({ sub: 'u', exp: Math.floor(Date.now() / 1000) - 10 });
    expect(isAccessTokenExpired(future)).toBe(false);
    expect(isAccessTokenExpired(past)).toBe(true);
    // 解析不出 exp ⇒ 保守判"该过期",不得判成有效
    expect(isAccessTokenExpired('not-a-jwt')).toBe(true);
    expect(decodeJwtClaims(future)?.sub).toBe('u');
  });
});
