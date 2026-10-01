// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 本文件由 G-688 票据新增:"查不到"与"没有"分型 + 观察汇(永不抛 / sender 身份闸门)。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type * as stateStoreNs from '../src/subagents/state-store.js';
import type { SubagentObservation } from '../src/subagents/state-store.js';

/** 只用作类型面;运行期实例由 freshStore() 取(构造时刻的销号集合是模块级状态) */
type StateStore = typeof stateStoreNs;

let tmpDir = '';
let store: StateStore;

/** 每个用例换一个全新模块实例:构造时刻的幂等与"本进程在飞"集合是模块级状态 */
async function freshStore(): Promise<StateStore> {
  vi.resetModules();
  return (await import('../src/subagents/state-store.js')) as StateStore;
}

function writeRaw(id: string, body: string): void {
  fs.writeFileSync(path.join(tmpDir, `${id}.json`), body, 'utf-8');
}

function seedRow(id: string, parentId: string, status: string): void {
  writeRaw(
    id,
    JSON.stringify(
      {
        id,
        parentId,
        persona: 'coder',
        capabilityMode: 'all',
        isolation: 'none',
        transcript: [],
        status,
        startedAt: '2026-09-29T00:00:00.000Z',
      },
      null,
      2,
    ),
  );
}

function bytesOf(id: string): string {
  return fs.readFileSync(path.join(tmpDir, `${id}.json`), 'utf-8');
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-g688-'));
  process.env.IHUI_SUBAGENT_STATE_DIR = tmpDir;
  store = await freshStore();
});

