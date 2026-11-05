// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能清单磁盘缓存(端内消费者)—— 把 `@ihui/shared/skills/catalog-cache-schema` 的信封契约
 * 落到 `~/.ihui/skill-catalog-cache.json`,给"列出有哪些技能"这一条快路。
 *
 * 形态纪律取自 `../plugins/cache.ts`(本仓已验证过的那一族):落点走具名数据目录出口
 * (`getIhuiRoot()`,认 `IHUI_HOME`)、写盘走全仓唯一的原子写出口、降级必须带可诊断说明。
 * **不重写它、不 import 它的判据**。
 *
 * 与外部程序(`.skill-list-cache.json`)的两处不同(本票的超越点):
 *   ① scope 是自描述对象,不是字符串套字符串的定长位置编码 ⇒ 换机能点名"哪个字段对不上";
 *   ② "空"与"未判定"分档:缓存里 0 条必须带 `catalog-empty-stable` 具名件才算稳定态,
 *      否则一律 `unjudged`(AGENTS §0.3 —— 不得用空数组冒充"没有技能")。
 *
 * 缓存的是**清单**(名称/描述/来源/优先级),不含正文:正文由 `/skill <name>` 那一侧按需读,
 * 本模块不声称自己加速过正文加载(名字承诺不得大于实现)。
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  CATALOG_CACHE_SCHEMA_VERSION,
  CATALOG_EMPTY_STABLE,
  classifyCacheHit,
  decodeCatalogCacheEnvelope,
  encodeCatalogCacheEnvelope,
  fingerprintCatalogEntries,
  isCatalogDirty,
  type CatalogCacheEnvelope,
  type CatalogCacheScope,
  type CatalogCacheSignature,
  type CatalogCacheWatchPlan,
  type CatalogEntrySeed,
} from '@ihui/shared/skills/catalog-cache-schema';
import { getIhuiRoot } from '../plugins/paths.js';
import { captureWriteBaseline, commitAtomicWrite } from '../util/atomic-write.js';
import { findRepoRoot, loadSkills, type LoadSkillsOptions, type Skill } from './index.js';

/** 清单条目(可序列化;与 Skill 的差别只有 body)。 */
export interface SkillCatalogEntry {
  readonly name: string;
  readonly source: string;
  readonly description: string;
  readonly priority: number;
  readonly version?: string;
}

/**
 * `hit` = 时钟新鲜且探针不脏;`stale`/`unjudged`/`dirty` 都表示"本轮重建过",
 * 三者语义不同,不得并成一格(未判定 ≠ 过期 ≠ 内容变了)。
 */
export type SkillCatalogState = 'hit' | 'stale' | 'unjudged' | 'dirty';

export interface SkillCatalogOutcome {
  readonly entries: readonly SkillCatalogEntry[];
  readonly loadedFrom: 'cache' | 'scan';
  readonly state: SkillCatalogState;
  readonly notes: readonly string[];
  readonly signature: CatalogCacheSignature;
}

export interface SkillCatalogCacheOptions {
  readonly cwd: string;
  readonly repoRoot?: string;
  readonly includeUserHome?: boolean;
  /** 新鲜度窗口(默认 5 分钟,与插件市场缓存同一档)。 */
  readonly freshnessMs?: number;
  /** 缓存落点覆盖(测试注入用;缺省走 getIhuiRoot())。 */
  readonly cachePath?: string;
  readonly now?: () => number;
  readonly scan?: (opts: LoadSkillsOptions) => readonly Skill[];
  readonly onNotice?: (message: string) => void;
}

/** 默认新鲜度窗口:5 分钟(与技能目录变更的实际节奏同档,不是拍的整数)。 */
const DEFAULT_FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

/** 缓存文件落点(唯一实现;测试与诊断都只引用这里)。 */
export function skillCatalogCachePath(): string {
  return path.join(getIhuiRoot(), 'skill-catalog-cache.json');
}

/** 自描述 scope:四个具名字段恒有值,零空串占位。 */
export function skillCatalogScopeOf(opts: SkillCatalogCacheOptions): CatalogCacheScope {
  const projectDir = path.resolve(opts.cwd);
  return {
    projectDir,
    repoRoot: path.resolve(opts.repoRoot ?? findRepoRoot(projectDir)),
    userHomeDir: os.homedir(),
    includeUserHome: opts.includeUserHome !== false,
  };
}

/** 条目更新时间 = 源文件 mtime(只 stat,不读正文:这就是"廉价"那一档)。取不到 ⇒ undefined ⇒ 由签名计进 missing。 */
function updatedAtOf(source: string): number | undefined {
  try {
    return fs.statSync(source).mtimeMs;
  } catch {
    return undefined;
  }
}

/**
 * 签名的输入(唯一一份构造路径):缓存侧与探针侧都走它,token 形状才会逐字相同。
 * 两侧若各构造一次,一条"缓存里的 version 没进 token"就足以让每次探针都判脏 —— 缓存永远用不上。
 */
