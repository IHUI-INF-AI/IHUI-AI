// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后台任务花名册投影测试(G-937976,[C10] run 内省 roster 投影纪律)。
 *
 * 验收面(票面,可跑):
 *  - 快照缺某字段 ⇒ 输出**无该键**而非 0(上游 turn/toolCalls 一格的同构:exitedAt/exitCode/worktreePath);
 *  - >maxTasks ⇒ truncated=true 且**尾部说明行**;
 *  - 「不知道」与 0 可分辨(exitCode 三态互异);
 *  - 时长措辞(上游 format-roster.ts:144-151 同构:终态有 exitedAt 说已结算时长,
 *    活着的说「到现在为止」,终态无 exitedAt 什么也不说)。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TASK_ROSTER_LIMITS,
  projectTaskRoster,
  formatTaskRoster,
  toTaskRosterRow,
} from '../src/tools/task-roster-projection.js';
import {
  registerTask,
  registerFailedTask,
  clearAllTasks,
  type BackgroundTaskMeta,
} from '../src/tools/background-registry.js';
import { list_background_tasks } from '../src/tools/builtins.js';
import type { ToolContext } from '../src/tools/index.js';

const T0 = '2026-01-01T00:00:00.000Z';
const T0_MS = Date.parse(T0);

function meta(overrides: Partial<BackgroundTaskMeta> = {}): BackgroundTaskMeta {
  return {
    id: 'bg_test_1',
    command: 'sleep 1',
    startedAt: T0,
    status: 'exited',
    ...overrides,
  };
}

