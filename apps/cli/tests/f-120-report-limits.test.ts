// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-120 回归钉:
 *  ① 输入先 stat 再整读 —— 超过 64 MB 直接报错退出,不产出/不备份输出文件;
 *  ② 覆盖已存在报告前留 `<out>.bak`(旧 .bak 被覆盖),输出走原子写(不留 tmp)。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';

import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import { registerReportCommand } from '../src/commands/report.js';

const MAX_BYTES = 64 * 1024 * 1024;

let scratch = '';
let consoleSpies: Array<{ mockRestore: () => void }> = [];

beforeAll(() => {
  scratch = mkScratch('f-120-report-limits-');
});

afterAll(() => {
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[f-120] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

beforeEach(() => {
  process.exitCode = undefined;
  consoleSpies = [
    vi.spyOn(console, 'info').mockImplementation(() => {}),
    vi.spyOn(console, 'log').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
    vi.spyOn(console, 'error').mockImplementation(() => {}),
  ];
});

afterEach(() => {
  for (const spy of consoleSpies) spy.mockRestore();
  consoleSpies = [];
  process.exitCode = undefined;
});

async function runReport(args: string[]): Promise<void> {
  const program = new Command();
  registerReportCommand(program);
  await program.parseAsync(['report', ...args], { from: 'user' });
}

function dirFor(name: string): string {
  const dir = path.join(scratch, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeTrace(dir: string): string {
  const input = path.join(dir, 'trace.json');
  fs.writeFileSync(input, JSON.stringify({ title: 't', toolCalls: [] }), 'utf8');
  return input;
}

describe('F-120 report agent-trace 上限与备份', () => {
  it('输入超过 64 MB 时报错退出,不写输出也不留 .bak', async () => {
    const dir = dirFor('oversize');
    const input = path.join(dir, 'huge.json');
    const fd = fs.openSync(input, 'w');
    try {
      fs.ftruncateSync(fd, MAX_BYTES + 1);
    } finally {
      fs.closeSync(fd);
    }
    const out = path.join(dir, 'out.html');

    await runReport(['agent-trace', input, '--out', out]);

    expect(process.exitCode).toBe(1);
    expect(fs.existsSync(out)).toBe(false);
    expect(fs.existsSync(`${out}.bak`)).toBe(false);
  });

  it('覆盖已存在报告前备份 <out>.bak 且覆盖旧 .bak,输出完整 HTML', async () => {
    const dir = dirFor('backup');
    const input = writeTrace(dir);
    const out = path.join(dir, 'out.html');
    fs.writeFileSync(out, 'OLD-REPORT', 'utf8');
    fs.writeFileSync(`${out}.bak`, 'STALE-BACKUP', 'utf8');

    await runReport(['agent-trace', input, '--out', out]);

    expect(process.exitCode).toBeUndefined();
    expect(fs.readFileSync(`${out}.bak`, 'utf8')).toBe('OLD-REPORT');
    const html = fs.readFileSync(out, 'utf8');
    expect(html).not.toBe('OLD-REPORT');
    expect(html.toLowerCase()).toContain('<html');
    expect(fs.readdirSync(dir).filter((n) => n.includes('.tmp-'))).toEqual([]);
  });

  it('输出文件不存在时不产出 .bak', async () => {
    const dir = dirFor('fresh');
    const input = writeTrace(dir);
    const out = path.join(dir, 'fresh.html');

    await runReport(['agent-trace', input, '--out', out]);

    expect(process.exitCode).toBeUndefined();
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.existsSync(`${out}.bak`)).toBe(false);
  });
});
