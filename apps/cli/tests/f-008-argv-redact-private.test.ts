// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-008 回归:凭据不得经 argv 明文落盘。
 *
 * 缺陷形态:`ihui login -p 明文密码` → `process.argv` 里带着口令,崩溃日志按
 * `argv.join(' ')` 原样写入 `~/.ihui/crash-logs`,runs manifest 也按原样写
 * `.ihui-agent/state/runs/<id>/manifest.json`,且两处都不保证 0600。
 *
 * 判据分三层:
 *  A 纯函数:只对 `-p/--password/--api-key/--token` 的**值**打码,键名与无关参数逐字保留;
 *  B 源码形状:崩溃日志与清单都不再直接 join 原始 argv,且统一走 writePrivateFile;
 *  C 实落盘:写入临时仓库的 manifest 里没有明文凭据,且 writePrivateFile 被调用。
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
// arch-exempt: 夹具唯一落点 scripts/lib/scratch-dir.mjs(§15b 禁 os.tmpdir),测试面单向借用 tooling 层
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs';
import { ARGV_MASK, redactArgv } from '../src/util/argv-redact.js';
import type * as PrivateFileModule from '../src/lib/private-file.js';

const privateFileCalls = vi.hoisted(() => [] as string[]);

vi.mock('../src/lib/private-file.js', async (importOriginal) => {
  const actual = await importOriginal<typeof PrivateFileModule>();
  return {
    ...actual,
    writePrivateFile: (filePath: string, text: string) => {
      privateFileCalls.push(filePath);
      actual.writePrivateFile(filePath, text);
    },
  };
});

import { writeRunManifest } from '../src/runs/manifest.js';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function readSrc(rel: string): string {
  return readFileSync(join(SRC_DIR, rel), 'utf-8');
}

function makeRepo(root: string): string {
  mkdirSync(join(root, '.git'), { recursive: true });
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
  const deep = join(root, 'apps', 'cli', 'src');
  mkdirSync(deep, { recursive: true });
  return deep;
}

describe('F-008 argv 凭据脱敏(纯函数)', () => {
  it('空格分隔与等号形式都打码值,键名与无关参数原样', () => {
    expect(redactArgv(['-p', 'secret123', '--api-key=sk_x', '--token', 'abc', 'run'])).toEqual([
      '-p',
      ARGV_MASK,
      `--api-key=${ARGV_MASK}`,
      '--token',
      ARGV_MASK,
      'run',
    ]);
  });

  it('--password 等号形式覆盖,且不改写同前缀的无关旗标', () => {
    const input = ['login', '--password=p@ss=word', '--api-url=https://api.example.com', '--model', 'gpt-4'];
    const snapshot = [...input];
    expect(redactArgv(input)).toEqual([
      'login',
      `--password=${ARGV_MASK}`,
      '--api-url=https://api.example.com',
      '--model',
      'gpt-4',
    ]);
    // 纯函数:不改入参
    expect(input).toEqual(snapshot);
  });

  it('旗标在末位(没有值)时只保留键名,不凭空造值', () => {
    expect(redactArgv(['agent', '--token'])).toEqual(['agent', '--token']);
  });

  it('完全无关的 argv 逐字返回', () => {
    const argv = ['run', '--json', 'task with space', '-m', 'gpt-4'];
    expect(redactArgv(argv)).toEqual(argv);
  });
});

describe('F-008 落盘面源码形状', () => {
  it('crash-handler 不再 join 原始 argv,且崩溃日志走 writePrivateFile', () => {
    const src = readSrc('crash-handler.ts');
    expect(src).not.toMatch(/info\.runtime\.argv\.join\(/);
    expect(src).toMatch(/redactArgv\(info\.runtime\.argv\)\.join\(' '\)/);
    expect(src).toContain("from './lib/private-file.js'");
    expect(src).toMatch(/writePrivateFile\(filepath/);
  });

  it('runs/manifest 先按旗标脱敏 argv,两份 JSON 都走 writePrivateFile', () => {
    const src = readSrc('runs/manifest.ts');
    expect(src).toMatch(/argv:\s*redactArgv\(options\.argv \?\? process\.argv\.slice\(2\)\)/);
    expect(src).toMatch(/writePrivateFile\(manifestTmp/);
    expect(src).toMatch(/writePrivateFile\(tmp/);
    // 裸 writeFileSync 会让清单落成 0644 且丢原子性 —— 出现即回归
    expect(src).not.toMatch(/\bwriteFileSync\(/);
  });
});

describe('F-008 runs manifest 实落盘', () => {
  it('凭据值打码、无关参数保留,文件经 writePrivateFile(0600)落盘', () => {
    const root = mkScratch('f-008-manifest-');
    try {
      const deep = makeRepo(root);
      privateFileCalls.length = 0;
      const out = writeRunManifest({
        cwd: deep,
        cliVersion: '1.0.0',
        argv: ['login', '-p', 'secret123', '--api-key=sk_x', '--token', 'abc', '--json'],
      });
      expect(out).not.toBeNull();
      const manifestPath = join(root, '.ihui-agent', 'state', 'runs', out!.manifest.runId, 'manifest.json');
      const raw = readFileSync(manifestPath, 'utf-8');
      const saved = JSON.parse(raw) as { argv: string[] };
      expect(saved.argv).toEqual(['login', '-p', ARGV_MASK, `--api-key=${ARGV_MASK}`, '--token', ARGV_MASK, '--json']);
      expect(raw).not.toContain('secret123');
      expect(raw).not.toContain('sk_x');

      // Windows 无 POSIX 权限位:只断言"走了唯一写入口";POSIX 再核对实际 mode。
      const pid = String(process.pid);
      expect(privateFileCalls.some((p) => p.endsWith(`manifest.json.${pid}.tmp`))).toBe(true);
      expect(privateFileCalls.some((p) => p.endsWith(`latest.json.${pid}.tmp`))).toBe(true);
      if (process.platform !== 'win32') {
        expect(statSync(manifestPath).mode & 0o777).toBe(0o600);
      }
    } finally {
      rmScratch(root);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
