// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 服务端可下发的 CLI 最低版本闸门 — cli 侧离线回归（G-243，2026-09-27）。
 *
 * 全程不发网络：request 与 fetch 都被注入/打桩（AGENTS §5 测试隔离：不得对生产库/外网产生副作用）。
 * 三条判据各一组用例：
 *   ① 问不到 / 非 2xx / 形状不认识 / 版本号写坏 ⇒ 一律放行，且**命令照常执行 + 有一条可见提示**
 *   ② 真拦下 ⇒ 文案含当前版本、要求版本、可复制的升级出口
 *   ③ 比较不受 1.10 / 1.9 影响（逐段整数比，不是字符串比）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXIT_CODE_BELOW_MINIMUM,
  UPGRADE_COMMAND,
  compareVersions,
  decideGate,
  enforceServerMinimumVersion,
  notifyUpdates,
  parseServerMinVersion,
  renderBlockMessage,
  type ServerMinVersionFacts,
} from '../src/updater.js';
import { probeServerMinimumVersion, renderProbeReport } from '../src/min-version-probe.js';

const TMP_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '.ihui-agent',
  'tmp',
  'cli-server-min-version-gate',
);
const CACHE_FILE = join(TMP_DIR, 'min-version-gate.json');
const BASE_URL = 'http://127.0.0.1:59999';

let envSnapshot: Record<string, string | undefined> = {};
const ENV_KEYS = ['IHUI_NO_UPDATE_CHECK', 'IHUI_REGISTRY_URL', 'IHUI_API_URL'] as const;

beforeEach(() => {
  envSnapshot = {};
  for (const k of ENV_KEYS) envSnapshot[k] = process.env[k];
  delete process.env.IHUI_NO_UPDATE_CHECK;
  mkdirSync(TMP_DIR, { recursive: true });
  if (existsSync(CACHE_FILE)) rmSync(CACHE_FILE, { force: true });
  // registry 那条链(checkForUpdates)也走 fetch —— 一律打桩成失败，避免真打 npm registry
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline (stubbed for tests)');
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV_KEYS) {
    if (envSnapshot[k] === undefined) delete process.env[k];
    else process.env[k] = envSnapshot[k];
  }
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
});

function facts(minimumVersion: string | null): ServerMinVersionFacts {
  return { minimumVersion, source: 'env', reason: '环境变量 IHUI_CLI_MIN_VERSION=9.9.9' };
}

function serverBody(minimumVersion: unknown, extra: Record<string, unknown> = {}): unknown {
  return {
    code: 0,
    message: 'success',
    data: { platform: 'cli', minimumVersion, source: 'env', reason: 'from test', ...extra },
  };
}

// -----------------------------------------------------------------------------
// ① 三态放行（每条都断言"照常执行 + 有可见提示"）
// -----------------------------------------------------------------------------

