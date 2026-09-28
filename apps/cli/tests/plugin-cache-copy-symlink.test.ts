// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-747 —— `cache.ts` 的 `copyDirRecursive` 必须消费 `path-safety.ts` 那一份符号链接可达性判据。
 *
 * 钉的实测缺陷(G-705 交付报告点名的一格):cache 的复制面对链接目标**完全没做可达性校验**
 * (`fs.statSync(resolved).isDirectory()` 直接跟随),于是一条指向缓存根之外的链接会把外面那
 * 整棵树复制进 staging —— 而这条链路吃的是**远端 manifest 指定的第三方仓库**。
 *
 * 测试口径(与 `plugin-cache-rollback.test.ts` 同一套夹具机制,不改那个文件):
 *   - 一律走生产入口 `getOrCloneGitCache()` + `IHUI_MOCK_GIT_CLONE_SRC`(即真实调用形状),
 *     不从测试里调私有函数 —— 判据要在"有人真跑它的那一刻"才成立;
 *   - 真造 vs 注入:**逃逸 / 合法链接 / 悬空链接三型全部真造符号链接**(本机实测 Windows
 *     可建 `fs.symlinkSync`,含指向已删除目标的悬空链接 ⇒ 真实 ENOENT 走 degraded-missing);
 *     只有 `unsafe`(可达性判不了)按 G-705 的做法**注入** realpath 实现抛权限类错误码 ——
 *     真造 EPERM/EACCES 需要撤销本机权限或换文件系统,不可复现;
 *   - 每条"拒绝"用例都同时断言**没留下半份内容**(缓存目录整体为空:既没有落位副本也没有
 *     在途 staging),否则"抛了错但脏了盘"这一型看不见。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// 夹具唯一落点(AGENTS §26):活进程的 TEMP 可能仍钉在 C 盘,故一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import { getMarketplaceCacheDir } from '../src/plugins/paths.js';
import { getCachePath, getOrCloneGitCache, PluginCacheCopyUnsafeError } from '../src/plugins/cache.js';
import { __test__ as pathSafety } from '../src/plugins/path-safety.js';

const MOCK_CLONE_SRC_ENV = 'IHUI_MOCK_GIT_CLONE_SRC';
const GIT_BIN_ENV = 'IHUI_GIT_BIN';
const HOME_ENV = 'IHUI_HOME';

/** 通过 git 入参形状白名单的正常 URL(见 url-shape.ts:https 为默认放行档)。 */
const URL_A = 'https://example.com/ihui/g747-alpha.git';

let tmpHome: string;
let tmpMockSrc: string;
let tmpOutside: string;
let savedHome: string | undefined;
let savedMock: string | undefined;
let savedGitBin: string | undefined;

beforeEach(() => {
  // 三个夹具目录一律取 realpath:否则 8.3 短名/junction 形态会让"路径相等"断言假红。
  tmpHome = fs.realpathSync(mkScratch('g747-home-'));
  tmpMockSrc = fs.realpathSync(mkScratch('g747-mock-'));
  tmpOutside = fs.realpathSync(mkScratch('g747-outside-'));
  savedHome = process.env[HOME_ENV];
  savedMock = process.env[MOCK_CLONE_SRC_ENV];
  savedGitBin = process.env[GIT_BIN_ENV];
  process.env[HOME_ENV] = tmpHome;
  process.env[MOCK_CLONE_SRC_ENV] = tmpMockSrc;
  delete process.env[GIT_BIN_ENV];
});

afterEach(() => {
  // 注入实现必须复位,否则后续用例会继承它(那是"测试互相污染"而不是"判据通过")。
  pathSafety.setRealpathProbeForTests(null);
  if (savedHome !== undefined) process.env[HOME_ENV] = savedHome;
  else delete process.env[HOME_ENV];
  if (savedMock !== undefined) process.env[MOCK_CLONE_SRC_ENV] = savedMock;
  else delete process.env[MOCK_CLONE_SRC_ENV];
  if (savedGitBin !== undefined) process.env[GIT_BIN_ENV] = savedGitBin;
  else delete process.env[GIT_BIN_ENV];
  rmScratch(tmpOutside);
  rmScratch(tmpMockSrc);
  rmScratch(tmpHome);
});

