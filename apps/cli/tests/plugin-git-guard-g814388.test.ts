// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-814388 —— apps/cli git 派生守卫收敛的验收面。
 *
 * 票面:cache.ts 的三处 execFileSync(clone / fetch / checkout)缺 timeout / maxBuffer / killSignal /
 * env 净化,修法是收敛到统一的 runGit 出口。落地形态(G-815/G-816 先行收敛,本票验收并钉死):
 *   - cache.ts 本体 **零** child_process 引用,三趟全部走 `./git-runner.js` 的
 *     `execGitCloneWithRetry`(clone)/ `execGitCapped`(fetch / checkout);
 *   - git-runner.ts 是本族唯一的 child_process 持有者,`execGitCapped` 即票面所指的 runGit 出口
 *     (timeout / maxBuffer / killSignal / 净化 env 全部在它内部默认给全);
 *   - 门 80(scripts/check-git-read-timeout.mjs)的 HOT 清单已扩射程到 apps/cli/src/plugins/**。
 *
 * 测试口径(沿用 plugins-git-caps.test.ts 的两条硬约束):
 *   - **真派生**:用 `binary: process.execPath` 起真 Node 子进程冒充 git,不 mock child_process ——
 *     mock 出来的"封顶"证明的是断言写法,不是封顶真的杀得掉进程;
 *   - **正反成对**:源码断言配"旧形态必须命中"的反向锚,封顶断言配"放宽后必须拿到完整输出"的对照。
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_GIT_MAX_BUFFER_BYTES,
  DEFAULT_GIT_TIMEOUT_MS,
  GIT_KILL_SIGNAL,
  GitBinaryUnavailableError,
  GitCommandTimeoutError,
  GitOutputTooLargeError,
  buildGitEnv,
  classifyGitFailure,
  execGitCapped,
  resolveGitSpawnOptions,
} from '../src/plugins/git-runner.js';

/** 直连 child_process 派生调用的形态(cache.ts 收敛前正是第一段这种) */
const SPAWN_CALL_RE = /\b(?:execFileSync|execSync|execFile|spawnSync|spawn|fork)\s*\(/;
const CHILD_PROCESS_IMPORT_RE = /from\s+['"]node:child_process['"]/;

const readSrc = (rel: string): string => fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const cacheSrc = readSrc('../src/plugins/cache.ts');
const runnerSrc = readSrc('../src/plugins/git-runner.ts');
const gateSrc = readSrc('../../../scripts/check-git-read-timeout.mjs');

describe('G-814388 收敛面:cache.ts 零直连派生,三趟全部点名唯一出口', () => {
  it('cache.ts 不 import node:child_process,也不存在任何 execFileSync/execSync/spawn 直连调用', () => {
    expect(cacheSrc).not.toMatch(CHILD_PROCESS_IMPORT_RE);
    expect(cacheSrc).not.toMatch(SPAWN_CALL_RE);
  });

  it('反向锚:上面那条正则在收敛前的旧形态上确实命中(证明 not.toMatch 不是恒真式)', () => {
    expect(SPAWN_CALL_RE.test("execFileSync(gitBin, args, { stdio: 'pipe', windowsHide: true })")).toBe(true);
    expect(CHILD_PROCESS_IMPORT_RE.test("import { execFileSync } from 'node:child_process';")).toBe(true);
  });

  it('clone / fetch / checkout 三趟分别落在 execGitCloneWithRetry 与 execGitCapped,网络档带 GIT_NETWORK_TIMEOUT_MS', () => {
    expect(cacheSrc).toContain("from './git-runner.js'");
    expect(cacheSrc).toContain('execGitCloneWithRetry(');
    expect(cacheSrc).toContain("execGitCapped(['-C', target, 'fetch'");
    expect(cacheSrc).toContain("execGitCapped(['-C', target, 'checkout'");
    expect(cacheSrc).toContain('GIT_NETWORK_TIMEOUT_MS');
  });

  it('唯一出口由 git-runner.ts 持有:本族只有它 import child_process 并真正派生', () => {
    expect(runnerSrc).toMatch(CHILD_PROCESS_IMPORT_RE);
    expect(runnerSrc).toMatch(SPAWN_CALL_RE);
  });
});

describe('G-814388 出口封顶:runGit 等价面(execGitCapped)对 git 派生传入 timeout / maxBuffer / killSignal', () => {
  it('默认解析:没传 opts 也拿到全部三件套(没传 ≠ 没封顶)', () => {
    const r = resolveGitSpawnOptions();
    expect(r.timeoutMs).toBe(DEFAULT_GIT_TIMEOUT_MS);
    expect(r.timeoutMs).toBeGreaterThan(0);
    expect(r.maxBufferBytes).toBe(DEFAULT_GIT_MAX_BUFFER_BYTES);
    expect(r.maxBufferBytes).toBeGreaterThan(1024 * 1024); // 高于 Node 默认 1MB,否则大仓 clone 必 ENOBUFS
    expect(r.killSignal).toBe(GIT_KILL_SIGNAL);
    expect(r.windowsHide).toBe(true);
    expect(r.stdio).toBe('pipe');
  });

  it('真派生:挂起进程在 timeoutMs 内被杀(GitCommandTimeoutError / code=ETIMEDOUT / 消息点名 killSignal)', () => {
    const t0 = Date.now();
    let thrown: unknown;
    try {
      // 子进程自己睡 8s;封顶只给 300ms ⇒ 必须是"被杀"而不是"等完"
      execGitCapped(['-e', 'setTimeout(() => {}, 8000)'], { binary: process.execPath, timeoutMs: 300 });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(GitCommandTimeoutError);
    const err = thrown as GitCommandTimeoutError;
    expect(err.code).toBe('ETIMEDOUT');
    expect(err.timeoutMs).toBe(300);
    expect(err.message).toContain(GIT_KILL_SIGNAL);
    expect(Date.now() - t0).toBeLessThan(4000); // 有牙:真被杀掉了,而不是断言碰巧对上
  });

  it('真派生:输出超 maxBuffer ⇒ GitOutputTooLargeError(ENOBUFS),绝不返回半截内容', () => {
    let returned: string | undefined;
    let thrown: unknown;
    try {
      returned = execGitCapped(['-e', 'console.log("x".repeat(400000))'], {
        binary: process.execPath,
        maxBufferBytes: 1024,
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(GitOutputTooLargeError);
    expect((thrown as GitOutputTooLargeError).code).toBe('ENOBUFS');
    expect(returned).toBeUndefined();
  });

  it('反向对照:maxBuffer 放宽后同一脚本拿到完整输出(封顶不是恒红)', () => {
    const out = execGitCapped(['-e', 'console.log("x".repeat(400000))'], {
      binary: process.execPath,
      maxBufferBytes: 4 * 1024 * 1024,
    });
    expect(out.trim().length).toBe(400000);
  });
});

describe('G-814388 env 净化:可疑键剥离、git 必需白名单保留', () => {
  it('buildGitEnv:GIT_DIR 族 / 密钥形态 / 任意未知键一律剥离;PATH/SystemRoot/COMSPEC/HOME 与代理键保留', () => {
    const env = buildGitEnv({
      PATH: '/usr/bin:/bin',
      SystemRoot: 'C:/Windows',
      COMSPEC: 'C:/Windows/system32/cmd.exe',
      HOME: '/home/t',
      HTTP_PROXY: 'http://127.0.0.1:7890',
      GIT_DIR: '/wrong/gitdir',
      GIT_INDEX_FILE: '/wrong/index',
      GIT_CONFIG_GLOBAL: '/wrong/config',
      GIT_SSH_COMMAND: 'ssh -i /secret/id_ed25519',
      GIT_ASKPASS: 'echo-pw',
      AWS_SECRET_ACCESS_KEY: 'sk-live',
      IHUI_G814388_MARKER: 'must-not-pass',
    } as NodeJS.ProcessEnv);
    expect(env.PATH).toBe('/usr/bin:/bin');
    expect(env.SystemRoot).toBe('C:/Windows');
    expect(env.COMSPEC).toBe('C:/Windows/system32/cmd.exe');
    expect(env.HOME).toBe('/home/t');
    expect(env.HTTP_PROXY).toBe('http://127.0.0.1:7890');
    expect(env.GIT_DIR).toBeUndefined();
    expect(env.GIT_INDEX_FILE).toBeUndefined();
    expect(env.GIT_CONFIG_GLOBAL).toBeUndefined();
    expect(env.GIT_SSH_COMMAND).toBeUndefined();
    expect(env.GIT_ASKPASS).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.IHUI_G814388_MARKER).toBeUndefined();
    expect(env.GIT_TERMINAL_PROMPT).toBe('0'); // 交互索要凭据被强制关:封顶成立的前提
  });

  it('真派生走同一份白名单:投影源里的可疑键在子进程中不可见,PATH/SystemRoot 保留', () => {
    const probe = [
      'console.log(JSON.stringify({',
      'gitDir: process.env.GIT_DIR ?? null,',
      'marker: process.env.IHUI_G814388_MARKER ?? null,',
      'hasPath: !!process.env.PATH,',
      'systemRoot: process.env.SystemRoot ?? process.env.WINDIR ?? null,',
      'terminalPrompt: process.env.GIT_TERMINAL_PROMPT ?? null,',
      '}))',
    ].join('');
    const raw = execGitCapped(['-e', probe], {
      binary: process.execPath,
      timeoutMs: 15_000,
      // 投影源直接给被污染的 env,不 mutate 本进程的 process.env
      env: {
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? process.env.WINDIR ?? '',
        GIT_DIR: 'Z:/wrong-gitdir',
        IHUI_G814388_MARKER: 'must-not-pass',
      },
    });
    const seen = JSON.parse(raw.trim()) as Record<string, unknown>;
    expect(seen.gitDir).toBeNull();
    expect(seen.marker).toBeNull();
    expect(seen.hasPath).toBe(true);
    expect(typeof seen.systemRoot === 'string' && (seen.systemRoot as string).length > 0).toBe(true);
    expect(seen.terminalPrompt).toBe('0');
  });
});

describe('G-814388 ENOENT 归因:git 不存在 ⇒ 清晰错误,不裸抛', () => {
  it('binary 指向不存在的路径 ⇒ GitBinaryUnavailableError(code=ENOENT,消息点名 IHUI_GIT_BIN 与候选解析)', () => {
    let thrown: unknown;
    try {
      execGitCapped(['status'], { binary: 'Z:/definitely-not-git/g814388-nope.exe', timeoutMs: 5000 });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(GitBinaryUnavailableError);
    const err = thrown as GitBinaryUnavailableError;
    expect(err.code).toBe('ENOENT');
    expect(err.class).toBe('binary-missing');
    expect(err.message).toContain('找不到可用的 git');
    expect(err.message).toContain('IHUI_GIT_BIN');
    expect(err.message).toContain('ENOENT');
  });

  it('派生层分类契约:裸 ENOENT ⇒ binary-missing 且**不重试**(git 缺失是确定性失败,重试只是三倍时长)', () => {
    const verdict = classifyGitFailure({ code: 'ENOENT' });
    expect(verdict.class).toBe('binary-missing');
    expect(verdict.retryable).toBe(false);
  });
});

describe('G-814388 守门射程:门 80 的 HOT 清单已含 apps/cli/src/plugins/**', () => {
  it('cache.ts / git-runner.ts / installer.ts / marketplace.ts 都登记在册(本票对 cache.ts 的改动在射程内)', () => {
    expect(gateSrc).toContain("'apps/cli/src/plugins/cache.ts'");
    expect(gateSrc).toContain("'apps/cli/src/plugins/git-runner.ts'");
    expect(gateSrc).toContain("'apps/cli/src/plugins/installer.ts'");
    expect(gateSrc).toContain("'apps/cli/src/plugins/marketplace.ts'");
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