describe('闸门三态放行：网络失败 / 非 2xx / 格式不认识', () => {
  it('状态一 · 网络失败 ⇒ 放行，且留一条点名"问不到"的提示', async () => {
    const lines: string[] = [];
    const exits: number[] = [];
    const r = await enforceServerMinimumVersion({
      currentVersion: '1.0.0',
      baseUrl: BASE_URL,
      cacheFile: CACHE_FILE,
      warn: (l) => lines.push(l),
      exit: (c) => exits.push(c),
      request: async () => {
        throw new Error('fetch failed: ECONNREFUSED');
      },
    });
    expect(r.blocked).toBe(false);
    expect(r.source).toBe('unreachable');
    expect(r.asked).toBe(true);
    // 可见提示：必须有一条，且说清"失败开"而不是静默
    expect(lines).toHaveLength(1);
    // G-660:问不到 ⇒ 标 UNDETERMINED 而不是 pass。旧断言把"降级放行"印成 pass,
    // 读日志的人会以为版本检查过了 —— 而这条检查根本没发生。
    expect(lines[0]).toMatch(/version gate \[UNDETERMINED\]/);
    expect(lines[0]).toMatch(/failing open/);
    expect(exits).toEqual([]);
  });

  it('状态二 · 返回非 2xx ⇒ 放行并留痕（不冒成"服务端没要求"）', async () => {
    const lines: string[] = [];
    const r = await enforceServerMinimumVersion({
      currentVersion: '1.0.0',
      baseUrl: BASE_URL,
      cacheFile: CACHE_FILE,
      warn: (l) => lines.push(l),
      exit: () => undefined,
      request: async () => {
        const err = new Error('HTTP 429 Too Many Requests') as Error & { status?: number };
        err.status = 429;
        throw err;
      },
    });
    expect(r.blocked).toBe(false);
    expect(r.source).toBe('unreachable');
    expect(r.reason).toContain('429');
    expect(lines).toHaveLength(1);
  });

  it('状态三 · 返回体缺字段 / 版本号写坏 ⇒ 放行并留痕', async () => {
    // 缺字段：形状不认识
    const missing = await enforceServerMinimumVersion({
      currentVersion: '1.0.0',
      baseUrl: BASE_URL,
      cacheFile: CACHE_FILE,
      warn: () => undefined,
      exit: () => undefined,
      request: async () => ({ code: 0, message: 'success', data: {} }),
    });
    expect(missing.blocked).toBe(false);
    expect(missing.source).toBe('unknown');
    expect(missing.reason).toMatch(/shape not recognised/);

    // 版本号写坏
    const broken = await enforceServerMinimumVersion({
      currentVersion: '1.0.0',
      baseUrl: BASE_URL,
      cacheFile: CACHE_FILE,
      warn: () => undefined,
      exit: () => undefined,
      request: async () => serverBody('banana'),
    });
    expect(broken.blocked).toBe(false);
    expect(broken.source).toBe('invalid');
    expect(broken.reason).toMatch(/banana/);
  });

  it('三态都不退出进程：走 notifyUpdates 挂点时命令照常执行', async () => {
    const exits: number[] = [];
    const lines: string[] = [];
    const failCases: Array<() => Promise<unknown>> = [
      async () => {
        throw new Error('ECONNREFUSED');
      },
      async () => {
        throw new Error('HTTP 503');
      },
      async () => ({ nope: true }),
    ];
    // 每一态都单独等到它自己那条留痕出现 —— 否则"三条"会退化成"第一条 + 两条没跑"
    for (const [i, failCase] of failCases.entries()) {
      notifyUpdates({
        currentVersion: '1.0.0',
        baseUrl: BASE_URL,
        cacheFile: CACHE_FILE,
        warn: (l) => lines.push(l),
        exit: (c) => exits.push(c),
        request: async () => failCase(),
      });
      await vi.waitFor(() => {
        expect(lines.length).toBe(i + 1);
      });
    }
    expect(exits).toEqual([]);
    expect(lines).toHaveLength(3);
    // 三条都是"没判出来"(网络失败 / 5xx / 形状不认识)⇒ 一律 UNDETERMINED(G-660),
    // 不得再印 pass;同时不得是 BLOCK —— 放行是降级选择,这一条仍成立。
    expect(lines.every((l) => /\[UNDETERMINED\]/.test(l))).toBe(true);
    expect(lines.some((l) => /\[BLOCK\]/.test(l))).toBe(false);
  });

  it('版本自识别失败（读到哨兵 0.0.0）⇒ 放行，绝不拿哨兵去挡住所有人', async () => {
    const r = await enforceServerMinimumVersion({
      currentVersion: '0.0.0',
      baseUrl: BASE_URL,
      cacheFile: CACHE_FILE,
      warn: () => undefined,
      exit: () => undefined,
      request: async () => serverBody('9.9.9'),
    });
    expect(r.blocked).toBe(false);
    expect(r.asked).toBe(false);
    expect(r.reason).toMatch(/cannot determine own version/);
  });
});

// -----------------------------------------------------------------------------
// ② 拦下时的文案
// -----------------------------------------------------------------------------

