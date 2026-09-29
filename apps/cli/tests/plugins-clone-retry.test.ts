// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816 —— clone 重试:抄上游 ZCode 的**结构**,不抄它的**文案正则**。
 *
 * 抄下来的三条(上游 `marketplace.ts:1662-1688` / `:1734-1758`):
 *   ① 有限次数,且**只对可重试类别**退避;② 重试前复位目标目录(git 拒绝 clone 进非空目录,
 *   不复位 = 第二轮必撞第一轮的残骸,"重试"这件事本身失效);③ 退避挂 abort 监听(取消不能等满)。
 *
 * 明确不抄的一条:上游 `isRetryableGitCloneError` 拿 `/RPC failed|Recv failure|early EOF …/i` 匹配 stderr。
 * 本仓纪律是"不靠错误文本做流程判断"(守门 135/67 同族),分类只读 `err.code` / `err.errno` / `err.status`。
 *
 * 本机实测(2026-09-29,Windows,取证探针 `.ihui-agent/tmp/git-caps-probe/probe.mjs`):
 *   派生层给结构码(ENOENT / ETIMEDOUT+SIGTERM / ENOBUFS+SIGTERM),而 **git 自己的网络失败
 *   (clone http://127.0.0.1:9、https://…invalid)只有 status=128,与权限/路径/仓库不存在同码**。
 *   ⇒ 票面预设的降级成立:**只认结构码白名单,其余一律不重试**(宁可不重试,绝不盲目重试)。
 *   代价如实登记在 git-runner.ts 头注:GitHub 偶发 RPC/recv timeout 落在 128 这一档,本实现不为它重试。
 *
 * 测试口径:真派生(node 冒充 git,计数器落盘 ⇒ "试了几次"是量出来的不是断言出来的),
 * 每个"会重试"都配一条"绝不重试"的反向对照。
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  GitCloneRetriesExhaustedError,
  GitCommandFailedError,
  GitOperationAbortedError,
  classifyGitFailure,
  execGitCloneWithRetry,
  redactForPrint,
  sleepAbortable,
} from '../src/plugins/git-runner.js';
import { GitCloneInputRejectedError } from '../src/plugins/url-shape.js';

// 夹具唯一落点(AGENTS §26):不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

/** 冒充 git 的子进程:argv 经 `node -e <body> <target> <marker>` 传入(argv[1]=target,argv[2]=marker) */
function fakeGit(args: {
  /** 每次尝试都要自增的计数器写在 marker/count */
  count: boolean;
  /** 写 leftover-<n> 到 target,用于证明"重试前复位" */
  leftover: boolean;
  /** 本轮结局:'hang'(挂起到被杀)/ 'exit128'(确定性失败)/ 'ok'(成功) */
  outcome: 'hang' | 'exit128' | 'ok' | 'hang-first-only';
  stderrText?: string;
}): string {
  const lines: string[] = [
    'const fs = require("fs");',
    'const target = process.argv[1];',
    'const marker = process.argv[2];',
    'const p = marker + "/count";',
    'const c = fs.existsSync(p) ? Number(fs.readFileSync(p, "utf8")) : 0;',
  ];
  if (args.count) lines.push('fs.writeFileSync(p, String(c + 1));');
  if (args.leftover) lines.push('fs.mkdirSync(target, { recursive: true });', 'fs.writeFileSync(target + "/leftover-" + c, "x");');
  if (args.stderrText) lines.push(`console.error(${JSON.stringify(args.stderrText)});`);
  if (args.outcome === 'hang') lines.push('setTimeout(() => {}, 20000);');
  if (args.outcome === 'hang-first-only') lines.push('if (c === 0) { setTimeout(() => {}, 20000); } else { process.exit(0); }');
  if (args.outcome === 'exit128') lines.push('process.exit(128);');
  if (args.outcome === 'ok') lines.push('process.exit(0);');
  return lines.join('');
}

function readCount(marker: string): number {
  const p = path.join(marker, 'count');
  if (!fs.existsSync(p)) return 0;
  return Number(fs.readFileSync(p, 'utf8'));
}

/** clone 形态的参数数组(尾部带一个含凭据的 URL,用来证明脱敏:它绝不该出现在任何错误文本里) */
const SENSITIVE_URL = 'https://user:pw\u0040127.0.0.1:9/ihs.git?token=SECRETVALUE';

