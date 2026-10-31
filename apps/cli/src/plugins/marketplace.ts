// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plugins Marketplace 索引解析 — 读取 marketplace.json 并提供插件查找/类型守卫。
 *
 * 灵感来源:参考行业 Agent 框架的 .ihui-plugin/marketplace.json + Claude Code 的 .claude-plugin/。
 * 设计:
 *   - 三态 source:相对路径字符串 / { type: 'local', path } / { source: 'url', url, ref?, sha?, path? }
 *   - scanMarketplace 按优先级查找索引文件:.ihui-plugin > .claude-plugin > 根
 *   - findPluginInIndex 按 name 匹配,可选 qualifier(tags/keywords/domains/category 别名)
 *   - 类型守卫 isLocalSource / isGitSource 便于 installer 分流
 *
 * 索引文件格式:
 *   {
 *     "name": "my-marketplace",
 *     "owner": { "name": "alice" },
 *     "plugins": [
 *       { "name": "foo", "source": "./plugins/foo" },
 *       { "name": "bar", "source": { "type": "local", "path": "./plugins/bar" } },
 *       { "name": "baz", "source": { "source": "url", "url": "https://github.com/x/baz.git" } }
 *     ]
 *   }
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getInstalledPluginsDir } from './paths.js';

/** Marketplace 索引根结构 */
export interface MarketplaceIndex {
  name: string;
  owner?: { name: string };
  plugins: MarketplacePluginEntry[];
}

/** Marketplace 单个插件条目 */
export interface MarketplacePluginEntry {
  name: string;
  version?: string;
  description?: string;
  category?: string;
  /** 三态来源:相对路径字符串 / 本地对象 / Git URL 对象 */
  source: MarketplaceSource;
  tags?: string[];
  keywords?: string[];
  domains?: string[];
}

/**
 * 三态插件来源:
 *   - string:相对路径(如 './plugins/foo')
 *   - { type: 'local', path: string }:显式本地路径
 *   - { source: 'url', url, ref?, sha?, path? }:Git URL
 */
export type MarketplaceSource =
  | string
  | { type: 'local'; path: string }
  | { source: 'url'; url: string; ref?: string; sha?: string; path?: string };

/** scanMarketplace 返回结构 */
export interface MarketplaceScan {
  found: boolean;
  index?: MarketplaceIndex;
  /** 命中时为索引文件路径;未找到为空字符串;损坏时为损坏文件路径 */
  indexPath: string;
}

/** 候选索引文件相对路径(按优先级排序,前者优先) */
const CANDIDATE_PATHS: readonly (readonly string[])[] = [
  ['.ihui-plugin', 'marketplace.json'],
  ['.claude-plugin', 'marketplace.json'],
  ['marketplace.json'],
];

/** 校验解析对象是否符合 MarketplaceIndex 最小约束 */
function isValidIndex(obj: unknown): obj is MarketplaceIndex {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.name !== 'string' || o.name.length === 0) return false;
  if (!Array.isArray(o.plugins)) return false;
  return true;
}

/**
 * 扫描 marketplace 根目录,按优先级查找并解析索引文件。
 *
 * 优先级:.ihui-plugin/marketplace.json > .claude-plugin/marketplace.json > 根 marketplace.json
 *
 * 返回:
 *   - 命中且解析成功:{ found: true, index, indexPath }
 *   - 未找到任何候选:{ found: false, indexPath: '' }
 *   - 候选存在但损坏:{ found: false, indexPath: '<损坏文件路径>' }
 */
export function scanMarketplace(root: string): MarketplaceScan {
  for (const segments of CANDIDATE_PATHS) {
    const p = path.join(root, ...segments);
    if (!fs.existsSync(p)) continue;
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      if (isValidIndex(parsed)) {
        return { found: true, index: parsed, indexPath: p };
      }
      // 校验失败视为损坏
      return { found: false, indexPath: p };
    } catch {
      // JSON 解析异常视为损坏
      return { found: false, indexPath: p };
    }
  }
  return { found: false, indexPath: '' };
}

/**
 * 在索引中按 name 查找插件条目,可选 qualifier 限定别名。
 *
 * qualifier 匹配规则:与 plugin 的 tags/keywords/domains/category 任一匹配则命中。
 * 不传 qualifier 时按 name 精确匹配返回首个。
 */
export function findPluginInIndex(
  index: MarketplaceIndex,
  name: string,
  qualifier?: string,
): MarketplacePluginEntry | undefined {
  for (const p of index.plugins) {
    if (p.name !== name) continue;
    if (!qualifier) return p;
    // 收集所有别名
    const aliases: string[] = [];
    if (Array.isArray(p.tags)) aliases.push(...p.tags);
    if (Array.isArray(p.keywords)) aliases.push(...p.keywords);
    if (Array.isArray(p.domains)) aliases.push(...p.domains);
    if (typeof p.category === 'string') aliases.push(p.category);
    if (aliases.includes(qualifier)) return p;
  }
  return undefined;
}

