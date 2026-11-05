// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 端内消费者用例:技能清单磁盘缓存(`apps/cli/src/skills/catalog-cache-store.ts`)。
 *
 * 三态各有**一条**可读日志;缓存命中时**不再扫盘**(scan 调用次数是这格的唯一硬证据);
 * 空清单走具名件、与"未判定"分档(AGENTS §0.3)。落点经 IHUI_HOME 换根,不碰真实 ~/.ihui。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Skill } from '../src/skills/index.js';
import { readSkillCatalog, skillCatalogCachePath, skillCatalogScopeOf } from '../src/skills/catalog-cache-store.js';

const BASE_NOW = 1_800_000_000_000;
const FRESHNESS = 60_000;

let tmpHome = '';
let tmpProject = '';
let skillFile = '';
let originalEnv: NodeJS.ProcessEnv = {};

function fakeSkill(name: string, source: string, version?: string): Skill {
  return {
    name,
    source,
    description: `${name} 的描述`,
    body: '正文不进缓存',
    priority: 0,
    frontmatter: version ? { name, version } : {},
  };
}

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cat-home-'));
  tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cat-proj-'));
  originalEnv = { ...process.env };
  process.env.IHUI_HOME = tmpHome;
  const dir = path.join(tmpProject, '.ihui', 'skills', 'alpha');
  fs.mkdirSync(dir, { recursive: true });
  skillFile = path.join(dir, 'SKILL.md');
  fs.writeFileSync(skillFile, '---\nname: alpha\n---\n正文\n', 'utf-8');
  fs.mkdirSync(path.join(tmpProject, '.git'), { recursive: true });
});

afterEach(() => {
  process.env = originalEnv;
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpProject, { recursive: true, force: true });
});

describe('落点', () => {
  it('走具名数据目录出口(认 IHUI_HOME),不是手拼 home', () => {
    expect(skillCatalogCachePath()).toBe(path.join(tmpHome, '.ihui', 'skill-catalog-cache.json'));
  });

  it('scope 四个具名字段恒有值,零空串占位', () => {
    const scope = skillCatalogScopeOf({ cwd: tmpProject });
    expect(Object.keys(scope).sort()).toEqual(['includeUserHome', 'projectDir', 'repoRoot', 'userHomeDir']);
    expect(Object.values(scope).some((v) => v === '')).toBe(false);
  });
});

describe('首次读:无缓存 ⇒ 未判定(不是"没有技能")', () => {
  it('state=unjudged ∧ 落盘一份信封 ∧ 一条日志', () => {
    let calls = 0;
    const out = readSkillCatalog({
      cwd: tmpProject,
      cachePath: skillCatalogCachePath(),
      now: () => BASE_NOW,
      scan: () => {
        calls += 1;
        return [fakeSkill('alpha', skillFile, '1.0.0')];
      },
      onNotice: () => {},
    });
    expect(out.state).toBe('unjudged');
    expect(out.loadedFrom).toBe('scan');
    expect(calls).toBe(1);
    expect(out.entries.map((e) => e.name)).toEqual(['alpha']);
    expect(out.signature.ok).toBe(1);
    expect(out.signature.missing).toBe(0);
    // 一态一条判定行 + 一条回写行
    expect(out.notes.filter((n) => n.includes('unjudged'))).toHaveLength(1);
    expect(out.notes.some((n) => n.includes('written'))).toBe(true);
    const saved = JSON.parse(fs.readFileSync(skillCatalogCachePath(), 'utf-8'));
    expect(saved.results).toHaveLength(1);
    expect(saved.emptyMarker).toBeUndefined();
    expect(saved.scope.userHomeDir).toBe(os.homedir());
    expect(saved.watch.files).toEqual([skillFile]);
    expect(saved.watch.dirs).toEqual([path.dirname(skillFile)]);
  });
});