function cloneArgs(target: string, marker: string, body: string): string[] {
  return ['-e', body, target, marker, '--', SENSITIVE_URL, target];
}

describe('G-816 execGitCloneWithRetry —— 只重试可重试类别', () => {
  it('被封顶杀掉的挂起(ETIMEDOUT)会退避重试,并在第二轮成功', async () => {
    const dir = mkScratch('ihui-clone-retry-ok-');
    try {
      const target = path.join(dir, 'staging');
      const body = fakeGit({ count: true, leftover: false, outcome: 'hang-first-only' });
      await execGitCloneWithRetry(cloneArgs(target, dir, body), target, {
        binary: process.execPath,
        timeoutMs: 200,
        baseDelayMs: 30,
        attempts: 3,
      });
      // 派生了两次:第一次挂起被杀,第二次成功 —— 次数是子进程自己记的账
      expect(readCount(dir)).toBe(2);
    } finally {
      rmScratch(dir);
    }
  });

  it('重试前旧 staging 被复位(正向对照:第一轮的 leftover 必须不在,第二轮的必须在)', async () => {
    const dir = mkScratch('ihui-clone-reset-');
    try {
      const target = path.join(dir, 'staging');
      const body = fakeGit({ count: true, leftover: true, outcome: 'hang-first-only' });
      await execGitCloneWithRetry(cloneArgs(target, dir, body), target, {
        binary: process.execPath,
        timeoutMs: 200,
        baseDelayMs: 30,
        attempts: 3,
      });
      expect(fs.existsSync(path.join(target, 'leftover-0'))).toBe(false);
      expect(fs.existsSync(path.join(target, 'leftover-1'))).toBe(true);
    } finally {
      rmScratch(dir);
    }
  });

  it('权限型确定性失败(退出码 128 + stderr 写着 Permission denied)**绝不重试**', async () => {
    const dir = mkScratch('ihui-clone-noretry-');
    try {
      const target = path.join(dir, 'staging');
      const body = fakeGit({
        count: true,
        leftover: false,
        outcome: 'exit128',
        // 上游那条文案正则在这一形态下**会**判成可重试 —— 我方按结构码必须判不可重试。
        stderrText: 'Permission denied (publickey): fatal: unable to access RPC failed; curl 56 Recv failure early EOF',
      });
      let thrown: unknown;
      try {
        await execGitCloneWithRetry(cloneArgs(target, dir, body), target, {
          binary: process.execPath,
          timeoutMs: 5_000,
          baseDelayMs: 30,
          attempts: 3,
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(GitCommandFailedError);
      expect((thrown as GitCommandFailedError).status).toBe(128);
      // 本条的落点:次数必须恰为 1(证明不靠文案 —— 文案里堆满了上游会放行的关键词)
      expect(readCount(dir)).toBe(1);
    } finally {
      rmScratch(dir);
    }
  });

  it('重试耗尽 ⇒ 错误里带尝试次数,且**不含**凭据 / URL 查询串', async () => {
    const dir = mkScratch('ihui-clone-exhaust-');
    try {
      const target = path.join(dir, 'staging');
      const body = fakeGit({ count: true, leftover: true, outcome: 'hang' });
      let thrown: unknown;
      try {
        await execGitCloneWithRetry(cloneArgs(target, dir, body), target, {
          binary: process.execPath,
          timeoutMs: 150,
          baseDelayMs: 20,
          attempts: 2,
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(GitCloneRetriesExhaustedError);
      const err = thrown as GitCloneRetriesExhaustedError;
      expect(err.attempts).toBe(2);
      expect(readCount(dir)).toBe(2);
      expect(err.message).toContain('2 次尝试');
      // 脱敏硬要求:URL 连同 userinfo 与 query 一律不得进错误文本
      expect(err.message).not.toContain('SECRETVALUE');
      expect(err.message).not.toContain('user:pw');
      expect(err.message).not.toContain('127.0.0.1:9');
    } finally {
      rmScratch(dir);
    }
  });

  it('取消信号在退避里到达 ⇒ 立刻结束,不再发起第三轮', async () => {
    const dir = mkScratch('ihui-clone-abort-');
    const controller = new AbortController();
    try {
      const target = path.join(dir, 'staging');
      const body = fakeGit({ count: true, leftover: false, outcome: 'hang' });
      setTimeout(() => controller.abort(), 400);
      const t0 = Date.now();
      let thrown: unknown;
      try {
        await execGitCloneWithRetry(cloneArgs(target, dir, body), target, {
          binary: process.execPath,
          timeoutMs: 150,
          baseDelayMs: 6_000, // 刻意给一个远超测试窗口的退避:能被 abort 打断才算"可取消退避"
          attempts: 5,
          signal: controller.signal,
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(GitOperationAbortedError);
      expect(readCount(dir)).toBe(1);
      expect(Date.now() - t0).toBeLessThan(3_000);
    } finally {
      rmScratch(dir);
    }
  });

  it('预先取消 ⇒ 一轮都不派生', async () => {
    const dir = mkScratch('ihui-clone-preabort-');
    const controller = new AbortController();
    controller.abort();
    try {
      const target = path.join(dir, 'staging');
      const body = fakeGit({ count: true, leftover: false, outcome: 'ok' });
      await expect(
        execGitCloneWithRetry(cloneArgs(target, dir, body), target, {
          binary: process.execPath,
          signal: controller.signal,
        }),
      ).rejects.toBeInstanceOf(GitOperationAbortedError);
      expect(readCount(dir)).toBe(0);
    } finally {
      rmScratch(dir);
    }
  });
});

describe('G-816 classifyGitFailure —— 只读结构码', () => {
  it('白名单内:被封顶杀掉(ETIMEDOUT)与传输类 errno ⇒ 可重试', () => {
    expect(classifyGitFailure({ code: 'ETIMEDOUT', signal: 'SIGTERM' })).toMatchObject({
      class: 'timeout',
      retryable: true,
    });
    expect(classifyGitFailure({ code: 'ECONNRESET' }).retryable).toBe(true);
    expect(classifyGitFailure({ code: 'EAI_AGAIN' }).retryable).toBe(true);
  });

  it('白名单外:ENOENT / ENOBUFS / 纯退出码(实测 git 网络失败就在这一档)⇒ 不重试', () => {
    expect(classifyGitFailure({ code: 'ENOENT' })).toMatchObject({ class: 'binary-missing', retryable: false });
    expect(classifyGitFailure({ code: 'ENOBUFS', signal: 'SIGTERM' })).toMatchObject({
      class: 'output-too-large',
      retryable: false,
    });
    // 这条是"降级成立"的证据:git 自己的网络失败拿不到 errno,只有 128
    expect(classifyGitFailure({ status: 128 })).toMatchObject({ class: 'exit', status: 128, retryable: false });
  });

  it('安全拒绝类(带 reasonCode / G-786 形状拒绝 / 取消)一律不重试且原样上抛', () => {
    expect(classifyGitFailure({ reasonCode: 'urlLeadingDash' })).toMatchObject({
      class: 'unsafe-rejection',
      retryable: false,
    });
    expect(classifyGitFailure(new GitCloneInputRejectedError('url', 'urlSchemeUnsupported', 'ext::'))).toMatchObject({
      class: 'unsafe-rejection',
      retryable: false,
    });
    expect(classifyGitFailure(new GitOperationAbortedError())).toMatchObject({ class: 'aborted', retryable: false });
  });
});

describe('G-816 退避与脱敏两个纯件', () => {
  it('sleepAbortable 到点返回;期间 abort ⇒ 立刻以取消错误结束', async () => {
    const c = new AbortController();
    setTimeout(() => c.abort(), 40);
    const t0 = Date.now();
    await expect(sleepAbortable(4_000, c.signal)).rejects.toBeInstanceOf(GitOperationAbortedError);
    expect(Date.now() - t0).toBeLessThan(2_000);
    await expect(sleepAbortable(10)).resolves.toBeUndefined();
  });

  it('redactForPrint 剥掉 URL(含 userinfo/query)与凭据键值,普通叙述逐字不改坏', () => {
    const leaky = "fatal: unable to access 'https://u:p\u0040h.example/x.git?token=ABC123': Received fatal alert";
    const out = redactForPrint(leaky);
    expect(out).not.toContain('u:p');
    expect(out).not.toContain('ABC123');
    expect(out).toContain('<url-redacted>');
    expect(out).toContain('Received fatal alert');
    expect(redactForPrint('password=hunter2 rejected')).not.toContain('hunter2');
    expect(redactForPrint('')).toBe('');
    expect(redactForPrint('plain narrative, no url')).toBe('plain narrative, no url');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