afterEach(() => {
  delete process.env.IHUI_SUBAGENT_STATE_DIR;
  if (tmpDir && fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('G-688 集合面:"查不到"与"没有"是两个类型', () => {
  it('票面成对判据①:查到且为空 ⇒ 空数组且 statesKnown:true', () => {
    const r = store.querySubagentStates();
    expect(r.statesKnown).toBe(true);
    expect(r.statesKnown && r.states).toEqual([]);
    expect(r.statesKnown && r.unreadable).toEqual([]);
  });

  it('票面成对判据②:查不到 ⇒ statesKnown:false 且 states 字段缺席', () => {
    const filePath = path.join(os.tmpdir(), `ihui-g688-file-${process.pid}.txt`);
    fs.writeFileSync(filePath, 'x', 'utf-8');
    process.env.IHUI_SUBAGENT_STATE_DIR = filePath;
    const warns: string[] = [];
    try {
      const r = store.querySubagentStates('p-any', { warn: (m: string) => warns.push(m) });
      expect(r.statesKnown).toBe(false);
      // 字段**缺席**(不是空数组、不是 null)—— 空数组与判不出同形就是本票要消灭的东西
      expect('states' in r).toBe(false);
      if (!r.statesKnown) {
        expect(r.reason).toBe('unreadable');
        expect(r.detail.length).toBeGreaterThan(0);
      }
      // 能力缺席 ⇒ **大声**降级(不是静默返回 [])
      expect(warns.join('\n')).toContain('枚举失败');
    } finally {
      process.env.IHUI_SUBAGENT_STATE_DIR = tmpDir;
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('目录尚未存在(ENOENT)= 确实没有,不是查不到', () => {
    const ghost = path.join(tmpDir, 'nope');
    process.env.IHUI_SUBAGENT_STATE_DIR = ghost;
    try {
      const r = store.querySubagentStates();
      expect(r.statesKnown).toBe(true);
      if (r.statesKnown) expect(r.states).toEqual([]);
    } finally {
      process.env.IHUI_SUBAGENT_STATE_DIR = tmpDir;
    }
  });

  it('兼容投影 listSubagentStates 仍把两档同形返回 [](老调用方契约未被砸)', () => {
    expect(store.listSubagentStates()).toEqual([]);
  });

  it('部分判不出:集合仍可信,但判不出的行必须点名且不静默丢', () => {
    seedRow('good-1', 'p1', 'completed');
    writeRaw('bad-1', '{ 这不是合法 JSON');
    const warns: string[] = [];
    const r = store.querySubagentStates('p1', { warn: (m: string) => warns.push(m) });
    expect(r.statesKnown).toBe(true);
    if (r.statesKnown) {
      expect(r.states.map((s) => s.id)).toEqual(['good-1']);
      expect(r.unreadable).toEqual(['bad-1']);
    }
    // "少了一行"绝不能被读成"本来就没有这一行"
    expect(warns.join('\n')).toContain('bad-1');
  });

  it('status 不在唯一清单内 ⇒ 判不出(不收敛、不改写),unknown ≠ "不是孤儿"', () => {
    seedRow('weird-1', 'p1', 'zombie_state_not_in_vocabulary');
    const before = bytesOf('weird-1');
    const r = store.readSubagentState('weird-1');
    expect(r.stateKnown).toBe(false);
    expect('state' in r).toBe(false);

    const report = store.reconcileOrphans('p1', { warn: () => {} });
    expect(report.reconciled).toHaveLength(0);
    expect(report.skippedUnreadable).toEqual(['weird-1']);
    expect(bytesOf('weird-1')).toBe(before);
  });
});

describe('G-688 单行面:查到了 / 确实没有 / 查不到', () => {
  it('查到了 ⇒ stateKnown:true 且带 state', () => {
    seedRow('one-1', 'p1', 'running');
    const r = store.readSubagentState('one-1');
    expect(r.stateKnown).toBe(true);
    if (r.stateKnown && r.state) expect(r.state.id).toBe('one-1');
  });

  it('确实没有 ⇒ stateKnown:true 且 state 为 undefined(可判定的否定)', () => {
    const r = store.readSubagentState('does-not-exist');
    expect(r.stateKnown).toBe(true);
    expect(r.stateKnown && r.state).toBeUndefined();
  });

  it('查不到 ⇒ stateKnown:false、字段缺席、detail 点名原因', () => {
    writeRaw('broken-1', '{"id":"broken-1"');
    const r = store.readSubagentState('broken-1');
    expect(r.stateKnown).toBe(false);
    expect('state' in r).toBe(false);
    if (!r.stateKnown) {
      expect(r.reason).toBe('unreadable');
      expect(r.detail).toContain('JSON');
    }
    // 兼容投影:两档否定同形返回 null(老调用方未被砸,但也拿不到分义)
    expect(store.loadSubagentState('broken-1')).toBeNull();
    expect(store.loadSubagentState('does-not-exist')).toBeNull();
  });

  it('持久化能力缺席 ⇒ 抛出而不是静默退回内存实现(内存副本进程一死就没)', () => {
    const blocker = path.join(os.tmpdir(), `ihui-g688-blocker-${process.pid}.bin`);
    fs.writeFileSync(blocker, 'x', 'utf-8');
    // 把一个**普通文件**当父目录 ⇒ mkdirSync(recursive) 必失败 = 持久化能力不存在
    process.env.IHUI_SUBAGENT_STATE_DIR = path.join(blocker, 'sub', 'states');
    try {
      expect(() =>
        store.saveSubagentState({
          id: 'x-1',
          parentId: 'p1',
          persona: 'general',
          capabilityMode: 'all',
          isolation: 'none',
          transcript: [],
          status: 'running',
          startedAt: new Date().toISOString(),
        }),
      ).toThrow();
      // 反向对照:能力存在时同一调用应成功且真落盘(可回读)
      process.env.IHUI_SUBAGENT_STATE_DIR = tmpDir;
      store.saveSubagentState({
        id: 'x-2',
        parentId: 'p1',
        persona: 'general',
        capabilityMode: 'all',
        isolation: 'none',
        transcript: [],
        status: 'completed',
        startedAt: new Date().toISOString(),
      });
      expect(fs.existsSync(path.join(tmpDir, 'x-2.json'))).toBe(true);
    } finally {
      process.env.IHUI_SUBAGENT_STATE_DIR = tmpDir;
      if (fs.existsSync(blocker)) fs.unlinkSync(blocker);
    }
  });
});

describe('G-688 观察汇:永不抛 + 按 sender 的身份闸门 + 能力缺席大声降级', () => {
  /** 在**用例体内**取 kind:describe 收集期 store 还没被 beforeEach 赋过值,提前读会炸 */
  function observationOf(senderId = 'p-own', subagentId = 's-1') {
    return {
      kind: store.SUBAGENT_OBSERVATION_KIND_ORPHAN_RECONCILED,
      senderId,
      at: '2026-09-29T00:00:00.000Z',
      subagentId,
    };
  }

  it('成对:受信 sender ⇒ 写入被调用一次;外来 sender ⇒ 拒收且写入一次都不调用(副作用没发生)', () => {
    const writeSpy = vi.fn();
    const sink = store.createSubagentObservationSink({ trustedSenderIds: ['p-own'], write: writeSpy });

    expect(sink.observe(observationOf())).toEqual({ accepted: true });
    expect(writeSpy).toHaveBeenCalledTimes(1);

    const out = sink.observe(observationOf('p-intruder'));
    expect(out.accepted).toBe(false);
    if (!out.accepted) expect(out.reason).toBe('untrusted-sender');
    expect(writeSpy).toHaveBeenCalledTimes(1);

    // 阳性对照:闸门若被摘掉,上面那次就该被写进去 ⇒ 用空名单证明"名单为空一律拒收"
    const emptyGate = store.createSubagentObservationSink({ trustedSenderIds: [], write: writeSpy });
    expect(emptyGate.observe(observationOf()).accepted).toBe(false);
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('永不抛:落点写入抛错 ⇒ 返回 write-failed 并把原因喊出来,异常不外溢', () => {
    const warns: string[] = [];
    const sink = store.createSubagentObservationSink({
      trustedSenderIds: ['p-own'],
      write: () => {
        throw new Error('sink 落点炸了');
      },
      warn: (m: string) => warns.push(m),
    });
    let outcome: { accepted: boolean } | undefined;
    expect(() => {
      outcome = sink.observe(observationOf());
    }).not.toThrow();
    expect(outcome!.accepted).toBe(false);
    expect(warns.join('\n')).toContain('sink 落点炸了');
  });

  it('能力缺席(无落点)⇒ 大声降级:每次都点名丢弃,绝不聚合成内存队列冒充"收到了"', () => {
    const warns: string[] = [];
    const sink = store.createSubagentObservationSink({ trustedSenderIds: ['p-own'], warn: (m) => warns.push(m) });
    const a = sink.observe(observationOf());
    const b = sink.observe(observationOf());
    expect(a.accepted).toBe(false);
    if (!a.accepted) expect(a.reason).toBe('capability-absent');
    expect(b.accepted).toBe(false);
    // 两条各喊一次 ⇒ 没有"攒起来再说"的内存兜底(那种兜底会让账面像收到了而数据随进程蒸发)
    expect(warns.filter((w) => w.includes('能力缺席'))).toHaveLength(2);
  });

  it('形状不合规 ⇒ malformed 且不落任何写口', () => {
    const writeSpy = vi.fn();
    const sink = store.createSubagentObservationSink({ trustedSenderIds: ['p-own'], write: writeSpy });
    for (const bad of [null, 'string', { kind: 'k' }, { kind: 'k', senderId: 'p-own' }, 42]) {
      const out = sink.observe(bad);
      expect(out.accepted).toBe(false);
      if (!out.accepted) expect(out.reason).toBe('malformed');
    }
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('生产接线:孤儿收敛的留痕真走观察汇(kind/sender 都是收敛自己的身份)', () => {
    seedRow('orphan-1', 'p-live', 'running');
    const received: SubagentObservation[] = [];
    const report = store.reconcileOrphans('p-live', {
      auditWrite: (o: SubagentObservation) => received.push(o),
      warn: () => {},
    });
    expect(report.reconciled).toHaveLength(1);
    expect(received).toHaveLength(1);
    expect(received[0]!.kind).toBe(store.SUBAGENT_OBSERVATION_KIND_ORPHAN_RECONCILED);
    expect(received[0]!.senderId).toBe('p-live');
    expect(received[0]!.subagentId).toBe('orphan-1');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
