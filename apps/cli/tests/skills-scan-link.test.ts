// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-408③ — 技能扫描对符号链接/junction 的三粒度显式拒绝测试。
 * 成对设计:每条"链接必须被拒且不读取"都配"普通真目录正常命中"的阳性对照,
 * 否则判据退化成"逢目录即拒"也测不出来。
 *
 * 夹具纪律:链接只在 mkdtemp 临时目录里造;Windows 用 Node 自身的 'junction' 类型
 * (不经 cmd/PowerShell 派生 ⇒ 没有引号链路可翻车,且 junction 不需要管理员/开发者模式,
 * file symlink 需要 —— 所以三粒度统一用 junction 形态测);
 * afterEach 先 unlink 链接本体、再递归删临时目录,不跟随、不残留。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadSkills } from '../src/skills/index.js';

/** 造一个"目录链接"(win32 = junction,其余 = dir symlink)。 */
function makeLink(target: string, linkPath: string): void {
  if (process.platform === 'win32') {
    fs.symlinkSync(target, linkPath, 'junction');
  } else {
    fs.symlinkSync(target, linkPath, 'dir');
  }
}

const SKILL_BODY = (name: string): string =>
  `---\nname: ${name}\ndescription: fixture\n---\ncontent of ${name}\n`;

/** 断链:unlink 与 rmdir 两个出口按顺序试(见 afterEach 注释),都不成则说明已不在。 */
function removeLink(p: string): void {
  try {
    fs.unlinkSync(p);
    return;
  } catch {
    /* Windows junction 可能拒绝 unlink,转 rmdir */
  }
  try {
    fs.rmdirSync(p);
  } catch {
    /* 已不存在 */
  }
}

describe('技能扫描一律不跟随符号链接/junction(G-408③)', () => {
  let tmpDir: string;
  let tmpHome: string;
  const extraDirs: string[] = [];
  const createdLinks: string[] = [];
  let origHome: string | undefined;
  let origUserProfile: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-skills-link-'));
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-skills-link-home-'));
    origHome = process.env.HOME;
    origUserProfile = process.env.USERPROFILE;
    // Windows 下 os.homedir() 优先 USERPROFILE,Unix 用 HOME,两者都钉到隔离目录,
    // 保证真机 ~/.ihui/skills 里的第三方技能不掺进断言。
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    // 固定 repoRoot 于 tmpDir,findRepoRoot 不会上溯到真仓库(调用处也显式传了 repoRoot)。
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });
  });

  afterEach(() => {
    // 先断链再删目录:递归删除绝不许跟随重解析点(§26 的穿透清空事故同型)。
    // Windows 上 junction 常被 unlinkSync 以 EISDIR/EPERM 拒绝(它看起来是目录),
    // 而 rmdir 对重解析点只断链、不删目标 —— 两种出口按顺序试,不是"删不掉就算了"。
    for (const l of createdLinks) removeLink(l);
    createdLinks.length = 0;
    for (const d of [tmpDir, tmpHome, ...extraDirs]) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {
        /* 竞态/占用:留待系统 TEMP 回收 */
      }
    }
    extraDirs.length = 0;
    if (origHome === undefined) delete process.env.HOME;
    else process.env.HOME = origHome;
    if (origUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = origUserProfile;
  });

  function link(target: string, linkPath: string): void {
    makeLink(target, linkPath);
    createdLinks.push(linkPath);
  }

  function mkOutside(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-skills-outside-'));
    extraDirs.push(d);
    return d;
  }

  function scan(cwd: string): { names: string[]; notices: string[] } {
    const notices: string[] = [];
    const skills = loadSkills({ cwd, repoRoot: cwd, onNotice: (m) => notices.push(m) });
    return { names: skills.map((s) => s.name), notices };
  }

  it('阳性对照(真目录包):正常命中,且零拒绝记录', () => {
    const root = path.join(tmpDir, '.ihui', 'skills');
    fs.mkdirSync(path.join(root, 'realskill'), { recursive: true });
    fs.writeFileSync(path.join(root, 'realskill', 'SKILL.md'), SKILL_BODY('real-skill'));
    const { names, notices } = scan(tmpDir);
    expect(names).toContain('real-skill');
    expect(notices).toEqual([]);
  });

  it('粒度① 扫描根本体是 junction ⇒ 整根拒绝,且不枚举其内容', () => {
    const outside = mkOutside();
    fs.writeFileSync(path.join(outside, 'rootlink-skill.md'), SKILL_BODY('rootlink-skill'));
    fs.mkdirSync(path.join(tmpDir, '.ihui'), { recursive: true });
    link(outside, path.join(tmpDir, '.ihui', 'skills'));
    const { names, notices } = scan(tmpDir);
    expect(names).not.toContain('rootlink-skill');
    const joined = notices.join('\n');
    expect(joined).toMatch(/拒绝跟随符号链接\/junction/);
    expect(joined).toContain(path.join('.ihui', 'skills'));
  });

  it('粒度② 根子项是 junction(指向含 <pkg>/SKILL.md 的外部目录)⇒ 拒读并点名', () => {
    const root = path.join(tmpDir, '.ihui', 'skills');
    fs.mkdirSync(root, { recursive: true });
    const outside = mkOutside();
    fs.mkdirSync(path.join(outside, 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(outside, 'pkg', 'SKILL.md'), SKILL_BODY('should-never-load'));
    link(outside, path.join(root, 'pkglink'));
    const { names, notices } = scan(tmpDir);
    expect(names).not.toContain('should-never-load');
    const joined = notices.join('\n');
    expect(joined).toMatch(/拒绝跟随符号链接\/junction/);
    expect(joined).toContain('pkglink');
  });

  it('粒度③ 子项是真目录、但其 SKILL.md 本体是 junction ⇒ 拒读该文件并点名', () => {
    const root = path.join(tmpDir, '.ihui', 'skills');
    fs.mkdirSync(path.join(root, 'pk2'), { recursive: true });
    const outside = mkOutside();
    fs.writeFileSync(path.join(outside, 'SKILL.md'), SKILL_BODY('via-file-link'));
    link(outside, path.join(root, 'pk2', 'SKILL.md'));
    const { names, notices } = scan(tmpDir);
    expect(names).not.toContain('via-file-link');
    const joined = notices.join('\n');
    expect(joined).toMatch(/拒绝跟随符号链接\/junction/);
    expect(joined).toContain(path.join('pk2', 'SKILL.md'));
  });

  it('混合场景:同根内真目录技能照常命中,只有链接那份被拒(拒绝不是整根误伤)', () => {
    const root = path.join(tmpDir, '.ihui', 'skills');
    fs.mkdirSync(path.join(root, 'good'), { recursive: true });
    fs.writeFileSync(path.join(root, 'good', 'SKILL.md'), SKILL_BODY('good-skill'));
    const outside = mkOutside();
    fs.writeFileSync(path.join(outside, 'SKILL.md'), SKILL_BODY('bad-skill'));
    link(outside, path.join(root, 'badlink'));
    const { names, notices } = scan(tmpDir);
    expect(names).toContain('good-skill');
    expect(names).not.toContain('bad-skill');
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain('badlink');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
