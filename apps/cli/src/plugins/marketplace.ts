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

/** 类型守卫:source 是 Git URL({ source: 'url', url }) */
export function isGitSource(s: MarketplaceSource): s is { source: 'url'; url: string; ref?: string; sha?: string; path?: string } {
  if (!s || typeof s !== 'object') return false;
  if (!('source' in s)) return false;
  return (s as { source: unknown }).source === 'url';
}