function seedsOf(entries: readonly SkillCatalogEntry[]): CatalogEntrySeed[] {
  return entries.map((e) => ({ name: e.name, version: e.version, updatedAt: updatedAtOf(e.source) }));
}

function watchPlanOf(sources: readonly string[]): CatalogCacheWatchPlan {
  const dirs = new Set<string>();
  for (const s of sources) dirs.add(path.dirname(s));
  return { dirs: Array.from(dirs).sort(), files: [...sources].sort() };
}

function toEntries(skills: readonly Skill[]): SkillCatalogEntry[] {
  return skills.map((s) => ({
    name: s.name,
    source: s.source,
    description: s.description,
    priority: s.priority,
    version: s.frontmatter?.version,
  }));
}

function readRaw(cachePath: string): string | null {
  try {
    return fs.readFileSync(cachePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * 读清单(唯一入口):缓存命中直接返回清单;否则扫盘重建并回写。
 * 三态各有**一条**可读日志,且日志只说量出来的东西(命中说年龄、降级说原因、未判定点名缺哪格)。
 */
export function readSkillCatalog(opts: SkillCatalogCacheOptions): SkillCatalogOutcome {
  const now = (opts.now ?? Date.now)();
  const freshnessMs = opts.freshnessMs ?? DEFAULT_FRESHNESS_WINDOW_MS;
  const cachePath = opts.cachePath ?? skillCatalogCachePath();
  const scope = skillCatalogScopeOf(opts);
  const notes: string[] = [];
  const say = (line: string): void => {
    notes.push(line);
    try {
      (opts.onNotice ?? ((m: string) => console.warn(m)))(line);
    } catch {
      // 报名通道不可用不改判据结论
    }
  };

  const raw = readRaw(cachePath);
  const decoded = raw === null ? null : decodeCatalogCacheEnvelope<SkillCatalogEntry>(raw);
  if (raw !== null && decoded && !decoded.ok) {
    say(`[skill-catalog] unjudged: envelope failed structural decode (${decoded.reasons.join('; ')}) — cache kept as-is at ${cachePath}`);
  }
  const envelope = decoded && decoded.ok ? decoded.envelope : null;
  const verdict = classifyCacheHit<SkillCatalogEntry>(envelope, now, freshnessMs, scope);

  let rebuildState: SkillCatalogState = 'unjudged';
  if (verdict.status === 'hit' && envelope) {
    const cached = envelope.results as readonly SkillCatalogEntry[];
    const live = fingerprintCatalogEntries(seedsOf(cached));
    const dirty = isCatalogDirty(envelope.signature, live);
    if (!dirty.dirty) {
      say(
        `[skill-catalog] cache hit: ${cached.length} entry(ies), age ${Math.round(verdict.ageMs / 1000)}s, `
          + `probe ok=${live.ok}/missing=${live.missing}, from ${cachePath}`,
      );
      return { entries: cached, loadedFrom: 'cache', state: 'hit', notes, signature: live };
    }
    rebuildState = 'dirty';
    say(`[skill-catalog] rescan: fresh by clock but dirty by probe (${dirty.reasons.join('; ')})`);
  } else if (verdict.status === 'unjudged') {
    rebuildState = 'unjudged';
    say(`[skill-catalog] unjudged: ${verdict.reasons.join('; ')} — an empty/absent cache is NOT reported as "no skills"`);
  } else {
    rebuildState = 'stale';
    say(`[skill-catalog] rescan: cache age ${Math.round(verdict.ageMs / 1000)}s > freshness ${Math.round(freshnessMs / 1000)}s`);
  }

  const skills = (opts.scan ?? ((o: LoadSkillsOptions) => loadSkills(o)))({
    cwd: scope.projectDir,
    repoRoot: scope.repoRoot,
  });
  const entries = toEntries(skills);
  const signature = fingerprintCatalogEntries(seedsOf(entries));
  const next: CatalogCacheEnvelope<SkillCatalogEntry> = {
    schemaVersion: CATALOG_CACHE_SCHEMA_VERSION,
    scope,
    savedAt: now,
    signature,
    watch: watchPlanOf(skills.map((s) => s.source)),
    results: entries,
    ...(entries.length === 0 ? { emptyMarker: CATALOG_EMPTY_STABLE } : {}),
  };
  try {
    commitAtomicWrite(captureWriteBaseline(cachePath), encodeCatalogCacheEnvelope(next));
    say(
      `[skill-catalog] written: ${entries.length} entry(ies) to ${cachePath} `
        + `(probe ok=${signature.ok}, missing=${signature.missing}${entries.length === 0 ? `, ${CATALOG_EMPTY_STABLE}` : ''})`,
    );
  } catch (e) {
    // 回写失败不影响本次清单:内容已经扫到了,只是下一轮还得再扫一次
    say(`[skill-catalog] write failed, serving this scan only: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { entries, loadedFrom: 'scan', state: rebuildState, notes, signature };
}

export const __test__ = { skillCatalogCachePath, skillCatalogScopeOf, watchPlanOf, seedsOf };
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