/** 类型守卫:source 是本地(相对路径字符串或 { type: 'local' }) */
export function isLocalSource(s: MarketplaceSource): s is string | { type: 'local'; path: string } {
  if (typeof s === 'string') return true;
  if (s && typeof s === 'object' && 'type' in s && (s as { type: unknown }).type === 'local') return true;
  return false;
}

/**
 * 类型守卫:source 是 Git URL({ source: 'url', url })。
 *
 * G-786 扩了这一条守卫的**形态判定**:`url` 必须是非空字符串。旧实现只判 `source === 'url'`,
 * 于是 manifest 里 `"url":123` / `"url":""` 都能通过守卫并一路流到 `cache.ts::performClone` 的 argv
 * (空串在位置参数位上是"没有仓库却像有",非字符串则在 execFileSync 里炸成无归属的 TypeError)。
 *
 * **这里刻意不判 scheme 白名单**,不是漏掉:守卫在 `installer.ts::installFromMarketplaceEntry` 里
 * 承担的是**分流**职责(false 会落到 `未知的 source 类型` 分支)。若按 scheme 在这一层拒绝,恶意条目
 * 虽然照样不会被 clone,但结构化 `reasonCode` 会被降级成一句拼出来的文案 —— 而 AGENTS 与本仓守门
 * 67/135 反复记过"流程判断不得依赖错误文案"。形状白名单问责点收敛在 clone 的唯一咽喉点
 * (`cache.ts::performClone` → `assertGitCloneInputs`),它同时覆盖"直接调 installPlugin(url)"这条
 * 不经 marketplace 的入口,所以判一遍就够,且两处共用同一份实现。
 */
export function isGitSource(s: MarketplaceSource): s is { source: 'url'; url: string; ref?: string; sha?: string; path?: string } {
  if (!s || typeof s !== 'object') return false;
  if (!('source' in s)) return false;
  if ((s as { source: unknown }).source !== 'url') return false;
  const url = (s as { url?: unknown }).url;
  return typeof url === 'string' && url.length > 0;
}

// ==================== G-22 autoUpdate:市场登记面(只读判据) ====================

/**
 * 市场登记台账的文件名 —— 与安装台账 `registry.json` 同盘(`~/.ihui/installed-plugins/`)。
 *
 * 立的因(对照程序一手事实,取证册 T3 §G-22 / T7):Qoder CN 的用户态插件面把
 * 「装了谁」(`installed_plugins.json` / `installed_plugins_v2.json`)与「从哪些市场装」
 * (`known_marketplaces.json`,携 `autoUpdate`)分成两本台账。本仓只有前者
 * (`registry.json` ← `installer.ts` 写的 `InstallRecord`),后者结构上不存在 ⇒
 * "这个插件在市场里的新版本能不能安全落"这一问**没有输入**(§0.3:没输入不能编结论)。
 *
 * ⚠ **本席只写"读"这一半**:文件不存在 ⇒ `marketplace-registry-file-absent` ⇒ 全部候选
 * 落 `unjudged` 并点名缺这一枚输入。**写它(登记市场)属 `--apply` 那张后续票**,
 * 因为落台账要接 `git-guardian` 的写锁与 `safe-commit` 五步法,不在本席射程(见交付报告)。
 *
 * 形状(唯一契约,读侧即此,不另立第二份):
 *   { "version": 1, "marketplaces": [ { "name": "…", "root": "本地检出根", "url": "…", "ref": "…" } ] }
 */
export const MARKETPLACE_REGISTRY_FILENAME = 'marketplaces.json';

/** 市场登记台账的绝对路径(取值序交给 `paths.ts::getInstalledPluginsDir`,这里不另算 home) */
export function getMarketplaceRegistryPath(): string {
  return path.join(getInstalledPluginsDir(), MARKETPLACE_REGISTRY_FILENAME);
}

/** 已登记市场的一条 */
export interface RegisteredMarketplace {
  name: string;
  /** 市场索引的本地检出根(含 `.ihui-plugin/marketplace.json` 等);缺省 ⇒ 该枚无从解析条目 */
  root?: string;
  /** 登记时声明的远端(只用于与 `InstallRecord.sourceUrl` 对账点名;本席不据此发任何 git 动作) */
  url?: string;
  ref?: string;
}

