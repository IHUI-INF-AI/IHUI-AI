// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-066 回归:ACP 会话关闭 / 进程信号必须先中止在飞 prompt。
 *
 * 失败形态(修前):closeSession 只 `sessions.delete`,runToolLoop 继续生成/落盘;
 * SIGINT 只 `connection.close()`,fetch 与定时器钉住进程不退。
 */
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { IhuiAcpAgent, type AcpServerOptions } from '../src/acp/server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(path.join(here, '..', 'src', 'index.ts'), 'utf-8');

function makeAgent(): IhuiAcpAgent {
  const opts: AcpServerOptions = {
    apiUrl: 'http://localhost',
    modelId: 'm',
    maxIterations: 1,
  };
  return new IhuiAcpAgent(opts);
}

function seedSession(agent: IhuiAcpAgent, sessionId: string, pendingAbort: AbortController | null): void {
  const sessions = (agent as unknown as { sessions: Map<string, unknown> }).sessions;
  sessions.set(sessionId, { session: { id: sessionId }, pendingAbort });
}

function hasSession(agent: IhuiAcpAgent, sessionId: string): boolean {
  return (agent as unknown as { sessions: Map<string, unknown> }).sessions.has(sessionId);
}

describe('F-066 closeSession 中止在飞 prompt', () => {
  it('关闭会话先 abort 该会话的 pendingAbort,再删除会话', () => {
    const agent = makeAgent();
    const inFlight = new AbortController();
    const other = new AbortController();
    seedSession(agent, 's1', inFlight);
    seedSession(agent, 's2', other);

    agent.closeSession?.({ sessionId: 's1' } as never);

    expect(inFlight.signal.aborted).toBe(true);
    expect(other.signal.aborted).toBe(false);
    expect(hasSession(agent, 's1')).toBe(false);
    expect(hasSession(agent, 's2')).toBe(true);
  });

  it('abortAllPrompts 中止全部会话的在飞 prompt', () => {
    const agent = makeAgent();
    const first = new AbortController();
    const second = new AbortController();
    seedSession(agent, 's1', first);
    seedSession(agent, 's2', second);

    agent.abortAllPrompts();

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(true);
  });
});

describe('F-066 进程信号先 abort 再 close', () => {
  it('index.ts 的 SIGINT/SIGTERM 收口顺序为 abortAllPrompts → close → 退出码', () => {
    const handlerAt = indexSrc.indexOf('const acpShutdown');
    expect(handlerAt).toBeGreaterThan(-1);
    const window = indexSrc.slice(handlerAt, handlerAt + 600);

    const abortAt = window.indexOf('abortAllPrompts');
    const closeAt = window.indexOf('connection.close()');
    expect(abortAt).toBeGreaterThan(-1);
    expect(closeAt).toBeGreaterThan(-1);
    expect(abortAt).toBeLessThan(closeAt);
    expect(window).toContain('process.exitCode = exitCode');
    expect(window).toContain("process.on('SIGINT'");
    expect(window).toContain("process.on('SIGTERM'");
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
