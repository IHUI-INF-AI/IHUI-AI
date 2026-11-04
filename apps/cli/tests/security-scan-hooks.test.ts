// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全扫描 × hooks 事件面接线测试(G-12 落地席,2026-11-01)。
 *
 * 钉住的契约(全部断言**副作用与形状**,不断言文案措辞):
 *  ① 命中形态(硬编码凭据样式)⇒ 产出告警行 **且用户文件字节不变**;
 *  ② 干净改动 ⇒ status=clean 且扫描真的跑过(scan-ran),零告警零异常;
 *  ③ 取不到输入 ⇒ status=undetermined + missing 点名,且带 not-judged-safe、
 *     **绝不**出现 status=clean(反向牙:谁把缺输入折成"安全",本用例翻红);
 *  ④ 扫描器自身抛异常 ⇒ proceed 依旧 true、工具调用正常结果不被毁(§12e);
 *  ⑤ CLI 既有行为兼容:命令壳只 import 判据层,不再持有第二份判据(形状锁,§0.6/§22c)。
 *
 * 判据单源纪律:本文件不复制任何正则/模式常量 —— 夹具命中形态由生产模式表驱动
 * (SECRET_SCAN_PATTERNS),测试只造"必然命中 aws-access-key-id 一行"的最小内容。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { Command } from 'commander';

import { runPostToolCall, runHook, SECURITY_SCAN_LINE_PREFIX } from '../src/hooks/index.js';
import {
  SECRET_SCAN_PATTERNS,
  describeScanOutcome,
  resetFindingsMemoryForTest,
  reviewWorkspaceChanges,
  scanEditedFile,
  scanText,
  type SecretScanOutcome,
} from '../src/security/secret-scan.js';
import {
  parseNonNegativeInt,
  parsePositiveInt,
  parseScore,
} from '../src/security/audit-guards.js';
import { registerSecurityCommand } from '../src/commands/security.js';

const SRC_DIR = path.resolve(__dirname, '..', 'src');

// 必然命中 aws-access-key-id 模式的最小夹具(AWS 官方文档示例形态,不是真凭据)。
const FINDING_LINE = 'const KEY = "AKIAIOSFODNN7EXAMPLE";';

let tmpDir: string;
let origConfig: string | undefined;
let origTrust: string | undefined;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-g12-security-'));
  // 钩子配置钉死为空束:内置扫描层不依赖用户 hooks.json,本测试要的是"零用户钩子"面。
  const hooksFile = path.join(tmpDir, 'empty-hooks.json');
  fs.writeFileSync(hooksFile, '{}', 'utf-8');
  origConfig = process.env.IHUI_HOOKS_CONFIG;
  origTrust = process.env.IHUI_TRUST_WORKSPACE;
  process.env.IHUI_HOOKS_CONFIG = hooksFile;
  process.env.IHUI_TRUST_WORKSPACE = '1';
  resetFindingsMemoryForTest();
});

