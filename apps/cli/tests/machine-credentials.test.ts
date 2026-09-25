// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O12 机器凭据(API Key)接入回归测试 — 零外部网络。
 *
 * 覆盖面:
 *   1. 凭据分类(ihui_ = 机器 / eyJ… = 人 JWT / 其他 = opaque)
 *   2. settings.json 向后兼容(旧文件无 credentialKind 也正确判定,字段与优先级不变)
 *   3. 出站请求头(两类凭据分别正确携带 Authorization / X-Api-Secret)
 *   4. secret 与 token 脱敏(前 6 后 2 + 长度,明文绝不出现)
 *   5. 入站鉴权两条通道 + scope 能力闸 + errorCode 可判别
 *   6. 服务端错误 → 本地 errorCode 归一化
 *   7. ihui serve HTTP 面(127.0.0.1 临时端口,不出本机)的 errorCode 与响应体
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  SERVER_API_KEY_PREFIX,
  authenticateInbound,
  buildApiAuthHeaders,
  classifyAuthError,
  classifyCredential,
  hasInboundCredentials,
  installOutboundCredentialHeaders,
  isOutboundCredentialHeadersInstalled,
  isMachineCredential,
  machineKeysFromSettings,
  maskSecret,
  parseMachineKeyList,
  preflightCredentialCheck,
  resolveCredentialKind,
  resolveOutboundCredential,
  setCapabilityGate,
  getCapabilityGate,
  withSecretHeader,
  type InboundAuthContext,
  type ResolvedCredential,
} from '../src/config/credentials.js';
import {
  getSettingsPath,
  loadSettings,
  resolveEffectiveConfig,
} from '../src/commands/settings.js';
import { ensureFreshAccessToken } from '../src/commands/token-manager.js';
import { startAgentServer } from '../src/server/http-server.js';
import type { AgentCore } from '../src/server/index.js';

/** 结构合法的假 JWT(header 段 eyJ… 才满足 looksLikeJwt)。 */
const JWT_TOKEN = `eyJhbGciOiJIUzI1NiJ9.${'eyJzdWIiOiIxMjM0NTY3ODkwIn0'.repeat(2)}.SIGNATURE_PART_VALUE`;
const MACHINE_KEY = 'ihui_0123456789abcdef0123456789abcdef';
const MACHINE_SECRET = 'sk_0123456789abcdef01234567';

