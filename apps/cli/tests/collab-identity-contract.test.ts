// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 协作身份三档 + 退出码/幂等契约(B3-03)的行为哨。
 *
 * 四组:
 *   A 身份解析与命令门槛(三档枚举、映射完备、未知即拒、自选即拒、越权退出码 3)
 *   B 退出码与响应形(0/3/4/130、未知三档必须查询再重试、分页 complete 由 nextOffset 推导)
 *   C 幂等键(稳定哈希:键序无关、同操作同 payload 恒同、64 位 hex)
 *   D 装车面(生产入口 `dispatchTask` / `spawnParallel` 真的调了闸,不是纸面件)
 *
 * 全部为纯函数用例,不碰磁盘/网络/子进程。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  COLLAB_COMMAND_MIN_RANK,
  COLLAB_FORBIDDEN_ARGV_FLAGS,
  COLLAB_IDENTITY_RANK,
  COLLAB_IDENTITY_TIERS,
  COLLAB_RUNTIME_CONTEXT_ENV,
  CollabIdentityRefused,
  assertCollabIdentity,
  assertCollabIdentityOrThrow,
  findForbiddenArgvFlag,
  resolveCollabIdentity,
} from '../src/commands/collab/identity.js';
import {
  COLLAB_EXIT_CODES,
  collabError,
  collabOk,
  exitCodeForOutcome,
  mustQueryBeforeRetry,
  partialPage,
  requestIdFor,
  stableStringify,
} from '../src/commands/collab/exit-codes.js';

const SRC_ROOT = path.resolve(__dirname, '..');
const IDENTITY_SRC = readFileSync(
  path.join(SRC_ROOT, 'src/commands/collab/identity.ts'),
  'utf8',
);
const EXIT_CODES_SRC = readFileSync(
  path.join(SRC_ROOT, 'src/commands/collab/exit-codes.ts'),
  'utf8',
);
const COLLAB_SRC = readFileSync(
  path.join(SRC_ROOT, 'src/commands/subagent-collab.ts'),
  'utf8',
);

