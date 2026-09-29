// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-705:插件安装里 realpath 失败被当"可跳过"是 fail-open。
 *
 * 钉的两处旧形态(见 `git show HEAD:apps/cli/src/plugins/installer.ts` 第 165-210 行原文):
 *   ① `isPathUnsafe` 的 `catch { /* realpath 失败,跳过 symlink 检查 *\/ }`
 *   ② `copyDirRecursive` 里 realpath 失败 `continue`
 * 两处都把"判不了"记成了"没问题"。插件源是**第三方**的,所以这一格的表现是:一条指向范围外
 * 的链接只要在解析时出错(EPERM/EACCES/ELOOP),就被静默放行,而安装照样成功、旧副本照样被换掉。
 *
 * 现在只有**封闭集** `{ENOENT, ENOTDIR, EISDIR}`(明确缺失)才允许降级,其它一律判 unsafe。
 * 判据的唯一实现在 `src/plugins/path-safety.ts`;本文件在**端到端**(走 `installPlugin`)与
 * **单元层**两个高度上钉它,并钉住三件事:
 *   - 阳性:EACCES / EPERM / ELOOP ⇒ 判 unsafe、**一条内容都不复制**、旧副本仍在位;
 *   - 反向对照:ENOENT(真实悬空链接)⇒ 仍按"缺失"降级,行为与改动前一致(装成功、只跳过
 *     那条链接) —— 防"把判据改严到连正当形态都拦";
 *   - 一份实现:errno 名单不得在 `src/plugins/` 里出现第二份(源码级反向锁)。
 *
 * 注入方式:`path-safety` 的 realpath 实现可替换(函数注入,不是环境变量开关)。
 * EACCES/EPERM 不能靠真权限复现(本机以管理员跑,根本造不出"没权限"),所以用注入;
 * ELOOP 另有一条**不依赖注入**的真实链接环用例作为阳性对照。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import { getInstalledPluginsDir, getPluginInstallPath } from '../src/plugins/paths.js';
import { isUsableDirectoryCopy, swapScratchMarkers } from '../src/plugins/cache.js';
import {
  PluginPathUnsafeError,
  installPlugin,
  loadInstallRegistry,
  type InstallOutcome,
} from '../src/plugins/installer.js';
import { __test__ as pathSafety, type RealpathProbe } from '../src/plugins/path-safety.js';

const HOME_ENV = 'IHUI_HOME';

let tmpHome: string;
let tmpCwd: string;
let tmpOutside: string;
let originalCwd: string;
let savedHome: string | undefined;

beforeEach(() => {
  tmpHome = mkScratch('g705-home-');
  tmpCwd = mkScratch('g705-cwd-');
  tmpOutside = mkScratch('g705-outside-');
  originalCwd = process.cwd();
  savedHome = process.env[HOME_ENV];
  process.env[HOME_ENV] = tmpHome;
});

afterEach(() => {
  // 注入位必须复位:否则会串到下一条用例(甚至同文件其它 describe)
  pathSafety.setRealpathProbeForTests(null);
  process.chdir(originalCwd);
  if (savedHome !== undefined) process.env[HOME_ENV] = savedHome;
  else delete process.env[HOME_ENV];
  rmScratch(tmpOutside);
  rmScratch(tmpCwd);
  rmScratch(tmpHome);
});

// ==================== 夹具助手 ====================

/** 造一个带错误码的 Error(与 Node fs 抛出的形状一致) */
function errnoError(code: string, target: string): Error & { code: string } {
  return Object.assign(new Error(`${code}: ${target} (G-705 注入,非真实文件系统错误)`), { code });
}

/** 对匹配路径抛指定 errno、其余照走 node:fs 的 realpath 实现 */
function probeThrowingOn(match: (p: string) => boolean, code: string): RealpathProbe {
  return (p: string) => {
    if (match(p)) throw errnoError(code, p);
    return fs.realpathSync(p);
  };
}

/** 写一个可安装的本地插件源(不含链接) */
function writePluginDir(
  dir: string,
  manifest: { name: string; version: string },
  files: Record<string, string> = {},
): string {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest), 'utf-8');
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content, 'utf-8');
  }
  return dir;
}

