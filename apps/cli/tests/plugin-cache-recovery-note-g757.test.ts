// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-757:恢复器的结论必须有"到人出口"。
 *
 * 票面:`recoverStaleSwapArtifacts()` 的返回值在 `getOrCloneGitCache` 里被丢弃 —— 既不进
 * archiveNote 也不打日志。崩溃恢复的全部价值在"事后有人知道发生过什么";只改目录不吭声,
 * 等于把"没判"写成"判过"(§5e 的反面形态:判了但不语)。
 *
 * 落地形态:恢复非空时 ① 逐条走 stderr 事实行(处置=回位/仅清归档/两份并存/不动 + 依据,
 * 与 hooks 的 warnOnce 同一形态,不新造第二份日志屋;凭据不进输出);② 结构化结论挂到
 * `getOrCloneGitCache` **所有返回路径**的 `recovered` 字段上,调用面可读可断言。
 *
 * 验收(票面):新增一例断言"恢复跑完后调用面能读到该条结论"(不是只断言目录状态)。
 * 本文件走生产入口 getOrCloneGitCache + 真实形态 marker(生产原语构造,同 rollback 先例)。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import {
  getCachePath,
  getOrCloneGitCache,
  prepareStagingDirectory,
  takeOwnershipOfTarget,
  type SwapAuthority,
} from '../src/plugins/cache.js';

const MOCK_CLONE_SRC_ENV = 'IHUI_MOCK_GIT_CLONE_SRC';
const HOME_ENV = 'IHUI_HOME';

let tmpHome: string;
let tmpMockSrc: string;
let savedHome: string | undefined;
let savedMock: string | undefined;

beforeEach(() => {
  tmpHome = mkScratch('g757-home-');
  tmpMockSrc = mkScratch('g757-mock-');
  savedHome = process.env[HOME_ENV];
  savedMock = process.env[MOCK_CLONE_SRC_ENV];
  process.env[HOME_ENV] = tmpHome;
  // 回位后缓存命中即早退,不真 clone;仍备好 mock 源,防命中判据任何一条不成立时打到真网络
  process.env[MOCK_CLONE_SRC_ENV] = tmpMockSrc;
  fs.writeFileSync(path.join(tmpMockSrc, 'plugin.json'), JSON.stringify({ name: 'g757', version: '1.0.0' }), 'utf-8');
});

afterEach(() => {
  if (savedHome !== undefined) process.env[HOME_ENV] = savedHome;
  else delete process.env[HOME_ENV];
  if (savedMock !== undefined) process.env[MOCK_CLONE_SRC_ENV] = savedMock;
  else delete process.env[MOCK_CLONE_SRC_ENV];
  rmScratch(tmpMockSrc);
  rmScratch(tmpHome);
  vi.restoreAllMocks();
});

/**
 * 造一份"上一次进程崩在提交序列中间"的现场(生产原语构造,marker 吃真实形态;
 * 写者身份改写为外进程,权威面记录"别的更老的事务号"⇒ 恢复判 not-committed)。
 */
function seedCrashScene(url: string): { target: string; archive: string; authorityFile: string } {
  const target = getCachePath(url);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'old.txt'), 'old', 'utf-8');
  const authorityFile = path.join(tmpHome, 'recover-authority.json');
  const authority: SwapAuthority = { path: authorityFile, recordKey: 'p1' };

  const staging = prepareStagingDirectory(target);
  fs.writeFileSync(path.join(staging, 'new.txt'), 'new', 'utf-8');
  const swap = takeOwnershipOfTarget(target, staging, { authority });
  const archive = swap.superseded as string;
  expect(archive).toBeTruthy();

  // 写者身份改写成外进程(生产原语盖的是本进程章,不重写会被判 skipped-in-process;
  // 与 rollback 先例同一姿势):ownerPid/ownerId 都不是本进程 ⇒ 判活走 deadWriter 语义
  const markerPath = path.join(archive, '.ihui-swap-transaction.json');
  fs.writeFileSync(
    markerPath,
    JSON.stringify({
      transactionId: swap.transactionId,
      target,
      stagedAt: new Date().toISOString(),
      ownerPid: 424242,
      ownerId: 'another-process',
      authorityPath: authority.path,
      authorityKey: authority.recordKey,
    }),
    'utf-8',
  );

  // 权威记录里写一个不同的旧事务号 ⇒ 恢复对账结论 = not-committed
  const record = { name: 'p1', sourceType: 'git', installedAt: '2026-09-29T00:00:00.000Z', transactionId: 'an-older-generation-txn' };
  fs.writeFileSync(authorityFile, JSON.stringify({ records: [record] }, null, 2), 'utf-8');
  return { target, archive, authorityFile };
}

describe('G-757 恢复结论的到人出口', () => {
  it('恢复跑完后调用面能读到该条结论(recovered 结构化)且 stderr 有处置行', async () => {
    const scene = seedCrashScene('https://example.com/g757/repo.git');

    const stderrLines: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
      stderrLines.push(String(chunk));
      return true;
    }) as never);

    const res = await getOrCloneGitCache('https://example.com/g757/repo.git');

    // ① 调用面可读:结构化结论挂在返回值上(不是只看目录状态)
    expect(res.recovered).toHaveLength(1);
    const entry = res.recovered![0]!;
    expect(entry.action).toBe('restored');
    expect(entry.reason.length).toBeGreaterThan(0);
    // 回位是真实发生的:归档消失,旧副本回到权威槽位
    expect(fs.existsSync(scene.archive)).toBe(false);
    expect(fs.readFileSync(path.join(scene.target, 'old.txt'), 'utf-8')).toBe('old');

    // ② 到人出口:stderr 逐条报名,处置词与依据可见
    const joined = stderrLines.join('');
    expect(joined).toContain('插件缓存恢复');
    expect(joined).toContain('处置=回位');
  });

  it('无遗留现场 ⇒ 返回值不带 recovered 字段,stderr 零输出(正常路径零噪音)', async () => {
    const stderrLines: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
      stderrLines.push(String(chunk));
      return true;
    }) as never);

    const res = await getOrCloneGitCache('https://example.com/g757/clean.git');

    expect(res.recovered).toBeUndefined();
    expect(stderrLines.join('')).not.toContain('插件缓存恢复');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