// ==================== 夹具助手 ====================

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf-8');
}

/** 缓存落点目录(父级可能已被 prepareStagingDirectory 创建,但本用例里没有落位副本)。 */
function cacheRootOf(url: string): string {
  return getCachePath(url);
}

/**
 * 断言"复制被拒且盘上没留半份":缓存目标路径不存在,且缓存父目录里没有任何条目
 * (既没有落位的副本,也没有在途的 `.staging-*`)—— 由 getOrCloneGitCache 的
 * `discardStagingDirectory()` 负责清,这条断言钉的就是它真的清了。
 */
function expectNothingLeftBehind(url: string): void {
  const target = cacheRootOf(url);
  expect(fs.existsSync(target)).toBe(false);
  const parent = getMarketplaceCacheDir();
  const leftovers = fs.existsSync(parent) ? fs.readdirSync(parent) : [];
  expect(leftovers).toEqual([]);
}

/** 从被 getOrCloneGitCache 包过一层的错误里取出复制面的结构化异常本体。 */
function asCopyUnsafeError(err: unknown): PluginCacheCopyUnsafeError {
  const cause = (err as { cause?: unknown }).cause;
  expect(err).toBeInstanceOf(Error);
  expect(cause).toBeInstanceOf(PluginCacheCopyUnsafeError);
  return cause as PluginCacheCopyUnsafeError;
}

// ==================== ① 指向根外的链接 ⇒ 中止且不落半份 ====================