/** 目录符号链接(Windows 走 junction,与既有插件用例同一口径) */
function linkDir(target: string, link: string): void {
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
}

/** 文件符号链接(造真实链接环用) */
function linkFile(target: string, link: string): void {
  fs.symlinkSync(target, link, 'file');
}

/** 交换残留:失败路径不许留下 staging 半成品 */
function leftoverStaging(): string[] {
  const dir = getInstalledPluginsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => n.includes(swapScratchMarkers().staging));
}

function installedVersions(name: string): string[] {
  return loadInstallRegistry()
    .records.filter((r) => r.name === name)
    .map((r) => r.version)
    .filter((v): v is string => typeof v === 'string');
}

/** 取某个函数的源码体(括号配对;注释已剥,字符串里没有裸花括号时够用) */
function functionBodyOf(code: string, name: string): string {
  const at = code.indexOf(`function ${name}(`);
  expect(at, `installer.ts 里找不到函数 ${name}`).toBeGreaterThanOrEqual(0);
  const open = code.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    const ch = code.charAt(i);
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(open, i + 1);
    }
  }
  throw new Error(`函数体不闭合:${name}`);
}

/** 走生产入口跑一次安装,把结论与异常一起带回来(断言要同时看两者) */
async function tryInstall(
  source: string,
): Promise<{ ok: true; outcome: InstallOutcome } | { ok: false; err: unknown }> {
  try {
    return { ok: true, outcome: await installPlugin(source) };
  } catch (err) {
    return { ok: false, err };
  }
}

/**
 * 覆盖安装夹具:先装 v1,再备一份"内含一条**树内**链接"的 v2。
 * 链接本身完全合法 —— 于是"被拒"只能来自 errno 判定,不可能来自夹具形状。
 */
function buildOverwriteFixture(name: string): { insideTarget: string; linkPath: string } {
  process.chdir(tmpCwd);
  writePluginDir(path.join(tmpCwd, 'v1'), { name, version: '1.0.0' }, { 'marker.txt': 'v1' });
  const v2 = writePluginDir(path.join(tmpCwd, 'v2'), { name, version: '2.0.0' }, {
    'marker.txt': 'v2',
    'keep.txt': 'keep',
  });
  const insideTarget = path.join(v2, 'inside-dir');
  fs.mkdirSync(insideTarget, { recursive: true });
  fs.writeFileSync(path.join(insideTarget, 'inner.txt'), 'inner', 'utf-8');
  const linkPath = path.join(v2, 'link-inside');
  linkDir(insideTarget, linkPath);
  return { insideTarget, linkPath };
}

/** 当前环境能否创建符号链接(不能则相关用例如实 skip,不冒充已验) */
const canSymlink = (() => {
  let probe: string | null = null;
  try {
    probe = mkScratch('g705-symlink-cap-');
    const inner = path.join(probe, 'target');
    fs.mkdirSync(inner, { recursive: true });
    linkDir(inner, path.join(probe, 'link'));
    return fs.lstatSync(path.join(probe, 'link')).isSymbolicLink();
  } catch {
    return false;
  } finally {
    if (probe) rmScratch(probe);
  }
})();

/**
 * 本机能否造出**真实**的 ELOOP(两个互相指向的符号链接)。
 * 阳性对照:判据不必依赖注入也能在真链接环上命中。
 */
const realEloop: { ok: boolean; errno: string | null } = (() => {
  let probe: string | null = null;
  try {
    probe = mkScratch('g705-eloop-cap-');
    const a = path.join(probe, 'a');
    const b = path.join(probe, 'b');
    linkFile(b, a);
    linkFile(a, b);
    try {
      fs.realpathSync(a);
      return { ok: false, errno: null }; // 解析成功 = 这台机没造出环
    } catch (err) {
      const code = (err as { code?: unknown }).code;
      return { ok: code === 'ELOOP', errno: typeof code === 'string' ? code : null };
    }
  } catch {
    return { ok: false, errno: null };
  } finally {
    if (probe) rmScratch(probe);
  }
})();

