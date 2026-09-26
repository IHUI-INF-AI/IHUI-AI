// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * debug.ts 会话注册表回收回归(第九轮覆盖面穷举 · 票二)。
 *
 * 立因(实测,非假想):`cleanupIdleSessions()` 在 HEAD 面**导出却零调用方** ——
 * 守门 121 `scripts/check-declared-policy-has-consumer.mjs` 现读即点名它未接线。
 * 于是文件头那句"session 30 分钟无活动自动清理"是注释,不是行为:
 * 空闲/已终止的 DAP 会话会永久留在 `sessions` Map 里(adapter 子进程也不被摘)。
 *
 * 判序说明:用例通过**生产入口** `debug_list_sessions.execute()` 断言,而不是只调
 * 那个 helper —— helper 自己永远能把自己测绿(§22c"镜像测试只复读实现就是复读机"同型)。
 * 变异对照:把 `debug_list_sessions` 里那一行 `reapIdleSessionsNote()` 摘掉,
 * 下面第 3、4 例必红;把它换回旧的内联循环(只清 terminated),第 4 例必红。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __test__, debug_list_sessions } from '../src/tools/debug.js';

const { seedSession, sessionCount, cleanupIdleSessions } = __test__;

describe('debug 会话注册表回收', () => {
  let base = 0;
  beforeEach(() => {
    // 只回收,不清整表:回收后 map 应为空,天然隔离用例之间的状态。
    cleanupIdleSessions();
    base = sessionCount();
  });

  /**
   * 必须排在首位:它依赖 base=0 才能命中【注册表被清空】那条分支
   * (后续用例各留一条活条目来证明没被误杀,而那些条目本模块按设计不挤)。
   */
  it('注册表被清空时,回收数仍然喊出来(不静默丢)', async () => {
    seedSession('bg_only_idle', { idle: true });

    const res = await debug_list_sessions.execute({}, {});

    expect(res.output).toMatch(/无活跃 debug session/);
    expect(res.output).toMatch(/回收 1/);
    expect(sessionCount()).toBe(base);
  });

  it('空闲会话被真摘除,且回收有计数', () => {
    seedSession('bg_idle_1', { idle: true });
    seedSession('bg_live_1', {});
    expect(sessionCount()).toBe(base + 2);

    const cleaned = cleanupIdleSessions();

    expect(cleaned).toBe(1);
    expect(sessionCount()).toBe(base + 1);
  });

  it('已终止(terminated)会话同样被摘除', () => {
    seedSession('bg_dead_1', { terminated: true });
    seedSession('bg_dead_2', { terminated: true, idle: true });
    seedSession('bg_live_2', {});

    expect(cleanupIdleSessions()).toBe(2);
    expect(sessionCount()).toBe(base + 1);
  });

  it('生产入口 debug_list_sessions 会收敛注册表并把计数摊到输出里', async () => {
    for (let i = 0; i < 5; i++) seedSession(`bg_burst_${i}`, { idle: true });
    seedSession('bg_keep', {});
    expect(sessionCount()).toBe(base + 6);

    const res = await debug_list_sessions.execute({}, {});

    expect(res.success).toBe(true);
    // 回收可见:输出必须点名回收了几条(静默变短等于伪造完整性)
    expect(res.output).toMatch(/回收 5/);
    expect(sessionCount()).toBe(base + 1);
  });


});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
