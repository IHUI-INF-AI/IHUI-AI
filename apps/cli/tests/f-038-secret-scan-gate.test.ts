// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-038 回归锁:secret-scan 从"只告警"改为"可阻断的闸门"。
 *
 * 钉住的契约(断言机器码与副作用,不断言文案措辞):
 *  ① 命中 HIGH 凭据形态 ⇒ proceed=false + terminal=blocked,阻断理由只带规则 id/位置,
 *     不含凭据原文,且用户文件字节不被本层改写;
 *  ② 无命中 ⇒ 放行(status=clean + scan-ran,不是"没扫");
 *  ③ 显式豁免 IHUI_SECRET_SCAN_ALLOW=1 ⇒ 放行且留痕(上下文 gate=exempted + stderr 点名);
 *  ④ 扫描不可用(取不到输入)⇒ 不阻断但标 gate=not-judged,绝不出现 status=clean
 *     (反向牙:谁把"没判成"折成"安全",本条翻红)。
 *
 * 判据单源:夹具命中形态由生产模式表驱动(此处只造必然命中 aws-access-key-id 的一行)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { runPostToolCall, SECURITY_SCAN_LINE_PREFIX, SECRET_SCAN_ALLOW_ENV } from '../src/hooks/index.js';
import { resetFindingsMemoryForTest } from '../src/security/secret-scan.js';

// AWS 官方文档示例形态,不是真凭据;命中 HIGH 档 aws-access-key-id。
const FINDING_LINE = 'const KEY = "AKIAIOSFODNN7EXAMPLE";';

let tmpDir: string;
let origConfig: string | undefined;
let origTrust: string | undefined;
let origAllow: string | undefined;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-f038-secret-gate-'));
  // 空钩子束:内置扫描腿不依赖用户 hooks.json,这里要的是"零用户钩子"面。
  const hooksFile = path.join(tmpDir, 'empty-hooks.json');
  fs.writeFileSync(hooksFile, '{}', 'utf-8');
  origConfig = process.env.IHUI_HOOKS_CONFIG;
  origTrust = process.env.IHUI_TRUST_WORKSPACE;
  origAllow = process.env[SECRET_SCAN_ALLOW_ENV];
  process.env.IHUI_HOOKS_CONFIG = hooksFile;
  process.env.IHUI_TRUST_WORKSPACE = '1';
  delete process.env[SECRET_SCAN_ALLOW_ENV];
  resetFindingsMemoryForTest();
});

afterEach(() => {
  if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origConfig;
  if (origTrust === undefined) delete process.env.IHUI_TRUST_WORKSPACE;
  else process.env.IHUI_TRUST_WORKSPACE = origTrust;
  if (origAllow === undefined) delete process.env[SECRET_SCAN_ALLOW_ENV];
  else process.env[SECRET_SCAN_ALLOW_ENV] = origAllow;
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFixture(name: string, content: string): string {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, content, 'utf-8');
  return p;
}

describe('F-038 ① 命中凭据 ⇒ 阻断', () => {
  it('write_file 落盘文件命中 HIGH 凭据 ⇒ proceed=false / terminal=blocked,理由不泄原文', async () => {
    const target = writeFixture('leaky.ts', `${FINDING_LINE}\n`);
    const bytesBefore = fs.readFileSync(target);
    const result = await runPostToolCall('write_file', { path: target, bytes: bytesBefore.length });

    expect(result.proceed).toBe(false);
    expect(result.terminal).toBe('blocked');
    // 阻断理由可判:点名规则与位置,但不含凭据原文
    expect(result.reason ?? '').toContain('aws-access-key-id');
    expect(result.reason ?? '').not.toContain('AKIAIOSFODNN7EXAMPLE');
    // 上下文里同一结论也以机器码留痕(消费面能看出是闸门拦的)
    expect(result.additionalContext ?? '').toContain('gate=blocked');
    expect(result.additionalContext ?? '').not.toContain('AKIAIOSFODNN7EXAMPLE');
    // 副作用:闸门只读不写
    expect(fs.readFileSync(target).equals(bytesBefore)).toBe(true);
  });
});

describe('F-038 ② 无命中 ⇒ 放行', () => {
  it('干净内容 ⇒ proceed=true 且 status=clean + scan-ran', async () => {
    const target = writeFixture('clean.ts', 'export const VERSION = "1.2.3";\n');
    const result = await runPostToolCall('edit_file', { path: target, replacements: 1 });

    expect(result.proceed).toBe(true);
    const ctx = result.additionalContext ?? '';
    expect(ctx).toContain(SECURITY_SCAN_LINE_PREFIX);
    expect(ctx).toContain('status=clean');
    expect(ctx).toContain('scan-ran');
    expect(ctx).not.toContain('gate=blocked');
  });

  it('非编辑工具不触发扫描腿(不受闸门影响)', async () => {
    const result = await runPostToolCall('bash', { exitCode: 0 });
    expect(result.proceed).toBe(true);
    expect(result.additionalContext).toBeUndefined();
  });
});

describe('F-038 ③ 显式豁免 ⇒ 放行且留痕', () => {
  it(`${SECRET_SCAN_ALLOW_ENV}=1 ⇒ proceed=true,上下文带 gate=exempted 且 stderr 点名`, async () => {
    process.env[SECRET_SCAN_ALLOW_ENV] = '1';
    let stderrText = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderrText += String(chunk);
      return true;
    });

    const target = writeFixture('leaky-exempt.ts', `${FINDING_LINE}\n`);
    const result = await runPostToolCall('write_file', { path: target });

    expect(result.proceed).toBe(true);
    const ctx = result.additionalContext ?? '';
    expect(ctx).toContain('gate=exempted');
    expect(ctx).toContain(SECRET_SCAN_ALLOW_ENV);
    // 留痕:应急通道必须喊出来,且凭据原文仍不得进任何外部面
    expect(stderrText).toContain(SECRET_SCAN_ALLOW_ENV);
    expect(ctx).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(stderrText).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });
});

describe('F-038 ④ 扫描不可用 ⇒ 不静默判过', () => {
  it('拿不到文件路径 ⇒ 放行但标 gate=not-judged,绝不出现 status=clean', async () => {
    const result = await runPostToolCall('write_file', { bytes: 12 });

    expect(result.proceed).toBe(true);
    const ctx = result.additionalContext ?? '';
    expect(ctx).toContain('status=undetermined');
    expect(ctx).toContain('not-judged-safe');
    expect(ctx).toContain('gate=not-judged');
    expect(ctx).not.toContain('status=clean');
  });
});
