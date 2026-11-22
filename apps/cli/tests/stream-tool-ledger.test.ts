// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 流式期工具登记账本:锁四条性质
// 1. 登记即时(不等流结束)+ 提前执行只发给准入线内的调用;
// 2. 幂等 —— 同一个调用被"提前执行"和"主路径"各要一次结果时只真跑一次;
// 3. 同指纹多次出现不得被合并(那是改语义,不是修 bug);
// 4. end_of_stream 与恢复锚点 —— stranded/unknown 必须如实报,不得静默当没发生。
import { describe, expect, it, vi } from 'vitest';

import {
  StreamToolLedger,
  canonicalizeArgs,
  computeFingerprint,
  formatLedgerSummary,
} from '../src/stream-tool-ledger.js';

const READ_EARLY = new Set(['read_file', 'search_codebase']);

function makeLedger(overrides?: Partial<ConstructorParameters<typeof StreamToolLedger>[0]>) {
  return new StreamToolLedger({
    turn: 3,
    streamId: 'stream-aaaa-1111',
    mayRunEarly: (name) => READ_EARLY.has(name),
    ...overrides,
  });
}

describe('canonicalizeArgs / fingerprint', () => {
  it('参数键序不同不影响指纹(否则断流重放对不上)', () => {
    const a = computeFingerprint(1, 'read_file', { path: 'x.ts', encoding: 'utf8' });
    const b = computeFingerprint(1, 'read_file', { encoding: 'utf8', path: 'x.ts' });
    expect(a).toBe(b);
  });

  it('嵌套对象也按键序归一', () => {
    expect(canonicalizeArgs({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } })).toBe(
      '{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}',
    );
  });

  it('轮次/工具名/参数任一不同即不同指纹', () => {
    const base = computeFingerprint(1, 'read_file', { path: 'x' });
    expect(computeFingerprint(2, 'read_file', { path: 'x' })).not.toBe(base);
    expect(computeFingerprint(1, 'file_edit', { path: 'x' })).not.toBe(base);
    expect(computeFingerprint(1, 'read_file', { path: 'y' })).not.toBe(base);
  });
});

describe('登记与提前执行', () => {
  it('登记即按到达顺序入册,seq 单调', () => {
    const ledger = makeLedger();
    const first = ledger.register({ toolCallId: 't1', toolName: 'read_file', args: { path: 'a' } });
    const second = ledger.register({ toolCallId: 't2', toolName: 'file_edit', args: { path: 'b' } });
    expect(first.anchor.seq).toBe(1);
    expect(second.anchor.seq).toBe(2);
    expect(ledger.size).toBe(2);
    expect(ledger.ended).toBe(false);
  });

  it('同一 toolCallId 重复登记不造第二条(流重放安全)', () => {
    const ledger = makeLedger();
    const run = vi.fn(async () => ({ ok: true }));
    ledger.register({ toolCallId: 'dup', toolName: 'read_file', args: { path: 'a' } }, run);
    const again = ledger.register(
      { toolCallId: 'dup', toolName: 'read_file', args: { path: 'a' } },
      run,
    );
    expect(ledger.size).toBe(1);
    expect(again.anchor.seq).toBe(1);
  });

  it('准入线内的只读调用当场就跑,不必等 markEndOfStream', async () => {
    const ledger = makeLedger();
    const run = vi.fn(async () => 'content');
    const entry = ledger.register({ toolName: 'read_file', args: { path: 'a' } }, run);
    // 微任务推进一次即应已发起
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    expect(entry.state).toBe('settled');
    expect(entry.early).toBe(true);
    expect(entry.ok).toBe(true);
  });

  it('准入线外的调用(有副作用)绝不提前发起', async () => {
    const ledger = makeLedger();
    const run = vi.fn(async () => 'done');
    const entry = ledger.register({ toolName: 'file_edit', args: { path: 'a' } }, run);
    await Promise.resolve();
    expect(run).not.toHaveBeenCalled();
    expect(entry.state).toBe('registered');
    expect(entry.early).toBe(false);
  });
});