describe('命中 / 判脏 / 过期 / 换机', () => {
  function seed(): void {
    readSkillCatalog({
      cwd: tmpProject,
      cachePath: skillCatalogCachePath(),
      now: () => BASE_NOW,
      freshnessMs: FRESHNESS,
      scan: () => [fakeSkill('alpha', skillFile, '1.0.0')],
      onNotice: () => {},
    });
  }

  it('时钟新鲜 + 探针不脏 ⇒ hit,且**不再扫盘**', () => {
    seed();
    let calls = 0;
    const out = readSkillCatalog({
      cwd: tmpProject,
      cachePath: skillCatalogCachePath(),
      now: () => BASE_NOW + 1_000,
      freshnessMs: FRESHNESS,
      scan: () => {
        calls += 1;
        return [fakeSkill('alpha', skillFile, '1.0.0')];
      },
      onNotice: () => {},
    });
    expect(out.state).toBe('hit');
    expect(out.loadedFrom).toBe('cache');
    expect(calls).toBe(0);
    expect(out.notes).toHaveLength(1);
    expect(out.notes[0]).toContain('cache hit');
  });

  it('源文件被改 ⇒ 判脏重建(判脏不猜 mtime 的"猜",而是量探针后重建)', () => {
    seed();
    const later = new Date(BASE_NOW + 30_000);
    fs.utimesSync(skillFile, later, later);
    let calls = 0;
    const out = readSkillCatalog({
      cwd: tmpProject,
      cachePath: skillCatalogCachePath(),
      now: () => BASE_NOW + 2_000,
      freshnessMs: FRESHNESS,
      scan: () => {
        calls += 1;
        return [fakeSkill('alpha', skillFile, '1.0.0')];
      },
      onNotice: () => {},
    });
    expect(out.state).toBe('dirty');
    expect(calls).toBe(1);
    expect(out.notes.join(' ')).toContain('dirty by probe');
  });

  it('超出新鲜窗口 ⇒ stale 重建', () => {
    seed();
    const out = readSkillCatalog({
      cwd: tmpProject,
      cachePath: skillCatalogCachePath(),
      now: () => BASE_NOW + FRESHNESS + 1,
      freshnessMs: FRESHNESS,
      scan: () => [fakeSkill('alpha', skillFile, '1.0.0')],
      onNotice: () => {},
    });
    expect(out.state).toBe('stale');
    expect(out.loadedFrom).toBe('scan');
    expect(out.notes.join(' ')).toContain('rescan');
  });

  it('换项目目录(scope 字段变)⇒ 判不命中并点名 projectDir', () => {
    seed();
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cat-other-'));
    try {
      const out = readSkillCatalog({
        cwd: other,
        cachePath: skillCatalogCachePath(),
        now: () => BASE_NOW + 1_000,
        freshnessMs: FRESHNESS,
        scan: () => [],
        onNotice: () => {},
      });
      expect(out.state).toBe('unjudged');
      expect(out.notes.join(' ')).toContain('projectDir');
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it('includeUserHome 翻转同样判不命中(scope 不是可忽略的装饰)', () => {
    seed();
    const out = readSkillCatalog({
      cwd: tmpProject,
      includeUserHome: false,
      cachePath: skillCatalogCachePath(),
      now: () => BASE_NOW + 1_000,
      freshnessMs: FRESHNESS,
      scan: () => [fakeSkill('alpha', skillFile, '1.0.0')],
      onNotice: () => {},
    });
    expect(out.state).toBe('unjudged');
    expect(out.notes.join(' ')).toContain('includeUserHome');
  });

  it('缓存文件坏 JSON ⇒ 未判定并点名,回写自愈成新信封', () => {
    seed();
    fs.writeFileSync(skillCatalogCachePath(), '{truncated', 'utf-8');
    const out = readSkillCatalog({
      cwd: tmpProject,
      cachePath: skillCatalogCachePath(),
      now: () => BASE_NOW + 1_000,
      freshnessMs: FRESHNESS,
      scan: () => [fakeSkill('alpha', skillFile, '1.0.0')],
      onNotice: () => {},
    });
    expect(out.state).toBe('unjudged');
    expect(out.notes.join(' ')).toContain('json unreadable');
    const healed = JSON.parse(fs.readFileSync(skillCatalogCachePath(), 'utf-8'));
    expect(healed.results).toHaveLength(1);
    expect(healed.scope.projectDir).toBe(path.resolve(tmpProject));
  });
});

describe('空清单 = 稳定态', () => {
  it('扫到 0 条 ⇒ 落具名件,下一轮 hit 且条目为 0(不是未判定)', () => {
    const scan = () => [];
    const first = readSkillCatalog({ cwd: tmpProject, cachePath: skillCatalogCachePath(), now: () => BASE_NOW, freshnessMs: FRESHNESS, scan, onNotice: () => {} });
    expect(first.state).toBe('unjudged');
    const saved = JSON.parse(fs.readFileSync(skillCatalogCachePath(), 'utf-8'));
    expect(saved.results).toEqual([]);
    expect(saved.emptyMarker).toBe('catalog-empty-stable');

    const second = readSkillCatalog({ cwd: tmpProject, cachePath: skillCatalogCachePath(), now: () => BASE_NOW + 1_000, freshnessMs: FRESHNESS, scan, onNotice: () => {} });
    expect(second.state).toBe('hit');
    expect(second.entries).toEqual([]);
    expect(second.notes.join(' ')).toContain('cache hit: 0');
  });
});

describe('探针取不到 ⇒ 永不冒充命中', () => {
  it('缓存里的源文件被删 ⇒ stat 失败进 missing ⇒ 判脏重建', () => {
    readSkillCatalog({
      cwd: tmpProject,
      cachePath: skillCatalogCachePath(),
      now: () => BASE_NOW,
      freshnessMs: FRESHNESS,
      scan: () => [fakeSkill('alpha', skillFile, '1.0.0')],
      onNotice: () => {},
    });
    fs.rmSync(skillFile);
    let calls = 0;
    const out = readSkillCatalog({
      cwd: tmpProject,
      cachePath: skillCatalogCachePath(),
      now: () => BASE_NOW + 1_000,
      freshnessMs: FRESHNESS,
      scan: () => {
        calls += 1;
        return [];
      },
      onNotice: () => {},
    });
    expect(out.state).toBe('dirty');
    expect(calls).toBe(1);
    // 判脏的证据是"探针里有 1 格量不到"(写进日志),回写的信封则是干净的空清单
    expect(out.notes.join(' ')).toContain('unread probe');
    expect(out.signature).toEqual({ ok: 0, missing: 0, sum: 0, xor: 0 });
    const saved = JSON.parse(fs.readFileSync(skillCatalogCachePath(), 'utf-8'));
    expect(saved.results).toEqual([]);
    expect(saved.emptyMarker).toBe('catalog-empty-stable');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
