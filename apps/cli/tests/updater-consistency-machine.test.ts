// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b75-2#1:更新检查结果一致性状态机测试(纯注入面,不发真网、不碰磁盘缓存)。
 *
 * 票面五项验收逐条对号:
 *   ① 并发两次检查,迟到结果不覆盖(generation 门);
 *   ② 通道不匹配的结论丢弃 + 留痕;
 *   ③ 取数失败回可检查态(idle,非终态);
 *   ④ 同版本不二次通知;
 *   ⑤ 手动检查清 skip。
 *
 * 变异对照(改回旧写法必须翻红的断言):
 *   ① 去掉 generation 门(settle 里不比对 gen)⇒ 用例①的 notified 变 ['9.9.9'] 翻红;
 *   ⑤ beginCheck 去掉"manual 清 skip"⇒ 用例⑤的 notified 停在 [] 翻红。
 */
import { describe, expect, it } from 'vitest';
import { createUpdateCheckMachine, type UpdateCheckFacts } from '../src/updater.js';

/** 把 then 链冲干净(settle 在微任务里跑);setTimeout(0) 跨微任务层级最稳。 */
const flush = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** 手工决议的 fetch 桩:按顺序吐出预备好的 promise。 */
function sequencedFetch(sequence: Array<Promise<UpdateCheckFacts>>): () => Promise<UpdateCheckFacts> {
  let n = 0;
  return () => sequence[n++] ?? Promise.resolve({});
}

