// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2026-11-08 P0(F-001)回归钉:Windows 上 run_tests 不得再因 `npm.cmd` 直呼而 EINVAL。
 *
 * 根因:Node ≥20.12 对 `.cmd`/`.bat` 的 spawn 必须显式 shell,否则恒返回 EINVAL;
 * 旧实现 `spawnSync('npm.cmd', ...)` 在 Windows 上从未真正跑起来,还把 status=null
 * 折成"npm 退出码 null"。修复改为 node + npm-cli.js 的无 shell 执行。
 *
 * 判据:① 解析出的入口真实存在;② 用解析结果真跑一次 `npm --version` 得到 0;
 * ③ 生产工具入口在真实 workspace 上跑通 `npm test`(不是只测 helper)。
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveNpmSpawn, run_tests } from '../src/tools/run-tests.js';
import type { ToolContext } from '../src/tools/index.js';

const madeDirs: string[] = [];

function makeWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-run-tests-p0-'));
  madeDirs.push(dir);
  return dir;
}

afterEach(() => {
  delete process.env.IHUI_HOOKS_CONFIG;
  for (const dir of madeDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('F-001 Windows npm 调用', () => {
  it('解析出的 npm 入口存在,且能真实执行(不再 EINVAL)', () => {
    const plan = resolveNpmSpawn(['--version']);
    if (process.platform === 'win32') {
      expect(plan.command).toBe(process.execPath);
      expect(fs.existsSync(plan.args[0]!)).toBe(true);
    }
    const result = spawnSync(plan.command, plan.args, { encoding: 'utf-8' });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });

  it('run_tests 生产入口在真实 workspace 上跑通 npm test', async () => {
    const dir = makeWorkspace();
    fs.writeFileSync(path.join(dir, 'ok.js'), 'process.exit(0);\n');
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'p0-run-tests-fixture', scripts: { test: 'node ok.js' } }),
    );
    // 隔离宿主 hooks,避免机器上的真实钩子把本用例变成环境依赖。
    process.env.IHUI_HOOKS_CONFIG = path.join(dir, 'no-such-hooks.json');

    const ctx = {
      workspacePath: dir,
      signal: new AbortController().signal,
    } as ToolContext;

    const result = await run_tests.execute({}, ctx);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.output).not.toContain('退出码 null');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