/** 市场登记面的读取结论(三态:读到 / 读不到 / 显式注入) */
export interface RegisteredMarketplacesOutcome {
  ok: boolean;
  /** 读不到时恒为 `[]`(不用"半份清单"冒充清单;半份 = 少枚举的那几枚会被读成"没登记") */
  marketplaces: RegisteredMarketplace[];
  source: 'explicit' | 'registry-file' | 'absent';
  /** `ok:false` 时必非空:点名是哪一枚输入取不到(§0.3) */
  reason?: string;
  file?: string;
  detail?: string;
}

/** 市场登记台账的合法形状:一条不合规 ⇒ 整面判"形状坏",不静默丢条目 */
function parseRegisteredMarketplaces(raw: unknown): { ok: true; marketplaces: RegisteredMarketplace[] } | { ok: false; detail: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, detail: '根不是对象' };
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.marketplaces)) return { ok: false, detail: '缺 marketplaces 数组' };
  const out: RegisteredMarketplace[] = [];
  for (const [i, item] of (o.marketplaces as unknown[]).entries()) {
    if (!item || typeof item !== 'object') return { ok: false, detail: `marketplaces[${i}] 不是对象` };
    const m = item as Record<string, unknown>;
    if (typeof m.name !== 'string' || m.name.trim() === '') return { ok: false, detail: `marketplaces[${i}].name 缺失` };
    // 名字要能当文件名用:与 `check-plugin-manifest-integrity.mjs` 的 usableRecordName 同一红线
    // (目录穿越防护),但**判据不复制**:这里只拦分隔符/相对形态,越界形态由安装面那侧的门兜。
    if (/[/\\]/.test(m.name) || m.name === '.' || m.name === '..') {
      return { ok: false, detail: `marketplaces[${i}].name 不是合法目录名` };
    }
    const entry: RegisteredMarketplace = { name: m.name };
    if (m.root !== undefined && m.root !== null) {
      if (typeof m.root !== 'string' || m.root.trim() === '') return { ok: false, detail: `marketplaces[${i}].root 不是非空字符串` };
      entry.root = m.root;
    }
    if (typeof m.url === 'string' && m.url.length > 0) entry.url = m.url;
    if (typeof m.ref === 'string' && m.ref.length > 0) entry.ref = m.ref;
    out.push(entry);
  }
  return { ok: true, marketplaces: out };
}

/**
 * 读市场登记台账 —— **只读,永不写盘、永不创建**(本席的射程边界)。
 *
 * 三条失效方向都点名(§0.3):文件不存在 / 读不动 / 形状坏,各自独立 `reason`;
 * 任何一条都交回 `marketplaces: []`,调用方据此把候选判成 `unjudged`,
 * **绝不允许把"没登记"读成"没有更新"**。
 */