/** 悬空链接在本机抛的 errno(必须是封闭集内的,否则那条真实反向对照不成立) */
const danglingErrno: string | null = (() => {
  let probe: string | null = null;
  try {
    probe = mkScratch('g705-dangling-cap-');
    const target = path.join(probe, 'gone');
    fs.mkdirSync(target, { recursive: true });
    const link = path.join(probe, 'lnk');
    linkDir(target, link);
    fs.rmSync(target, { recursive: true, force: true });
    try {
      fs.realpathSync(link);
      return null;
    } catch (err) {
      const code = (err as { code?: unknown }).code;
      return typeof code === 'string' ? code : null;
    }
  } catch {
    return null;
  } finally {
    if (probe) rmScratch(probe);
  }
})();

// ==================== 单元层:封闭集与分类 ====================

describe('path-safety — errno 封闭集(唯一一份实现)', () => {
  it('名单就是那三个码(扩表必须显式改这里,不得在别处另抄)', () => {
    expect([...pathSafety.skippableRealpathErrnos].sort()).toEqual(['EISDIR', 'ENOENT', 'ENOTDIR']);
  });

  it('明确缺失三码 ⇒ kind=missing', () => {
    for (const code of ['ENOENT', 'ENOTDIR', 'EISDIR']) {
      expect(pathSafety.classifyRealpathFailure(errnoError(code, '/x'))).toMatchObject({
        kind: 'missing',
        errno: code,
      });
    }
  });

  it('EPERM / EACCES / ELOOP 及未知码 ⇒ kind=unsafe(旧代码正是在这一格放行)', () => {
    for (const code of ['EPERM', 'EACCES', 'ELOOP', 'ENAMETOOLONG', 'EBUSY', 'ESTALE', 'UNKNOWN_CODE']) {
      const verdict = pathSafety.classifyRealpathFailure(errnoError(code, '/x'));
      expect(verdict).toMatchObject({ kind: 'unsafe', errno: code });
      expect(verdict.summary).toContain(code);
    }
  });

  it('取不到码一律 unsafe,绝不并进 missing', () => {
    expect(pathSafety.classifyRealpathFailure(new Error('没有 code'))).toMatchObject({
      kind: 'unsafe',
      errno: null,
    });
    expect(pathSafety.classifyRealpathFailure('EACCES: 字符串抛出物')).toMatchObject({
      kind: 'unsafe',
      errno: null,
    });
    expect(pathSafety.classifyRealpathFailure(null)).toMatchObject({ kind: 'unsafe', errno: null });
    expect(pathSafety.classifyRealpathFailure({ code: 5 })).toMatchObject({ kind: 'unsafe', errno: null });
  });

  it('被 cause 包了一层也要问得出码(本仓自己的包装形态,如 saveInstallRegistryChecked)', () => {
    const wrappedMissing = new Error('外层包装', { cause: errnoError('ENOENT', '/x') });
    expect(pathSafety.classifyRealpathFailure(wrappedMissing)).toMatchObject({
      kind: 'missing',
      errno: 'ENOENT',
    });
    const wrappedDenied = new Error('外层包装', { cause: errnoError('EACCES', '/x') });
    expect(pathSafety.classifyRealpathFailure(wrappedDenied)).toMatchObject({
      kind: 'unsafe',
      errno: 'EACCES',
    });
  });

  it('checkSymlinkContainment 四态分得开:contained / escape / degraded-missing / unsafe', () => {
    const root = tmpCwd;
    const inside = path.join(tmpCwd, 'inside-target');
    fs.mkdirSync(inside, { recursive: true });
    const passProbe: RealpathProbe = (p: string) => fs.realpathSync(p);

    expect(
      pathSafety.checkSymlinkContainment({ linkPath: 'l', targetPath: inside, rootPath: root }, passProbe).status,
    ).toBe('contained');
    expect(
      pathSafety.checkSymlinkContainment(
        { linkPath: 'l', targetPath: inside, rootPath: root },
        (p: string) => (p === inside ? path.join(fs.realpathSync(root), '..', 'elsewhere') : fs.realpathSync(p)),
      ).status,
    ).toBe('escape');

    for (const code of ['ENOENT', 'ENOTDIR', 'EISDIR']) {
      expect(
        pathSafety.checkSymlinkContainment(
          { linkPath: 'l', targetPath: inside, rootPath: root },
          probeThrowingOn((p) => p === inside, code),
        ),
      ).toMatchObject({ status: 'degraded-missing', stage: 'target', errno: code });
    }
    for (const code of ['EACCES', 'EPERM', 'ELOOP']) {
      expect(
        pathSafety.checkSymlinkContainment(
          { linkPath: 'l', targetPath: inside, rootPath: root },
          probeThrowingOn((p) => p === inside, code),
        ),
      ).toMatchObject({ status: 'unsafe', stage: 'target', errno: code });
    }
    // 失败也可能发生在"根"那一步(判据必须覆盖门自己产出的另一形态)
    expect(
      pathSafety.checkSymlinkContainment(
        { linkPath: 'l', targetPath: inside, rootPath: root },
        probeThrowingOn((p) => p === root, 'EACCES'),
      ),
    ).toMatchObject({ status: 'unsafe', stage: 'root', errno: 'EACCES' });
    expect(
      pathSafety.checkSymlinkContainment(
        { linkPath: 'l', targetPath: inside, rootPath: root },
        probeThrowingOn((p) => p === root, 'ENOENT'),
      ),
    ).toMatchObject({ status: 'degraded-missing', stage: 'root', errno: 'ENOENT' });
  });
});

