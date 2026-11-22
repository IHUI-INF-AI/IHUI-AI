// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 本文件由 G-687 票据新增:孤儿收敛(挂在构造时刻)的验收夹具。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
// 遮噪只引权威那一份实现(§22c「两处算同一件事必漂移」是本仓记过最多次的失败型,测试不得再抄)
// arch-exempt: 判据面必须与被审门共用同一份遮罩实现,属测试面而非生产依赖边;正解=给「测试支持层」在策略表建档并降到 apps 之下 until 2026-12-28
import { maskComments } from '../../../scripts/lib/code-mask.mjs';

import type * as stateStoreNs from '../src/subagents/state-store.js';
import { isSubagentTerminalStatus, type SubagentLifecycleStatus } from '../src/subagents/types.js';
import type { SubagentState } from '../src/subagents/state-store.js';

/** 只用作类型面;运行期实例由 freshStore() 取(幂等集合是模块级状态) */
type StateStore = typeof stateStoreNs;

const STORE_TS = path.resolve(fileURLToPath(import.meta.url), '../../src/subagents/state-store.ts');

let tmpDir = '';
let store: StateStore;

/**
 * 每个用例换一个**全新模块实例**:「构造时刻只收敛一次」的幂等集合是模块级状态,
 * 沿用同一实例会把上一轮的销号带进本轮,于是"二次构造幂等"这一条会假绿。
 */
async function freshStore(): Promise<StateStore> {
  vi.resetModules();
  return (await import('../src/subagents/state-store.js')) as StateStore;
}

/** 夹具直接落盘(绕过 saveSubagentState)⇒ 模拟"上一个进程被杀后留在盘上的行" */
function seedRow(
  id: string,
  parentId: string,
  status: string,
  extra: Record<string, unknown> = {},
): void {
  const row = {
    id,
    parentId,
    persona: 'coder',
    capabilityMode: 'all',
    isolation: 'none',
    transcript: [],
    status,
    startedAt: '2026-09-29T00:00:00.000Z',
    ...extra,
  };
  fs.writeFileSync(path.join(tmpDir, `${id}.json`), JSON.stringify(row, null, 2), 'utf-8');
}

function bytesOf(id: string): string {
  return fs.readFileSync(path.join(tmpDir, `${id}.json`), 'utf-8');
}

function rowOf(id: string): Record<string, unknown> {
  return JSON.parse(bytesOf(id)) as Record<string, unknown>;
}

function makeState(id: string, parentId: string): SubagentState {
  return {
    id,
    parentId,
    persona: 'general',
    capabilityMode: 'all',
    isolation: 'none',
    transcript: [],
    status: 'running',
    startedAt: new Date().toISOString(),
  };
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-g687-'));
  process.env.IHUI_SUBAGENT_STATE_DIR = tmpDir;
  store = await freshStore();
});

