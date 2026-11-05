// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal-b49 W4 装车票用例(2026-11-05):`readSkillCatalog` 挂上 `/skills` 真实消费点。
 *
 * 钉死四格:
 *  ① **装车证明** —— 从分发口(`handleSlashCommand`)打进去,量 `readSkillCatalog` 真被调到
 *     (只测被调函数等于没证明这条命令会走到那一格,AGENTS §0.9);spy 一律 `importOriginal`
 *     后原样转发,不改判据、不复算(§0.6/§22c)。
 *  ② 缓存失效 ⇒ 重算 **且把失效因念出来**:时钟新鲜但探针判脏 ⇒ `dirty by probe`;
 *     换工作区 ⇒ `scope mismatch on: <具名字段>`(点名是哪一格对不上,本票的超越轴)。
 *  ③ scope 四字段原样上展示面(缺一格就等于退回外部程序那种位置编码)。
 *  ④ 正向对照:命中态**不得**出现 unjudged/rescan/failed 任何一行 —— 否则①②的"没噪声"只是没接上。
 *  ⑤ 空清单走具名件 `catalog-empty-stable`,与"未判定"分档(§0.3:不得用空数组冒充"没有技能")。
 *
 * 夹具落点 = §15b/§26 唯一出口 `mkScratch`(禁 os.tmpdir/裸 mkdtemp);
 * `IHUI_HOME` 换缓存根,`USERPROFILE`/`HOME` 换 `os.homedir()` 以隔离用户全局技能面 ⇒ 不碰真实 ~/.ihui。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as readline from 'node:readline';
import type * as CatalogCacheStoreModule from '../src/skills/catalog-cache-store.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const probe = vi.hoisted(() => ({ catalogReads: 0 }));
vi.mock('../src/skills/catalog-cache-store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof CatalogCacheStoreModule>();
  return {
    ...actual,
    readSkillCatalog: (opts: Parameters<typeof actual.readSkillCatalog>[0]) => {
      probe.catalogReads += 1;
      return actual.readSkillCatalog(opts);
    },
  };
});

import { Command } from 'commander';
import { handleSlashCommand, type ReplState } from '../src/commands/repl.js';
import { registerSkillsListCommand, showSkillsCatalog } from '../src/commands/skills-catalog-view.js';
import { skillCatalogCachePath } from '../src/skills/catalog-cache-store.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §15b/§26 唯一落点(禁 os.tmpdir/裸 mkdtemp);属测试面而非生产依赖边

let home = '';
let project = '';
let skillFile = '';
let originalEnv: NodeJS.ProcessEnv = {};
let emitted: string[] = [];

/** 目录形态技能(与 `catalog-cache-store.test.ts` 同一形态),返回源文件路径供 mtime 探针用。 */
function writeSkill(dir: string, name: string): string {
  const fileDir = path.join(dir, '.ihui', 'skills', name);
  fs.mkdirSync(fileDir, { recursive: true });
  const file = path.join(fileDir, 'SKILL.md');
  fs.writeFileSync(file, `---\nname: ${name}\ndescription: ${name} fixture description\n---\nbody\n`, 'utf-8');
  return file;
}