/** 造一个 exp 可控的假 JWT(仅语义正确,不验签)。 */
function makeJwt(expSeconds: number): string {
  const b64url = (obj: unknown): string =>
    Buffer.from(JSON.stringify(obj), 'utf-8').toString('base64url');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: '1', exp: expSeconds })}.SIGNATURE`;
}

// ==================== 1. 凭据分类 ====================

describe('凭据分类:机器凭据 vs 人凭据', () => {
  it('ihui_ 前缀 = 服务端 API Key', () => {
    expect(SERVER_API_KEY_PREFIX).toBe('ihui_');
    expect(classifyCredential(MACHINE_KEY)).toBe('api_key');
    expect(isMachineCredential(MACHINE_KEY)).toBe(true);
  });

  it('eyJ… 三段 = 人 JWT(不享受机器凭据语义)', () => {
    expect(classifyCredential(JWT_TOKEN)).toBe('jwt');
    expect(isMachineCredential(JWT_TOKEN)).toBe(false);
  });

  it('既非 ihui_ 也非 JWT = opaque,按人凭据保守处理', () => {
    expect(classifyCredential('legacy-random-token-xyz')).toBe('opaque');
    expect(classifyCredential('')).toBeUndefined();
    expect(classifyCredential(undefined)).toBeUndefined();
  });

  it('显式声明优先于前缀推断(允许用户强制覆盖)', () => {
    expect(resolveCredentialKind(MACHINE_KEY, 'jwt')).toBe('jwt');
    expect(resolveCredentialKind('opaque-ish-token', 'api_key')).toBe('api_key');
    expect(resolveCredentialKind(MACHINE_KEY, 'auto')).toBe('api_key');
    expect(resolveCredentialKind(undefined, 'api_key')).toBeUndefined();
  });
});

// ==================== 2. settings.json 向后兼容 ====================

describe('settings.json 向后兼容(O12 不破坏既有读取)', () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  const writeSettings = (obj: Record<string, unknown>): void => {
    const p = getSettingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cli-o12-'));
    originalEnv = { ...process.env };
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
    process.env.IHUI_API_URL = '';
    process.env.IHUI_API_KEY = '';
    process.env.IHUI_API_SECRET = '';
    process.env.IHUI_CREDENTIAL_KIND = '';
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  it('历史文件(只有 apiKey=JWT + refreshToken)仍按原语义读出', () => {
    writeSettings({
      // RFC 2606 保留域,不带端口:这条只验"存进去原样读出来",
      // 造一个 localhost:88xx 假端口会让端口注册表守门把测试数据当成宿主端口占用。
      apiUrl: 'http://cfg.invalid',
      apiKey: JWT_TOKEN,
      refreshToken: 'rt-1',
      maxIterations: 7,
    });
    const s = loadSettings();
    expect(s.apiKey).toBe(JWT_TOKEN);
    expect(s.refreshToken).toBe('rt-1');
    // 缺省即 'auto':无需迁移即可正确判定为 JWT
    expect(s.credentialKind).toBeUndefined();
    expect(classifyCredential(s.apiKey)).toBe('jwt');

    const cfg = resolveEffectiveConfig({});
    expect(cfg.apiKey).toBe(JWT_TOKEN);
    expect(cfg.apiUrl).toBe('http://cfg.invalid');
    expect(cfg.maxIterations).toBe(7);
    expect(cfg.credentialKind).toBe('auto');
    expect(cfg.apiSecret).toBe('');
  });

  it('apiKey 被填成 ihui_ 时自动判为机器凭据(无需任何新字段)', () => {
    writeSettings({ apiKey: MACHINE_KEY });
    const cfg = resolveEffectiveConfig({});
    expect(cfg.credentialKind).toBe('auto');
    expect(isMachineCredential(cfg.apiKey, cfg.credentialKind)).toBe(true);
  });

  it('新增字段 credentialKind / apiSecret / serve.machineKeys 参与合并且不干扰既有字段', () => {
    writeSettings({
      apiKey: MACHINE_KEY,
      credentialKind: 'api_key',
      apiSecret: MACHINE_SECRET,
      serve: { machineKeys: [{ key: MACHINE_KEY, secret: MACHINE_SECRET, scopes: ['chat:write'] }] },
      defaultModel: 'gpt-4o-mini',
    });
    const cfg = resolveEffectiveConfig({});
    expect(cfg.credentialKind).toBe('api_key');
    expect(cfg.apiSecret).toBe(MACHINE_SECRET);
    expect(cfg.model).toBe('gpt-4o-mini');
    expect(loadSettings().serve?.machineKeys?.[0]?.scopes).toEqual(['chat:write']);
  });

  it('优先级:CLI flag > settings.json > env(apiKey / apiSecret / credentialKind 同链路)', () => {
    writeSettings({ apiKey: MACHINE_KEY, apiSecret: MACHINE_SECRET, credentialKind: 'api_key' });
    process.env.IHUI_API_SECRET = 'sk_from_env_0000000000';
    expect(resolveEffectiveConfig({}).apiSecret).toBe(MACHINE_SECRET);

    const fromCli = resolveEffectiveConfig({
      cliApiKey: 'ihui_cli_key_value_000000000000aa',
      cliApiSecret: 'sk_from_cli_0000000000',
      cliCredentialKind: 'jwt',
    });
    expect(fromCli.apiKey).toBe('ihui_cli_key_value_000000000000aa');
    expect(fromCli.apiSecret).toBe('sk_from_cli_0000000000');
    expect(fromCli.credentialKind).toBe('jwt');
  });

  it('env-only 配置(无 settings.json)同样可解析出机器凭据', () => {
    process.env.IHUI_API_KEY = MACHINE_KEY;
    process.env.IHUI_API_SECRET = MACHINE_SECRET;
    const cfg = resolveEffectiveConfig({});
    expect(cfg.apiKey).toBe(MACHINE_KEY);
    expect(cfg.apiSecret).toBe(MACHINE_SECRET);
    expect(resolveOutboundCredential({ cliApiKey: cfg.apiKey, cliApiSecret: cfg.apiSecret })?.kind).toBe('api_key');
  });

  it('非法 credentialKind 值回退 auto,不污染判定', () => {
    writeSettings({ apiKey: JWT_TOKEN, credentialKind: 'not-a-kind' });
    const cfg = resolveEffectiveConfig({});
    expect(cfg.credentialKind).toBe('auto');
    expect(resolveCredentialKind(cfg.apiKey, cfg.credentialKind)).toBe('jwt');
  });
});

// ==================== 3. token-manager:机器凭据不续期 ====================

describe('token-manager 续期隔离(机器凭据不写 refresh、不打网络)', () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  const writeSettings = (obj: Record<string, unknown>): void => {
    const p = getSettingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
  };
  const readSettingsFile = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')) as Record<string, unknown>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cli-o12-tm-'));
    originalEnv = { ...process.env };
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
    process.env.IHUI_API_KEY = '';
    process.env.IHUI_API_SECRET = '';
    process.env.IHUI_CREDENTIAL_KIND = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  it('apiKey 为 ihui_ 时:绝不调用 /api/auth/refresh,原样返回', async () => {
    // 既有 refreshToken 也不得被使用 —— 否则机器身份会被悄悄换成人的 JWT
    writeSettings({ apiKey: MACHINE_KEY, refreshToken: 'rt-must-not-be-used' });
    const fetchMock = vi.fn(() => {
      throw new Error('机器凭据不应触发任何网络请求');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureFreshAccessToken('http://127.0.0.1:9')).resolves.toBe(MACHINE_KEY);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(readSettingsFile().apiKey).toBe(MACHINE_KEY);
  });

  it('apiKey 为未过期 JWT 时:直接返回,无网络', async () => {
    const unexpired = makeJwt(Math.floor(Date.now() / 1000) + 3600);
    writeSettings({ apiKey: unexpired, refreshToken: 'rt' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(ensureFreshAccessToken('http://127.0.0.1:9')).resolves.toBe(unexpired);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('过期 JWT + refreshToken:正常续期并把 credentialKind 显式落为 jwt', async () => {
    const expired = makeJwt(Math.floor(Date.now() / 1000) - 60);
    writeSettings({ apiKey: expired, refreshToken: 'rt-old', defaultModel: 'm-keep' });
    const fresh = makeJwt(Math.floor(Date.now() / 1000) + 7200);
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: 0,
          data: { accessToken: fresh, refreshToken: 'rt-new', expiresIn: 900, refreshExpiresIn: 100 },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureFreshAccessToken('http://127.0.0.1:9')).resolves.toBe(fresh);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:9/api/auth/refresh');
    const written = readSettingsFile();
    expect(written.apiKey).toBe(fresh);
    expect(written.refreshToken).toBe('rt-new');
    expect(written.credentialKind).toBe('jwt');
    // 既有字段不被吞
    expect(written.defaultModel).toBe('m-keep');
  });

  it('防御:即使被诱导走续期,也不会用 JWT 覆盖 ihui_ 机器凭据', async () => {
    // credentialKind 显式声明 jwt ⇒ 进入续期分支;落盘守卫识别出 apiKey 是机器凭据后拒写
    writeSettings({ apiKey: MACHINE_KEY, refreshToken: 'rt-old', credentialKind: 'jwt' });
    const fresh = makeJwt(Math.floor(Date.now() / 1000) + 7200);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            code: 0,
            data: { accessToken: fresh, refreshToken: 'rt-new', expiresIn: 900, refreshExpiresIn: 100 },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await ensureFreshAccessToken('http://127.0.0.1:9');
    const written = readSettingsFile();
    expect(written.apiKey).toBe(MACHINE_KEY);
    expect(written.refreshToken).toBe('rt-old');
  });
});

// ==================== 4. 出站请求头 ====================

describe('出站鉴权头:两类凭据分别正确携带', () => {
  it('机器凭据 → Authorization + X-Api-Secret', () => {
    const cred = resolveOutboundCredential({
      cliApiKey: MACHINE_KEY,
      cliApiSecret: MACHINE_SECRET,
      env: {},
    });
    expect(cred?.kind).toBe('api_key');
    const headers = buildApiAuthHeaders(cred);
    expect(headers.Authorization).toBe(`Bearer ${MACHINE_KEY}`);
    expect(headers['X-Api-Secret']).toBe(MACHINE_SECRET);
  });

  it('人凭据(JWT)→ 仅 Authorization,不带 X-Api-Secret', () => {
    const cred = resolveOutboundCredential({
      cliApiKey: JWT_TOKEN,
      cliApiSecret: MACHINE_SECRET,
      env: {},
    });
    expect(cred?.kind).toBe('jwt');
    const headers = buildApiAuthHeaders(cred);
    expect(headers.Authorization).toBe(`Bearer ${JWT_TOKEN}`);
    expect(headers['X-Api-Secret']).toBeUndefined();
  });

  it('无凭据 → 空头(不发出未鉴权伪装)', () => {
    expect(buildApiAuthHeaders(null)).toEqual({});
    expect(resolveOutboundCredential({ env: {} })).toBeNull();
  });

  it('withSecretHeader 仅对本 CLI apiUrl 下的请求生效', () => {
    const cred: ResolvedCredential = { kind: 'api_key', token: MACHINE_KEY, secret: MACHINE_SECRET };
    const apiBase = 'http://127.0.0.1:8802';

    const hit = withSecretHeader(`${apiBase}/v1/chat/completions`, { method: 'POST' }, cred, apiBase);
    expect(new Headers(hit?.headers).get('x-api-secret')).toBe(MACHINE_SECRET);

    // 第三方主机不得被塞入自有 secret
    expect(withSecretHeader('https://example.com/x', {}, cred, apiBase)).toBeUndefined();
    // 调用方自带 X-Api-Secret 时不覆盖(支持轮换期双写)
    expect(
      withSecretHeader(`${apiBase}/x`, { headers: { 'X-Api-Secret': 'sk_caller_supplied_00' } }, cred, apiBase),
    ).toBeUndefined();
    // JWT 通道 passthrough
    const jwtCred: ResolvedCredential = { kind: 'jwt', token: JWT_TOKEN, secret: MACHINE_SECRET };
    expect(withSecretHeader(`${apiBase}/x`, {}, jwtCred, apiBase)).toBeUndefined();
    // 尾斜杠不影响前缀匹配
    expect(withSecretHeader(`${apiBase}/x`, {}, cred, `${apiBase}/`)).toBeDefined();
  });

  it('installOutboundCredentialHeaders 装机 / 卸机幂等并还原 globalThis.fetch(不发请求)', () => {
    const before = globalThis.fetch;
    const cred: ResolvedCredential = { kind: 'api_key', token: MACHINE_KEY, secret: MACHINE_SECRET };
    const off = installOutboundCredentialHeaders(cred, 'http://127.0.0.1:8802');
    try {
      expect(isOutboundCredentialHeadersInstalled()).toBe(true);
      expect(globalThis.fetch).not.toBe(before);
      // 重复装机只更新凭据,不层层包裹
      installOutboundCredentialHeaders(cred, 'http://127.0.0.1:8803');
      expect(globalThis.fetch).not.toBe(before);
    } finally {
      off();
    }
    expect(isOutboundCredentialHeadersInstalled()).toBe(false);
    expect(globalThis.fetch).toBe(before);
    off(); // 幂等:重复卸载不抛错
    expect(globalThis.fetch).toBe(before);
  });
});

// ==================== 5. 脱敏 ====================
describe('secret / token 脱敏(明文绝不外泄)', () => {
  it('前 6 后 2 + 长度', () => {
    expect(maskSecret(MACHINE_SECRET)).toBe('sk_012***67 (len=27)');
    expect(maskSecret(MACHINE_KEY)).toBe('ihui_0***ef (len=37)');
  });

  it('过短值整体遮蔽;空值返回 undefined', () => {
    expect(maskSecret('12345678')).toBe('***(len=8)');
    expect(maskSecret('')).toBeUndefined();
    expect(maskSecret(undefined)).toBeUndefined();
  });

  it('预检结果只含脱敏态,序列化后不含明文', () => {
    const cred = resolveOutboundCredential({ cliApiKey: MACHINE_KEY, cliApiSecret: MACHINE_SECRET, env: {} });
    const check = preflightCredentialCheck(cred);
    const line = JSON.stringify(check);
    expect(check.ok).toBe(true);
    expect(line).not.toContain(MACHINE_KEY);
    expect(line).not.toContain(MACHINE_SECRET);
    expect(check.maskedSecret).toBe(maskSecret(MACHINE_SECRET));
    expect(check.maskedToken).toBe(maskSecret(MACHINE_KEY));
  });
});

// ==================== 6. 凭据预检 errorCode ====================

describe('凭据预检:缺失 / secret 未带 → agent 可判别 errorCode', () => {
  it('无任何凭据 → CREDENTIAL_MISSING', () => {
    const check = preflightCredentialCheck(null);
    expect(check.ok).toBe(false);
    expect(check.errorCode).toBe('CREDENTIAL_MISSING');
  });

  it('机器凭据未配 secret → SECRET_REQUIRED(服务端默认必带)', () => {
    const cred = resolveOutboundCredential({ cliApiKey: MACHINE_KEY, env: {} });
    expect(preflightCredentialCheck(cred).errorCode).toBe('SECRET_REQUIRED');
    // 过渡期等价 API_KEY_REQUIRE_SECRET=false:降级为通过
    expect(preflightCredentialCheck(cred, { requireSecret: false }).ok).toBe(true);
  });

  it('人凭据不需要 secret;机器凭据带齐 secret 通过', () => {
    expect(preflightCredentialCheck(resolveOutboundCredential({ cliApiKey: JWT_TOKEN, env: {} })).ok).toBe(true);
    expect(
      preflightCredentialCheck(
        resolveOutboundCredential({ cliApiKey: MACHINE_KEY, cliApiSecret: MACHINE_SECRET, env: {} }),
      ).ok,
    ).toBe(true);
  });
});

// ==================== 7. 入站鉴权 ====================

describe('ihui serve 入站鉴权:agent token 或机器凭据透传', () => {
  /**
   * 假能力目录:与服务端能力目录同语义的最小实现。
   * 真实目录由 `ihui serve` 启动时从 @ihui/types 动态装载并注入(见 serve.ts 的能力闸装配),
   * 测试侧刻意不静态引入该包 —— 其桶内自引用环会污染测试的模块初始化顺序。
   */
  const REGISTERED_SCOPES = new Set(['chat:read', 'chat:write', 'agents:read', 'agents:call', 'models:read']);
  const NON_M2M_SCOPES = new Set(['im:send', 'publish:operate', 'sandbox:run', 'diff:apply']);
  const FAKE_GATE = {
    isRegistered: (scope: string) => REGISTERED_SCOPES.has(scope),
    isM2MAllowed: (scope: string) => REGISTERED_SCOPES.has(scope) && !NON_M2M_SCOPES.has(scope),
  };

  afterEach(() => {
    setCapabilityGate(null);
  });

  const ctx: InboundAuthContext = {
    agentToken: 'shared-agent-token',
    machineKeys: [
      { key: MACHINE_KEY, secret: MACHINE_SECRET, scopes: ['chat:write', 'chat:read'] },
      { key: 'ihui_noscopekey0000000000aa', secret: 'sk_noscope0000000000aa', scopes: [] },
    ],
    requireApiSecret: true,
  };

  it('主机未配置任何凭据 → 保持无鉴权语义(行为不变)', () => {
    expect(hasInboundCredentials({})).toBe(false);
    expect(authenticateInbound({}, {})).toEqual({ ok: true, subject: 'anonymous' });
  });

  it('共享 agent token 通过(既有通道不变)', () => {
    expect(authenticateInbound({ authorization: 'Bearer shared-agent-token' }, ctx)).toEqual({
      ok: true,
      subject: 'agent-token',
    });
  });

  it('无凭据 → 401 CREDENTIAL_MISSING', () => {
    const d = authenticateInbound({}, ctx);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.status).toBe(401);
      expect(d.errorCode).toBe('CREDENTIAL_MISSING');
    }
  });

  it('凭据不匹配 → 401 CREDENTIAL_INVALID(不泄露原因细节)', () => {
    const d = authenticateInbound({ authorization: 'Bearer nope' }, ctx);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.errorCode).toBe('CREDENTIAL_INVALID');
      expect(d.message).toBe('Unauthorized');
    }
  });

  it('机器凭据 + 正确 secret → 放行,并回传已授予 scopes', () => {
    const d = authenticateInbound(
      { authorization: `Bearer ${MACHINE_KEY}`, apiSecret: MACHINE_SECRET, requiredScope: 'chat:write' },
      ctx,
    );
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.subject).toBe('machine-key');
      expect(d.scopes).toContain('chat:read');
    }
  });

  it('机器凭据缺 X-Api-Secret → 401 SECRET_REQUIRED', () => {
    const d = authenticateInbound({ authorization: `Bearer ${MACHINE_KEY}`, requiredScope: 'chat:write' }, ctx);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.status).toBe(401);
      expect(d.errorCode).toBe('SECRET_REQUIRED');
    }
  });

  it('X-Api-Secret 不匹配 → CREDENTIAL_INVALID(与"缺 secret"区分开)', () => {
    const d = authenticateInbound(
      { authorization: `Bearer ${MACHINE_KEY}`, apiSecret: 'sk_wrong_wrong_wrong', requiredScope: 'chat:write' },
      ctx,
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.errorCode).toBe('CREDENTIAL_INVALID');
  });

  it('scope 不足 → 403 SCOPE_REQUIRED + requiredScope', () => {
    const d = authenticateInbound(
      {
        authorization: 'Bearer ihui_noscopekey0000000000aa',
        apiSecret: 'sk_noscope0000000000aa',
        requiredScope: 'chat:write',
      },
      ctx,
    );
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.status).toBe(403);
      expect(d.errorCode).toBe('SCOPE_REQUIRED');
      expect(d.requiredScope).toBe('chat:write');
    }
  });

  it('能力闸注入后:不对机器凭据开放的能力 → 403 M2M_FORBIDDEN', () => {
    setCapabilityGate(FAKE_GATE);
    const m2mCtx: InboundAuthContext = {
      machineKeys: [{ key: MACHINE_KEY, secret: MACHINE_SECRET, scopes: ['im:send'] }],
      requireApiSecret: true,
    };
    const d = authenticateInbound(
      { authorization: `Bearer ${MACHINE_KEY}`, apiSecret: MACHINE_SECRET, requiredScope: 'im:send' },
      m2mCtx,
    );
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.status).toBe(403);
      expect(d.errorCode).toBe('M2M_FORBIDDEN');
    }
  });

  it('能力闸注入后:未登记的能力 → 403 M2M_FORBIDDEN(目录漂移不允许静默放行)', () => {
    setCapabilityGate(FAKE_GATE);
    const d = authenticateInbound(
      {
        authorization: `Bearer ${MACHINE_KEY}`,
        apiSecret: MACHINE_SECRET,
        requiredScope: 'totally:unregistered',
      },
      { machineKeys: [{ key: MACHINE_KEY, secret: MACHINE_SECRET, scopes: ['*'] }] },
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.errorCode).toBe('M2M_FORBIDDEN');
  });

  it("'*' 通配只放行已登记且 M2M 开放的能力(platform 域仍拒)", () => {
    setCapabilityGate(FAKE_GATE);
    const wildcardCtx: InboundAuthContext = {
      machineKeys: [{ key: MACHINE_KEY, secret: MACHINE_SECRET, scopes: ['*'] }],
      requireApiSecret: true,
    };
    expect(
      authenticateInbound(
        { authorization: `Bearer ${MACHINE_KEY}`, apiSecret: MACHINE_SECRET, requiredScope: 'chat:read' },
        wildcardCtx,
      ).ok,
    ).toBe(true);
    expect(
      authenticateInbound(
        { authorization: `Bearer ${MACHINE_KEY}`, apiSecret: MACHINE_SECRET, requiredScope: 'im:send' },
        wildcardCtx,
      ).ok,
    ).toBe(false);
  });

  it('未注入能力闸(serve 未启动):scopes 闸仍生效,M2M 交由服务端权威判定', () => {
    expect(getCapabilityGate()).toBeNull();
    const d = authenticateInbound(
      { authorization: `Bearer ${MACHINE_KEY}`, apiSecret: MACHINE_SECRET, requiredScope: 'im:send' },
      { machineKeys: [{ key: MACHINE_KEY, secret: MACHINE_SECRET, scopes: ['im:send'] }] },
    );
    expect(d.ok).toBe(true);
  });

  it('requireApiSecret=false 过渡期:机器凭据可不带 secret(兼容存量纯 key 客户端)', () => {
    const loose: InboundAuthContext = { ...ctx, requireApiSecret: false };
    expect(
      authenticateInbound({ authorization: `Bearer ${MACHINE_KEY}`, requiredScope: 'chat:write' }, loose).ok,
    ).toBe(true);
  });

  it('WS 握手 ?token= 通道保留(header 优先)', () => {
    expect(authenticateInbound({ queryToken: 'shared-agent-token' }, ctx)).toEqual({
      ok: true,
      subject: 'agent-token',
    });
    expect(authenticateInbound({ authorization: 'Bearer nope', queryToken: 'shared-agent-token' }, ctx).ok).toBe(
      false,
    );
  });
});

// ==================== 8. 机器凭据清单解析 ====================

describe('机器凭据清单解析(env / settings 两种载体)', () => {
  it('env 条目格式 key=secret=scope1,scope2(scope 含冒号故用 = 分隔)', () => {
    const list = parseMachineKeyList(
      `${MACHINE_KEY}=${MACHINE_SECRET}=chat:write,chat:read; ihui_second000000000000aa=sk_second00000000aa=`,
    );
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({ key: MACHINE_KEY, secret: MACHINE_SECRET, scopes: ['chat:write', 'chat:read'] });
    expect(list[1]?.scopes).toEqual([]);
    expect(list[1]?.secret).toBe('sk_second00000000aa');
  });

  it('非 ihui_ 前缀 / 空串条目丢弃(容错优先,不抛错)', () => {
    expect(parseMachineKeyList(undefined)).toEqual([]);
    expect(parseMachineKeyList('not-a-key=sk_x;;')).toEqual([]);
    expect(parseMachineKeyList(MACHINE_KEY)).toEqual([{ key: MACHINE_KEY, scopes: [] }]);
  });

  it('settings.serve.machineKeys 只接纳结构合法条目', () => {
    const entries = machineKeysFromSettings({
      machineKeys: [
        { key: MACHINE_KEY, secret: MACHINE_SECRET, scopes: ['chat:read'] },
        { secret: MACHINE_SECRET },
        { key: 'sk_not_a_key' },
      ],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.scopes).toEqual(['chat:read']);
    expect(machineKeysFromSettings(undefined)).toEqual([]);
  });
});

// ==================== 9. 上游错误 → errorCode ====================

describe('服务端鉴权错误归一化', () => {
  it('已带 errorCode 时直接透传', () => {
    expect(classifyAuthError(Object.assign(new Error('x'), { errorCode: 'SCOPE_REQUIRED' }))).toBe(
      'SCOPE_REQUIRED',
    );
    expect(classifyAuthError({ errorCode: 'RATE_BACKEND_UNAVAILABLE' })).toBe('RATE_BACKEND_UNAVAILABLE');
  });

  it('按 status + message 推断', () => {
    expect(classifyAuthError({ status: 401, message: 'X-Api-Secret header is required' })).toBe('SECRET_REQUIRED');
    expect(classifyAuthError({ status: 403, message: 'Missing capability: chat:write' })).toBe('SCOPE_REQUIRED');
    expect(classifyAuthError({ statusCode: 403, message: 'Capability is not available to API keys' })).toBe(
      'M2M_FORBIDDEN',
    );
    expect(classifyAuthError({ status: 503, message: 'Rate limit backend unavailable (fail-close)' })).toBe(
      'RATE_BACKEND_UNAVAILABLE',
    );
  });

  it('错误消息里揉进字面量也能捞出来', () => {
    expect(classifyAuthError(new Error('HTTP 403 {"errorCode":"SCOPE_REQUIRED"}'))).toBe('SCOPE_REQUIRED');
  });

  it('与鉴权无关的错误返回 undefined(保持原始事件形态)', () => {
    expect(classifyAuthError(new Error('socket hang up'))).toBeUndefined();
    expect(classifyAuthError(undefined)).toBeUndefined();
    expect(classifyAuthError({ status: 500, message: 'boom' })).toBeUndefined();
  });
});

// ==================== 10. serve HTTP 面集成(仅 127.0.0.1 临时端口) ====================

interface RequestServerArgs {
  agentToken?: string;
  machineKeys?: InboundAuthContext['machineKeys'];
  requireApiSecret?: boolean;
  path: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  coreOverride?: Partial<AgentCore>;
}

/** 起一个临时端口 server 发一次请求,拿回状态码 + 响应文本。 */
async function requestServer(args: RequestServerArgs): Promise<{ status: number; text: string }> {
  const stubCore = {
    listSessions: () => [],
    resumeSession: async () => null,
    sendMessage: async () => ({ sessionId: 's', stopReason: 'end_turn', iterations: 1, usage: {} }),
    ...args.coreOverride,
  } as unknown as AgentCore;

  const handle = await startAgentServer(stubCore, {
    port: 0,
    token: args.agentToken,
    machineKeys: args.machineKeys,
    requireApiSecret: args.requireApiSecret,
  });
  try {
    const resp = await fetch(`http://127.0.0.1:${handle.port}${args.path}`, {
      method: args.method ?? 'GET',
      headers: args.headers,
      ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
    });
    return { status: resp.status, text: await resp.text() };
  } finally {
    await handle.close();
  }
}

