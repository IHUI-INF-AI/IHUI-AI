// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 子智能体状态词汇"单一成员清单"回归(2026-09-27 票)。
 *
 * 立论:转后台的新档位 `detached_idle` 必须只活在**唯一那份**状态词汇
 * (`apps/cli/src/subagents/types.ts`),其余文件(state-store 的持久化字段、
 * worker-pool 的迁移写入)一律引用它。本仓有 blocking 守门判"端内不得再抄第二份
 * 成员清单",抄第二份 = 给自己造红门,也让"改一处忘另一处"回到本票开头描述的分叉型。
 *
 * 这里只做静态/纯函数对账;生产路径的状态迁移由
 * apps/cli/tests/subagent-idle-timeout.test.ts 经 `SubagentWorkerPool.spawn()` 断言。
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
// 遮噪只引这份权威实现(§3"两处实现必漂移"是本仓记过最多次的失败型,测试不得再抄一份)
import { maskComments } from '../../../scripts/lib/code-mask.mjs'; // arch-exempt: 判据面必须与被审门共用同一份遮罩实现(§22c,两处算同一件事必漂移),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import {
  SUBAGENT_LIFECYCLE_STATUSES,
  SUBAGENT_TERMINAL_STATUSES,
  SUBAGENT_STATUS_DETACHED_IDLE,
  SUBAGENT_DETACH_REASON,
  isSubagentTerminalStatus,
} from '../src/subagents/types.js';
// 编译期证明:持久化结构的 status 字段就是那份唯一清单的类型(引用即校验)
import type { SubagentState } from '../src/subagents/state-store.js';

const SRC_DIR = path.resolve(fileURLToPath(import.meta.url), '../../src/subagents');

/** 读 subagents 源面(测试通道:只读,不写任何文件) */
function readSrc(name: string): string {
  return readFileSync(path.join(SRC_DIR, name), 'utf-8');
}

describe('状态词汇:唯一清单的集合关系', () => {
  it('detached_idle 在生命周期清单里(显式档位,不是借既有终态冒充)', () => {
    expect(SUBAGENT_LIFECYCLE_STATUSES).toContain(SUBAGENT_STATUS_DETACHED_IDLE);
    // 既有四档一个不少(扩档不是换档;旧消费端读到的值域只增不减)
    for (const legacy of ['running', 'completed', 'failed', 'cancelled'] as const) {
      expect(SUBAGENT_LIFECYCLE_STATUSES).toContain(legacy);
    }
  });

  it('detached_idle **不在**终态集合;running 也不在(转后台≠完成/失败/取消)', () => {
    expect(SUBAGENT_TERMINAL_STATUSES).not.toContain(SUBAGENT_STATUS_DETACHED_IDLE);
    expect(SUBAGENT_TERMINAL_STATUSES).not.toContain('running');
    expect(SUBAGENT_TERMINAL_STATUSES).toEqual(['completed', 'failed', 'cancelled']);
    expect(isSubagentTerminalStatus(SUBAGENT_STATUS_DETACHED_IDLE)).toBe(false);
    expect(isSubagentTerminalStatus('running')).toBe(false);
    for (const t of SUBAGENT_TERMINAL_STATUSES) {
      expect(isSubagentTerminalStatus(t)).toBe(true);
    }
  });

  it('用户可见出口的机器码是稳定 ASCII(语言包未就绪时的唯一呈现形态)', () => {
    expect(SUBAGENT_DETACH_REASON).toBe('subagent_detached_idle');
    expect(SUBAGENT_DETACH_REASON).toMatch(/^[a-z_]+$/);
  });

  it('持久化状态可直接落 detached_idle(类型面引用同一份清单,不是第二份名单)', () => {
    // 编译期断言:下面这行能过 tsc = state-store 的 status 字段接受新档
    const s: SubagentState = {
      id: 'x',
      parentId: 'p',
      persona: 'coder',
      capabilityMode: 'all',
      isolation: 'none',
      transcript: [],
      status: SUBAGENT_STATUS_DETACHED_IDLE,
      startedAt: '2026-09-27T00:00:00.000Z',
    };
    expect(s.status).toBe('detached_idle');
    expect(isSubagentTerminalStatus(s.status)).toBe(false);
  });
});

describe('单一声明处的源码锁(防"第二份成员清单"回来)', () => {
  const srcFiles = readdirSync(SRC_DIR).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.d.ts'),
  );

  it("'detached_idle' 的**带引号字面量**全源面只在 types.ts 出现一次", () => {
    // 判"代码面"必须先遮注释 —— 解释这一档的说明文字里合法出现该词,
    // 不遮就会让门开始判自己的散文(守门 131/135 同型事故)。遮噪实现引权威那一份。
    const hits = srcFiles
      .map((f) => ({
        f,
        n: (maskComments(readSrc(f)).match(/'detached_idle'/g) ?? []).length,
      }))
      .filter((x) => x.n > 0);
    // 判据本身有牙:若把常量再抄一份到别处,这里必红
    expect(hits).toEqual([{ f: 'types.ts', n: 1 }]);
  });

  it('state-store.ts 不再内联成员清单,引用 types.ts 的唯一类型', () => {
    const code = maskComments(readSrc('state-store.ts'));
    // 反向锁:旧写法 `status: 'running' | 'completed' | ...` 不得回来
    expect(code).not.toMatch(/status:\s*'[a-z_]+'(\s*\|\s*'[a-z_]+')*\s*;/);
    expect(code).toMatch(/import\s+type\s+\{\s*SubagentLifecycleStatus\s*\}\s+from\s+'.\/types\.js'/);
    expect(code).toMatch(/status:\s*SubagentLifecycleStatus\s*;/);
  });

  it('worker-pool.ts 的迁移写入走常量,不写带引号字面量', () => {
    const code = maskComments(readSrc('worker-pool.ts'));
    expect(code).toMatch(/entry\.lifecycle\s*=\s*SUBAGENT_STATUS_DETACHED_IDLE\s*;/);
    // 转后台的 spawn 响应必须用 wire 既有档位 'running',不得新增 wire 词汇
    expect(code).not.toMatch(/status:\s*'(detached|backgrounded|detached_idle)'/);
  });

  // G-1079155 两轮裁决(4ba74686e2 立、7748f62c51 复核"原裁决重复执行")显式删除了模块入口
  // index.ts;本断言块是删除批次漏清的连带账(断言块 aab9259860 早于删除批),宿主文件不存在
  // 即 ENOENT。其余三把锁(types.ts 唯一清单/state-store/worker-pool)在 HEAD 全绿——
  // 没有"第二份成员清单"回来,锁的设计意图未被违反,故删断言而非复活文件。
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
