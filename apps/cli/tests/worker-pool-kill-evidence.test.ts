// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest';
import {
  attemptKillSignal,
  attributeWorkerExit,
  formatExitEvidenceSuffix,
  formatKillEvidenceReport,
  formatUndeterminedReport,
  probeWorkerLiveness,
  shouldMarkDeadAfterKill,
  type KillableProcLike,
  type WorkerKillEvidence,
} from '../src/subagents/worker-pool.js';

/**
 * G-998112:worker 池 kill 退出证据回归。
 * 全程离线:用假 proc(注入 kill 行为),不派生真实子进程、不发真实信号。
 */

type KillBehavior = 'sent' | 'not-sent' | { throwCode: string; message?: string };

interface FakeProcOptions {
  pid?: number;
  exitCode?: number | null;
  signalCode?: NodeJS.Signals | null;
  killBehavior?: KillBehavior;
}

interface FakeProc extends KillableProcLike {
  killCalls: Array<NodeJS.Signals | 0>;
}

function makeFakeProc(options: FakeProcOptions = {}): FakeProc {
  const killCalls: Array<NodeJS.Signals | 0> = [];
  const behavior: KillBehavior = options.killBehavior ?? 'sent';
  return {
    pid: options.pid ?? 4242,
    exitCode: options.exitCode ?? null,
    signalCode: options.signalCode ?? null,
    killCalls,
    kill(signal: NodeJS.Signals | 0): boolean {
      killCalls.push(signal);
      if (typeof behavior === 'object') {
        const err = new Error(behavior.message ?? `kill test double (${behavior.throwCode})`);
        (err as NodeJS.ErrnoException).code = behavior.throwCode;
        throw err;
      }
      return behavior === 'sent';
    },
  };
}

function sentKill(signal: NodeJS.Signals = 'SIGTERM'): WorkerKillEvidence {
  return { signal, pid: 4242, sent: true };
}

describe('attemptKillSignal — kill 发出证据(永不抛错、永不静默)', () => {
  it('kill 返回 true ⇒ sent=true,记录 signal 与 pid', () => {
    const proc = makeFakeProc({ pid: 4242 });
    const evidence = attemptKillSignal(proc, 'SIGTERM');
    expect(evidence).toEqual({ signal: 'SIGTERM', pid: 4242, sent: true });
    expect(proc.killCalls).toEqual(['SIGTERM']);
  });

  it('kill 返回 false ⇒ sent=false 且带错误信息', () => {
    const proc = makeFakeProc({ killBehavior: 'not-sent' });
    const evidence = attemptKillSignal(proc, 'SIGKILL');
    expect(evidence.sent).toBe(false);
    expect(evidence.error ?? '').not.toBe('');
  });

  it('kill 抛错(ESRCH)⇒ sent=false 且错误进证据,不抛到调用方', () => {
    const proc = makeFakeProc({ killBehavior: { throwCode: 'ESRCH' } });
    const evidence = attemptKillSignal(proc, 'SIGTERM');
    expect(evidence.sent).toBe(false);
    expect(evidence.error ?? '').not.toBe('');
    expect(proc.killCalls).toEqual(['SIGTERM']);
  });
});

describe('probeWorkerLiveness — 存活探针(OS 证据)', () => {
  it('exitCode 非空 ⇒ 已不在(false),不发 0 信号', () => {
    const proc = makeFakeProc({ exitCode: 1 });
    expect(probeWorkerLiveness(proc)).toBe(false);
    expect(proc.killCalls).toEqual([]);
  });

  it('signalCode 非空 ⇒ 已不在(false)', () => {
    const proc = makeFakeProc({ signalCode: 'SIGKILL' });
    expect(probeWorkerLiveness(proc)).toBe(false);
  });

  it('0 信号可达 ⇒ 仍在(true)', () => {
    const proc = makeFakeProc({});
    expect(probeWorkerLiveness(proc)).toBe(true);
    expect(proc.killCalls).toEqual([0]);
  });

  it('0 信号抛 ESRCH ⇒ 已不在(false);抛 EPERM ⇒ 仍在(true);抛未知 ⇒ null 未判定', () => {
    expect(probeWorkerLiveness(makeFakeProc({ killBehavior: { throwCode: 'ESRCH' } }))).toBe(false);
    expect(probeWorkerLiveness(makeFakeProc({ killBehavior: { throwCode: 'EPERM' } }))).toBe(true);
    expect(probeWorkerLiveness(makeFakeProc({ killBehavior: { throwCode: 'EIO' } }))).toBe(null);
  });
});