afterEach(() => {
  delete process.env.IHUI_SUBAGENT_STATE_DIR;
  if (tmpDir && fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('G-687 孤儿收敛挂在构造时刻', () => {
  it('票面验收:夹具预插一行 running ⇒ 构造后落终态,并带专属 interrupted 编码', () => {
    seedRow('orphan-1', 'p-a', 'running');
    const handle = store.openSubagentStateStore('p-a');

    expect(handle.orphans).not.toBeNull();
    const report = handle.orphans!;
    expect(report.reconciled).toHaveLength(1);
    expect(report.reconciled[0]!.id).toBe('orphan-1');
    expect(report.reconciled[0]!.from).toBe('running');
    expect(report.enumeratedKnown).toBe(true);
    expect(report.writeFailures).toHaveLength(0);

    const row = rowOf('orphan-1');
    // "落 stopped"= 生命周期状态落到终态档(判据引唯一清单的判据函数,不在测试里抄三档名单)
    expect(isSubagentTerminalStatus(row.status as SubagentLifecycleStatus)).toBe(true);
    expect(row.status).toBe(store.SUBAGENT_ORPHAN_TERMINAL_STATUS);
    // "interrupted"= 专属失败编码,与脚本失败/用户取消不同码
    expect(row.failureCode).toBe('interrupted');
    expect(row.failureCode).toBe(store.SUBAGENT_INTERRUPT_CODE);
    expect(typeof row.endedAt).toBe('string');
    expect(String(row.error)).toContain('G-687');
  });

  it('专属编码确实与"脚本失败/用户取消"分档(不得同码)', () => {
    // 'interrupted' 在实例七态里与 errored(脚本失败)、shutdown/notFound(取消族)并列
    expect(store.SUBAGENT_INTERRUPT_CODE).toBe('interrupted');
    expect(store.SUBAGENT_INTERRUPT_CODE).not.toBe('errored');
    expect(store.SUBAGENT_INTERRUPT_CODE).not.toBe('shutdown');
    expect(store.SUBAGENT_INTERRUPT_CODE).not.toBe('cancelled');
    // 终态落点由 @ihui/types 的唯一映射给出,本文件没有第二张表
    expect(store.SUBAGENT_ORPHAN_TERMINAL_STATUS).toBe('cancelled');
  });

  it('二次构造天然幂等:第二次不改任何行(字节级)', () => {
    seedRow('orphan-2', 'p-b', 'running');
    const first = store.openSubagentStateStore('p-b');
    expect(first.orphans!.reconciled).toHaveLength(1);

    const afterFirst = bytesOf('orphan-2');
    // 同一模块实例内二次构造 ⇒ 销号命中,返回 null(没有"再改一遍"的机会)
    const second = store.openSubagentStateStore('p-b');
    expect(second.orphans).toBeNull();
    expect(bytesOf('orphan-2')).toBe(afterFirst);

    // 幂等的**结构**理由:行已是终态 ⇒ 即便绕过销号再跑一次原始判据,也一行都不动
    const again = store.reconcileOrphans('p-b');
    expect(again.reconciled).toHaveLength(0);
    expect(bytesOf('orphan-2')).toBe(afterFirst);
  });

  it('边界①只收敛本父会话:别的 parentId 的行逐字未动(副作用没发生)', () => {
    seedRow('mine', 'p-own', 'running');
    seedRow('theirs', 'p-other', 'running');
    const theirsBefore = bytesOf('theirs');

    const report = store.reconcileOrphans('p-own');
    expect(report.reconciled.map((r) => r.id)).toEqual(['mine']);
    expect(report.enumerated).toBe(1);
    expect(bytesOf('theirs')).toBe(theirsBefore);
    expect(rowOf('theirs').status).toBe('running');
  });

  it('边界①的另一半:本进程正在飞的行不得被杀', () => {
    // 本进程先派生一条(saveSubagentState 会把它登记为在飞)
    store.saveSubagentState(makeState('live-1', 'p-live'));
    // 再伪造一条"上一进程留下的"孤儿
    seedRow('orphan-3', 'p-live', 'running');
    const liveBefore = bytesOf('live-1');

    const report = store.reconcileOrphans('p-live');
    expect(report.skippedInFlight).toEqual(['live-1']);
    expect(report.reconciled.map((r) => r.id)).toEqual(['orphan-3']);
    expect(bytesOf('live-1')).toBe(liveBefore);
    expect(rowOf('live-1').status).toBe('running');
  });

  it('resumeFrom 复用同一 id:自己正接着跑的那一行不被判成孤儿', () => {
    // 上一实例留下的 running 行,本次以同一 id 续跑
    seedRow('resume-1', 'p-resume', 'running', { transcript: [{ role: 'user', content: 'hi' }] });
    store.saveSubagentState(makeState('resume-1', 'p-resume'));

    const row = rowOf('resume-1');
    expect(row.status).toBe('running');
    expect(row.failureCode).toBeUndefined();
    // 落盘的是调用方交来的那一份整行(save 语义),收敛逻辑没有插进去改写任何字段
    expect(row.transcript).toEqual([]);
  });

  it('生产接线证据:saveSubagentState(生产唯一写入口)首次落盘即触发收敛', async () => {
    // tools/subagent.ts:364 就是这一条路径 ⇒ 判据真在生产面上,不是只喂测试的旁支
    const fresh = await freshStore();
    seedRow('orphan-5', 'p-prod-2', 'running');
    fresh.saveSubagentState(makeState('new-1', 'p-prod-2'));
    expect(rowOf('orphan-5').status).toBe(fresh.SUBAGENT_ORPHAN_TERMINAL_STATUS);
    expect(rowOf('orphan-5').failureCode).toBe('interrupted');
    // 本进程刚写下的那一行当然仍是 running
    expect(rowOf('new-1').status).toBe('running');
  });

  it('边界②不合成引擎事件:注入 spy 零调用 + 报告恒 0 + 源码锁(含阳性对照)', () => {
    seedRow('orphan-6', 'p-ev', 'running');
    const engineSpy = vi.fn();
    const report = store.reconcileOrphans('p-ev', { engineEventPort: engineSpy });

    expect(report.reconciled).toHaveLength(1);
    expect(engineSpy).not.toHaveBeenCalled();
    expect(report.engineEventsDispatched).toBe(0);

    // 源码锁:state-store.ts 的代码面(遮注释后)只许出现**声明**那一次标识符
    const code = maskComments(fs.readFileSync(STORE_TS, 'utf-8'));
    const mentions = (code.match(/engineEventPort/g) ?? []).length;
    expect(mentions).toBe(1);

    // 阳性对照(防"正则恒绿"):同一把尺子喂一段真有调用的文本必须给出更多
    const mutated = `${code}\nif (deps.engineEventPort) deps.engineEventPort('subagentStop', {});\n`;
    expect((mutated.match(/engineEventPort/g) ?? []).length).toBe(3);
  });

  it('边界③注入写入抛错 ⇒ 构造仍成功、非终态行未被改写、降级点名', () => {
    seedRow('orphan-7', 'p-io', 'running');
    const before = bytesOf('orphan-7');
    const warns: string[] = [];

    const handle = store.openSubagentStateStore('p-io', {
      writeRow: () => {
        throw new Error('EIO: injected');
      },
      warn: (m: string) => warns.push(m),
    });

    // "注入写入抛错时构造仍成功"是票面验收的另一半
    expect(handle.parentId).toBe('p-io');
    expect(handle.orphans).not.toBeNull();
    expect(handle.orphans!.reconciled).toHaveLength(0);
    expect(handle.orphans!.writeFailures).toHaveLength(1);
    expect(handle.orphans!.writeFailures[0]!.id).toBe('orphan-7');
    expect(warns.join('\n')).toContain('不拖垮构造');
    // 副作用没发生:行**未被半改写**,原样留在盘上
    expect(bytesOf('orphan-7')).toBe(before);
    expect(rowOf('orphan-7').failureCode).toBeUndefined();
  });

  it('写失败那一轮不销号:下一次触碰仍能收敛(瞬时故障不得变成永久脏账)', () => {
    seedRow('orphan-8', 'p-retry', 'running');
    const first = store.openSubagentStateStore('p-retry', {
      writeRow: () => {
        throw new Error('EIO: injected');
      },
      warn: () => {},
    });
    expect(first.orphans).not.toBeNull();
    // 再开一次(这次默认写口)⇒ 仍会尝试并成功收敛
    const second = store.openSubagentStateStore('p-retry');
    expect(second.orphans).not.toBeNull();
    expect(second.orphans!.reconciled.map((r) => r.id)).toEqual(['orphan-8']);
    expect(rowOf('orphan-8').status).toBe(store.SUBAGENT_ORPHAN_TERMINAL_STATUS);
  });

  it('集合判不出(目录在但枚举不了)⇒ 整轮不写任何行 + 大声 warn,且不销号', () => {
    const filePath = path.join(os.tmpdir(), `ihui-g687-not-a-dir-${process.pid}.txt`);
    fs.writeFileSync(filePath, 'x', 'utf-8');
    process.env.IHUI_SUBAGENT_STATE_DIR = filePath;
    const warns: string[] = [];

    try {
      const report = store.reconcileOrphans('p-x', { warn: (m: string) => warns.push(m) });
      expect(report.enumeratedKnown).toBe(false);
      expect(report.reconciled).toHaveLength(0);
      expect(report.writeFailures).toHaveLength(0);
      expect(warns.join('\n')).toContain('不可判定');
      // 判不出与"确实没有"分档:这一轮不许被记成"已收敛"(下一次触碰还会试)
      const handle = store.openSubagentStateStore('p-x', { warn: (m: string) => warns.push(m) });
      expect(handle.orphans).not.toBeNull();
      expect(handle.orphans!.enumeratedKnown).toBe(false);
    } finally {
      process.env.IHUI_SUBAGENT_STATE_DIR = tmpDir;
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('目录尚未建过 = 确实没有(known:true),不是"查不到"', () => {
    const ghost = path.join(tmpDir, 'never-created');
    process.env.IHUI_SUBAGENT_STATE_DIR = ghost;
    try {
      const report = store.reconcileOrphans('p-empty');
      expect(report.enumeratedKnown).toBe(true);
      expect(report.enumerated).toBe(0);
      expect(report.warnings).toHaveLength(0);
    } finally {
      process.env.IHUI_SUBAGENT_STATE_DIR = tmpDir;
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