describe('A 身份三档与命令门槛', () => {
  it('三档全集恰好三项且顺序稳定', () => {
    expect(COLLAB_IDENTITY_TIERS).toEqual(['user', 'runtime-owner', 'runtime-agent']);
  });

  it('每个命令都有权重映射,且权重落在已知档位权重之内', () => {
    const weights = new Set(Object.values(COLLAB_IDENTITY_RANK));
    const commands = Object.keys(COLLAB_COMMAND_MIN_RANK);
    expect(commands.length).toBeGreaterThanOrEqual(4);
    for (const command of commands) {
      const need = COLLAB_COMMAND_MIN_RANK[command as keyof typeof COLLAB_COMMAND_MIN_RANK];
      expect(weights.has(need)).toBe(true);
    }
  });

  it('runtime-agent 权重严格低于 user 与 runtime-owner', () => {
    expect(COLLAB_IDENTITY_RANK['runtime-agent']).toBeLessThan(COLLAB_IDENTITY_RANK.user);
    expect(COLLAB_IDENTITY_RANK['runtime-agent']).toBeLessThan(
      COLLAB_IDENTITY_RANK['runtime-owner'],
    );
  });

  it('无宿主上下文 ⇒ 默认 user(本地终端直跑)', () => {
    expect(resolveCollabIdentity({})).toBe('user');
    expect(resolveCollabIdentity({ [COLLAB_RUNTIME_CONTEXT_ENV]: '' })).toBe('user');
  });

  it('宿主注入 owner / agent ⇒ 对应档位', () => {
    expect(resolveCollabIdentity({ [COLLAB_RUNTIME_CONTEXT_ENV]: 'owner' })).toBe(
      'runtime-owner',
    );
    expect(resolveCollabIdentity({ [COLLAB_RUNTIME_CONTEXT_ENV]: 'agent' })).toBe(
      'runtime-agent',
    );
  });

  it('宿主上下文不可识别 ⇒ null(不回落 user)', () => {
    expect(resolveCollabIdentity({ [COLLAB_RUNTIME_CONTEXT_ENV]: 'root' })).toBeNull();
    expect(resolveCollabIdentity({ [COLLAB_RUNTIME_CONTEXT_ENV]: 'OWNER' })).toBeNull();
  });

  it('runtime-agent 不得派发/派生,但可以读拓扑', () => {
    expect(assertCollabIdentity('subagent.dispatch', 'runtime-agent')).toMatchObject({
      ok: false,
      exitCode: 3,
      code: 'identity_insufficient',
    });
    expect(assertCollabIdentity('subagent.spawn', 'runtime-agent').ok).toBe(false);
    expect(assertCollabIdentity('subagent.topology-read', 'runtime-agent').ok).toBe(true);
  });

  it('user 与 runtime-owner 都能派发、派生、仲裁', () => {
    for (const identity of ['user', 'runtime-owner'] as const) {
      for (const command of [
        'subagent.dispatch',
        'subagent.spawn',
        'subagent.arbitrate',
      ] as const) {
        expect(assertCollabIdentity(command, identity).ok).toBe(true);
      }
    }
  });

  it('身份未知 ⇒ 连只读命令都拒(fail-closed)', () => {
    const gate = assertCollabIdentity('subagent.topology-read', null);
    expect(gate).toMatchObject({ ok: false, exitCode: 3, code: 'identity_unknown' });
  });

  it('argv 出现身份自选参数即拒,即使宿主给的是最高档', () => {
    const gate = assertCollabIdentity('subagent.dispatch', 'runtime-owner', {
      argv: ['--identity=runtime-agent'],
    });
    expect(gate).toMatchObject({ ok: false, exitCode: 3, code: 'identity_self_selected' });
    expect(gate.message).toContain('--identity');
  });

  it('独立成项的身份参数同样命中(四种都在禁用清单里)', () => {
    for (const flag of COLLAB_FORBIDDEN_ARGV_FLAGS) {
      expect(findForbiddenArgvFlag(['run', flag, 'x'])).toBe(flag);
      expect(findForbiddenArgvFlag(['run', `${flag}=x`])).toBe(flag);
    }
    expect(findForbiddenArgvFlag(['run', '--topology=mesh'])).toBeNull();
  });

  it('不传 argv 时不做 argv 检查(避免把无关命令参数误判)', () => {
    expect(assertCollabIdentity('subagent.dispatch', 'user').ok).toBe(true);
  });

  it('OrThrow:越权抛 CollabIdentityRefused 且 exitCode 为 3', () => {
    let caught: unknown;
    try {
      assertCollabIdentityOrThrow('subagent.spawn', {
        env: { [COLLAB_RUNTIME_CONTEXT_ENV]: 'agent' },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CollabIdentityRefused);
    expect((caught as CollabIdentityRefused).exitCode).toBe(3);
    expect((caught as CollabIdentityRefused).code).toBe('identity_insufficient');
  });

  it('OrThrow:合规身份不抛', () => {
    expect(() =>
      assertCollabIdentityOrThrow('subagent.dispatch', { env: {} }),
    ).not.toThrow();
    expect(() =>
      assertCollabIdentityOrThrow('subagent.dispatch', {
        env: { [COLLAB_RUNTIME_CONTEXT_ENV]: 'owner' },
      }),
    ).not.toThrow();
  });

  it('身份解析的主体既不收 argv 也不读 process.argv(结构上无法被命令行影响)', () => {
    const start = IDENTITY_SRC.indexOf('export function resolveCollabIdentity');
    const end = IDENTITY_SRC.indexOf('从 argv 找第一个身份自选参数');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const body = IDENTITY_SRC.slice(start, end);
    expect(body.includes('process.argv')).toBe(false);
    expect(body.includes('argv')).toBe(false);
  });
});

describe('B 退出码与响应形', () => {
  it('四码契约:0 / 3 / 4 / 130', () => {
    expect(COLLAB_EXIT_CODES).toEqual({ ok: 0, refused: 3, partial: 4, canceled: 130 });
  });

  it('结局 → 退出码映射逐档正确', () => {
    expect(exitCodeForOutcome('ok')).toBe(0);
    expect(exitCodeForOutcome('refused')).toBe(3);
    expect(exitCodeForOutcome('partial')).toBe(4);
    expect(exitCodeForOutcome('canceled')).toBe(130);
  });

  it('结果未知三档绝不给 0(退出码按拒绝算)', () => {
    for (const outcome of ['outcome_unknown', 'disconnected', 'oversize'] as const) {
      expect(exitCodeForOutcome(outcome)).toBe(COLLAB_EXIT_CODES.refused);
      expect(mustQueryBeforeRetry(outcome)).toBe(true);
    }
  });

  it('已读到答案的四档不需要先查询', () => {
    for (const outcome of ['ok', 'refused', 'partial', 'canceled'] as const) {
      expect(mustQueryBeforeRetry(outcome)).toBe(false);
    }
  });

  it('成功响应形只有 success + data', () => {
    expect(collabOk({ items: [1, 2] })).toEqual({ success: true, data: { items: [1, 2] } });
  });

  it('失败响应形只有 success + error,没有 data 字段', () => {
    const failed = collabError('identity_insufficient', '权重不足');
    expect(failed).toEqual({
      success: false,
      error: { code: 'identity_insufficient', message: '权重不足' },
    });
    expect('data' in failed).toBe(false);
  });

  it('分页:有 nextOffset ⇒ complete 为 false(部分结果)', () => {
    const page = partialPage([1, 2, 3], 42);
    expect(page.success).toBe(true);
    if (page.success) {
      expect(page.data.complete).toBe(false);
      expect(page.data.nextOffset).toBe(42);
    }
  });

  it('分页:nextOffset 为 null ⇒ complete 为 true(唯一真相源)', () => {
    const page = partialPage([1], null);
    if (page.success) {
      expect(page.data.complete).toBe(true);
      expect(page.data.nextOffset).toBeNull();
    }
  });
});

describe('C 幂等键', () => {
  it('稳定序列化与键序无关', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
  });

  it('稳定序列化保数组顺序,并丢弃 undefined 键', () => {
    expect(stableStringify([3, 1, 2])).not.toBe(stableStringify([1, 2, 3]));
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('同操作同 payload ⇒ 同 requestId;键序不影响', () => {
    const payload = { repoId: 'r1', files: ['a.ts', 'b.ts'], limit: 20 };
    expect(requestIdFor('codebase.index', payload)).toBe(
      requestIdFor('codebase.index', { limit: 20, files: ['a.ts', 'b.ts'], repoId: 'r1' }),
    );
  });

  it('不同操作或不同 payload ⇒ 不同 requestId', () => {
    expect(requestIdFor('codebase.index', { a: 1 })).not.toBe(
      requestIdFor('codebase.search', { a: 1 }),
    );
    expect(requestIdFor('codebase.index', { a: 1 })).not.toBe(
      requestIdFor('codebase.index', { a: 2 }),
    );
  });

  it('requestId 是 64 位小写 hex', () => {
    expect(requestIdFor('op', { x: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });

  it('退出码层不引入本地状态库(项目只允许 PostgreSQL)', () => {
    expect(EXIT_CODES_SRC.toLowerCase().includes('sqlite')).toBe(false);
  });
});

describe('D 装车面(生产入口调了闸)', () => {
  it('dispatchTask 体内第一步就是 dispatch 身份闸', () => {
    const match = COLLAB_SRC.match(
      /async dispatchTask\([\s\S]{0,300}?assertCollabIdentityOrThrow\('subagent\.dispatch'/,
    );
    expect(match).not.toBeNull();
  });

  it('spawnParallel 体内有 spawn 身份闸,且在派生之前', () => {
    const start = COLLAB_SRC.indexOf('export async function spawnParallel');
    expect(start).toBeGreaterThan(0);
    const body = COLLAB_SRC.slice(start, start + 800);
    expect(body).toContain("assertCollabIdentityOrThrow('subagent.spawn'");
    expect(body.indexOf("assertCollabIdentityOrThrow('subagent.spawn'")).toBeLessThan(
      body.indexOf('new SubagentWorkerPool('),
    );
  });

  it('身份层从协作命令面 import,不是各写一份判据', () => {
    expect(COLLAB_SRC).toContain("from './collab/identity.js'");
  });

  it('仲裁与拓扑读面同样接线(四档命令面没有纸面项)', () => {
    expect(COLLAB_SRC).toContain("assertCollabIdentityOrThrow('subagent.arbitrate')");
    expect(COLLAB_SRC).toContain("assertCollabIdentityOrThrow('subagent.topology-read')");
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