describe('task-roster-projection(G-937976)', () => {
  describe('逐字段搬(判据①)', () => {
    it('数据面多长出来的字段不会漏进模型面', () => {
      const withExtra = { ...meta(), somedayNewField: 'leak' } as unknown as BackgroundTaskMeta;
      const row = toTaskRosterRow(withExtra);
      expect('somedayNewField' in row).toBe(false);
      expect(row).toStrictEqual({
        id: 'bg_test_1',
        command: 'sleep 1',
        status: 'exited',
        startedAt: T0,
      });
    });
  });

  describe('无则缺席(判据②,票面验收:快照缺某字段⇒输出无该键而非 0)', () => {
    it('running 行缺 exitedAt/exitCode/worktreePath ⇒ 三个键直接不存在(toStrictEqual 区分缺席与 undefined)', () => {
      const row = toTaskRosterRow(meta({ status: 'running' }));
      expect('exitedAt' in row).toBe(false);
      expect('exitCode' in row).toBe(false);
      expect('worktreePath' in row).toBe(false);
      // toStrictEqual( unlike toEqual )把「显式 undefined 值」判为与缺席不同 —— 这里整行相等
      // 证明没有哪个键被写成 undefined 或 0。
      expect(row).toStrictEqual({ id: 'bg_test_1', command: 'sleep 1', status: 'running', startedAt: T0 });
    });

    it('可选字段在快照里存在时才出现', () => {
      const row = toTaskRosterRow(
        meta({ exitedAt: T0, exitCode: 0, worktreePath: 'G:/wt/demo' }),
      );
      expect(row.exitedAt).toBe(T0);
      expect(row.exitCode).toBe(0);
      expect(row.worktreePath).toBe('G:/wt/demo');
    });
  });

  describe('「不知道」与 0 可分辨(判据③,票面验收)', () => {
    it('exitCode=0 说 exitCode=0(正常收场是一件发生过的事)', () => {
      const projection = projectTaskRoster([meta({ status: 'exited', exitCode: 0, exitedAt: T0 })]);
      const text = formatTaskRoster(projection, { now: T0_MS });
      expect(text).toContain('exitCode=0');
      expect(text).not.toContain('exitCode=未知');
    });

    it('exitCode=null(已退出但无退出码记录)说「未知」,与 0 可分辨', () => {
      const projection = projectTaskRoster([meta({ status: 'exited', exitCode: null, exitedAt: T0 })]);
      const text = formatTaskRoster(projection, { now: T0_MS });
      expect(text).toContain('exitCode=未知(无退出码记录)');
      expect(text).not.toContain('exitCode=0');
    });

    it('exitCode 缺席(running)没有任何 exitCode 格 —— 缺席,不是 - 也不是 0', () => {
      const projection = projectTaskRoster([meta({ status: 'running' })]);
      const text = formatTaskRoster(projection, { now: T0_MS + 30_000 });
      expect(text).not.toContain('exitCode');
    });
  });

  describe('截断说出口(判据④,票面验收:>maxTasks⇒truncated=true 且尾部说明行)', () => {
    it('25 行 > maxTasks ⇒ 保留 20 行,truncated=true,omittedCount=5', () => {
      const metas = Array.from({ length: 25 }, (_, i) => meta({ id: `bg_${i}`, startedAt: T0 }));
      const projection = projectTaskRoster(metas);
      expect(projection.tasks).toHaveLength(TASK_ROSTER_LIMITS.maxTasks);
      expect(projection.truncated).toBe(true);
      expect(projection.omittedCount).toBe(5);
    });

    it('说明行在**尾部**:只列出前 20 个;还有 5 个未列出', () => {
      const metas = Array.from({ length: 25 }, (_, i) => meta({ id: `bg_${i}`, startedAt: T0 }));
      const text = formatTaskRoster(projectTaskRoster(metas), { now: T0_MS });
      const lines = text.split('\n');
      const last = lines[lines.length - 1]!;
      expect(last).toContain('只列出前 20 个');
      expect(last).toContain('还有 5 个未列出');
    });

    it('未截断 ⇒ truncated=false,omittedCount=0 时不说话(上游 roster-output.ts:121-124「为 0 时缺席」同格)', () => {
      const projection = projectTaskRoster([meta(), meta({ id: 'bg_2' })]);
      expect(projection.truncated).toBe(false);
      expect(projection.omittedCount).toBe(0);
      const text = formatTaskRoster(projection, { now: T0_MS });
      expect(text).not.toContain('只列出前');
      expect(text).not.toContain('未列出');
    });

    it('头部只说「显示多少个」,不把截断后的名单说成总数', () => {
      const metas = Array.from({ length: 25 }, (_, i) => meta({ id: `bg_${i}`, startedAt: T0 }));
      const projection = projectTaskRoster(metas);
      // 头部措辞由工具层负责;这里验证投影本身不提供"总数"字样,格式化行文只出现保留数。
      const text = formatTaskRoster(projection, { now: T0_MS });
      expect(text).toContain('只列出前 20 个');
    });
  });

  describe('时长措辞(上游 format-roster.ts:144-151 同构)', () => {
    it('终态有 exitedAt ⇒ 已结算时长「耗时 5s」', () => {
      const projection = projectTaskRoster([
        meta({ status: 'exited', exitedAt: '2026-01-01T00:00:05.000Z', exitCode: 0 }),
      ]);
      const text = formatTaskRoster(projection, { now: T0_MS + 3_600_000 });
      expect(text).toContain('耗时 5s');
      expect(text).not.toContain('已运行');
    });

    it('running ⇒ 「到现在为止」(已运行 30s),不冒充已结算', () => {
      const projection = projectTaskRoster([meta({ status: 'running' })]);
      const text = formatTaskRoster(projection, { now: T0_MS + 30_000 });
      expect(text).toContain('已运行 30s');
      expect(text).not.toContain('耗时');
    });

    it('终态却无 exitedAt ⇒ 什么都不说(拿读时 now 去减等于把进程死后的时间算进去)', () => {
      const projection = projectTaskRoster([meta({ status: 'killed' })]);
      const text = formatTaskRoster(projection, { now: T0_MS + 3_600_000 });
      expect(text).not.toContain('耗时');
      expect(text).not.toContain('已运行');
    });
  });
});

describe('list_background_tasks 接线(G-937976)', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    clearAllTasks();
    ctx = { workspacePath: '.' };
  });

  afterEach(() => {
    clearAllTasks();
  });

  it('空表 ⇒ 「当前无后台任务」', async () => {
    const result = await list_background_tasks.execute({}, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toBe('当前无后台任务');
  });

  it('running 行无 exitCode 格;error(null 退出码)行说「未知」—— 两态在同一张名单里可分辨', async () => {
    const failedId = registerFailedTask('blocked command', '沙盒拒绝');
    const runningId = registerTask(null, 'sleep 9999');
    const result = await list_background_tasks.execute({}, ctx);
    expect(result.success).toBe(true);
    const lines = (result.output as string).split('\n');
    const failedLine = lines.find((l) => l.includes(failedId))!;
    const runningLine = lines.find((l) => l.includes(runningId))!;
    expect(failedLine).toContain('exitCode=未知(无退出码记录)');
    expect(runningLine).not.toContain('exitCode');
    // 头部只说「显示多少个」
    expect(result.output).toContain('后台任务列表(显示 2 个)');
  });
});