describe('shouldMarkDeadAfterKill — 有 OS 证据才记 dead', () => {
  it('有 exit code ⇒ 可记 dead', () => {
    expect(shouldMarkDeadAfterKill({ exitCode: 1, signalCode: null, alive: null }).markDead).toBe(true);
  });

  it('探针确认已不在 ⇒ 可记 dead', () => {
    expect(shouldMarkDeadAfterKill({ exitCode: null, signalCode: null, alive: false }).markDead).toBe(true);
  });

  it('探针确认仍在 ⇒ 不记 dead(未判定)', () => {
    const gate = shouldMarkDeadAfterKill({ exitCode: null, signalCode: null, alive: true });
    expect(gate.markDead).toBe(false);
    expect(gate.reason).toContain('still alive');
  });

  it('未知 ⇒ 不记 dead(宁可报名,不把没判写成已判)', () => {
    const gate = shouldMarkDeadAfterKill({ exitCode: null, signalCode: null, alive: null });
    expect(gate.markDead).toBe(false);
  });
});

describe('attributeWorkerExit — 退出归因三态', () => {
  it('kill 发出且进程真退(code=1)⇒ 有退出证据,终态 failed', () => {
    const kills = [sentKill('SIGTERM')];
    const attribution = attributeWorkerExit({
      pid: 4242,
      code: 1,
      signal: null,
      timedOut: false,
      kills,
      alive: false,
    });
    expect(attribution.kind).toBe('decided');
    if (attribution.kind !== 'decided') return;
    expect(attribution.terminal).toBe('failed');
    expect(attribution.evidence.exited).toBe(true);
    expect(attribution.evidence.exitCode).toBe(1);
    expect(attribution.evidence.kills[0]?.sent).toBe(true);
  });

  it('正常退出(code=0)⇒ 有退出证据,终态 completed', () => {
    const attribution = attributeWorkerExit({
      pid: 4242,
      code: 0,
      signal: null,
      timedOut: false,
      kills: [],
      alive: false,
    });
    expect(attribution.kind).toBe('decided');
    if (attribution.kind !== 'decided') return;
    expect(attribution.terminal).toBe('completed');
    expect(attribution.evidence.exited).toBe(true);
  });

  it('kill 后进程仍在 ⇒ 不记 dead/failed,而是未判定 + 报名', () => {
    const kills = [sentKill('SIGKILL')];
    const attribution = attributeWorkerExit({
      pid: 4242,
      code: null,
      signal: null,
      timedOut: false,
      kills,
      alive: true,
    });
    expect(attribution.kind).toBe('undetermined');
    if (attribution.kind !== 'undetermined') return;
    expect(attribution.evidence.exited).toBe(false);
    const gate = shouldMarkDeadAfterKill({ exitCode: null, signalCode: null, alive: true });
    expect(gate.markDead).toBe(false);
    const report = formatUndeterminedReport('sa_test', {
      pid: 4242,
      exitCode: null,
      signal: null,
      alive: true,
      kills,
    });
    expect(report).toContain('4242');
    expect(report).toContain('still alive');
  });

  it('纯超时无 kill ⇒ 维持原终态 failed,不断言新退出证据', () => {
    const attribution = attributeWorkerExit({
      pid: 4242,
      code: null,
      signal: null,
      timedOut: true,
      kills: [],
      alive: null,
    });
    expect(attribution.kind).toBe('decided');
    if (attribution.kind !== 'decided') return;
    expect(attribution.terminal).toBe('failed');
    expect(attribution.evidence.exited).toBe(false);
    expect(attribution.evidence.kills).toEqual([]);
    expect(attribution.reason).toContain('timeout');
  });
});

describe('报名行 — 不再静默', () => {
  it('kill 报名行含 signal/pid/发出结果', () => {
    expect(formatKillEvidenceReport('sa_1', sentKill('SIGTERM'))).toContain('SIGTERM');
    expect(formatKillEvidenceReport('sa_1', sentKill('SIGTERM'))).toContain('4242');
    expect(formatKillEvidenceReport('sa_1', sentKill('SIGTERM'))).toContain('sent');
    const failed = formatKillEvidenceReport('sa_1', { signal: 'SIGKILL', pid: 7, sent: false, error: 'EPERM' });
    expect(failed).toContain('NOT sent');
    expect(failed).toContain('EPERM');
  });

  it('退出证据摘要含 kill 序列与 code/signal', () => {
    const suffix = formatExitEvidenceSuffix({
      pid: 4242,
      exited: true,
      exitCode: 1,
      signal: null,
      alive: false,
      kills: [sentKill('SIGTERM')],
    });
    expect(suffix).toContain('SIGTERM:sent');
    expect(suffix).toContain('exitCode=1');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