// ==================== 端到端:copyDirRecursive 那一站 ====================

describe('installPlugin(第三方源)— realpath 判不了 ⇒ 拒装,不再 fail-open', () => {
  it.each(['EACCES', 'EPERM', 'ELOOP'])(
    '%s:判 unsafe ⇒ 抛 PluginPathUnsafeError、旧副本仍在位、一条内容都不复制',
    { skip: !canSymlink },
    async (code) => {
      const name = `p-${code.toLowerCase()}`;
      const { insideTarget } = buildOverwriteFixture(name);
      await installPlugin('./v1');
      const dest = getPluginInstallPath(name);
      expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('v1');

      // 只在"解析链接目标"这一步注入错误(根解析照常)⇒ 被拒只能因为这条 errno 判据
      pathSafety.setRealpathProbeForTests(probeThrowingOn((p) => p === insideTarget, code));

      const run = await tryInstall('./v2');
      expect(run.ok).toBe(false);
      if (run.ok) return;

      expect(run.err).toBeInstanceOf(PluginPathUnsafeError);
      const err = run.err as PluginPathUnsafeError;
      expect(err.reason).toBe('symlink-unverifiable');
      expect(err.errno).toBe(code);
      expect(err.stage).toBe('target');
      expect(String(err.linkPath)).toContain('link-inside');
      // 点名信息必须够诊断:哪条链接、哪个码,都在文案里
      expect(err.message).toContain('判不了');
      expect(err.message).toContain(code);

      // 旧副本仍在位且内容一字未变;v2 的任何东西都没进安装目录
      expect(isUsableDirectoryCopy(dest)).toBe(true);
      expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('v1');
      expect(fs.existsSync(path.join(dest, 'keep.txt'))).toBe(false);
      expect(fs.existsSync(path.join(dest, 'link-inside'))).toBe(false);
      expect(installedVersions(name)).toEqual(['1.0.0']);
      expect(leftoverStaging()).toEqual([]);
    },
  );

  it(
    '阳性对照:同一份源在没有注入时安装成功(证明上面被拒的是 errno 判定,不是夹具)',
    { skip: !canSymlink },
    async () => {
      const name = 'p-no-inject';
      buildOverwriteFixture(name);
      await installPlugin('./v1');
      const dest = getPluginInstallPath(name);

      const run = await tryInstall('./v2');
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      expect(run.outcome.wasInstalled).toBe(false);
      expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('v2');
      expect(fs.existsSync(path.join(dest, 'keep.txt'))).toBe(true);
      expect(leftoverStaging()).toEqual([]);
    },
  );

  it('ELOOP 真实链接环(不依赖注入)⇒ 同样判 unsafe', { skip: !canSymlink }, async () => {
    if (!realEloop.ok) {
      console.warn(`跳过真实 ELOOP 用例:本机造不出链接环(实测 errno=${realEloop.errno ?? '解析成功'})`);
      return;
    }
    process.chdir(tmpCwd);
    const name = 'p-eloop-real';
    const src = writePluginDir(path.join(tmpCwd, 'ring'), { name, version: '1.0.0' }, { 'keep.txt': 'keep' });
    const a = path.join(src, 'ring-a');
    const b = path.join(src, 'ring-b');
    linkFile(b, a);
    linkFile(a, b);

    const run = await tryInstall('./ring');
    expect(run.ok).toBe(false);
    if (run.ok) return;
    const err = run.err as PluginPathUnsafeError;
    expect(err).toBeInstanceOf(PluginPathUnsafeError);
    expect(err.reason).toBe('symlink-unverifiable');
    expect(err.errno).toBe('ELOOP');
    expect(fs.existsSync(getPluginInstallPath(name))).toBe(false);
    expect(loadInstallRegistry().records.some((r) => r.name === name)).toBe(false);
    expect(leftoverStaging()).toEqual([]);
  });

  it('反向对照:树外的链接照旧判 escape(判据没被改宽)', { skip: !canSymlink }, async () => {
    process.chdir(tmpCwd);
    const name = 'p-escape';
    const src = writePluginDir(path.join(tmpCwd, 'esc'), { name, version: '1.0.0' }, { 'keep.txt': 'keep' });
    const outsideTarget = path.join(tmpOutside, 'victim');
    fs.mkdirSync(outsideTarget, { recursive: true });
    fs.writeFileSync(path.join(outsideTarget, 'secret.txt'), 'not-yours', 'utf-8');
    linkDir(outsideTarget, path.join(src, 'escape'));

    const run = await tryInstall('./esc');
    expect(run.ok).toBe(false);
    if (run.ok) return;
    const err = run.err as PluginPathUnsafeError;
    expect(err.reason).toBe('symlink-escape');
    expect(err.errno).toBeNull();
    expect(fs.existsSync(getPluginInstallPath(name))).toBe(false);
  });

  it.each(['ENOENT', 'ENOTDIR', 'EISDIR'])(
    '反向对照:封闭集内的 %s ⇒ 仍按"缺失"降级(装成功,只跳过那条链接)',
    { skip: !canSymlink },
    async (code) => {
      const name = `p-missing-${code.toLowerCase()}`;
      const { insideTarget } = buildOverwriteFixture(name);
      pathSafety.setRealpathProbeForTests(probeThrowingOn((p) => p === insideTarget, code));

      const run = await tryInstall('./v2');
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const dest = getPluginInstallPath(name);
      expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('v2');
      expect(fs.existsSync(path.join(dest, 'keep.txt'))).toBe(true);
      // 与改动前一致:那条"明确缺失"的链接不被复制,但安装不因此失败
      expect(fs.existsSync(path.join(dest, 'link-inside'))).toBe(false);
      expect(leftoverStaging()).toEqual([]);
    },
  );

  it('反向对照:真实悬空链接(本机实测 errno 在封闭集内)⇒ 与改动前逐字同形', { skip: !canSymlink }, async () => {
    if (danglingErrno === null || !pathSafety.skippableRealpathErrnos.has(danglingErrno)) {
      console.warn(`跳过真实悬空链接用例:本机 realpath 对它抛 ${danglingErrno ?? '无码'},不属明确缺失档`);
      return;
    }
    process.chdir(tmpCwd);
    const name = 'p-dangling';
    const src = writePluginDir(path.join(tmpCwd, 'dang'), { name, version: '1.0.0' }, { 'keep.txt': 'keep' });
    const gone = path.join(tmpCwd, 'was-here');
    fs.mkdirSync(gone, { recursive: true });
    const link = path.join(src, 'dangling');
    linkDir(gone, link);
    fs.rmSync(gone, { recursive: true, force: true });

    const run = await tryInstall('./dang');
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const dest = getPluginInstallPath(name);
    expect(isUsableDirectoryCopy(dest)).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'keep.txt'), 'utf-8')).toBe('keep');
    expect(fs.existsSync(path.join(dest, 'dangling'))).toBe(false);
    expect(leftoverStaging()).toEqual([]);
  });
});

