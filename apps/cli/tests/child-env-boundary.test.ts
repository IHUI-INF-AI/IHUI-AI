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

import { buildFilteredEnv, CREDENTIAL_SHAPE_BLOCKED_PATTERNS, DEFAULT_BLOCKED_ENV_VARS } from '../src/sandbox/index.js';

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

  /**
   * 原残留名单(2026-09-29 拍板先钉名单不拦;**2026-10-08 拍板采纳扩展后全部收编进 deny**)。
   *
   * 根因:`matchPattern` 只认 `endsWith` 的后缀族(`*_API_KEY`/`*_SECRET`/`*_TOKEN`/`*_PASSWORD`),
   * 所以单数 `*_KEY`、`*_SENDKEY`、`*_TOKEN_ID`,以及任何不带这四个后缀的凭据名,一律盖不住。
   * 10-08 机主拍板:子进程 env 从「只剥我方凭据」扩到「一切凭据形态」,MCP/hook 子进程改
   * 白名单透传(默认全剥)作逃生门 —— 下面这批键自此全部被宽 deny 剥除,本 describe 反转成
   * "收编对账":名单里的键一个都不许再漏进子进程;deny 形态集逐字钉死,增删必须显式裁决。
   */
  describe('凭据形态收编(2026-10-08 拍板:原残留名单全部进 deny)', () => {
    // 原 RESIDUAL_LEDGER 四键 + 复测新增的 TOKEN_PATH 形态:今天必须全部被剥
    const ONCE_RESIDUAL: string[] = [
      'LIBTV_ACCESS_KEY',
      'SERVERCHAN_SENDKEY',
      'TUNNEL_SERVICE_TOKEN_ID',
      'QODER_SDK_AUTH_PAYLOAD_FILE',
      'TRAE_JWT_TOKEN_PATH',
    ];
    // 对照组:同形且一直被既有后缀族盖住的,必须一个都不漏
    const BLOCKED_CONTROLS: string[] = [
      'IHUI_API_KEY',
      'STEPFUN_API_KEY',
      'AI_CALLBACK_SECRET',
      'IHUI_AGENT_TOKEN',
      'DB_PASSWORD',
      'IHUI_SERVE_MACHINE_KEYS',
    ];
    // 反对照组:非凭据形态,宽 deny 也不许碰(宁窄不误伤的现行口径)
    const NEGATIVE_CONTROLS: string[] = ['SOME_VENDOR_PROFILE', 'G465_PLAIN_FLAG'];
    const CANDIDATES = [...ONCE_RESIDUAL, ...BLOCKED_CONTROLS];

    it('原残留名单 + 对照组全部被剥(值不进子进程 env)', () => {
      const previous = new Map<string, string | undefined>();
      try {
        for (const k of CANDIDATES) {
          previous.set(k, process.env[k]);
          process.env[k] = 'sentinel-value-not-a-real-credential';
        }
        const filtered = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS);
        for (const k of CANDIDATES) {
          expect(filtered[k], `${k} 应当被宽 deny 剥除`).toBeUndefined();
        }
      } finally {
        for (const [k, v] of previous) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    });

    it('反对照组幸存:非凭据形态不误伤(宁窄不误伤的现行口径)', () => {
      const previous = new Map<string, string | undefined>();
      try {
        for (const k of NEGATIVE_CONTROLS) {
          previous.set(k, process.env[k]);
          process.env[k] = 'keep-me';
        }
        const filtered = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS);
        for (const k of NEGATIVE_CONTROLS) {
          expect(filtered[k], `${k} 不是凭据形态,不得被剥`).toBe('keep-me');
        }
      } finally {
        for (const [k, v] of previous) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    });

    it('deny 形态集逐字钉死 —— 增删模式必须显式改本例并写下理由', () => {
      expect([...CREDENTIAL_SHAPE_BLOCKED_PATTERNS]).toEqual([
        '*_API_KEY',
        '*_SECRET',
        '*_TOKEN',
        '*_PASSWORD',
        '*_SENDKEY',
        '*_AUTH_PAYLOAD_FILE',
        '*_TOKEN_ID',
        '*_SECRET_ID',
        '*_KEY_ID',
        '*_TOKEN_PATH',
        '*_TOKEN_FILE',
        '*_KEY_PATH',
        '*_KEY_FILE',
        '*_KEY',
      ]);
      // 默认表必须包含全部形态模式(同源拼装,不得漏拼)
      expect(DEFAULT_BLOCKED_ENV_VARS).toEqual(expect.arrayContaining([...CREDENTIAL_SHAPE_BLOCKED_PATTERNS]));
    });

    it('变异自证:把 *_KEY 模式从 deny 里摘掉,LIBTV_ACCESS_KEY 必须幸存(证明剥除非恒真)', () => {
      const SENTINEL = 'sentinel-value-not-a-real-credential';
      const previous = process.env.LIBTV_ACCESS_KEY;
      try {
        process.env.LIBTV_ACCESS_KEY = SENTINEL;
        const narrowed = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS.filter((p) => p !== '*_KEY'));
        expect(narrowed.LIBTV_ACCESS_KEY).toBe(SENTINEL);
        const current = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS);
        expect(current.LIBTV_ACCESS_KEY).toBeUndefined();
      } finally {
        if (previous === undefined) delete process.env.LIBTV_ACCESS_KEY;
        else process.env.LIBTV_ACCESS_KEY = previous;
      }
    });
  });

  describe('白名单透传(G-465 10-08 拍板:buildFilteredEnv 第二参逃生门)', () => {
    it('精确名白名单越过 deny 幸存;无白名单时保持全剥', () => {
      const previous = process.env.LIBTV_ACCESS_KEY;
      try {
        process.env.LIBTV_ACCESS_KEY = 'sentinel-value-not-a-real-credential';
        const filtered = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS, ['LIBTV_ACCESS_KEY']);
        expect(filtered.LIBTV_ACCESS_KEY).toBe('sentinel-value-not-a-real-credential');
        expect(buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS).LIBTV_ACCESS_KEY).toBeUndefined();
      } finally {
        if (previous === undefined) delete process.env.LIBTV_ACCESS_KEY;
        else process.env.LIBTV_ACCESS_KEY = previous;
      }
    });

    it('通配模式白名单只放行命中键,其余凭据形态照剥', () => {
      const previous = new Map<string, string | undefined>();
      try {
        for (const k of ['LIBTV_ACCESS_KEY', 'SERVERCHAN_SENDKEY', 'G465_PLAIN_FLAG']) {
          previous.set(k, process.env[k]);
          process.env[k] = 'sentinel-value-not-a-real-credential';
        }
        const filtered = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS, ['LIBTV_*']);
        expect(filtered.LIBTV_ACCESS_KEY).toBe('sentinel-value-not-a-real-credential');
        expect(filtered.SERVERCHAN_SENDKEY).toBeUndefined();
        expect(filtered.G465_PLAIN_FLAG).toBe('sentinel-value-not-a-real-credential');
      } finally {
        for (const [k, v] of previous) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
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
