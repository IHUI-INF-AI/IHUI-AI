// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 沙盒同步结算的退出归因测试(票:spawnSync 失败分型,timedOut 不再吞并其余类型)。
 *
 * 形状依据(本机 Node v24.19.0 现测,三形态均为实测回报,不是推测):
 *  - 真超时    = error.code 'ETIMEDOUT' + signal SIGTERM + status null
 *  - 撞上限    = error.code 'ENOBUFS'   + signal SIGTERM + status null + stdout 带回截断体
 *               ⇒ 旧实现按 signal 判超时,产出"没超时却报超时"—— 本票消灭的现症
 *  - 没拉起来  = error.code 'ENOENT'    + status null + stdout=undefined
 *               ⇒ 旧实现读成"跑完了且无输出"
 *
 * 口径(AGENTS §22c:镜像测试只复读实现就是复读机):
 *  断言一律走生产入口 —— runSandboxed(真机端到端)或它导出的结算/归因函数
 *  (settleSpawnSyncOutcome / classifySpawnSyncFailure,构造面);本文件**不内联
 *  第二份归因逻辑**,变异自证改的是 src/sandbox/index.ts 本体。
 *
 * 变异对照(改回旧写法必须翻红的断言):
 *  ① 归因序退化为"signal 一律算超时" ⇒ 「ENOBUFS ⇒ timedOut=false」与真机撞上限用例翻红;
 *  ②(见 sandbox-output-loss-diagnosis.test.ts)字节量纲退化;
 *  ③(同前)诊断门退化。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as path from 'node:path';
import {
  classifySpawnSyncFailure,
  runSandboxed,
  settleSpawnSyncOutcome,
  type SpawnSyncOutcomeLike,
} from '../src/sandbox/index.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