function deferred(): {
  promise: Promise<UpdateCheckFacts>;
  resolve: (v: UpdateCheckFacts) => void;
  reject: (e: unknown) => void;
} {
  let resolve!: (v: UpdateCheckFacts) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<UpdateCheckFacts>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('更新检查结果一致性状态机(b75-2#1)', () => {
  it('① 自动+手动并发:先发的迟到结论被 generation 门整体丢弃,不覆盖任何状态面', async () => {
    const d1 = deferred();
    const d2 = deferred();
    const notified: string[] = [];
    const logs: string[] = [];
    const m = createUpdateCheckMachine({
      currentVersion: '1.0.0',
      channel: 'stable',
      fetchLatest: sequencedFetch([d1.promise, d2.promise]),
      log: (l) => logs.push(l),
      notify: (i) => notified.push(i.latestVersion),
    });
    expect(m.beginCheck()).toBe(true); // 自动检查 gen1
    expect(m.beginCheck({ manual: true })).toBe(true); // 手动取代 → gen2
    d1.resolve({ latestVersion: '9.9.9', channel: 'stable' }); // gen1 的结论迟到
    await flush();
    expect(notified).toEqual([]); // 迟到结论不通知
    expect(m.latestVersion).toBeNull(); // 不写 latest
    expect(m.notifiedVersion).toBeNull();
    expect(logs.some((l) => l.includes('stale'))).toBe(true); // 丢弃必须留痕
    d2.resolve({ latestVersion: '1.2.0', channel: 'stable' });
    await flush();
    expect(notified).toEqual(['1.2.0']);
    expect(m.latestVersion).toBe('1.2.0');
  });

  it('互斥:检查中的自动触发拒并(fetch 不重入),手动触发可取代在途检查', async () => {
    const d1 = deferred();
    const d2 = deferred();
    let calls = 0;
    const m = createUpdateCheckMachine({
      currentVersion: '1.0.0',
      channel: 'stable',
      fetchLatest: () => {
        calls += 1;
        return calls === 1 ? d1.promise : d2.promise;
      },
    });
    expect(m.beginCheck()).toBe(true);
    expect(m.state).toBe('checking');
    expect(m.beginCheck()).toBe(false); // 自动拒并
    expect(calls).toBe(1); // 没有重入
    expect(m.beginCheck({ manual: true })).toBe(true); // 手动取代
    expect(calls).toBe(2);
    d1.resolve({ latestVersion: '1.2.0' }); // gen1 迟到
    await flush();
    expect(m.latestVersion).toBeNull(); // 仍不覆盖
    d2.resolve({ latestVersion: '1.3.0' });
    await flush();
    expect(m.latestVersion).toBe('1.3.0');
  });

  it('② 通道不匹配:available 结论整条丢弃 + 留痕,不冒充本通道', async () => {
    const d = deferred();
    const notified: string[] = [];
    const logs: string[] = [];
    const m = createUpdateCheckMachine({
      currentVersion: '1.0.0',
      channel: 'stable',
      fetchLatest: () => d.promise,
      log: (l) => logs.push(l),
      notify: (i) => notified.push(i.latestVersion),
    });
    m.beginCheck();
    d.resolve({ latestVersion: '2.0.0', channel: 'beta' });
    await flush();
    expect(m.latestVersion).toBeNull();
    expect(m.notifiedVersion).toBeNull();
    expect(notified).toEqual([]);
    expect(logs.some((l) => l.includes('channel'))).toBe(true);
  });

  it('③ 取数失败回可检查态(非终态):状态回 idle、记忆面不被污染、可以再查', async () => {
    const d = deferred();
    let calls = 0;
    const logs: string[] = [];
    const m = createUpdateCheckMachine({
      currentVersion: '1.0.0',
      channel: 'stable',
      fetchLatest: () => {
        calls += 1;
        return calls === 1 ? d.promise : Promise.resolve({ latestVersion: '1.2.0' });
      },
      log: (l) => logs.push(l),
    });
    m.beginCheck();
    d.reject(new Error('net down'));
    await flush();
    expect(m.state).toBe('idle'); // 非终态
    expect(m.latestVersion).toBeNull(); // 失败不写 latest
    expect(logs.some((l) => l.includes('failed'))).toBe(true);
    expect(m.beginCheck()).toBe(true); // 失败后仍可再查
    await flush();
    expect(m.latestVersion).toBe('1.2.0');
  });

  it('④ 同版本不二次通知:同版本重复结算只喊一次,新版本才再喊', async () => {
    const notified: string[] = [];
    let n = 0;
    const m = createUpdateCheckMachine({
      currentVersion: '1.0.0',
      channel: 'stable',
      fetchLatest: () => Promise.resolve({ latestVersion: n++ < 2 ? '1.2.0' : '1.3.0' }),
      notify: (i) => notified.push(i.latestVersion),
    });
    m.beginCheck();
    await flush();
    m.beginCheck();
    await flush();
    expect(notified).toEqual(['1.2.0']); // 同版本第二次不喊
    m.beginCheck();
    await flush();
    expect(notified).toEqual(['1.2.0', '1.3.0']); // 新版本才喊
  });

  it('⑤ skip 语义:自动检查尊重 skipVersion;手动检查清 skip 后同版本照喊', async () => {
    const notified: string[] = [];
    const logs: string[] = [];
    const m = createUpdateCheckMachine({
      currentVersion: '1.0.0',
      channel: 'stable',
      fetchLatest: () => Promise.resolve({ latestVersion: '1.2.0' }),
      log: (l) => logs.push(l),
      notify: (i) => notified.push(i.latestVersion),
    });
    m.skipVersion('1.2.0');
    m.beginCheck(); // 自动检查:尊重 skip
    await flush();
    expect(notified).toEqual([]);
    expect(m.skippedVersion).toBe('1.2.0');
    m.beginCheck({ manual: true }); // 手动检查:清 skip
    await flush();
    expect(m.skippedVersion).toBeNull();
    expect(logs.some((l) => l.includes('clears skipped'))).toBe(true);
    expect(notified).toEqual(['1.2.0']); // 清完 skip,同版本也喊
  });

  it('不可解析 / 不比当前新的最新版:latest 如实记录,但不催更', async () => {
    const notified: string[] = [];
    let n = 0;
    const versions = ['0.9.0', 'not-a-version'];
    const m = createUpdateCheckMachine({
      currentVersion: '1.0.0',
      channel: 'stable',
      fetchLatest: () => Promise.resolve({ latestVersion: versions[n++] }),
      notify: (i) => notified.push(i.latestVersion),
    });
    m.beginCheck();
    await flush();
    expect(m.latestVersion).toBe('0.9.0'); // 旧版本也如实记录
    expect(notified).toEqual([]); // 但不催更
    m.beginCheck();
    await flush();
    expect(notified).toEqual([]); // 不可解析更不冒充"有更新"
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