// ==================== 端到端:顶层路径那一站(原 isPathUnsafe) ====================

describe('installPlugin(local) 顶层路径 — 判不了不再被读成"没有链接"', () => {
  /** 造一个"以符号链接形态出现在 cwd 里、真实目标仍在 cwd 内"的插件源 */
  function buildTopLevelLinkFixture(name: string): { realDir: string; alias: string } {
    process.chdir(tmpCwd);
    const realDir = writePluginDir(path.join(tmpCwd, 'real-plugin'), { name, version: '1.0.0' }, {
      'keep.txt': 'keep',
    });
    const alias = path.join(tmpCwd, 'alias-plugin');
    linkDir(realDir, alias);
    return { realDir, alias };
  }

  it('阳性:别名链接可达性抛 EACCES ⇒ 拒装,安装目录一步没动', { skip: !canSymlink }, async () => {
    const name = 'p-top-eacces';
    const { alias } = buildTopLevelLinkFixture(name);
    pathSafety.setRealpathProbeForTests(probeThrowingOn((p) => p === alias, 'EACCES'));

    const run = await tryInstall('./alias-plugin');
    expect(run.ok).toBe(false);
    if (run.ok) return;
    const err = run.err as PluginPathUnsafeError;
    expect(err).toBeInstanceOf(PluginPathUnsafeError);
    expect(err.reason).toBe('symlink-unverifiable');
    expect(err.errno).toBe('EACCES');
    expect(err.message).toContain('判不了');
    expect(fs.existsSync(getPluginInstallPath(name))).toBe(false);
    expect(loadInstallRegistry().records.some((r) => r.name === name)).toBe(false);
  });

  it('反向对照:同一份别名链接在可解析时正常安装(真实目标仍在基准目录内)', { skip: !canSymlink }, async () => {
    const name = 'p-top-ok';
    buildTopLevelLinkFixture(name);

    const run = await tryInstall('./alias-plugin');
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(isUsableDirectoryCopy(getPluginInstallPath(name))).toBe(true);
  });

  it('反向对照:路径明确不存在 ⇒ 仍是"本地源不是目录"的常规错误,不伪装成安全拒装', async () => {
    process.chdir(tmpCwd);
    const run = await tryInstall('./never-existed');
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.err).toBeInstanceOf(Error);
    expect(run.err).not.toBeInstanceOf(PluginPathUnsafeError);
    expect((run.err as Error).message).toContain('本地源不是目录');
  });

  it('越界路径(`..`)照旧拒,消息保持原样', async () => {
    process.chdir(tmpCwd);
    const run = await tryInstall('./../outside-dir');
    expect(run.ok).toBe(false);
    if (run.ok) return;
    const err = run.err as PluginPathUnsafeError;
    expect(err).toBeInstanceOf(PluginPathUnsafeError);
    expect(err.reason).toBe('outside-base-dir');
    expect(err.message).toBe('不安全的本地路径: ./../outside-dir');
  });
});

