// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 命令白名单三态回归(security 缺陷修复)。
 *
 * 立因:`readonly` 档的描述写着"无 shell 命令",但取值是 `commandAllowlist: []`,
 * 而两处强制点都是 `if (allowlist.length > 0) { ... }` —— 空数组被当成"未设置",
 * 于是这一档对命令名**零限制**。现在 `null` 表示"一律拒绝",`undefined` / `[]`
 * 保持旧语义(全仓现有免确认面依赖它,一并改成全禁就是把整条链路变成恒红)。
 *
 * 覆盖两套沙箱(它们是两条独立实现,必须各自钉住):
 *   - src/sandbox/index.ts        (runSandboxed / precheckSandbox)
 *   - src/tools/sandbox/policy.ts (evaluateCommand / validatePolicy)
 */
import { describe, it, expect, vi } from 'vitest';

const spawnSyncMock = vi.hoisted(() =>
  vi.fn(() => ({ status: 0, stdout: '', stderr: '', signal: null })),
);

vi.mock('node:child_process', async (importOriginal) => {
  const actual = (await importOriginal()) as object;
  return {
    ...actual,
    default: { ...actual, spawnSync: spawnSyncMock },
    spawnSync: spawnSyncMock,
  };
});

import {
  SANDBOX_PROFILES,
  resolveSandboxOptions,
  runSandboxed,
  runSandboxedAsync,
  precheckSandbox,
  evaluateCommandAllowlist,
  type SandboxOptions,
} from '../src/sandbox/index.js';
import { evaluateCommand, validatePolicy, type SandboxPolicy } from '../src/tools/sandbox/policy.js';

const CWD = process.cwd();
/** 解析不出命令名的畸形输入:孤引号开头,第一个 token 剥掉引号后为空串 */
const UNPARSEABLE = '"';

function readonlyOpts(profile: keyof typeof SANDBOX_PROFILES): SandboxOptions {
  return { cwd: CWD, ...resolveSandboxOptions(profile, {}) } as SandboxOptions;
}