export function loadRegisteredMarketplaces(opts: { file?: string } = {}): RegisteredMarketplacesOutcome {
  const file = opts.file ?? getMarketplaceRegistryPath();
  if (!fs.existsSync(file)) {
    return {
      ok: false,
      marketplaces: [],
      source: 'absent',
      reason: 'marketplace-registry-file-absent',
      file,
    };
  }
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf-8');
  } catch (e) {
    return {
      ok: false,
      marketplaces: [],
      source: 'absent',
      reason: 'marketplace-registry-unreadable',
      file,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      marketplaces: [],
      source: 'absent',
      reason: 'marketplace-registry-json-invalid',
      file,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
  const verdict = parseRegisteredMarketplaces(parsed);
  if (!verdict.ok) {
    return { ok: false, marketplaces: [], source: 'absent', reason: 'marketplace-registry-malformed', file, detail: verdict.detail };
  }
  // 枚举到 0 条登记 ≠ "这一面判过了":台账在但空的门面无从对账 ⇒ 与"文件不存在"同一档失效方向。
  if (verdict.marketplaces.length === 0) {
    return { ok: false, marketplaces: [], source: 'absent', reason: 'marketplace-registry-empty', file };
  }
  return { ok: true, marketplaces: verdict.marketplaces, source: 'registry-file', file };
}

/** 把调用方显式给出的市场根包成同一份结论形态(CLI `--marketplace` 用;不落任何盘) */
export function explicitMarketplaces(roots: readonly string[]): RegisteredMarketplacesOutcome {
  const marketplaces = roots.map((root, i) => ({ name: path.basename(path.resolve(root)) || `marketplace-${i + 1}`, root }));
  if (marketplaces.length === 0) {
    return { ok: false, marketplaces: [], source: 'absent', reason: 'marketplace-explicit-list-empty' };
  }
  return { ok: true, marketplaces, source: 'explicit' };
}

/** 条目解析的结论(每一条都自带"缺了哪个输入"的点名,不存在无声失败) */
export type MarketplaceEntryResolution =
  | { state: 'found'; marketplace: RegisteredMarketplace; entry: MarketplacePluginEntry }
  | { state: 'not-registered'; missingInput: string }
  | { state: 'index-unavailable'; missingInput: string; tried: string[] }
  | { state: 'entry-missing'; missingInput: string; scanned: string[] }
  | { state: 'entry-ambiguous'; missingInput: string; candidates: string[] }
  | { state: 'entry-not-git'; missingInput: string; marketplace: string }
  | { state: 'source-mismatch'; missingInput: string; marketplace: string };

/**
 * 在**已登记**的市场里解析某条安装记录对应的索引条目。
 *
 * 复用既有出口 `scanMarketplace` + `findPluginInIndex` + `isGitSource`(§0.6:索引解析只此一份),
 * 本函数只做"归属与可用性"这一层判定。三条硬规矩:
 *   1. 没有任何已登记市场 ⇒ `not-registered`(绝不返回"没更新");
 *   2. 同一枚插件在多枚市场里都有条目且声明的 URL 不一致 ⇒ `entry-ambiguous`(不猜哪一个是源头);
 *   3. 索引条目声明的 URL 与安装记录的 `sourceUrl` 对不上 ⇒ `source-mismatch`
 *      —— 对不上就是"不知道这个市场说的是不是同一个源",拿它当更新源是猜。
 */
export function resolveMarketplaceEntryForRecord(
  record: { name: string; sourceUrl?: string },
  marketplaces: readonly RegisteredMarketplace[],
): MarketplaceEntryResolution {
  if (marketplaces.length === 0) {
    return { state: 'not-registered', missingInput: 'marketplace-not-registered' };
  }
  const hits: Array<{ marketplace: RegisteredMarketplace; entry: MarketplacePluginEntry }> = [];
  const tried: string[] = [];
  const scanned: string[] = [];
  for (const m of marketplaces) {
    if (!m.root) {
      tried.push(`${m.name}(无本地检出根)`);
      continue;
    }
    const scan = scanMarketplace(m.root);
    if (!scan.found || !scan.index) {
      tried.push(`${m.name}(${scan.indexPath || '索引不存在或已损坏'})`);
      continue;
    }
    scanned.push(m.name);
    const entry = findPluginInIndex(scan.index, record.name);
    if (entry) hits.push({ marketplace: m, entry });
  }
  if (hits.length === 0) {
    if (tried.length > 0 && scanned.length === 0) {
      return { state: 'index-unavailable', missingInput: 'marketplace-index-unavailable', tried };
    }
    return { state: 'entry-missing', missingInput: 'plugin-not-in-registered-marketplace', scanned };
  }
  if (hits.length > 1) {
    const urls = new Set(hits.map((h) => normalizeGitUrl(marketplaceSourceUrl(h.entry.source))));
    if (urls.size > 1) {
      return {
        state: 'entry-ambiguous',
        missingInput: 'marketplace-entry-ambiguous-url',
        candidates: hits.map((h) => `${h.marketplace.name}:${String(record.name)}`),
      };
    }
  }
  const hit = hits[0]!;
  if (!isGitSource(hit.entry.source)) {
    return { state: 'entry-not-git', missingInput: 'marketplace-entry-not-git-source', marketplace: hit.marketplace.name };
  }
  if (typeof record.sourceUrl === 'string' && record.sourceUrl.length > 0) {
    if (normalizeGitUrl(record.sourceUrl) !== normalizeGitUrl(hit.entry.source.url)) {
      return { state: 'source-mismatch', missingInput: 'marketplace-url-differs-from-installed-source', marketplace: hit.marketplace.name };
    }
  }
  return { state: 'found', marketplace: hit.marketplace, entry: hit.entry };
}

/** URL 对账用的形态归一(只剥尾斜杠:那是同一个仓库的两种写法,不是两个源) */
function normalizeGitUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\/+$/, '');
}

/** 从三态 source 里取"能当 URL 对账用的那一串"(相对路径/本地对象没有 URL ⇒ 空串,由调用方分档) */
function marketplaceSourceUrl(source: MarketplaceSource): string {
  if (typeof source === 'string') return source;
  if ('url' in source && typeof source.url === 'string') return source.url;
  return '';
}

/**
 * Git 入参形状白名单的转发出口(唯一实现在 `./url-shape.ts`,与 `cache.ts` 同一份)。
 * marketplace 侧做预检、cache 侧做咽喉点,两边都必须从这里取判据 —— 不得在端内各抄一遍正则。
 */
export {
  assertGitCloneInputs,
  evaluateGitRef,
  evaluateGitSha,
  evaluateGitUrl,
  GitCloneInputRejectedError,
  type GitUrlKind,
  type GitUrlVerdict,
  type GitRefVerdict,
  type GitShaVerdict,
} from './url-shape.js';
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