describe('闸门拦下：可读原因 + 升级出口', () => {
  it('低于服务端要求 ⇒ 留痕行含当前版本、要求版本、真值来源与服务端原因', async () => {
    const lines: string[] = [];
    const exits: number[] = [];
    const r = await enforceServerMinimumVersion({
      currentVersion: '1.0.0',
      baseUrl: BASE_URL,
      cacheFile: CACHE_FILE,
      warn: (l) => lines.push(l),
      exit: (c) => exits.push(c),
      request: async () => serverBody('2.3.0', { reason: '环境变量 IHUI_CLI_MIN_VERSION=2.3.0' }),
    });
    expect(r.blocked).toBe(true);
    expect(r.requiredVersion).toBe('2.3.0');
    expect(exits).toEqual([]); // enforce 只给结论,不退出进程 —— 退出是挂点的职责(下一条)
    const all = lines.join('\n');
    expect(all).toMatch(/version gate \[BLOCK\]/);
    expect(all).toContain('1.0.0');
    expect(all).toContain('2.3.0');
    expect(all).toContain('IHUI_CLI_MIN_VERSION=2.3.0');
  });

  it('renderBlockMessage 不是裸错误码：既有数字也有出口命令', () => {
    const msg = renderBlockMessage(
      decideGate('1.2.0', { ...facts('2.0.0'), minimumVersion: '2.0.0' }),
    );
    expect(msg).toContain('1.2.0');
    expect(msg).toContain('2.0.0');
    expect(msg).toContain(UPGRADE_COMMAND);
    expect(msg).toContain('env');
  });

  it('notifyUpdates 挂点上拦下会带 EXIT_CODE_BELOW_MINIMUM 退出，并给可复制的升级出口', async () => {
    const exits: number[] = [];
    const lines: string[] = [];
    notifyUpdates({
      currentVersion: '1.0.0',
      baseUrl: BASE_URL,
      cacheFile: CACHE_FILE,
      warn: (l) => lines.push(l),
      exit: (c) => exits.push(c),
      request: async () => serverBody('2.3.0'),
    });
    await vi.waitFor(() => {
      expect(exits).toEqual([EXIT_CODE_BELOW_MINIMUM]);
    });
    const all = lines.join('\n');
    expect(all).toContain(UPGRADE_COMMAND);
    expect(all).toContain('1.0.0');
    expect(all).toContain('2.3.0');
  });

  it('同步落点：上一次问到的新鲜结论会在 action 之前就把命令拦下（不靠竞态）', () => {
    const now = Date.now();
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(
      CACHE_FILE,
      JSON.stringify({
        minGate: {
          checkedAt: now - 1000,
          minimumVersion: '5.0.0',
          source: 'file',
          reason: '配置文件 config/cli-min-version.json',
        },
      }),
      'utf-8',
    );
    const exits: number[] = [];
    const lines: string[] = [];
    notifyUpdates({
      currentVersion: '1.0.0',
      now,
      baseUrl: BASE_URL,
      cacheFile: CACHE_FILE,
      warn: (l) => lines.push(l),
      exit: (c) => exits.push(c),
      request: async () => {
        throw new Error('must not be reached when the cached verdict already blocks');
      },
    });
    expect(exits).toEqual([EXIT_CODE_BELOW_MINIMUM]);
    expect(lines.join('\n')).toContain('5.0.0');
  });

  it('缓存结论过期 ⇒ 不再拿旧账拦人（放行 + 重新问）', async () => {
    const now = Date.now();
    writeFileSync(
      CACHE_FILE,
      JSON.stringify({
        minGate: { checkedAt: now - 60 * 60 * 1000, minimumVersion: '5.0.0', source: 'env', reason: 'stale' },
      }),
      'utf-8',
    );
    const exits: number[] = [];
    notifyUpdates({
      currentVersion: '1.0.0',
      now,
      baseUrl: BASE_URL,
      cacheFile: CACHE_FILE,
      warn: () => undefined,
      exit: (c) => exits.push(c),
      request: async () => serverBody(null, { source: 'none' }),
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    expect(exits).toEqual([]);
    // 重新问之后缓存被写回成"不拦"，且合并写回保住了 registry 那条的键
    const rewritten = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as {
      minGate?: { minimumVersion: string | null };
    };
    expect(rewritten.minGate?.minimumVersion).toBe(null);
  });
});

// -----------------------------------------------------------------------------
// ③ 版本比较
// -----------------------------------------------------------------------------

describe('版本比较不受 1.10 / 1.9 影响', () => {
  it('compareVersions 逐段整数比：1.10.0 > 1.9.0，1.10.0 > 1.20.0 反向亦成立', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    // 字符串比会给出相反结论 —— 这一条就是"不许手写字符串比较"的证据
    expect('1.10.0' < '1.9.0').toBe(true);
  });

  it('服务端要求 1.9.0 而当前 1.10.0 ⇒ 不拦（若按字符串比会误拦）', () => {
    const r = decideGate('1.10.0', facts('1.9.0'));
    expect(r.blocked).toBe(false);
  });

  it('服务端要求 1.10.0 而当前 1.9.0 ⇒ 拦', () => {
    const r = decideGate('1.9.0', facts('1.10.0'));
    expect(r.blocked).toBe(true);
  });

  it('等值 ⇒ 不拦（"不低于"就放行）', () => {
    expect(decideGate('2.0.0', facts('2.0.0')).blocked).toBe(false);
  });

  it('minimumVersion=null ⇒ 服务端没有要求，一律放行', () => {
    const r = decideGate('0.0.1', facts(null));
    expect(r).toMatchObject({ blocked: false, requiredVersion: null, source: 'env' });
  });

  it('parseServerMinVersion 把"没要求"与"不认识"分成两态', () => {
    expect(parseServerMinVersion(serverBody(null, { source: 'none' }))).toMatchObject({
      minimumVersion: null,
      source: 'none',
    });
    expect(parseServerMinVersion(serverBody('1.2.3'))).toMatchObject({ minimumVersion: '1.2.3' });
    expect(parseServerMinVersion({})).toBe(null);
    expect(parseServerMinVersion(null)).toBe(null);
    expect(parseServerMinVersion(serverBody('1.2'))?.source).toBe('invalid');
  });
});

// -----------------------------------------------------------------------------
// 问责入口
// -----------------------------------------------------------------------------

describe('min-version-probe：回答"服务端现在要求哪个最低版本、真值来源是什么"', () => {
  it('配置了 ⇒ 报告里点名值与出处', async () => {
    const { exitCode, report } = await probeServerMinimumVersion(
      1000,
      BASE_URL,
      async () => serverBody('2.3.0', { source: 'file', reason: '配置文件 config/cli-min-version.json' }),
    );
    expect(exitCode).toBe(EXIT_CODE_BELOW_MINIMUM);
    expect(report.requirementSource).toBe('file');
    expect(report.serverMinimumVersion).toBe('2.3.0');
    expect(renderProbeReport(report)).toContain('config/cli-min-version.json');
  });

  it('没配置 ⇒ exitCode 0 并如实报 source=none', async () => {
    const { exitCode, report } = await probeServerMinimumVersion(
      1000,
      BASE_URL,
      async () => serverBody(null, { source: 'none', reason: '未配置：默认不拦' }),
    );
    expect(exitCode).toBe(0);
    expect(report.determined).toBe(true);
    expect(report.serverMinimumVersion).toBe(null);
  });

  it('问不到 ⇒ exitCode 2（无法判定），不得伪装成"服务端没要求"', async () => {
    const { exitCode, report } = await probeServerMinimumVersion(1000, BASE_URL, async () => {
      throw new Error('ECONNREFUSED');
    });
    expect(exitCode).toBe(2);
    expect(report.determined).toBe(false);
    expect(report.serverReason).toMatch(/NOT the same as/);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