/** 走展示口的缺省 console 面(REPL 分支不注入 onLine,所以这一格必须量得到 stdout 行)。 */
function collectConsole(): void {
  emitted = [];
  vi.spyOn(console, 'info').mockImplementation((...a: unknown[]) => {
    emitted.push(a.map((x) => String(x)).join(' '));
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
}

function linesThroughView(cwd: string): string[] {
  const out: string[] = [];
  showSkillsCatalog({ cwd, onLine: (line: string) => out.push(line) });
  return out;
}

const noiseMatchers = ['unjudged', 'rescan', 'write failed', 'threw'] as const;

beforeEach(() => {
  originalEnv = { ...process.env };
  home = mkScratch('w4-cat-home-');
  project = mkScratch('w4-cat-proj-');
  fs.mkdirSync(path.join(project, '.git'), { recursive: true });
  skillFile = writeSkill(project, 'alpha');
  process.env.IHUI_HOME = home;
  process.env.USERPROFILE = home;
  process.env.HOME = home;
  probe.catalogReads = 0;
  collectConsole();
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = originalEnv;
  rmScratch(home);
  rmScratch(project);
});

describe('① 装车证明:REPL /skills 分发口真走到 readSkillCatalog', () => {
  it('handleSlashCommand("/skills") 调 readSkillCatalog 一次并把读数与条目打到 stdout', async () => {
    const state = { opts: { workspacePath: project } } as unknown as ReplState;
    const rl = { close: () => {} } as unknown as readline.Interface;
    await handleSlashCommand('/skills', state, rl);

    expect(probe.catalogReads).toBe(1);
    expect(emitted.some((l) => l.includes('alpha'))).toBe(true);
    expect(emitted.some((l) => l.includes('[skill-catalog]'))).toBe(true);
    // 首屏之后缓存必须真落盘(否则"读缓存"只是话)
    expect(fs.existsSync(skillCatalogCachePath())).toBe(true);
  });
});

describe('② 缓存失效:重算并把失效因念出来', () => {
  it('时钟新鲜 ∧ 探针判脏 ⇒ 出声 "dirty by probe" 并重建', () => {
    linesThroughView(project); // 建缓存
    expect(linesThroughView(project).some((l) => l.includes('cache hit'))).toBe(true);

    const bumped = new Date(Date.now() + 60_000);
    fs.utimesSync(skillFile, bumped, bumped);
    const third = linesThroughView(project);
    expect(third.some((l) => l.includes('rescan') && l.includes('dirty by probe'))).toBe(true);
  });

  it('换工作区 ⇒ 出声 unjudged 并**点名对不上的具名 scope 字段**', () => {
    linesThroughView(project);
    const other = mkScratch('w4-cat-proj2-');
    fs.mkdirSync(path.join(other, '.git'), { recursive: true });
    const out = linesThroughView(other);
    try {
      expect(out.some((l) => l.includes('unjudged') && l.includes('scope mismatch on:'))).toBe(true);
      expect(out.some((l) => l.includes('scope mismatch on: ') && l.includes('projectDir'))).toBe(true);
    } finally {
      rmScratch(other);
    }
  });
});

describe('③ scope 自描述字段带到展示面', () => {
  it('四字段逐格可见,值取自已有的唯一 scope 构造出口', () => {
    const out = linesThroughView(project);
    const scopeLine = out.find((l) => l.includes('scope: projectDir='));
    expect(scopeLine).toBeDefined();
    for (const field of ['projectDir=', 'repoRoot=', 'userHomeDir=', 'includeUserHome=']) {
      expect(scopeLine ?? '').toContain(field);
    }
    expect(scopeLine ?? '').toContain(path.resolve(project));
  });
});

describe('④ 正向对照:正常命中态不出噪声', () => {
  it('第二轮只有 hit 一行读数,四类噪声行一条都不出现', () => {
    linesThroughView(project);
    const second = linesThroughView(project);
    expect(second.filter((l) => l.includes('cache hit'))).toHaveLength(1);
    for (const noise of noiseMatchers) {
      expect(second.filter((l) => l.includes(noise))).toEqual([]);
    }
  });
});

describe('⑤ 空清单与未判定分档(§0.3)', () => {
  it('空工作区 ⇒ 写具名件、第二轮走稳定空态并给目录提示,不冒充"未判定"', () => {
    const empty = mkScratch('w4-cat-empty-');
    fs.mkdirSync(path.join(empty, '.git'), { recursive: true });
    try {
      const first = linesThroughView(empty);
      expect(first.some((l) => l.includes('catalog-empty-stable'))).toBe(true);
      const second = linesThroughView(empty);
      expect(second.some((l) => l.includes('cache hit: 0 entry'))).toBe(true);
      expect(second.some((l) => l.includes('.ihui/skills/'))).toBe(true);
      for (const noise of noiseMatchers) {
        expect(second.filter((l) => l.includes(noise))).toEqual([]);
      }
    } finally {
      rmScratch(empty);
    }
  });
});

describe('⑥ 两处出口同形:REPL /skills 与 CLI skills list 共用一份格式化与缓存', () => {
  /** 走 commander 真分发口(`skills list`);注册体与生产 `index.ts` 挂的是同一个。 */
  async function linesThroughCli(cwd: string): Promise<string[]> {
    emitted = [];
    const program = new Command();
    registerSkillsListCommand(program.command('skills'), { resolveCwd: () => cwd });
    await program.parseAsync(['node', 'ihui', 'skills', 'list']);
    return [...emitted];
  }

  /** 走 REPL 的 `/skills` 分发口。 */
  async function linesThroughRepl(cwd: string): Promise<string[]> {
    emitted = [];
    const state = { opts: { workspacePath: cwd } } as unknown as ReplState;
    const rl = { close: () => {} } as unknown as readline.Interface;
    await handleSlashCommand('/skills', state, rl);
    return [...emitted];
  }

  it('同一夹具 ∧ 同一冷缓存态 ⇒ 两条路径的输出行逐字相等', async () => {
    fs.rmSync(skillCatalogCachePath(), { force: true });
    const viaCli = await linesThroughCli(project);
    fs.rmSync(skillCatalogCachePath(), { force: true });
    const viaRepl = await linesThroughRepl(project);

    expect(viaCli.length).toBeGreaterThan(0);
    expect(viaCli.some((l) => l.includes('alpha'))).toBe(true);
    expect(viaRepl).toEqual(viaCli);
  });

  it('共用同一份缓存:CLI 那一轮落盘,REPL 下一轮必须命中同一个缓存文件(不是各自扫盘)', async () => {
    fs.rmSync(skillCatalogCachePath(), { force: true });
    await linesThroughCli(project);
    expect(fs.existsSync(skillCatalogCachePath())).toBe(true);
    const viaRepl = await linesThroughRepl(project);
    expect(viaRepl.some((l) => l.includes('cache hit: 1 entry'))).toBe(true);
  });

  it('index.ts 只挂命令:skills 组到 show 之前不得再直调 loadSkills(口径只有一份)', () => {
    const entrySrc = fs.readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    const groupStart = entrySrc.indexOf("program.command('skills')");
    const showStart = entrySrc.indexOf("command('show <name>')");
    expect(groupStart).toBeGreaterThan(-1);
    expect(showStart).toBeGreaterThan(groupStart);
    const group = entrySrc.slice(groupStart, showStart);
    expect(group).toContain('registerSkillsListCommand(skillsCmd)');
    expect(group).not.toContain('loadSkills(');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