describe('runOnce 幂等(提前执行 + 主路径只跑一次)', () => {
  it('提前执行已发起时主路径复用同一结果,不重复执行', async () => {
    const ledger = makeLedger();
    let calls = 0;
    const entry = ledger.register({ toolName: 'read_file', args: { path: 'a' } }, async () => {
      calls += 1;
      await Promise.resolve();
      return { output: `read#${calls}` };
    });
    const first = await ledger.runOnce(entry, async () => {
      calls += 1;
      return { output: `late#${calls}` };
    });
    expect(first.reused).toBe(true);
    expect(first.attempts).toBe(1);
    expect(first.value).toEqual({ output: 'read#1' });
    expect(calls).toBe(1);
  });

  it('未提前执行时主路径自己发起,reused=false', async () => {
    const ledger = makeLedger();
    const run = vi.fn(async () => 'r');
    const entry = ledger.register({ toolName: 'file_edit', args: { path: 'a' } }, run);
    const res = await ledger.runOnce(entry, run);
    expect(res.reused).toBe(false);
    expect(res.value).toBe('r');
    expect(entry.state).toBe('settled');
    expect(entry.early).toBe(false);
  });

  it('同名同参两次调用各自执行一次,不被指纹合并', async () => {
    const ledger = makeLedger({ mayRunEarly: () => false });
    const args = { path: 'twice.txt' };
    const first = ledger.register({ toolName: 'file_edit', args });
    const second = ledger.register({ toolName: 'file_edit', args });
    expect(first.dedupeKey).not.toBe(second.dedupeKey);
    let n = 0;
    const r1 = await ledger.runOnce(first, async () => ++n);
    const r2 = await ledger.runOnce(second, async () => ++n);
    expect([r1.value, r2.value]).toEqual([1, 2]);
    expect(r1.reused).toBe(false);
    expect(r2.reused).toBe(false);
  });

  it('matchForCall 按登记顺序把同指纹的两次分发到不同条目', async () => {
    const ledger = makeLedger({ mayRunEarly: () => false });
    const args = { path: 'same.txt' };
    ledger.register({ toolName: 'read_file', args });
    ledger.register({ toolName: 'read_file', args });
    const m1 = ledger.matchForCall('read_file', args);
    expect(m1?.anchor.seq).toBe(1);
    await ledger.runOnce(m1!, async () => 1);
    // 上一条已被消费,再查必须落到后一条 —— 否则第二次调用会复用第一次的结果
    const m2 = ledger.matchForCall('read_file', args);
    expect(m2?.anchor.seq).toBe(2);
    await ledger.runOnce(m2!, async () => 2);
    expect(ledger.matchForCall('read_file', args)).toBeUndefined();
  });

  it('找不到匹配条目时返回 undefined(正则解析路径不冒充原生登记)', () => {
    const ledger = makeLedger();
    expect(ledger.matchForCall('never_registered', {})).toBeUndefined();
  });
});

