// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 方法恢复策略(recovery-policy)。
 *
 * 钉四件事:
 *   ① 四档语义与对标实现同义(read/idempotent → 可重试;mutation → 结果未知;control → 不适用);
 *   ② **未登记方法默认 mutation(结果未知)**,不是 read —— 这是最关键的失效方向;
 *   ③ 已登记方法的名字必须在我方真实存在(不许申报不存在的方法);
 *   ④ 统计口径正确(能一眼看出"多少方法崩了不敢重试")。
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  canRetryAfterCrash,
  policyOf,
  recoveryPolicyOf,
  registeredMethods,
  summarizeByKind,
  type RecoveryKind,
} from '../src/acp/recovery-policy.js';

describe('四档语义', () => {
  it('read / idempotent_mutation 可重试', () => {
    expect(policyOf('read').crashDisposition).toBe('retry_after_recovery');
    expect(policyOf('idempotent_mutation').crashDisposition).toBe('retry_after_recovery');
  });

  it('mutation ⇒ outcome_unknown(不能假装知道成没成)', () => {
    expect(policyOf('mutation').crashDisposition).toBe('outcome_unknown');
  });

  it('control ⇒ not_applicable', () => {
    expect(policyOf('control').crashDisposition).toBe('not_applicable');
  });

  it('同一 kind 返回同一冻结对象(可用 === 比较,避免每次新建)', () => {
    expect(policyOf('read')).toBe(policyOf('read'));
    expect(Object.isFrozen(policyOf('read'))).toBe(true);
  });
});

describe('未登记方法的失效方向(最关键)', () => {
  it('未登记 ⇒ mutation(结果未知),不是 read', () => {
    const p = recoveryPolicyOf('some.brand.new/method');
    expect(p.kind).toBe('mutation');
    expect(p.crashDisposition).toBe('outcome_unknown');
  });

  it('未登记方法不得被当成可重试', () => {
    expect(canRetryAfterCrash('totally/unknown')).toBe(false);
  });

  it('这条失效方向的理由:默认 read 会导致重复副作用,默认 mutation 只是多问一次', () => {
    // 断言"默认不是 read"本身就是这条纪律的可执行形式
    expect(recoveryPolicyOf('x/y/z').kind).not.toBe('read');
  });
});

describe('已登记方法', () => {
  it('纯读方法可重试', () => {
    for (const m of ['session/list', 'x.ai/turn/state', 'x.ai/checkpoint/list']) {
      expect(canRetryAfterCrash(m), `${m} 应可重试`).toBe(true);
    }
  });

  it('幂等写可重试', () => {
    for (const m of ['session/set_mode', 'x.ai/goal/update']) {
      expect(canRetryAfterCrash(m), `${m} 应可重试`).toBe(true);
    }
  });

  it('非幂等写不可重试(新建实体类)', () => {
    for (const m of ['session/fork', 'x.ai/turn/create', 'x.ai/goal/create', 'x.ai/goal/iterate']) {
      expect(canRetryAfterCrash(m), `${m} 不应可重试`).toBe(false);
      expect(recoveryPolicyOf(m).crashDisposition).toBe('outcome_unknown');
    }
  });

  it('关闭类属 control(重试无意义)', () => {
    for (const m of ['session/close', 'session/cancel']) {
      expect(recoveryPolicyOf(m).kind).toBe('control');
    }
  });

  it('登记表里的方法名必须在 ACP server 里真实存在(不申报不存在的方法)', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'acp', 'server.ts'),
      'utf8',
    )
    const missing = registeredMethods().filter((m) => !src.includes(`'${m}'`))
    expect(missing, `这些方法登记了但 server.ts 里没有:${missing.join(', ')}`).toEqual([])
  })
})

describe('统计', () => {
  it('四档计数之和等于登记数', () => {
    const s = summarizeByKind()
    const total = (Object.values(s) as number[]).reduce((a, b) => a + b, 0)
    expect(total).toBe(registeredMethods().length)
  })

  it('各档都有值(不会因为某档为 0 就缺键)', () => {
    const s = summarizeByKind()
    for (const k of ['read', 'idempotent_mutation', 'mutation', 'control'] as RecoveryKind[]) {
      expect(typeof s[k]).toBe('number')
    }
  })

  it('mutation 档非空 —— 说明确实有"崩了不敢重试"的方法', () => {
    expect(summarizeByKind().mutation).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