describe('ihui serve HTTP 面:errorCode 可判别 + scope 闸生效', () => {
  const machineKeys = [{ key: MACHINE_KEY, secret: MACHINE_SECRET, scopes: ['chat:read'] }];

  it('agent token 仍可通过 /sessions(向后兼容)', async () => {
    const r = await requestServer({
      agentToken: 'shared-agent-token',
      path: '/sessions',
      headers: { authorization: 'Bearer shared-agent-token' },
    });
    expect(r.status).toBe(200);
  });

  it('裸请求 → 401 + errorCode=CREDENTIAL_MISSING', async () => {
    const r = await requestServer({ agentToken: 'shared-agent-token', path: '/sessions' });
    expect(r.status).toBe(401);
    expect((JSON.parse(r.text) as { errorCode?: string }).errorCode).toBe('CREDENTIAL_MISSING');
  });

  it('机器凭据不带 secret → 401 + SECRET_REQUIRED', async () => {
    const r = await requestServer({
      machineKeys,
      path: '/sessions',
      headers: { authorization: `Bearer ${MACHINE_KEY}` },
    });
    expect(r.status).toBe(401);
    expect((JSON.parse(r.text) as { errorCode?: string }).errorCode).toBe('SECRET_REQUIRED');
  });

  it('机器凭据带齐 secret 但 scope 不足 → 403 + SCOPE_REQUIRED + requiredScope', async () => {
    const r = await requestServer({
      machineKeys,
      path: '/message',
      method: 'POST',
      headers: {
        authorization: `Bearer ${MACHINE_KEY}`,
        'x-api-secret': MACHINE_SECRET,
        'content-type': 'application/json',
      },
      body: { text: 'hi' },
    });
    expect(r.status).toBe(403);
    const payload = JSON.parse(r.text) as { errorCode?: string; requiredScope?: string };
    expect(payload.errorCode).toBe('SCOPE_REQUIRED');
    expect(payload.requiredScope).toBe('chat:write');
  });

  it('scope 齐备 → 200,且响应体不含凭据明文', async () => {
    const r = await requestServer({
      machineKeys,
      path: '/sessions',
      headers: { authorization: `Bearer ${MACHINE_KEY}`, 'x-api-secret': MACHINE_SECRET },
    });
    expect(r.status).toBe(200);
    expect(r.text).not.toContain(MACHINE_SECRET);
    expect(r.text).not.toContain(MACHINE_KEY);
  });

  it('未配置任何入站凭据 → 保持无鉴权(行为不变)', async () => {
    const r = await requestServer({ path: '/health' });
    expect(r.status).toBe(200);
  });

  it('SSE error 事件把上游 scope 错误带上 errorCode', async () => {
    const r = await requestServer({
      machineKeys: [{ key: MACHINE_KEY, secret: MACHINE_SECRET, scopes: ['chat:write'] }],
      path: '/message',
      method: 'POST',
      headers: {
        authorization: `Bearer ${MACHINE_KEY}`,
        'x-api-secret': MACHINE_SECRET,
        'content-type': 'application/json',
      },
      body: { text: 'hi' },
      coreOverride: {
        sendMessage: async () => {
          throw Object.assign(new Error('Missing capability: chat:write'), { status: 403 });
        },
      },
    });
    expect(r.status).toBe(200);
    expect(r.text).toContain('event: error');
    expect(r.text).toContain('"errorCode":"SCOPE_REQUIRED"');
  });

  it('非鉴权类上游错误不硬塞 errorCode(保持原始事件形态)', async () => {
    const r = await requestServer({
      machineKeys: [{ key: MACHINE_KEY, secret: MACHINE_SECRET, scopes: ['chat:write'] }],
      path: '/message',
      method: 'POST',
      headers: {
        authorization: `Bearer ${MACHINE_KEY}`,
        'x-api-secret': MACHINE_SECRET,
        'content-type': 'application/json',
      },
      body: { text: 'hi' },
      coreOverride: {
        sendMessage: async () => {
          throw new Error('provider overloaded');
        },
      },
    });
    expect(r.text).toContain('event: error');
    expect(r.text).not.toContain('errorCode');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
