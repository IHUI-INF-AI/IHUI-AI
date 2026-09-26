// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mcp-runtime 注册表有界回收回归(`managedClients`)。
 *
 * 立因(2026-09-26 实测):`apps/cli/src/tools/mcp-runtime.ts` 的全局注册表只有
 * delete-on-close(`unregisterManagedClient`)与整体 reset(`clearManagedClients`)两个出口,
 * **没有容量上限**;而 `markDead()` 只把条目标死、不摘出表 —— 死条目继续出现在
 * `listManagedClients()` 快照里,长驻进程实际形态是只增不减。
 *
 * 本文件钉三条,缺一不可:
 *  ① **超限必被收敛,且回收有计数**(禁止静默丢);
 *  ② **未终结的活跃条目绝不因容量压力被踢**(那等于掐掉在跑的 tool 调用);
 *  ③ **宽限期是判据不是装饰**:dead 但仍在宽限期内、且未超容量的条目不得被回收。
 *
 * 计数一律按【增量】断言:reclaimedTotal 是自进程启动的累计量,而 clearManagedClients()
 * 刻意不重置它 —— 把测试用的整表 reset 当成【回收发生过】会抹掉真实回收痕迹。
 * (首版按绝对值断言,被自己的测试判红 3 例 —— 那红是对的。)
 *
 * 变异对照(记录在交付报告里,不在本文件自动跑):把 `registerManagedClient` 里那句
 * `reclaimManagedClients()` 删掉 ⇒ ① 必红(既不收敛也无计数)。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearManagedClients,
  getManagedClient,
  getManagedClientRegistryStats,
  reclaimManagedClients,
  registerManagedClient,
  type ManagedMcpClient,
} from '../src/tools/mcp-runtime.js';

/**
 * 造一条注册项。刻意不 import 真 `ManagedMcpClient` 类去实例化 —— 那要拉真实子进程/网络,
 * 而本测试判的是**表的行为**,与传输无关。`as unknown as` 而非 `any`:AGENTS §3 类型零债。
 */
function makeClient(
  serverName: string,
  opts: { dead: boolean; lastPingAt: number },
): ManagedMcpClient {
  return {
    getStatus: () => ({
      serverName,
      alive: !opts.dead,
      dead: opts.dead,
      consecutiveFailures: opts.dead ? 1 : 0,
      lastPingAt: opts.lastPingAt,
      connected: !opts.dead,
    }),
  } as unknown as ManagedMcpClient;
}

/** 注册 n 条同名前缀的条目 */
function registerMany(prefix: string, count: number, make: (i: number) => { dead: boolean; lastPingAt: number }): void {
  for (let i = 0; i < count; i += 1) {
    registerManagedClient(makeClient(`${prefix}-${i}`, make(i)));
  }
}

function reclaimedSoFar(): number {
  return getManagedClientRegistryStats().reclaimedTotal;
}

describe('managedClients 注册表有界回收', () => {
  let baseAt = 0;
  beforeEach(() => {
    clearManagedClients();
    baseAt = reclaimedSoFar();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('① 注入超限的已终结超龄条目 ⇒ 收敛到上限以内且有回收计数', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { max } = getManagedClientRegistryStats();
    expect(max).toBeGreaterThan(0);

    const longAgo = Date.now() - 10 * 60_000;
    registerMany('aged-dead', max + 8, () => ({ dead: true, lastPingAt: longAgo }));

    const stats = getManagedClientRegistryStats();
    expect(stats.size).toBeLessThanOrEqual(stats.max);
    expect(stats.overLimit).toBe(false);
    // 计数与喊话都在:只改表不出声 = 静默丢,禁止
    expect(stats.reclaimedTotal - baseAt).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalled();
  });

  it('② 未终结的活跃条目即便超容量也不被回收(overLimit 必须如实报)', () => {
    const { max } = getManagedClientRegistryStats();
    const now = Date.now();
    registerMany('live', max + 5, () => ({ dead: false, lastPingAt: now }));

    const stats = getManagedClientRegistryStats();
    expect(stats.size).toBe(max + 5);
    expect(stats.overLimit).toBe(true);
    expect(stats.reclaimedTotal - baseAt).toBe(0);
    expect(reclaimManagedClients()).toBe(0);
    expect(getManagedClientRegistryStats().size).toBe(max + 5);
  });

  it('②b 混合场景:容量压力只吃 dead 条目,活跃条目一条不掉', () => {
    const { max } = getManagedClientRegistryStats();
    const now = Date.now();
    // max+3 条活跃(判据结构上不许踢) + 5 条"刚标死"(宽限期内,但第二档允许吃)
    registerMany('live', max + 3, () => ({ dead: false, lastPingAt: now }));
    registerMany('fresh-dead', 5, () => ({ dead: true, lastPingAt: now }));

    const stats = getManagedClientRegistryStats();
    // 5 条 dead 全被吃掉(注册即收敛),35 条活跃原样保留
    expect(stats.reclaimedTotal - baseAt).toBe(5);
    expect(stats.size).toBe(max + 3);
    // 超容量却仍 overLimit=true:宁可如实报超额,也绝不为了"看起来收住了"去踢活跃会话
    expect(stats.overLimit).toBe(true);
    expect(getManagedClient('live-0')).toBeDefined();
    expect(getManagedClient(`live-${max + 2}`)).toBeDefined();
    expect(getManagedClient('fresh-dead-0')).toBeUndefined();
    // 再收一次:没有可吃的人了 ⇒ 必须返回 0,不得为了凑数误伤活跃条目
    expect(reclaimManagedClients(now)).toBe(0);
  });

  it('③ 宽限期内且未超容量的 dead 条目不得被回收', () => {
    const now = Date.now();
    registerMany('fresh-dead', 3, () => ({ dead: true, lastPingAt: now }));
    const before = getManagedClientRegistryStats();

    expect(reclaimManagedClients(now)).toBe(0);
    const after = getManagedClientRegistryStats();
    expect(after.size).toBe(before.size);
    expect(after.reclaimedTotal - baseAt).toBe(0);
  });

  it('出口读数可被外部消费:统计形状稳定(防判据退化成"只报数冒充扫过了")', () => {
    const stats = getManagedClientRegistryStats();
    expect(typeof stats.size).toBe('number');
    expect(typeof stats.max).toBe('number');
    expect(typeof stats.reclaimedTotal).toBe('number');
    expect(typeof stats.overLimit).toBe('boolean');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
