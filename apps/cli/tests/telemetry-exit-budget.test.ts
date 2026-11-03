// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 遥测退出预算对账(2026-09-28 立,第九轮 ZCode 对照逼出)。
 *
 * 病灶:`flush()` 里那条 fetch 没有任何超时,而 `shutdown()` 直接 await 它。端点 stall
 * (连接建了但不再回字节)时那个 await 永不返回 —— 调用点注释写的是"telemetry 失败不阻塞
 * 退出",可那句只对 **throw** 成立。附属品不得决定主进程能不能退出。
 *
 * 两道预算各判一件事:
 * ① fetch 带 signal(正常实现能在 5s 内自行放弃,队列按失败档放回);
 * ② **就算 fetchImpl 完全不观测 signal**,shutdown 也必须在有限时间内返回 —— 这是退出路径
 *    的唯一硬保证,所以本文件第二例刻意造一个"永挂且忽略 signal"的实现。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import { TelemetryClient } from '../src/telemetry/index.js';

function stalledFetch(_input: string, init?: RequestInit): Promise<Response> {
  // 永挂 + 不观测 init.signal:模拟"第三方实现把取消信号吃掉了"这一最坏形态
  return new Promise<Response>(() => {
    void init;
  });
}

describe('TelemetryClient — 退出路径的有限预算', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('flush 的 fetch 必须带 AbortSignal(否则端点不回字节就永远等下去)', async () => {
    let seen: RequestInit | undefined;
    const client = new TelemetryClient({
      enabled: true,
      endpoint: 'https://telemetry.invalid/v1/collect',
      fetchImpl: (input, init) => {
        seen = init;
        return Promise.resolve(new Response('{}', { status: 202 }));
      },
    });
    client.trackEvent('session_start');
    await client.flush();

    expect(seen, '一次 fetch 都没发生:用例在对着空转说话').toBeDefined();
    expect(seen?.signal, 'fetch 没带 signal —— 超时档等于没接').toBeInstanceOf(AbortSignal);
    expect(seen?.signal?.aborted).toBe(false);
    await client.shutdown();
  });

  it('fetchImpl 永挂且不观测 signal 时,shutdown 仍必须在有限预算内返回,且丢弃量必须可查', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = new TelemetryClient({
      enabled: true,
      endpoint: 'https://telemetry.invalid/v1/collect',
      fetchImpl: stalledFetch,
    });
    client.trackEvent('session_start');

    const startedAt = Date.now();
    // 旧实现:`await this.flush()` 直接挂死,这一行永远走不到(用例超时即证据)
    await client.shutdown();
    const elapsedMs = Date.now() - startedAt;

    expect(elapsedMs, `shutdown 被附属品拖到 ${elapsedMs}ms`).toBeLessThan(4_000);
    // 进程退出前没等到,那这批就是**丢了** —— 丢了却不计数,读代码的人会以为都送达了。
    expect(client.getDroppedOnShutdownCount()).toBe(1);
    expect(client.getQueueSize()).toBe(0);
    const msg = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(msg).toContain('未送达即丢弃');
    expect(msg).toContain('1 条');
  });

  it('正向对照:正常端点下 shutdown 照常把队列清空后返回', async () => {
    const sent: string[] = [];
    const client = new TelemetryClient({
      enabled: true,
      endpoint: 'https://telemetry.invalid/v1/collect',
      fetchImpl: (_input, init) => {
        sent.push(String((init?.body as string) ?? ''));
        return Promise.resolve(new Response('{}', { status: 202 }));
      },
    });
    client.trackEvent('session_start');
    await client.shutdown();

    expect(sent).toHaveLength(1);
    expect(client.getQueueSize()).toBe(0);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
