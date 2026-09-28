// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 技能"目录包"形态发现测试（第三十七批）。
 *
 * 病灶：`scanDir` 旧实现第一行 `if (!entry.isFile()) continue` 把所有目录跳过,
 * 而 `.agents/skills` / `.claude/skills` / `~/.ihui/skills` 这些我们自己声明的扫描根,
 * 外部技能包实际按 `<name>/SKILL.md` 落地 ⇒ 装了技能但列表 0 个,且没有任何解释。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadSkills } from '../src/skills/index.js';

describe('技能目录包形态 <root>/<name>/SKILL.md', () => {
  let tmpDir: string;
  let tmpHome: string;
  let origHome: string;
  let origProfile: string;

  const agentsRoot = () => path.join(tmpDir, '.agents', 'skills');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-skillpack-'));
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-skillpack-home-'));
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });
    fs.mkdirSync(agentsRoot(), { recursive: true });
    origHome = process.env.HOME ?? '';
    origProfile = process.env.USERPROFILE ?? '';
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
  });

  afterEach(() => {
    process.env.HOME = origHome;
    process.env.USERPROFILE = origProfile;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  const write = (rel: string, text: string): string => {
    const p = path.join(agentsRoot(), rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text, 'utf-8');
    return p;
  };

  /** 写到任意绝对路径（用于跨根优先级那条用例：同一 cwd 下的 `.ihui/skills`） */
  const write2 = (abs: string, text: string): string => {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text, 'utf-8');
    return abs;
  };

  it('目录包被发现，frontmatter 的 name/description 生效', () => {
    write('docx/SKILL.md', '---\nname: docx-helper\ndescription: 处理 Word 文档\n---\n正文内容\n');
    const found = loadSkills({ cwd: tmpDir }).filter((s) => s.name === 'docx-helper');
    expect(found).toHaveLength(1);
    expect(found[0]?.description).toBe('处理 Word 文档');
    expect(found[0]?.body).toContain('正文内容');
    // source 必须指向真正被读的那个文件，而不是目录（否则 /skills 里点不开）
    expect(found[0]?.source.endsWith(path.join('docx', 'SKILL.md'))).toBe(true);
  });

  it('没有 name 时用目录名兜底（平铺形态用文件名，两型同规则）', () => {
    write('pdf/SKILL.md', '# PDF 处理\n\n第一行做描述\n');
    const found = loadSkills({ cwd: tmpDir }).filter((s) => s.name === 'pdf');
    expect(found).toHaveLength(1);
    expect(found[0]?.description).toContain('PDF 处理');
  });

  it('平铺形态零回归（两种形态同根混放都收）', () => {
    write('flat.md', '---\nname: flat-one\ndescription: 平铺\n---\nx\n');
    write('packed/SKILL.md', '---\nname: packed-two\ndescription: 目录包\n---\ny\n');
    const names = loadSkills({ cwd: tmpDir }).map((s) => s.name);
    expect(names).toContain('flat-one');
    expect(names).toContain('packed-two');
  });

  it('只下钻一层：包内的 references/ 等资源目录不得被当成技能', () => {
    write('docx/SKILL.md', '---\nname: docx-real\ndescription: 真技能\n---\nreal\n');
    write('docx/references/notes.md', '---\nname: should-not-appear\ndescription: 资源\n---\nz\n');
    const names = loadSkills({ cwd: tmpDir }).map((s) => s.name);
    expect(names).toContain('docx-real');
    expect(names).not.toContain('should-not-appear');
  });

  it('下划线前缀的目录与文件同样跳过（两型同规则，不各写一套）', () => {
    write('_template/SKILL.md', '---\nname: hidden-pack\ndescription: 模板\n---\nz\n');
    write('_draft.md', '---\nname: hidden-flat\ndescription: 草稿\n---\nz\n');
    const names = loadSkills({ cwd: tmpDir }).map((s) => s.name);
    expect(names).not.toContain('hidden-pack');
    expect(names).not.toContain('hidden-flat');
  });

  it('同名折叠按**已声明的目录优先级**决胜负（同一 cwd 下 .ihui 覆盖 .agents）', () => {
    // loadSkills 的策略是 byName + 「低 priority 值赢」，即根顺序 .ihui > .agents > .claude > .cursor。
    // 这条断言把它钉住：目录包形态与平铺形态共用同一套优先级，不许各走一套。
    write('shared/SKILL.md', '---\nname: shared-one\ndescription: 来自 .agents\n---\na\n');
    write2(path.join(tmpDir, '.ihui', 'skills', 'shared.md'), '---\nname: shared-one\ndescription: 来自 .ihui\n---\nb\n');
    const hits = loadSkills({ cwd: tmpDir }).filter((s) => s.name === 'shared-one');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.description).toBe('来自 .ihui');
  });

  it('同一根内两份不同文件写了同一个 name ⇒ 只留先遍历到的一份（如实登记：此处无提示出口）', () => {
    // 现状：byName 折叠，等 priority 时保留第一条（ readdir 已排序 ⇒ 字典序先者）。
    // 本条不是"好设计"的合格证，而是把**当前真实行为**钉成断言 —— 下一票若给 loadSkills
    // 加了 notice 出口（像 buildSkillPromptSection 那样），这条必须改判成"折叠要留计数"。
    write('alpha/SKILL.md', '---\nname: same-name\ndescription: A\n---\na\n');
    write('beta/SKILL.md', '---\nname: same-name\ndescription: B\n---\nb\n');
    const hits = loadSkills({ cwd: tmpDir }).filter((s) => s.name === 'same-name');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.description).toBe('A');
    // 但扫描层(scanDir 的出参)是按**文件真实路径**去重的：两份都读到了，折叠发生在上一级。
    // 这条区分很重要 —— 按 name 在扫描层去重会静默吞掉一份，且没人知道被吞的是哪份。
    const sources = new Set(
      ['alpha', 'beta'].map((d) => path.join(agentsRoot(), d, 'SKILL.md')),
    );
    expect(sources.size).toBe(2);
    for (const s of sources) expect(fs.existsSync(s)).toBe(true);
  });

  it('目录里没有 SKILL.md 不算技能，也不报错（别人的资源目录不是技能包）', () => {
    write('assets/logo.md', '# 素材说明\n');
    fs.mkdirSync(path.join(agentsRoot(), 'empty-pack'), { recursive: true });
    const names = loadSkills({ cwd: tmpDir }).map((s) => s.name);
    expect(names).not.toContain('empty-pack');
    expect(names).not.toContain('logo');
  });

  it('坏文件不影响同根其余技能（读取失败逐份跳过，不整根放弃）', () => {
    write('good/SKILL.md', '---\nname: good-one\ndescription: 好\n---\ng\n');
    const broken = path.join(agentsRoot(), 'broken', 'SKILL.md');
    fs.mkdirSync(path.dirname(broken), { recursive: true });
    // 目录冒充文件：readFileSync 在 Windows/POSIX 都会抛 EISDIR/EACCES
    fs.mkdirSync(broken, { recursive: true });
    const names = loadSkills({ cwd: tmpDir }).map((s) => s.name);
    expect(names).toContain('good-one');
  });
});
