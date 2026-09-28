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

  /**
   * 残留名单(2026-09-29 拍板:**先钉名单,不拦**)。
   *
   * 根因:`matchPattern` 只认 `endsWith` 的后缀族(`*_API_KEY`/`*_SECRET`/`*_TOKEN`/`*_PASSWORD`),
   * 所以单数 `*_KEY`、`*_SENDKEY`、`*_TOKEN_ID`,以及任何不带这四个后缀的凭据名,一律盖不住。
   *
   * 为什么不顺手放宽:宽 deny 会打断交互终端里**靠 env 工作**的第三方 CLI(`aws`/`gcloud` 这类),
   * 那是用户可见回归,与上面"保留未列入清单的第三方变量(宁窄不误伤)"是同一条口径。
   * 要拦得先按"对 MCP+hook 子进程改白名单"那一型单独拍板,不属本票。
   *
   * 本例断言的是**分区结果**,不是"某个变量存在":名单里少一项(将来真去拦它)或多一项
   * (判据放宽后又盖住了别的东西)都会翻红,逼那一次改动显式改这张清单并写下理由。
   */
  describe('残留名单:今天盖不住的凭据形态(报名不拦)', () => {
    const RESIDUAL_LEDGER: string[] = [
      // 第三方服务凭据,单数 _KEY 后缀
      'LIBTV_ACCESS_KEY',
      // 推送服务的 sendkey(名字以 SENDKEY 结尾,不是 SECRET)
      'SERVERCHAN_SENDKEY',
      // 隧道服务的 token id:_TOKEN 后面还挂着 _ID
      'TUNNEL_SERVICE_TOKEN_ID',
      // 这一条比前三条更该拦:它不是凭据值而是**指向凭据载荷文件的路径**,
      // 子进程拿到路径就能自己去读那份文件。仍按同一口径只报名。
      'QODER_SDK_AUTH_PAYLOAD_FILE',
    ];
    // 对照组:同形但今天确实被既有后缀族盖住的,必须一个都不漏
    const BLOCKED_CONTROLS: string[] = [
      'IHUI_API_KEY',
      'STEPFUN_API_KEY',
      'AI_CALLBACK_SECRET',
      'IHUI_AGENT_TOKEN',
      'DB_PASSWORD',
      'IHUI_SERVE_MACHINE_KEYS',
    ];
    const CANDIDATES = [...RESIDUAL_LEDGER, ...BLOCKED_CONTROLS];

    it('分区与名单逐字相等 —— 名单一旦变化(收紧或漏项)本例即红,要求显式裁决', () => {
      const previous = new Map<string, string | undefined>();
      try {
        for (const k of CANDIDATES) {
          previous.set(k, process.env[k]);
          process.env[k] = 'sentinel-value-not-a-real-credential';
        }
        const filtered = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS);
        const survivors = CANDIDATES.filter((k) => filtered[k] !== undefined);
        expect(survivors.slice().sort()).toEqual(RESIDUAL_LEDGER.slice().sort());
        for (const k of BLOCKED_CONTROLS) {
          expect(filtered[k], `${k} 应当被既有后缀族盖住`).toBeUndefined();
        }
      } finally {
        for (const [k, v] of previous) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    });

    it('阳性对照:给 deny 加一条 *_KEY,名单必须立刻缩小(证明上面那条等值不是恒真)', () => {
      const previous = new Map<string, string | undefined>();
      const SENTINEL = 'sentinel-value-not-a-real-credential';
      try {
        for (const k of CANDIDATES) {
          previous.set(k, process.env[k]);
          process.env[k] = SENTINEL;
        }
        // 同一份生产实现,只多一条后缀 ⇒ 单数 _KEY 那一条必须从"存活"翻到"被盖住"
        const widened = buildFilteredEnv([...DEFAULT_BLOCKED_ENV_VARS, '*_KEY']);
        expect(widened.LIBTV_ACCESS_KEY).toBeUndefined();
        const current = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS);
        expect(current.LIBTV_ACCESS_KEY).toBe(SENTINEL);
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