afterEach(() => {
  if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origConfig;
  if (origTrust === undefined) delete process.env.IHUI_TRUST_WORKSPACE;
  else process.env.IHUI_TRUST_WORKSPACE = origTrust;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFixture(name: string, content: string): string {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, content, 'utf-8');
  return p;
}

describe('G-12 ① 命中形态 ⇒ 告警产出且用户文件未被修改', () => {
  it('runPostToolCall(write_file) 对含硬编码凭据样式的落盘文件产 security-scan 告警行,文件字节逐字节不变', async () => {
    const target = writeFixture('leaky.ts', `${FINDING_LINE}\n`);
    const bytesBefore = fs.readFileSync(target);
    const result = await runPostToolCall('write_file', { path: target, bytes: bytesBefore.length });

    expect(result.proceed).toBe(true); // warn-only:永不阻断
    expect(result.additionalContext ?? '').toContain(SECURITY_SCAN_LINE_PREFIX);
    expect(result.additionalContext ?? '').toContain('status=findings');
    // 副作用断言:守卫只读不写 —— 用户文件逐字节一致
    expect(fs.readFileSync(target).equals(bytesBefore)).toBe(true);
    // 凭据原文不得进回传通道(告警只带遮蔽形态)
    expect(result.additionalContext ?? '').not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('同一命中在去重窗口内第二次派发 new=0(不重复刷屏,但仍如实是 findings)', async () => {
    const target = writeFixture('leaky2.ts', `${FINDING_LINE}\n`);
    const first = await runPostToolCall('write_file', { path: target });
    const second = await runPostToolCall('write_file', { path: target });
    expect(first.additionalContext ?? '').toContain('status=findings');
    expect(second.additionalContext ?? '').toContain('status=findings');
    expect(second.additionalContext ?? '').toContain('new=0');
  });
});

describe('G-12 ② 干净改动 ⇒ 零告警且没有扫描异常', () => {
  it('runPostToolCall(edit_file) 对干净内容给 status=clean + scan-ran(真扫过,不是没扫)', async () => {
    const target = writeFixture('clean.ts', 'export const VERSION = "1.2.3";\n');
    const result = await runPostToolCall('edit_file', { path: target, replacements: 1 });
    expect(result.proceed).toBe(true);
    const ctx = result.additionalContext ?? '';
    expect(ctx).toContain('status=clean');
    expect(ctx).toContain('scan-ran');
    expect(ctx).not.toContain('status=findings');
    expect(ctx).not.toContain('status=undetermined');
  });

  it('非编辑工具(write_file 之外的 bash)不触发扫描腿(形状逐字节不变)', async () => {
    const result = await runPostToolCall('bash', { exitCode: 0 });
    expect(result.additionalContext).toBeUndefined();
  });
});

describe('G-12 ③ 取不到输入 ⇒ 未判定并点名缺什么(反向牙:绝不冒绿)', () => {
  it('scanText 收到非字符串输入 ⇒ undetermined,missing 点名,不可能被读成 clean', () => {
    const outcome = scanText(undefined, 'origin-x');
    expect(outcome.status).toBe('undetermined');
    expect(outcome.missing.length).toBeGreaterThan(0);
    // 反向牙:任何"缺输入 ⇒ clean"的改动都会在这里翻红
    expect(outcome.status).not.toBe('clean');
    const body = describeScanOutcome(outcome);
    expect(body).toContain('not-judged-safe');
    expect(body).not.toContain('status=clean');
  });

  it('scanEditedFile 拿不到路径 ⇒ undetermined 点名 tool-output-file-path-missing', () => {
    const outcome = scanEditedFile({ bytes: 12 });
    expect(outcome.status).toBe('undetermined');
    expect(outcome.missing.join(';')).toContain('tool-output-file-path-missing');
  });

  it('reviewWorkspaceChanges 的 git 采集全部失败 ⇒ undetermined 逐条点名,不返回"安全"', () => {
    const failing = (): { ok: false; error: string } => ({ ok: false, error: 'git: not a repository' });
    const outcome = reviewWorkspaceChanges(tmpDir, failing as never);
    expect(outcome.status).toBe('undetermined');
    expect(outcome.missing.join(';')).toContain('git-diff-HEAD-unavailable');
    expect(outcome.missing.join(';')).toContain('git-ls-files-others-unavailable');
    expect(describeScanOutcome(outcome)).toContain('not-judged-safe');
  });

  it('runHook(stop) 在无 git 仓库的目录收场 ⇒ 告警行是 undetermined 而非缺省/安全', async () => {
    // 空束目录:git 两条采集命令都会失败(不在任何仓库内) ⇒ 只能落未判定
    const result = await runHook('stop', { workspacePath: tmpDir });
    const ctx = result.additionalContext ?? '';
    expect(ctx).toContain(SECURITY_SCAN_LINE_PREFIX);
    expect(ctx).toContain('status=undetermined');
    expect(ctx).not.toContain('status=clean');
    expect(result.proceed).toBe(true);
  });
});

describe('G-12 stop 层真仓库端到端(未跟踪文件命中 ⇒ findings)', () => {
  function git(args: string[], cwd: string): boolean {
    try {
      execFileSync('git', args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生 git 必须显式 stdio
        windowsHide: true,
        timeout: 15_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  it('git 可用时:初始化仓库 + 提交基线 + 未跟踪凭据文件 ⇒ 收场审查给 findings 且文件未被修改', async () => {
    const repo = path.join(tmpDir, 'repo');
    fs.mkdirSync(repo, { recursive: true });
    const identity = ['-c', 'user.email=t@example.invalid', '-c', 'user.name=ihui-g12-test', '-c', 'commit.gpgsign=false'];
    if (!git(['init', '-q'], repo) || !git([...identity, 'commit', '--allow-empty', '-q', '-m', 'base'], repo)) {
      return; // 本机无 git ⇒ 本用例不适用(未判定形态已由上一条覆盖)
    }
    fs.writeFileSync(path.join(repo, 'app.config.ts'), `${FINDING_LINE}\n`, 'utf-8');
    const result = await runHook('stop', { workspacePath: repo });
    const ctx = result.additionalContext ?? '';
    expect(ctx).toContain('status=findings');
    expect(ctx).not.toContain('AKIAIOSFODNN7EXAMPLE'); // 遮蔽纪律在 stop 层同样成立
    expect(result.proceed).toBe(true);
  });
});

describe('G-12 ④ 扫描器自身抛异常 ⇒ 不影响本次工具调用的正常结果', () => {
  it('scanEditedFile 崩溃被接成 scan-adapter-crashed 未判定行,proceed 不变、无异常传导', async () => {
    vi.resetModules();
    vi.doMock('../src/security/secret-scan.js', async (importOriginal) => {
      const actual = await (importOriginal as () => Promise<Record<string, unknown>>)();
      return {
        ...actual,
        scanEditedFile: (): never => {
          throw new Error('boom-scanner-self-crash');
        },
      };
    });
    try {
      const mod = await import('../src/hooks/index.js');
      const target = writeFixture('clean3.ts', 'export const OK = true;\n');
      const result = await mod.runPostToolCall('write_file', { path: target });
      expect(result.proceed).toBe(true);
      const ctx = result.additionalContext ?? '';
      expect(ctx).toContain('status=undetermined');
      expect(ctx).toContain('scan-adapter-crashed');
      expect(ctx).not.toContain('status=clean');
    } finally {
      vi.doUnmock('../src/security/secret-scan.js');
      vi.resetModules();
    }
  });
});

describe('G-12 ⑤ 形状锁:判据只住一处 + CLI 既有行为兼容', () => {
  const commandShell = fs.readFileSync(path.join(SRC_DIR, 'commands', 'security.ts'), 'utf-8');
  const hooksWiring = fs.readFileSync(path.join(SRC_DIR, 'hooks', 'index.ts'), 'utf-8');

  it('命令壳不持有第二份判据:import 判据层,且文件体内不再自定义守卫/校验函数', () => {
    expect(commandShell).toContain("'../security/audit-guards.js'");
    expect(commandShell).not.toMatch(/function\s+isSecurityLogEntry/);
    expect(commandShell).not.toMatch(/function\s+parsePositiveInt/);
    expect(commandShell).toContain('export function registerSecurityCommand');
  });

  it('hooks 接线面只调用不复制:不出现模式常量,判据 import 自 secret-scan', () => {
    expect(hooksWiring).toContain("'../security/secret-scan.js'");
    expect(hooksWiring).not.toContain('SECRET_SCAN_PATTERNS');
    expect(hooksWiring).not.toMatch(/AKIA\[0-9A-Z\]/);
  });

  it('模式表单源在场且字段齐(id/severity/source/reminder),测试夹具由它驱动', () => {
    expect(SECRET_SCAN_PATTERNS.length).toBeGreaterThan(0);
    for (const p of SECRET_SCAN_PATTERNS) {
      expect(typeof p.id).toBe('string');
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(p.severity);
      expect(new RegExp(p.source).global).toBe(false); // 逐行判据不许带 /g(lastIndex 漂移)
    }
  });

  it('CLI 判据行为兼容:参数校验语义逐格照旧(既有命令依赖的现值)', () => {
    expect(parsePositiveInt(undefined, 50, 200, 'limit')).toBe(50);
    expect(parsePositiveInt('999', 50, 200, 'limit')).toBe(200); // 上限钳制
    expect(() => parsePositiveInt('0', 1, 10, 'page')).toThrow();
    expect(parseNonNegativeInt(undefined, 0, 'offset')).toBe(0);
    expect(() => parseNonNegativeInt('-1', 0, 'offset')).toThrow();
    expect(parseScore(undefined, 'min-score')).toBeUndefined();
    expect(parseScore('55', 'min-score')).toBe(55);
    expect(() => parseScore('101', 'min-score')).toThrow();
  });

  it('命令注册面兼容:security 命令组与 audit/scan/report 三子命令齐备', () => {
    const program = new Command();
    program.exitOverride();
    registerSecurityCommand(program);
    const sec = program.commands.find((c) => c.name() === 'security');
    expect(sec).toBeDefined();
    const subNames = (sec as Command).commands.map((c) => c.name()).sort();
    expect(subNames).toEqual(['audit', 'report', 'scan']);
  });
});

// ---------------------------------------------------------------------------
// /goal R2(2026-11-04):自治派发「我量不动」被读成「没推进」的真断链
// ---------------------------------------------------------------------------
//
// 立因(台账实证):`.ihui-agent/state/auto-evolve-ledger.jsonl` 219 行
// `git-diff-HEAD-unavailable: spawnSync git ETIMEDOUT`、222 行
// `...;git-diff-HEAD-unavailable: spawnSync git ENOBUFS`。旧实现把内容扫描预算
// (400 KiB) 当成 git stdout 上限,多席并发工作树上的 `git diff HEAD` 一超
// 464 KiB 就 ENOBUFS ⇒ 安全审查落 status=undetermined ⇒ 派发面读成 no_progress。
//
// 第 1 条是**行为锁**:真造一份 > 旧上限的 diff,旧实现必红、修后必绿,
// 天然构成变异自证(把 GIT_MAX_BUFFER_BYTES 改回 464 KiB ⇒ 本条翻红)。
// 第 2 条是**常量契约锁**:防有人把 git 派生预算重新绑回内容扫描预算,
// 或把 60s 墙钟改回 10s(ETIMEDOUT 那一半病灶)。
describe('/goal R2 收场审查 git 派生预算(自治派发空转真断链)', () => {
  function gitIn(args: string[]): void {
    execFileSync('git', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 64 << 20,
    });
  }

  it('大 diff(> 旧 464KiB maxBuffer)仍采得到,不得因 ENOBUFS 落采集失败', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-r2-bigdiff-'));
    try {
      gitIn(['init', '-q', dir]);
      gitIn(['-C', dir, 'config', 'user.email', 'r2@test.local']);
      gitIn(['-C', dir, 'config', 'user.name', 'r2']);
      const big = path.join(dir, 'big.txt');
      fs.writeFileSync(big, 'A'.repeat(600 * 1024) + '\n', 'utf-8');
      gitIn(['-C', dir, 'add', 'big.txt']);
      gitIn(['-C', dir, 'commit', '-qm', 'base']);
      fs.writeFileSync(big, 'B'.repeat(600 * 1024) + '\n', 'utf-8');
      const outcome = reviewWorkspaceChanges(dir);
      const missing = outcome.missing.join(';');
      expect(missing, `采集失败原因: ${missing}`).not.toContain('git-diff-HEAD-unavailable');
      expect(missing).not.toContain('ENOBUFS');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('git 派生预算与内容扫描预算解耦,且墙钟不小于 60s(常量契约)', () => {
    const src = fs.readFileSync(path.join(SRC_DIR, 'security', 'secret-scan.ts'), 'utf-8');
    expect(src).toMatch(/const\s+GIT_MAX_BUFFER_BYTES\s*=/);
    expect(src).not.toMatch(/maxBuffer:\s*MAX_SCAN_TOTAL_BYTES/);
    const bufExpr = /const\s+GIT_MAX_BUFFER_BYTES\s*=\s*([^;]+);/.exec(src)?.[1] ?? '';
    const timeout = /const\s+GIT_TIMEOUT_MS\s*=\s*([\d_]+)\s*;/.exec(src)?.[1] ?? '0';
    // 只求值常量表达式(64 << 20 这类),不执行整份源码;避免把常量锁写成易腐烂的整行切片。
    const bufValue = Function(`"use strict"; return (${bufExpr});`)() as number;
    expect(bufValue).toBeGreaterThanOrEqual(64 * 1024 * 1024);
    expect(Number(timeout.replace(/_/g, ''))).toBeGreaterThanOrEqual(60_000);
    // fail-closed 的内容扫描预算必须原样在位,不得被顺手放大
    expect(src).toContain('const MAX_SCAN_TOTAL_BYTES = 409_600;');
    expect(src).toContain('const MAX_SCAN_FILES_PER_REVIEW = 30;');
  });
});

// 类型面自检:outcome 值域封闭在观察/推断之外不得多出"默认安全"这一格
const _statusDomainLock: SecretScanOutcome['status'][] = ['findings', 'clean', 'undetermined'];
expect(_statusDomainLock).toHaveLength(3);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
