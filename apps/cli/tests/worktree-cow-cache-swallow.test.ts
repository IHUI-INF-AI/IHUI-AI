// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边

/** 本机能否建**文件**符号链接(Windows 需开发者模式/管理员):不能就如实 skip,不冒充 passed。 */
const CAN_FILE_SYMLINK = (() => {
  const d = mkScratch('worktree-link-cap-');
  try {
    const real = path.join(d, 'real.txt');
    fs.writeFileSync(real, 'x');
    const link = path.join(d, 'link.txt');
    fs.symlinkSync(real, link, 'file');
    return fs.lstatSync(link).isSymbolicLink();
  } catch {
    return false;
  } finally {
    try {
      rmScratch(d);
    } catch {
      // 探针目录清理失败不影响能力判定
    }
  }
})();
const itLink = CAN_FILE_SYMLINK ? it : it.skip;
const LINK_CASE_COUNT = 1;
if (!CAN_FILE_SYMLINK) {
  console.warn(
    `[worktree-cow-cache-swallow] 本机不能建文件符号链接 ⇒ 跳过 ${LINK_CASE_COUNT} 条 symlink 用例(skip,不计覆盖);` +
      '留痕逻辑本身仍由本文件其余代码路径调用,但 symlink 触发分支未判定。',
  );
}

let scratch = '';
const prevHome = process.env.HOME;
const prevUserProfile = process.env.USERPROFILE;

beforeEach(() => {
  scratch = mkScratch('worktree-swallow-');
  // COW_CACHE_PATH 在模块加载时由 os.homedir() 求值 ⇒ 必须先改环境再重新 import
  process.env.HOME = scratch;
  process.env.USERPROFILE = scratch;
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  try {
    rmScratch(scratch);
  } catch {
    // 夹具目录清理失败不影响判定
  }
});

function tmpLeftovers(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.includes('.tmp-')) : [];
}

describe('DBG-49 worktree CoW 缓存写失败被吞掉时必须留痕', () => {
  itLink('symlink 目标 ⇒ 不抛异常,但留一行 warn(路径+原因),真身不变', () => {
    const cacheDir = path.join(scratch, '.ihui', 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const real = path.join(cacheDir, 'cow-capability-real.json');
    // kind 不在合法集合内 ⇒ loadCachedCowKind 视为无缓存,才会走到写回
    fs.writeFileSync(real, JSON.stringify({ kind: 'bogus', ts: 1 }, null, 2));
    const before = fs.readFileSync(real);
    const link = path.join(cacheDir, 'cow-capability.json');
    fs.symlinkSync(real, link, 'file');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    return import('../src/worktree.js').then((worktree) => {
      const kind = worktree.detectCowKind(scratch);
      // 探测结果依宿主文件系统而变(Windows 只可能 refs/none;Linux 可能是 ficlone;macOS 可能是 clonefile):
      // 这条只是"探测落在一个合法档位"的前置条件,不是本用例的被审对象 —— 所以对着唯一源的全集判,
      // 不把本机的两档当成全世界的两档。真正要判的是下面的 warn 留痕与真身不变。
      expect(worktree.VALID_COW_KINDS).toContain(kind);

      const lines = warnSpy.mock.calls.flat().map(String).join('\n');
      expect(lines).toContain(link);
      expect(lines).toContain('symlink_target');
      expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
      expect(fs.readFileSync(real).equals(before)).toBe(true);
      expect(tmpLeftovers(cacheDir)).toEqual([]);
    });
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
