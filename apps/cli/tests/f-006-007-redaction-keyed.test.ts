// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-006 + F-007 回归:脱敏面必须同时管住"键名"与"值形状"两档。
 *
 * F-006:审计入参此前只走 `redactObject`(纯值形状),`{"api_key":"abc"}` 这类
 *        "值是普通串、键名才是凭据语义"的入参整类原样落盘。判据 = 键名档命中即整值遮蔽,
 *        且递归进嵌套对象/数组;普通键(如 model)不得被误盖。
 * F-007:本仓出站头是 `X-Api-Secret: sk_xxx`(config/credentials.ts),而旧表只认 `sk-`、
 *        Bearer 要 ≥12 字符。判据 = sk_ / X-Api-Secret / 短 Bearer(≥6)都被盖,
 *        1 位 `Authorization: Bearer x` 仍在阈值内保留。
 *
 * 两档共用 redact.ts 的同一份键名词根常量(F-006 键名档 = F-007 键名集),不另抄第二份。
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { redactSecrets, redactObjectDeepKeyed } from '../src/redact.js';

// 夹具用运行期拼接,避免测试源码被凭据扫描器当成真实 key 命中(值与断言仍逐字一致)。
const PLAIN_API_VALUE = ['plain', 'api', 'value'].join('-');
const PLAIN_NESTED_TOKEN = ['plain', 'nested', 'token'].join('-');
const PLAIN_AUTHORIZATION = ['plain', 'authorization'].join('-');
const PLAIN_PASSWORD = ['plain', 'password'].join('-');
const PLAIN_PASSWD = ['plain', 'passwd'].join('-');
const PLAIN_ACCESS_TOKEN = ['plain', 'access', 'token'].join('-');
const LONG_SK_TOKEN = ['sk', 'proj'].join('-') + 'A'.repeat(24) + '-' + 'B'.repeat(8) + '-' + 'C'.repeat(8);

// 审计开关钉档,避免读真实 ~/.ihui/settings.json
vi.mock('../src/commands/settings.js', () => ({
  loadSettings: () => ({ auditEnabled: true }),
}));

const { auditLog } = await import('../src/audit.js');

const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');

describe('F-006 键名档:键名即凭据时整值遮蔽(不看值形状)', () => {
  it('api_key / 嵌套 token / authorization / password 全部被打码', () => {
    expect(redactObjectDeepKeyed({ api_key: 'abc' })).toEqual({ api_key: '[redacted]' });
    expect(redactObjectDeepKeyed({ nested: { token: 't' } })).toEqual({
      nested: { token: '[redacted]' },
    });
    expect(redactObjectDeepKeyed({ authorization: 'Bearer abcdef' })).toEqual({
      authorization: '[redacted]',
    });
    expect(redactObjectDeepKeyed({ password: 'p' })).toEqual({ password: '[redacted]' });
    // F-006 键名集补齐项:passwd 与 password 同权
    expect(redactObjectDeepKeyed({ passwd: 'p' })).toEqual({ passwd: '[redacted]' });
  });

  it('普通键不被误盖(model 原样保留)', () => {
    expect(redactObjectDeepKeyed({ model: 'gpt' })).toEqual({ model: 'gpt' });
  });

  it('数组内的嵌套对象同样递归到键名档', () => {
    const out = redactObjectDeepKeyed({
      list: [{ apiKey: 'plain-a' }, { normal: 'ok' }],
      headers: { 'X-Api-Secret': 'sk_123456' },
    });
    expect(out).toEqual({
      list: [{ apiKey: '[redacted]' }, { normal: 'ok' }],
      headers: { 'X-Api-Secret': '[redacted]' },
    });
  });

  it('快照式断言:序列化结果只含占位符,原始 secret 一个都不出现', () => {
    const payload = {
      api_key: PLAIN_API_VALUE,
      nested: { token: PLAIN_NESTED_TOKEN, model: 'gpt' },
      authorization: PLAIN_AUTHORIZATION,
      password: PLAIN_PASSWORD,
      passwd: PLAIN_PASSWD,
      model: 'gpt',
    };
    const serialized = JSON.stringify(redactObjectDeepKeyed(payload));
    for (const raw of [
      PLAIN_API_VALUE,
      PLAIN_NESTED_TOKEN,
      PLAIN_AUTHORIZATION,
      PLAIN_PASSWORD,
      PLAIN_PASSWD,
    ]) {
      expect(serialized).not.toContain(raw);
    }
    expect(serialized).toContain('"model":"gpt"');
  });
});