let CWD = '';
beforeAll(() => {
  // 夹具落点:scripts/lib/scratch-dir.mjs(§26 —— 不落 os.tmpdir(),不裸 mkdtempSync)
  CWD = mkScratch('sandbox-exit-attribution-');
});
afterAll(() => {
  // 超时强杀后,孙进程(node)对夹具目录的句柄是**异步释放**的,Windows EPERM 可持续数秒
  // —— 同族现象见本仓 tests/sandbox-index.test.ts 的 teardown 注释。清理属 best-effort:
  // 失败时该目录仍留在 scratch-dir 的退出回收注册表里(进程退出再试一轮),§26 每日 Temp
  // 体检兜底;绝不允许把已判定的套件炸成"未判定"。
  try {
    rmScratch(CWD);
  } catch (err) {
    console.warn(`[sandbox-exit-attribution] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

/** 构造 Node 的 ErrnoException 形状(只有 code/message 被生产判据消费)。 */
function errnoError(message: string, code: string): NodeJS.ErrnoException {
  const e = new Error(message) as NodeJS.ErrnoException;
  e.code = code;
  return e;
}

/** 带计数的 statfs 探针:证明"该量的时候量、不该量的时候一个字都不碰"。 */
function countingProbe(result: { availableBytes: bigint | null; freeInodes: bigint | null }) {
  const calls: string[] = [];
  return {
    calls,
    probe: (p: string) => {
      calls.push(p);
      return result;
    },
  };
}

describe('归因序(构造面 = 生产结算函数):实测四形态互不塌缩', () => {
  it('ENOBUFS+SIGTERM(撞输出上限)⇒ output_limit,且不得报 timedOut', () => {
    const outcome: SpawnSyncOutcomeLike = {
      error: errnoError('spawnSync C:\\Windows\\system32\\cmd.exe ENOBUFS', 'ENOBUFS'),
      status: null,
      signal: 'SIGTERM',
      stdout: 'x'.repeat(65536),
      stderr: '',
    };
    expect(classifySpawnSyncFailure(outcome)).toBe('output_limit');
    const s = settleSpawnSyncOutcome(outcome, { cwd: CWD, maxOutputBytes: 4096 });
    // HEAD 现症在 signal 上判超时 ⇒ timedOut:true;归因序若被改回"signal 一律算超时",本行翻红(变异①)
    expect(s.timedOut).toBe(false);
    expect(s.failureKind).toBe('output_limit');
    expect(s.truncated).toBe(true);
    expect(s.exitCode).toBeNull();
    expect(s.stderr).toContain('独立终态');
    expect(s.stderr).toContain('不是超时');
  });

  it('ETIMEDOUT+SIGTERM(真超时)⇒ timed_out,timedOut=true', () => {
    const outcome: SpawnSyncOutcomeLike = {
      error: errnoError('spawnSync C:\\Windows\\system32\\cmd.exe ETIMEDOUT', 'ETIMEDOUT'),
      status: null,
      signal: 'SIGTERM',
      stdout: '',
      stderr: '',
    };
    expect(classifySpawnSyncFailure(outcome)).toBe('timed_out');
    const s = settleSpawnSyncOutcome(outcome, { cwd: CWD, maxOutputBytes: 1024 });
    expect(s.failureKind).toBe('timed_out');
    expect(s.timedOut).toBe(true);
  });

  it('ENOENT(没被拉起)⇒ spawn_error,不得被读成"跑完了且无输出",且不触发文件系统探针', () => {
    const outcome: SpawnSyncOutcomeLike = {
      error: errnoError('spawnSync C:\\Windows\\system32\\cmd.exe ENOENT', 'ENOENT'),
      status: null,
      signal: null,
    };
    expect(classifySpawnSyncFailure(outcome)).toBe('spawn_error');
    const s = settleSpawnSyncOutcome(outcome, { cwd: path.join(CWD, 'no-such-sub'), maxOutputBytes: 1024 });
    expect(s.failureKind).toBe('spawn_error');
    expect(s.timedOut).toBe(false);
    expect(s.exitCode).toBeNull();
    expect(s.stdout).toBe(''); // 原始 stdout=undefined,归一为空串,但 stderr 必须点名真因
    expect(s.stderr).toContain('命令未能启动');
    expect(s.stderr).toContain('从未执行');

    // spawn_error 不借道 statfs 探针(嫌疑就在 cwd 本身,再探一次只是噪声):
    const tracked = countingProbe({ availableBytes: 0n, freeInodes: null });
    const s2 = settleSpawnSyncOutcome(outcome, { cwd: CWD, maxOutputBytes: 1024, statfs: tracked.probe });
    expect(tracked.calls.length).toBe(0);
    expect(s2.stderr).not.toContain('根因诊断');
  });

  it('cancelled 需调用方显式盖章;同一 SIGTERM 未盖章仍归 timed_out(序:timed_out > cancelled)', () => {
    const killed: SpawnSyncOutcomeLike = { status: null, signal: 'SIGTERM', stdout: '', stderr: '' };
    expect(classifySpawnSyncFailure(killed)).toBe('timed_out');
    expect(classifySpawnSyncFailure(killed, { cancelled: true })).toBe('cancelled');
    const s = settleSpawnSyncOutcome(killed, { cwd: CWD, maxOutputBytes: 1024, cancelled: true });
    expect(s.failureKind).toBe('cancelled');
    expect(s.timedOut).toBe(false); // cancelled 不得冒充超时
  });

  it('判不出类型 ⇒ unattributed:保留原始信息并喊"未判定",绝不归成 timed_out 或正常完成', () => {
    const weirdSignal: SpawnSyncOutcomeLike = { status: null, signal: 'SIGHUP', stdout: '', stderr: '' };
    expect(classifySpawnSyncFailure(weirdSignal)).toBe('unattributed');
    const sw = settleSpawnSyncOutcome(weirdSignal, { cwd: CWD, maxOutputBytes: 1024 });
    expect(sw.timedOut).toBe(false);
    expect(sw.failureKind).toBe('unattributed');
    expect(sw.stderr).toContain('未判定');
    expect(sw.stderr).toContain('signal=SIGHUP');

    const unknownCode: SpawnSyncOutcomeLike = {
      error: errnoError('spawnSync boom EXXX', 'EXXX'),
      status: null,
      signal: null,
    };
    expect(classifySpawnSyncFailure(unknownCode)).toBe('unattributed');
    const su = settleSpawnSyncOutcome(unknownCode, { cwd: CWD, maxOutputBytes: 1024 });
    expect(su.failureKind).toBe('unattributed');
    expect(su.stderr).toContain('spawnSync boom EXXX'); // 原错误必须保留,不被分型改写掉

    const nothing: SpawnSyncOutcomeLike = {};
    expect(classifySpawnSyncFailure(nothing)).toBe('unattributed'); // status 缺席 ≠ 完成
  });

  it('退出码归因:0 ⇒ null(正常);非零且有输出 ⇒ failed 且不进诊断门', () => {
    expect(classifySpawnSyncFailure({ status: 0, signal: null })).toBeNull();
    expect(classifySpawnSyncFailure({ status: 3, signal: null, stdout: 'oops', stderr: '' })).toBe('failed');
    const tracked = countingProbe({ availableBytes: 0n, freeInodes: null });
    const s = settleSpawnSyncOutcome(
      { status: 3, signal: null, stdout: 'oops', stderr: '' },
      { cwd: CWD, maxOutputBytes: 1024 * 1024, statfs: tracked.probe },
    );
    expect(tracked.calls.length).toBe(0); // 有输出 ⇒ 没丢,不去诊断
    expect(s.failureKind).toBe('failed');
    expect(s.stderr).toBe('');
  });
});

describe('真机端到端(生产入口 runSandboxed)', () => {
  it('真超时:timeoutMs 内没跑完 ⇒ timedOut=true + failureKind=timed_out', () => {
    // 内层定时器取 4s:够让 timeoutMs=800 先杀到,又不至于让孙进程长时间咬住夹具目录
    const r = runSandboxed('node -e "setTimeout(()=>{},4000)"', { cwd: CWD, timeoutMs: 800 });
    expect(r.timedOut).toBe(true);
    expect(r.failureKind).toBe('timed_out');
    expect(r.blocked).toBe(false);
  }, 20000);

  it('真撞上限:3MB 输出 + 4096B 预算 ⇒ output_limit(独立终态)且 timedOut=false', () => {
    const r = runSandboxed('node -e "process.stdout.write(\'x\'.repeat(3000000))"', {
      cwd: CWD,
      timeoutMs: 30000,
      maxOutputBytes: 4096,
    });
    expect(r.failureKind).toBe('output_limit');
    // 这就是"没超时却报超时"的反证:归因序若退化回 signal 判定,本行翻红(变异①)
    expect(r.timedOut).toBe(false);
    expect(r.truncated).toBe(true);
    expect(r.stderr).toContain('不是超时');
  }, 30000);

  it('真没被拉起(cwd 不存在)⇒ spawn_error + stderr 点出真因', () => {
    const r = runSandboxed('node -e "process.stdout.write(\'never\')"', {
      cwd: path.join(CWD, 'no-such-cwd-xyz'),
    });
    expect(r.failureKind).toBe('spawn_error');
    expect(r.exitCode).toBeNull();
    expect(r.timedOut).toBe(false);
    expect(r.stderr).toContain('命令未能启动');
  });

  it('④正常退出:原有六字段与改动前逐字同形(新字段只增不改)', () => {
    const r = runSandboxed('node -e "process.stdout.write(\'ok\')"', { cwd: CWD });
    expect({
      stdout: r.stdout,
      stderr: r.stderr,
      exitCode: r.exitCode,
      timedOut: r.timedOut,
      truncated: r.truncated,
      blocked: r.blocked,
    }).toEqual({ stdout: 'ok', stderr: '', exitCode: 0, timedOut: false, truncated: false, blocked: false });
    expect(r.failureKind ?? null).toBeNull();
  });

  it('blocked 拒绝分支不参与归因(blockReason 仍是唯一标记)', () => {
    const r = runSandboxed('curl http://example.invalid', { cwd: CWD, commandAllowlist: ['node'] });
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toContain('command_not_allowed');
    expect(r.failureKind).toBeUndefined();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
