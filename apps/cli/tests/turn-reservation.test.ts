// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-633(2026-09-29)回合起点预留号 —— 反证用例落点。
 *
 * 票面判据:"两次并发 reserve 必得不同号"。并发回合(多 ACP 会话/agent 与
 * subagent 并跑)此前各自从 1 数起,落盘的 turnId 复用同一序号;reserve 必须是
 * 进程级原子分配。这里既测分配器本身,也用微任务交错模拟"并发"形态 ——
 * 若有人把计数器改成"读-加-写"之间夹 await(或按调用方身份复用号),下面
 * 的反证用例就会红。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  reserveTurnNumber,
  peekLastReservedTurnNumber,
  __resetTurnReservationForTests,
} from '../src/turn-reservation.js';

describe('G-633 回合起点预留号(先 reserve 再落盘)', () => {
  beforeEach(() => {
    __resetTurnReservationForTests();
  });

  it('反证:两次并发 reserve 必得不同号', async () => {
    const [a, b] = await Promise.all([reserveTurnNumber(), reserveTurnNumber()]);
    expect(a).not.toBe(b);
  });

  it('反证(微任务交错形态):并发任务各自的 reserve 互不复用', async () => {
    const reserveAfterTick = async (): Promise<number> => {
      await Promise.resolve(); // 让出微任务:模拟并发回合的调度交错
      return reserveTurnNumber();
    };
    const [a, b, c] = await Promise.all([reserveAfterTick(), reserveAfterTick(), reserveAfterTick()]);
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('突发批量:64 次 reserve 全体唯一且严格单调递增(永不回退、永不复用)', () => {
    const seen: number[] = [];
    for (let i = 0; i < 64; i++) seen.push(reserveTurnNumber());
    expect(new Set(seen).size).toBe(64);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBe(seen[i - 1]! + 1);
  });

  it('先 reserve 再落盘:reserve 之后观测口立刻可见;复位仅供测试用', () => {
    expect(peekLastReservedTurnNumber()).toBe(0); // 0 号永不发出
    const first = reserveTurnNumber();
    expect(peekLastReservedTurnNumber()).toBe(first);
  });
});