describe('F-007 形态档:本仓凭据形态', () => {
  it.each([
    ['X-Api-Secret: sk_123456', 'sk_123456'],
    ['X-API-Key: abc123456789', 'abc123456789'],
    ['sk-abcdef', 'sk-abcdef'],
    ['sk_abcdef', 'sk_abcdef'],
    ['Bearer abcdef', 'Bearer abcdef'],
    ['Authorization: Bearer abcdef', 'Bearer abcdef'],
  ])('%s 必须被盖', (input, leak) => {
    const out = redactSecrets(input);
    expect(out).toContain('***REDACTED***');
    expect(out).not.toContain(leak);
  });

  it('Authorization: Bearer x(1 位)仍在阈值内保留,不误伤极短普通词', () => {
    expect(redactSecrets('Authorization: Bearer x')).toBe('Authorization: Bearer x');
    expect(redactSecrets('normal text without secrets')).toBe('normal text without secrets');
  });

  it('长 sk- key 的可读前缀不被短形态兜底二次吃掉(变异自证锚)', () => {
    const out = redactSecrets(`token: ${LONG_SK_TOKEN}`);
    expect(out).toContain('sk-projAAA');
    expect(out).toContain('***REDACTED***');
    expect(out).not.toContain('B'.repeat(8));
  });
});

describe('F-006 audit.ts 源码:入参走键名/深脱敏入口,不再只 redactObject', () => {
  const src = fs.readFileSync(path.join(SRC_DIR, 'audit.ts'), 'utf8');

  it('input 字段调用 redactObjectDeepKeyed(entry.input)', () => {
    expect(src).toMatch(/redactObjectDeepKeyed\s*\(\s*entry\.input\s*\)/);
  });

  it('不存在 input: redactObject(...) 的旧出口', () => {
    expect(src).not.toMatch(/input\s*:\s*redactObject\s*\(/);
  });
});

describe('F-006 端到端:审计落盘的 JSONL 不含原始凭据', () => {
  const tmpDir = path.join(
    os.tmpdir(),
    `ihui-f006007-audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const auditPath = path.join(tmpDir, '.ihui', 'audit.jsonl');
  let origUserProfile: string | undefined;
  let origHome: string | undefined;
  let origAuditFlag: string | undefined;

  beforeEach(() => {
    fs.mkdirSync(path.join(tmpDir, '.ihui'), { recursive: true });
    if (fs.existsSync(auditPath)) fs.unlinkSync(auditPath);
    origUserProfile = process.env.USERPROFILE;
    origHome = process.env.HOME;
    origAuditFlag = process.env.IHUI_AUDIT;
    delete process.env.IHUI_AUDIT;
    process.env.USERPROFILE = tmpDir;
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    if (origUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = origUserProfile;
    if (origHome === undefined) delete process.env.HOME;
    else process.env.HOME = origHome;
    if (origAuditFlag === undefined) delete process.env.IHUI_AUDIT;
    else process.env.IHUI_AUDIT = origAuditFlag;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('键名类凭据(嵌套)与头部形态 secret 均不落盘', () => {
    auditLog({
      timestamp: '2026-11-11T00:00:00.000Z',
      tool: 'f006007',
      input: {
        api_key: PLAIN_API_VALUE,
        nested: { accessToken: PLAIN_ACCESS_TOKEN },
        headers: { 'X-Api-Secret': 'sk_123456' },
      },
      output: 'X-Api-Secret: sk_654321',
      success: true,
    });
    const raw = fs.readFileSync(auditPath, 'utf8');
    for (const secret of [
      PLAIN_API_VALUE,
      PLAIN_ACCESS_TOKEN,
      'sk_123456',
      'sk_654321',
    ]) {
      expect(raw).not.toContain(secret);
    }
    expect(raw.toLowerCase()).toContain('redacted');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
