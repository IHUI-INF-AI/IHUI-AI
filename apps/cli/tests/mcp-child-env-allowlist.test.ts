// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票B — 第三方 stdio MCP 子进程 env:白名单基底 + 单键重注。
 *
 * 核心是一对**成对判据**:同一个"黑名单盖不住的新密钥名",
 *   - 旧通道(黑名单出口)默认放行 ⇒ 证明存量缺陷的形状真实存在(阳性对照);
 *   - 新通道(buildMcpChildEnv)默认不可达 ⇒ 本票要买的结果;
 *   - 把该键写进该 server 的显式声明 ⇒ 可达(否则只留前一侧就是恒真断言)。
 *
 * 凭据卫生:所有值都是本文件自造的哨兵串,不含任何真实密钥;只断言"命中/未命中"。
 */
import { describe, expect, it, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMcpChildEnv } from '../src/tools/mcp-runtime.js';
import { buildFilteredEnv, DEFAULT_BLOCKED_ENV_VARS } from '../src/sandbox/index.js';

// 三个"黑名单后缀族盖不住"的新密钥名(G-465 登记过同一族缺口):
// *_KEY / *_SENDKEY / *_TOKEN_ID 都不在 *_API_KEY|*_SECRET|*_TOKEN|*_PASSWORD 之内。
const KEY_STYLE = 'IHUI_TEST_ONEKEY_Z9';
const SENDKEY_STYLE = 'IHUI_TEST_SENDKEY_Z8'; // 注意 *_TOKEN 不匹配它;*_SENDKEY 是全新词尾
const TOKEN_ID_STYLE = 'IHUI_TEST_TOKEN_ID_Z7';
const SENTINEL = 'sentinel-not-a-real-secret';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MCP_RUNTIME_SRC = readFileSync(path.resolve(HERE, '../src/tools/mcp-runtime.ts'), 'utf8');

describe('票B: MCP 子进程 env 白名单', () => {
  const cleanup: Array<() => void> = [];
  function injectProcessEnv(key: string, value: string): void {
    const previous = process.env[key];
    process.env[key] = value;
    cleanup.push(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  afterEach(() => {
    while (cleanup.length > 0) cleanup.pop()?.();
  });

  it('成对判据·前一半:黑名单盖不住的新密钥名,在 MCP 子进程 env 里默认不可达', () => {
    injectProcessEnv(KEY_STYLE, SENTINEL);
    injectProcessEnv(SENDKEY_STYLE, SENTINEL);
    injectProcessEnv(TOKEN_ID_STYLE, SENTINEL);

    // 阳性对照:旧通道(纯黑名单)确实会把这些键原样送出 —— 这正是要修的形状,
    // 若这半边断言不成立,后一边的"白名单挡住了"就可能只是"根本没注入成功"。
    const legacy = buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS);
    expect(legacy[KEY_STYLE]).toBe(SENTINEL);
    expect(legacy[SENDKEY_STYLE]).toBe(SENTINEL);
    expect(legacy[TOKEN_ID_STYLE]).toBe(SENTINEL);

    // 本票要买的结果:同一批键在 MCP 通道默认不可达
    const child = buildMcpChildEnv();
    expect(child[KEY_STYLE]).toBeUndefined();
    expect(child[SENDKEY_STYLE]).toBeUndefined();
    expect(child[TOKEN_ID_STYLE]).toBeUndefined();
  });

  it('成对判据·后一半:写进该 server 的显式声明(单键重注通道)⇒ 可达且值不变', () => {
    injectProcessEnv(KEY_STYLE, SENTINEL);
    const child = buildMcpChildEnv({ [KEY_STYLE]: 'declared-explicitly' });
    expect(child[KEY_STYLE]).toBe('declared-explicitly');
  });

  it('基底实测必需项可达:PATH 必达;家目录按平台各认其一(WIN=USERPROFILE/POSIX=HOME);TEMP 族按平台至少一档', () => {
    const child = buildMcpChildEnv();
    const lower = new Map(Object.keys(child).map((k) => [k.toLowerCase(), k]));
    expect(lower.has('path')).toBe(true);
    if (process.platform === 'win32') {
      expect(lower.has('userprofile')).toBe(true);
      expect(lower.has('systemroot')).toBe(true);
      expect(lower.has('temp')).toBe(true);
    } else {
      expect(lower.has('home')).toBe(true);
    }
    void lower;
  });

  it('基底里也不会漏出"看起来像密钥"的既有变量:任何值等于哨兵的新名都不出现,黑名单四族同样不出现', () => {
    injectProcessEnv('IHUI_TEST_LEGACY_TOKEN_Z6', SENTINEL); // 旧族,两侧都该挡住
    const child = buildMcpChildEnv();
    expect(child['IHUI_TEST_LEGACY_TOKEN_Z6']).toBeUndefined();
    // 基底全是定位类变量,不携带任何 *_API_KEY/*_SECRET/*_TOKEN/*_PASSWORD 命名的键
    for (const key of Object.keys(child)) {
      expect(/_(?:API_KEY|SECRET|TOKEN|PASSWORD)$/.test(key)).toBe(false);
    }
  });

  it('同名大小写冲突:显式声明优先,且结果里该名字只留一份(Windows env 块不得同名两拼)', () => {
    const child = buildMcpChildEnv({ PATH: 'declared-path-only' });
    const sameNameKeys = Object.keys(child).filter((k) => k.toLowerCase() === 'path');
    expect(sameNameKeys).toEqual(['PATH']);
    expect(child.PATH).toBe('declared-path-only');
  });

  describe('装车对账:MCP 通道必须真的走白名单出口', () => {
    it('connectMcpServer 的 stdio spawn 用 buildMcpChildEnv(server.env),旧的"黑名单整片+声明合并"写法不得回来', () => {
      expect(MCP_RUNTIME_SRC).toMatch(/env:\s*buildMcpChildEnv\(server\.env\)/);
      expect(MCP_RUNTIME_SRC).not.toMatch(
        /env:\s*\{\s*\.\.\.buildFilteredEnv\(DEFAULT_BLOCKED_ENV_VARS\),\s*\.\.\.server\.env\s*\}/,
      );
    });

    it('出口本体仍过既有那一份黑名单(复用,不另立第二份遮蔽清单)', () => {
      const fnBody = MCP_RUNTIME_SRC.slice(
        MCP_RUNTIME_SRC.indexOf('export function buildMcpChildEnv'),
        MCP_RUNTIME_SRC.indexOf('\n}', MCP_RUNTIME_SRC.indexOf('export function buildMcpChildEnv')),
      );
      expect(fnBody).toContain('buildFilteredEnv(');
      expect(fnBody).toContain('DEFAULT_BLOCKED_ENV_VARS');
    });

    it('反向锁:mcp-runtime 不得再把整份 process.env 直接摊进任何子进程 env', () => {
      expect(MCP_RUNTIME_SRC).not.toMatch(/env:\s*\{\s*\.\.\.process\.env/);
    });
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