describe('G-747 cache.copyDirRecursive — 符号链接可达性', () => {
  it('①源里一条指向缓存根之外的链接 ⇒ 复制中止、点名该链接,且不留半份目录', async () => {
    write(path.join(tmpMockSrc, 'plugin.json'), '{"name":"alpha"}');
    write(path.join(tmpOutside, 'other-tenant-secret.txt'), 'DO-NOT-COPY');
    const link = path.join(tmpMockSrc, 'escape-link');
    fs.symlinkSync(tmpOutside, link, 'dir');

    // 阳性对照:这台机上这条链接确实可达、确实落在根外(否则注入/夹具就是一张空支票)
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    const rel = path.relative(fs.realpathSync(tmpMockSrc), fs.realpathSync(tmpOutside));
    expect(rel.startsWith('..') || path.isAbsolute(rel)).toBe(true);

    const err = await getOrCloneGitCache(URL_A, { ttlMs: 1000 }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err, '越界链接必须让整次刷新失败,而不是"跳过这条链接"').toBeTruthy();
    const unsafe = asCopyUnsafeError(err);
    expect(unsafe.name).toBe('PluginCacheCopyUnsafeError');
    expect(unsafe.code).toBe('plugin_cache_copy_unsafe');
    expect(unsafe.reason).toBe('symlink-escape');
    expect(unsafe.linkPath).toBe(link);
    expect(unsafe.targetPath).toBe(fs.realpathSync(tmpOutside));
    expect(unsafe.rootPath).toBe(tmpMockSrc);
    expect(unsafe.message).toContain('escape-link');
    expectNothingLeftBehind(URL_A);
  });

  // ==================== ② 正向对照:指向根内的合法链接照常复制 ====================

  it('②指向根内的合法链接 ⇒ 正常复制(正向对照,防"一律拒")', async () => {
    write(path.join(tmpMockSrc, 'plugin.json'), '{"name":"alpha"}');
    write(path.join(tmpMockSrc, 'shared/payload.txt'), 'inside-the-root');
    fs.symlinkSync(path.join(tmpMockSrc, 'shared'), path.join(tmpMockSrc, 'inside-link'), 'dir');

    const result = await getOrCloneGitCache(URL_A, { ttlMs: 1000 });
    expect(result.fromCache).toBe(false);
    expect(fs.readFileSync(path.join(result.localPath, 'inside-link', 'payload.txt'), 'utf-8')).toBe(
      'inside-the-root',
    );
    expect(fs.readFileSync(path.join(result.localPath, 'plugin.json'), 'utf-8')).toBe('{"name":"alpha"}');
  });

  // ==================== ③ degraded-missing:悬空链接按既有语义跳过 ====================

  it('③链接目标已删除(degraded-missing)⇒ 干净跳过,其余内容照拷,不抛穿', async () => {
    write(path.join(tmpMockSrc, 'keep.txt'), 'kept');
    const doomed = path.join(tmpMockSrc, 'gone-target');
    write(path.join(doomed, 'x.txt'), 'x');
    const link = path.join(tmpMockSrc, 'dangling-link');
    fs.symlinkSync(doomed, link, 'dir');
    fs.rmSync(doomed, { recursive: true, force: true });

    // 阳性对照:本机 realpath 对悬空链接给的确实是"明确缺失"那一码(封闭集内 ⇒ degraded-missing)
    const probeErr = (() => {
      try {
        fs.realpathSync(link);
        return null;
      } catch (e) {
        return e as { code?: string };
      }
    })();
    expect(probeErr, '悬空链接必须在这台机上真解析失败,否则本用例只证明了夹具能建链接').toBeTruthy();
    expect(pathSafety.skippableRealpathErrnos.has(probeErr!.code ?? '')).toBe(true);

    const result = await getOrCloneGitCache(URL_A, { ttlMs: 1000 });
    expect(fs.readFileSync(path.join(result.localPath, 'keep.txt'), 'utf-8')).toBe('kept');
    // 跳过 = 该链接不进副本,而不是"复制出一条指向不存在内容的东西"
    expect(fs.existsSync(path.join(result.localPath, 'dangling-link'))).toBe(false);
  });

  // ==================== ④ unsafe:判不了 ⇒ 拒,且绝不并进 missing ====================

  it('④可达性判不了(unsafe)⇒ 抛带 reasonCode 的错,一条内容都不复制', async () => {
    write(path.join(tmpMockSrc, 'plugin.json'), '{"name":"alpha"}');
    write(path.join(tmpMockSrc, 'inner/payload.txt'), 'would-be-copied-if-allowed');
    const link = path.join(tmpMockSrc, 'locked-link');
    fs.symlinkSync(path.join(tmpMockSrc, 'inner'), link, 'dir');

    // 注入:根那一步照常解析,只有"链接目标"那一步抛权限类错误码 —— 真造 EPERM 需要动本机
    // 权限/文件系统(不可复现),所以按 G-705 的做法只换 realpath,其余照走 node:fs。
    pathSafety.setRealpathProbeForTests((target: string) => {
      if (target === path.resolve(path.dirname(link), 'inner')) {
        throw Object.assign(new Error('injected: operation not permitted'), { code: 'EPERM' });
      }
      return fs.realpathSync(target);
    });

    const err = await getOrCloneGitCache(URL_A, { ttlMs: 1000 }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err, '判不了不得当成"没问题"—— 变异自证:把 unsafe 一支改回跳过时这一条必红').toBeTruthy();
    const unsafe = asCopyUnsafeError(err);
    expect(unsafe.reason).toBe('symlink-unverifiable');
    expect(unsafe.errno).toBe('EPERM');
    expect(unsafe.stage).toBe('target');
    expect(unsafe.linkPath).toBe(link);
    expectNothingLeftBehind(URL_A);
  });

  // ==================== ⑤ 反向锁:判据只许有一份 ====================

  it('⑤cache.ts 里不得出现第二份错误码名单 / 第二份 realpath 包裹', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.join(here, '../src/plugins/cache.ts'), 'utf-8');
    // 手抄名单 = 两处必漂移;path-safety 的封闭集是唯一一份(名字也不得在别处复制成员)。
    for (const literal of ['ENOENT', 'ENOTDIR', 'EISDIR']) {
      expect(src, `cache.ts 不得出现 ${literal} —— 可降级错误码名单只住在 path-safety.ts`).not.toContain(literal);
    }
    expect(src).not.toMatch(/realpathSync/);
    expect(src).not.toMatch(/classifyRealpathFailure/); // 分类出口也不许在复制面另用一遍
    // 装车证明:必须真的引了那份判据并消费四态,而不是"看着像有"
    expect(src).toMatch(/import\s*\{[^}]*checkSymlinkContainment[^}]*\}\s*from\s*'\.\/path-safety\.js'/);
    expect(src).toMatch(/checkSymlinkContainment\(\{/);
    expect(src).toMatch(/status === 'degraded-missing'/);
    expect(src).toMatch(/status !== 'contained'/);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
