// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 子进程 env 边界对账(2026-09-28 立,第九轮 ZCode 对照逼出)。
 *
 * 病灶:CLI 手里有平台凭据(IHUI_API_KEY / IHUI_API_SECRET / IHUI_AGENT_TOKEN /
 * IHUI_SERVE_MACHINE_KEYS / IHUI_AI_SERVICE_API_KEY),而四个"把命令交给外部程序跑"的
 * 站点原先都是 `{ ...process.env }` 全量继承 —— 用户配置的第三方 stdio MCP 服务器、
 * hook 命令、交互终端里执行的任意 shell 都能直接读到我们自己的 key。
 *
 * 修法不新建第二张清单:复用 `src/sandbox/index.ts` 里既有的 `buildFilteredEnv` +
 * `DEFAULT_BLOCKED_ENV_VARS`(沙箱执行一直用它),把同一份实现接到所有边界。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildFilteredEnv, DEFAULT_BLOCKED_ENV_VARS } from '../src/sandbox/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('子进程 env 边界', () => {
  describe('buildFilteredEnv 的取值方向', () => {
    // 逐键 set/delete，不做 process.env 整体替换(整体替换在部分 runner 下不可靠)
    const SECRET_KEYS = [
      'IHUI_API_KEY',
      'IHUI_API_SECRET',
      'IHUI_AGENT_TOKEN',
      'IHUI_SERVE_MACHINE_KEYS',
      'IHUI_AI_SERVICE_API_KEY',
    ];

    it('剥掉我方平台凭据', () => {
      const previous = new Map<string, string | undefined>();
      try {
        for (const k of SECRET_KEYS) {
          previous.set(k, process.env[k]);
          process.env[k] = 'a-value-that-must-not-leak';
        }
        const filtered = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS);
        for (const k of SECRET_KEYS) {
          expect(filtered[k], `${k} 不应进入子进程 env`).toBeUndefined();
        }
      } finally {
        for (const [k, v] of previous) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    });

    it('保留 PATH 与未列入清单的第三方变量(宁窄不误伤)', () => {
      process.env.SOME_VENDOR_PROFILE = 'keep-me';
      try {
        const filtered = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS);
        expect(filtered.PATH).toBeTruthy();
        expect(filtered.SOME_VENDOR_PROFILE).toBe('keep-me');
      } finally {
        delete process.env.SOME_VENDOR_PROFILE;
      }
    });

    it('IHUI_SERVE_MACHINE_KEYS 必须在清单里 —— 通配 *_API_KEY/*_SECRET/*_TOKEN 都盖不到复数 KEYS', () => {
      expect(DEFAULT_BLOCKED_ENV_VARS).toContain('IHUI_SERVE_MACHINE_KEYS');
    });
  });

  describe('装车对账:边界站点必须真的走那一份出口', () => {
    // 判据是"生产站点调用出口"，不是"出口存在" —— 后者在历轮里绿过太多次而无人调用。
    const sites: Array<{ file: string; label: string }> = [
      { file: 'src/tools/mcp-runtime.ts', label: '第三方 stdio MCP 子进程' },
      { file: 'src/tools/terminal.ts', label: '交互终端里执行的任意命令' },
      { file: 'src/hooks/index.ts', label: 'hook 命令与 webhook 子进程' },
    ];

    for (const { file, label } of sites) {
      it(`${file} 的子进程 env 走 buildFilteredEnv(${label})`, () => {
        const src = readFileSync(path.join(ROOT, file), 'utf8');
        expect(src).toContain('buildFilteredEnv(');
        expect(src).toContain('DEFAULT_BLOCKED_ENV_VARS');
      });
    }

    it('反向锁:这三个文件不得再出现 `...process.env` 作为 spawn 的 env 值', () => {
      for (const { file } of sites) {
        const src = readFileSync(path.join(ROOT, file), 'utf8');
        expect(src).not.toMatch(/env:\s*\{\s*\.\.\.process\.env/);
        expect(src).not.toMatch(/env:\s*process\.env\s+as\s+Record/);
      }
    });

    it('POSIX 后端那一格必须"要么已过滤、要么带缺口声明"——不得静默', () => {
      // 事实:tools/sandbox/platform/unix.ts 的注释承诺"敏感变量过滤由策略层 blockedEnvVars 覆盖",
      // 而 POSIX 路径上没有任何过滤实现(Windows 后端有,见 platform/windows.ts:213)。
      // 本机是 Windows，bwrap/sandbox-exec 语义不可验证，所以本票**不动那一侧**，
      // 只要求它要么真过滤、要么留一行 `env-boundary-gap:` 声明 —— 静默才是最坏形态。
      const unix = readFileSync(path.join(ROOT, 'src/tools/sandbox/platform/unix.ts'), 'utf8');
      const filtered = /buildFilteredEnv\(|clearenv/.test(unix);
      const declared = /env-boundary-gap:/.test(unix);
      expect(filtered || declared).toBe(true);
    });
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
