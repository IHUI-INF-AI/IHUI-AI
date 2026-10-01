// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-998166(b76-12g 票1)—— 异步句柄的「await 后对象身份复核」+ disposed-stale 表项清理。
 *
 * 上游判据(zcodeAgentService.ts:2901-2925,1233-1243,1729-1753):
 *  · 所有按 key 复用 active entry 的路径必须先过「是否已 disposed」复核;
 *    命中 ⇒ 删表项 + 清配套状态 + warn 后返回 false;
 *  · 旧条目的迟到清理只能释放**自身绑定**,绝不能删除同 key 已登记的新条目;
 *  · await 之后做对象身份复核,stale success 不得改写换代后的账面。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquireLiveStream,
  getEventsAfter,
  isStreamActive,
  pushEvent,
  registerStream,
  releaseStream,
} from '../src/utils/sse-replay-buffer.js';
import { agentLoop, backgroundAgentManager } from '../src/services/workspace-ai-service.js';

describe('G-998166:sse-replay-buffer 的 disposed-stale 复核与迟到清理身份复核', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('(a) releaseStream 60s 到点:只删除调度时那一条;同 key 已换代的新表项绝不误删', () => {
    registerStream('k1');
    pushEvent('k1', { id: 1, rawLine: 'data: old\n' });
    releaseStream('k1'); // 旧代进入释放保留窗口(disposed)
    // 新一代在旧定时器到点前重注册(registerStream 会清旧定时器;若清不掉,身份复核兜底)
    registerStream('k1');
    pushEvent('k1', { id: 2, rawLine: 'data: new\n' });
    vi.advanceTimersByTime(61_000);
    // 新表项必须还活着:旧条的迟到清理不得删除同 key 的新条目
    expect(getEventsAfter('k1', 0)).toEqual([{ id: 2, rawLine: 'data: new\n' }]);
  });

  it('(b) acquireLiveStream:live ⇒ true;disposed-stale ⇒ false + 表项被清理', () => {
    registerStream('k2');
    expect(acquireLiveStream('k2')).toBe(true);
    releaseStream('k2'); // disposed,60s 保留窗口
    // 复用型路径取句柄:命中 disposed-stale ⇒ 拒绝,且表项当场清掉
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(acquireLiveStream('k2')).toBe(false);
    expect(acquireLiveStream('k2')).toBe(false); // 已删 ⇒ 普通未命中
    expect(isStreamActive('k2')).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('(c) 60s 重放窗口内只读重放仍然有效(disposed 不影响重放面)', () => {
    registerStream('k3');
    pushEvent('k3', { id: 1, rawLine: 'data: a\n' });
    pushEvent('k3', { id: 2, rawLine: 'data: b\n' });
    releaseStream('k3');
    expect(isStreamActive('k3')).toBe(true); // 保留窗口内仍可重放
    expect(getEventsAfter('k3', 1)).toEqual([{ id: 2, rawLine: 'data: b\n' }]);
  });
});

describe('G-998166:BackgroundAgentManager await 后身份复核', () => {
  it('(d) 运行中被 cancel ⇒ 迟到的成功不得把 cancelled 洗成 completed', async () => {
    let resolveRun: (v: unknown) => void = () => {};
    const runSpy = vi
      .spyOn(agentLoop, 'run')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRun = resolve;
          }),
      );
    try {
      const agentId = backgroundAgentManager.start({
        prompt: '夹具任务',
        workspacePath: process.cwd(),
      });
      const agent = backgroundAgentManager.get(agentId)!;
      expect(agent.status).toBe('running');
      // 运行中取消
      expect(backgroundAgentManager.cancel(agentId)).toBe(true);
      expect(agent.status).toBe('cancelled');
      // 上游迟到返回"成功" ⇒ 不得改写账面
      resolveRun({ result: 'late success' });
      await vi.waitFor(() => {
        expect(agent.events.some((e) => e.type === 'late-result-discarded')).toBe(true);
      });
      expect(agent.status).toBe('cancelled');
      expect(agent.events.some((e) => e.type === 'done')).toBe(false);
    } finally {
      runSpy.mockRestore();
    }
  });

  it('(e) 正常完成路径行为不变(running → completed)', async () => {
    let resolveRun: (v: unknown) => void = () => {};
    const runSpy = vi
      .spyOn(agentLoop, 'run')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRun = resolve;
          }),
      );
    try {
      const agentId = backgroundAgentManager.start({
        prompt: '夹具任务2',
        workspacePath: process.cwd(),
      });
      const agent = backgroundAgentManager.get(agentId)!;
      resolveRun({ result: 'done-text' });
      await vi.waitFor(() => {
        expect(agent.status).toBe('completed');
      });
      expect(agent.result).toBe('done-text');
    } finally {
      runSpy.mockRestore();
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