describe('null = 一律拒绝(含两处强制点)', () => {
  it('readonly 档下任意命令都被拒,且不派生子进程', () => {
    spawnSyncMock.mockClear();

    const result = runSandboxed('curl http://example.com', readonlyOpts('readonly'));

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain('command_not_allowed');
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it('readonly 档下连解析不出命令名的畸形输入也拒(fail closed)', () => {
    const result = runSandboxed(UNPARSEABLE, readonlyOpts('readonly'));

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain('command_not_allowed');
  });

  it('异步路径(precheckSandbox → runSandboxedAsync)同样拒绝,不 spawn', async () => {
    const opts = readonlyOpts('readonly');
    expect(precheckSandbox('rm -rf /', opts).blocked).toBe(true);

    const handle = runSandboxedAsync('rm -rf /', opts);
    expect(handle.process).toBeNull();
    const result = await handle.result;
    expect(result.blocked).toBe(true);
    expect(result.exitCode).toBeNull();
  });

  it('同步与异步两条强制点结论逐字同形(共用一份判据)', () => {
    const cases: Array<{ cmd: string; allow: string[] | null | undefined }> = [
      { cmd: 'node -v', allow: null },
      { cmd: UNPARSEABLE, allow: null },
      { cmd: 'curl example.com', allow: ['node'] },
      { cmd: 'node -v', allow: ['node'] },
      { cmd: UNPARSEABLE, allow: ['node'] },
      { cmd: 'node -v', allow: undefined },
      { cmd: 'node -v', allow: [] },
    ];
    for (const c of cases) {
      const opts = { cwd: CWD, commandAllowlist: c.allow } as SandboxOptions;
      const sync = runSandboxed(c.cmd, opts);
      const asyncPre = precheckSandbox(c.cmd, opts);
      expect(asyncPre.blockReason ?? null).toBe(sync.blockReason ?? null);
      expect(asyncPre.blocked).toBe(sync.blocked);
    }
  });
});

describe('limited / trusted 档行为不变', () => {
  it('limited:白名单内放行、名单外拒绝', () => {
    spawnSyncMock.mockClear();

    expect(runSandboxed('node -v', readonlyOpts('limited')).blocked).toBe(false);
    expect(runSandboxed('curl http://example.com', readonlyOpts('limited')).blocked).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
  });

  it('trusted:额外带 cat/ls/echo,名单外的 pwsh 仍拒', () => {
    expect(runSandboxed('echo hi', readonlyOpts('trusted')).blocked).toBe(false);
    expect(runSandboxed('pwsh -Command x', readonlyOpts('trusted')).blocked).toBe(true);
  });
});

describe('反向对照:undefined / [] 保持"不检查"的旧语义', () => {
  it('空数组不得被当成"禁止一切"(否则整仓免确认面会变成全禁)', () => {
    spawnSyncMock.mockClear();

    expect(evaluateCommandAllowlist('curl http://example.com', [])).toBeNull();
    expect(runSandboxed('curl http://example.com', { cwd: CWD, commandAllowlist: [] }).blocked).toBe(false);
    expect(precheckSandbox('curl http://example.com', { cwd: CWD, commandAllowlist: [] }).blocked).toBe(false);
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
  });

  it('未设置(undefined)同样不检查', () => {
    expect(evaluateCommandAllowlist('curl http://example.com', undefined)).toBeNull();
    // open / full 档本来就不设这一项,行为必须与旧版一致
    expect(runSandboxed('curl http://example.com', readonlyOpts('open')).blocked).toBe(false);
  });
});

describe('第二套沙箱 src/tools/sandbox/policy.ts 同批收口', () => {
  const base = (over: Partial<SandboxPolicy>): SandboxPolicy => ({
    workspaceRoot: CWD,
    ...over,
  });

  it('commandAllowlist: null 时任意命令判 command_not_allowed', () => {
    const d = evaluateCommand(base({ commandAllowlist: null }), 'node -v');
    expect(d.allowed).toBe(false);
    expect(d.violations.some((v) => v.kind === 'command_not_allowed')).toBe(true);
  });

  it('null 时解析不出命令名也拒(fail closed,并如实点名)', () => {
    // 两套实现的 tokenizer 不同:第一套取引号内首 token(孤引号 → 空名),
    // 这一套按空白切分后再剥引号(孤引号 → 名字就是 `"`),对它而言
    // `'/'` 才是"解析不出命令名"的输入。把差异写死在这里,免得日后有人以为两边同形。
    const d = evaluateCommand(base({ commandAllowlist: null }), '/');
    expect(d.allowed).toBe(false);
    const v = d.violations.find((x) => x.kind === 'command_not_allowed');
    expect(v?.message).toContain('无法解析命令名');
  });

  it('空数组仍是"不检查"(与第一套同口径,不得顺手改成全禁)', () => {
    const d = evaluateCommand(base({ commandAllowlist: [] }), 'curl http://example.com');
    expect(d.violations.some((v) => v.kind === 'command_not_allowed')).toBe(false);
  });

  it('非空数组行为不变(白名单内不报 command_not_allowed)', () => {
    const ok = evaluateCommand(base({ commandAllowlist: ['node'] }), 'node -v');
    expect(ok.violations.some((v) => v.kind === 'command_not_allowed')).toBe(false);
    const bad = evaluateCommand(base({ commandAllowlist: ['node'] }), 'curl http://example.com');
    expect(bad.violations.some((v) => v.kind === 'command_not_allowed')).toBe(true);
  });

  it('validatePolicy 认 null 合法,但仍拒绝既非数组也非 null 的取值', () => {
    expect(validatePolicy(base({ commandAllowlist: null }))).toEqual([]);
    expect(
      validatePolicy(base({ commandAllowlist: 'node' as unknown as string[] })),
    ).toEqual([expect.stringContaining('commandAllowlist')]);
  });
});

describe('档位表自身', () => {
  it('只有 readonly 用 null,其余档位的取值不受本次改动影响', () => {
    expect(SANDBOX_PROFILES.readonly.overrides.commandAllowlist).toBeNull();
    expect(Array.isArray(SANDBOX_PROFILES.limited.overrides.commandAllowlist)).toBe(true);
    expect(Array.isArray(SANDBOX_PROFILES.trusted.overrides.commandAllowlist)).toBe(true);
    expect(SANDBOX_PROFILES.open.overrides.commandAllowlist).toBeUndefined();
    expect(SANDBOX_PROFILES.full.overrides.commandAllowlist).toBeUndefined();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