// ==================== 一份实现:源码级反向锁 ====================

describe('G-705 判据只有一份实现', () => {
  it('src/plugins/ 下除 path-safety.ts 外不得再出现第二份 errno **名单**(单码同词不同义不计)', () => {
    /**
     * 口径修正(2026-09-29,主会话现读红在**已入库**代码上):
     * 原写法是"任何文件出现三码之一即红"。而 `git-runner.ts:153` 的 `this.code = 'ENOENT'`
     * 是 **node spawn 的"git 二进制不存在"**(该文件 :25/:389/:408 自己把它归成 `binary-missing`),
     * 与 `path-safety.ts` 的"realpath 失败里哪些算明确缺失"**同词不同义**。
     * 后果不是账面难看:一条对合法形态恒红的反向锁,会让所有人学会不看这个文件的输出,
     * 而它守的那一格(EACCES/EPERM 被静默放行)恰恰只在有人读它时才被看着。
     *
     * 判据改成它本来想判的东西:**一份复制出来的名单**。三码集的定义就是"这三个都算缺失",
     * 所以复制必然同时出现 ≥2 个;单码使用不可能是这份名单的复制品。
     * 有牙证明在下面两条构造面用例里(1 码 ⇒ 绿、2 码 ⇒ 红),不是靠注释。
     */
    const CODES = ['ENOENT', 'ENOTDIR', 'EISDIR'] as const;
    const offendersOf = (name: string, text: string): string[] => {
      if (name === 'path-safety.ts') return [];
      const hits = CODES.filter((c) => text.includes(`'${c}'`) || text.includes(`"${c}"`));
      return hits.length >= 2 ? [`${name}:${hits.join('+')}`] : [];
    };

    // 构造面·反例(不得误伤):合法的单码用法必须为绿 —— 这一条就是 git-runner 那一格
    expect(offendersOf('git-runner.ts', "this.code = 'ENOENT';")).toEqual([]);
    // 构造面·正例(判据有牙):抄了名单的两个成员就必须红
    expect(offendersOf('elsewhere.ts', "if (SKIPPABLE.includes('ENOENT') || SKIPPABLE.includes('ENOTDIR')) {}")).toEqual([
      'elsewhere.ts:ENOENT+ENOTDIR',
    ]);

    const pluginsDir = fileURLToPath(new URL('../src/plugins/', import.meta.url));
    const offenders: string[] = [];
    let ownerHasSet = false;
    for (const entry of fs.readdirSync(pluginsDir)) {
      if (!entry.endsWith('.ts')) continue;
      const text = fs.readFileSync(path.join(pluginsDir, entry), 'utf-8');
      if (entry === 'path-safety.ts') {
        // 装车证明:名单的唯一主人必须真含着这三个码,否则"除它之外不许有第二份"是句空话
        ownerHasSet = CODES.every((c) => text.includes(`'${c}'`) || text.includes(`"${c}"`));
        continue;
      }
      offenders.push(...offendersOf(entry, text));
    }
    expect(ownerHasSet, 'path-safety.ts 里找不到那份封闭集 ⇒ 本锁没有主人,判据已失效').toBe(true);
    expect(offenders).toEqual([]);
  });

  it('installer.ts:旧的"catch 里放行"形态不得回来,且 realpath 只能经唯一出口', () => {
    const src = fs.readFileSync(fileURLToPath(new URL('../src/plugins/installer.ts', import.meta.url)), 'utf-8');
    // 只剥块注释与整行注释:判据看的是代码形状,不是我们为讲清历史而在注释里复述的旧写法
    // (注释里逐字留着 `catch {}` / `catch { … 跳过 … }` 两句说明文,不剥就会自己判自己红)
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    // ① realpath 只能住在 path-safety.ts;installer 里再出现就是第二份判定,也是旧 fail-open 的入口
    expect(code).not.toContain('realpathSync');
    // ② "catch (x) { … continue }"(旧 ② 站点)这一型不得回来
    expect(code).not.toMatch(/catch\s*\([^)]*\)\s*\{[^}]*\bcontinue\b/);
    // ③ 两处站点都必须经唯一出口拿结论
    expect(code.split('checkSymlinkContainment(').length - 1).toBeGreaterThanOrEqual(2);
    expect(code).toContain('classifyRealpathFailure(');
    // ④ installer 不得自带 errno 名单(判据只有一份)
    expect(code).not.toMatch(/code\s*===\s*'E[A-Z]{3,}/);
    // ⑤ 站点①(lstat/existsSync 抛错那一支)必须走唯一分类出口,且"缺失"与"判不了"分流不同
    const safetyBody = functionBodyOf(code, 'inspectLocalPathSafety');
    expect(safetyBody).toMatch(/catch\s*\(err\)\s*\{[\s\S]{0,160}classifyRealpathFailure\(err\)/);
    expect(safetyBody).toContain("verdict.kind === 'missing'");
    // 复制这一站(站点②)不得再有 catch:失败一律由 checkSymlinkContainment 的结论分流
    const copyBody = functionBodyOf(code, 'copyDirRecursive');
    expect(copyBody).not.toContain('catch');
    expect(copyBody).toContain("status === 'degraded-missing'");
    expect(copyBody).toContain('checkSymlinkContainment(');
  });
});