describe('end_of_stream 与恢复锚点', () => {
  it('流读完仍未派发的登记项判 lost 并被列出', async () => {
    const ledger = makeLedger();
    ledger.register({ toolName: 'file_edit', args: { path: 'a' } });
    const settledEntry = ledger.register({ toolName: 'read_file', args: { path: 'b' } });
    await ledger.runOnce(settledEntry, async () => 'ok');
    const stranded = ledger.markEndOfStream();
    expect(ledger.ended).toBe(true);
    expect(stranded.map((e) => e.toolName)).toEqual(['file_edit']);
    expect(stranded[0]?.skipReason).toBe('end-of-stream before dispatch');
  });

  it('快照可序列化并原样用于对账', async () => {
    const ledger = makeLedger();
    const entry = ledger.register({ toolName: 'read_file', args: { path: 'a' } });
    await ledger.runOnce(entry, async () => 'v');
    ledger.markEndOfStream();
    const snapshot = ledger.snapshot();
    const roundTripped = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    expect(roundTripped.version).toBe(1);
    expect(roundTripped.turn).toBe(3);
    expect(roundTripped.endOfStreamAtMs).toBeTypeOf('number');
    expect(roundTripped.entries[0]?.anchor.fingerprint).toBe(entry.anchor.fingerprint);
  });

  it('reconcile 把"重复发起 / 状态未知 / 已落地"三类分开', async () => {
    const prev = makeLedger();
    const settledA = prev.register({ toolName: 'read_file', args: { path: 'a' } });
    const unknownB = prev.register({ toolName: 'search_codebase', args: { q: 'z' } });
    const doneC = prev.register({ toolName: 'fetch_url', args: { url: 'u' } });
    await prev.runOnce(settledA, async () => 1);
    await prev.runOnce(doneC, async () => 2);
    // unknownB 手动停在 started:模拟请求已发出但结果没回来(断流)
    unknownB.state = 'started';
    const snapshot = prev.snapshot();

    const next = makeLedger({ streamId: 'stream-bbbb-2222' });
    const replay = next.register({ toolName: 'read_file', args: { path: 'a' } });
    const report = StreamToolLedger.reconcile(snapshot, next.entries());
    expect(report.replayed.map((a) => a.fingerprint)).toEqual([replay.anchor.fingerprint]);
    expect(report.unknownEffect).toHaveLength(1);
    expect(report.settled.map((a) => a.fingerprint)).toEqual([doneC.anchor.fingerprint]);
  });

  it('ended 之后的 late 登记(不带 run)直接丢弃:不入册、不进快照', () => {
    const ledger = makeLedger();
    ledger.register({ toolName: 'read_file', args: { path: 'a' } });
    ledger.markEndOfStream();
    ledger.register({ toolName: 'search_codebase', args: { q: 'z' } });
    // 迟到的裸登记既没有执行机会也没有对账价值 —— 丢弃而不是伪造一条走不完的
    // lifecycle:账本只记还有完整生命周期可观测的调用。
    expect(ledger.size).toBe(1);
    expect(ledger.entries()).toHaveLength(1);
    const snap = ledger.snapshot();
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries.some((e) => e.skipReason === 'registered after end-of-stream')).toBe(false);
    expect(ledger.ended).toBe(true);
  });

  it('ended 之后带 run 的 late 登记必须大声抛错(不得静默无操作,也不得悄悄跑一次)', () => {
    const ledger = makeLedger();
    ledger.markEndOfStream();
    const run = vi.fn(async () => 1);
    expect(() => ledger.register({ toolName: 'read_file', args: { path: 'x' } }, run)).toThrow(
      /refusing to register/,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('同 toolCallId 不同指纹不得并入(撞键并发的第二次调用会静默蒸发)', () => {
    const ledger = makeLedger({ mayRunEarly: () => false });
    const first = ledger.register({ toolCallId: 'clash', toolName: 'read_file', args: { path: 'a' } });
    const second = ledger.register({ toolCallId: 'clash', toolName: 'read_file', args: { path: 'b' } });
    expect(second).not.toBe(first);
    expect(second.anchor.fingerprint).not.toBe(first.anchor.fingerprint);
    expect(ledger.size).toBe(2);
    // 幂等回放仍成立:同 id 且同指纹拿到同一条,不多造
    const replay = ledger.register({ toolCallId: 'clash', toolName: 'read_file', args: { path: 'a' } });
    expect(replay).toBe(first);
    expect(ledger.size).toBe(2);
  });

  it('摘要一行含 endOfStream 与 unknown/lost 计数(断流时人要能读懂)', async () => {
    const ledger = makeLedger();
    const e = ledger.register({ toolName: 'read_file', args: { path: 'a' } });
    await ledger.runOnce(e, async () => 1);
    const stuck = ledger.register({ toolName: 'file_edit', args: { path: 'b' } });
    stuck.state = 'started';
    const text = formatLedgerSummary(ledger.snapshot());
    expect(text).toContain('turn=3');
    expect(text).toContain('settled=1(ok=1,fail=0)');
    expect(text).toContain('unknown=1');
    expect(text).toContain('endOfStream=no');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
