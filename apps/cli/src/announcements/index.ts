/**
 * 公告系统 — 从后端 API 拉取公告,本地缓存 + 已读状态追踪 + REPL 渲染。
 *
 * 灵感来源:参考行业 Agent 框架的启动公告 / Changelog 提示机制。
 * 简化策略(做减法):
 *   - 不引入新依赖,纯 Node 内置(fs/path/os)+ fetch(Node 18+ 内置)
 *   - 本地缓存:~/.ihui/cache/announcements.json(TTL 失效,默认 10 分钟)
 *   - 已读状态:~/.ihui/state/seen-announcements.json(本地 Set,无需登录)
 *   - feature flag 关闭时所有 IO 静默 no-op(零回归)
 *
 * Feature flag:settings.announcements.enabled 默认 false,启用后 REPL 启动时拉取并显示未读公告。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/** 支持的 locale(用于 i18n 渲染) */
export type AnnouncementLocale = 'zh' | 'en';

/** locale 对应的文案模板 */
const I18N_STRINGS: Record<AnnouncementLocale, {
  noUnread: string;
  noAnnouncements: string;
  listHeader: (total: number, unread: number) => string;
  startupBanner: (unread: number, icon: string, title: string) => string;
  pinned: string;
  readMark: string;
  unreadMark: string;
  defaultTitle: string;
}> = {
  zh: {
    noUnread: '暂无未读公告',
    noAnnouncements: '暂无公告',
    listHeader: (total, unread) => `📢 公告列表(共 ${total} 条,未读 ${unread} 条):`,
    startupBanner: (unread, icon, title) =>
      `📢 你有 ${unread} 条未读公告,输入 /announcements 查看。最近: ${icon} ${title}`,
    pinned: '[置顶] ',
    readMark: '✓',
    unreadMark: ' ',
    defaultTitle: '(无标题)',
  },
  en: {
    noUnread: 'No unread announcements',
    noAnnouncements: 'No announcements',
    listHeader: (total, unread) =>
      `📢 Announcements (${total} total, ${unread} unread):`,
    startupBanner: (unread, icon, title) =>
      `📢 You have ${unread} unread announcements. Type /announcements to view. Latest: ${icon} ${title}`,
    pinned: '[Pinned] ',
    readMark: '✓',
    unreadMark: ' ',
    defaultTitle: '(Untitled)',
  },
};

/** 解析 locale 字符串(容错:不识别的值降级为 zh) */
export function parseLocale(input?: string): AnnouncementLocale {
  if (!input) return 'zh';
  const lower = input.toLowerCase().trim();
  if (lower.startsWith('en')) return 'en';
  return 'zh';
}

/** 公告类型(与后端 schema 对齐) */
export type AnnouncementType = 'info' | 'warning' | 'maintenance' | 'update';

/** 后端返回的公告条目(精简字段,不含正文 content) */
export interface AnnouncementBrief {
  id: string;
  title: string;
  type?: AnnouncementType | string;
  isPinned?: boolean;
  publishedAt?: string | null;
  summary?: string | null;
}

/** 后端返回的完整公告(含正文) */
export interface AnnouncementDetail extends AnnouncementBrief {
  content?: string;
}

/** 缓存文件结构 */
interface CacheFile {
  fetchedAt: number;
  list: AnnouncementBrief[];
}

/** 已读状态文件结构 */
interface SeenFile {
  seenIds: string[];
}

export interface AnnouncementsOptions {
  /** 后端 API 根 URL(如 http://localhost:8080),不带尾斜杠 */
  apiUrl: string;
  /** 缓存 TTL 毫秒数(默认 600_000 = 10 分钟) */
  cacheTtlMs?: number;
  /** 缓存文件路径(默认 ~/.ihui/cache/announcements.json) */
  cachePath?: string;
  /** 已读状态文件路径(默认 ~/.ihui/state/seen-announcements.json) */
  seenPath?: string;
  /** HTTP 请求超时毫秒(默认 5000) */
  fetchTimeoutMs?: number;
}

const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 5000;
const MAX_SEEN_IDS = 1000;

/** 默认缓存路径:~/.ihui/cache/announcements.json */
export function getDefaultCachePath(): string {
  return path.join(os.homedir(), '.ihui', 'cache', 'announcements.json');
}

/** 默认已读状态路径:~/.ihui/state/seen-announcements.json */
export function getDefaultSeenPath(): string {
  return path.join(os.homedir(), '.ihui', 'state', 'seen-announcements.json');
}

/** 确保父目录存在(避免写文件时 ENOENT) */
function ensureParentDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // 并发或权限问题忽略,写文件时会再次失败
    }
  }
}

/** 从后端拉取最新公告列表(轻量端点 /api/cli/announcements/latest) */
export async function fetchAnnouncements(
  opts: AnnouncementsOptions,
): Promise<AnnouncementBrief[]> {
  const url = `${opts.apiUrl.replace(/\/+$/, '')}/api/cli/announcements/latest?limit=20`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return [];
    const json = (await resp.json()) as { code?: number; data?: { list?: AnnouncementBrief[] } };
    if (json?.code !== 0 || !Array.isArray(json.data?.list)) return [];
    return json.data!.list ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** 读取本地缓存(过期返回 null) */
export function loadCache(cachePath: string, ttlMs: number = DEFAULT_CACHE_TTL_MS): AnnouncementBrief[] | null {
  try {
    if (!fs.existsSync(cachePath)) return null;
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const parsed = JSON.parse(raw) as CacheFile;
    if (!parsed || typeof parsed.fetchedAt !== 'number' || !Array.isArray(parsed.list)) return null;
    if (Date.now() - parsed.fetchedAt > ttlMs) return null;
    return parsed.list;
  } catch {
    return null;
  }
}

/** 写入本地缓存(失败不抛错) */
export function saveCache(cachePath: string, list: AnnouncementBrief[]): void {
  try {
    ensureParentDir(cachePath);
    const payload: CacheFile = { fetchedAt: Date.now(), list };
    fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  } catch {
    // 写入失败静默
  }
}

/** 获取公告:优先用缓存(未过期),否则拉取后写缓存 */
export async function getAnnouncements(
  opts: AnnouncementsOptions,
): Promise<AnnouncementBrief[]> {
  const cachePath = opts.cachePath ?? getDefaultCachePath();
  const ttl = opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const cached = loadCache(cachePath, ttl);
  if (cached) return cached;
  const list = await fetchAnnouncements(opts);
  if (list.length > 0) saveCache(cachePath, list);
  return list;
}

/** 强制刷新:绕过缓存,重新拉取并更新缓存 */
export async function refreshAnnouncements(
  opts: AnnouncementsOptions,
): Promise<AnnouncementBrief[]> {
  const list = await fetchAnnouncements(opts);
  const cachePath = opts.cachePath ?? getDefaultCachePath();
  if (list.length > 0) saveCache(cachePath, list);
  return list;
}

/** 加载已读 ID 集合(文件不存在返回空 Set) */
export function loadSeenIds(seenPath: string = getDefaultSeenPath()): Set<string> {
  try {
    if (!fs.existsSync(seenPath)) return new Set();
    const raw = fs.readFileSync(seenPath, 'utf-8');
    const parsed = JSON.parse(raw) as SeenFile;
    if (!parsed || !Array.isArray(parsed.seenIds)) return new Set();
    return new Set(parsed.seenIds);
  } catch {
    return new Set();
  }
}

/** 标记某条公告为已读(幂等,失败不抛错) */
export function markSeen(seenPath: string, id: string): void {
  if (!id) return;
  try {
    ensureParentDir(seenPath);
    const set = loadSeenIds(seenPath);
    if (set.has(id)) return;
    set.add(id);
    // 环形缓冲:超过上限移除最早的(用 Array 顺序保证)
    let arr = Array.from(set);
    if (arr.length > MAX_SEEN_IDS) arr = arr.slice(arr.length - MAX_SEEN_IDS);
    const payload: SeenFile = { seenIds: arr };
    fs.writeFileSync(seenPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  } catch {
    // 写入失败静默
  }
}

/** 标记列表中所有公告为已读(批量,用于 /announcements read-all) */
export function markAllSeen(seenPath: string, list: AnnouncementBrief[]): void {
  if (list.length === 0) return;
  try {
    ensureParentDir(seenPath);
    const set = loadSeenIds(seenPath);
    for (const a of list) {
      if (a.id) set.add(a.id);
    }
    let arr = Array.from(set);
    if (arr.length > MAX_SEEN_IDS) arr = arr.slice(arr.length - MAX_SEEN_IDS);
    const payload: SeenFile = { seenIds: arr };
    fs.writeFileSync(seenPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  } catch {
    // 写入失败静默
  }
}

/** 统计未读数量 */
export function countUnread(list: AnnouncementBrief[], seen: Set<string>): number {
  return list.filter((a) => !seen.has(a.id)).length;
}

/** 类型对应的图标(用于渲染) */
function typeIcon(type?: string): string {
  switch (type) {
    case 'warning':
      return '⚠';
    case 'maintenance':
      return '🔧';
    case 'update':
      return '✨';
    case 'info':
    default:
      return '📢';
  }
}

/** 格式化单条公告简要(单行,支持 i18n) */
export function formatAnnouncementBrief(
  a: AnnouncementBrief,
  seen: Set<string>,
  index: number,
  locale: AnnouncementLocale = 'zh',
): string {
  const icon = typeIcon(a.type);
  const t = I18N_STRINGS[locale];
  const pin = a.isPinned ? t.pinned : '';
  const read = seen.has(a.id) ? t.readMark : t.unreadMark;
  const title = a.title ?? t.defaultTitle;
  const time = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : '';
  return `  ${read} ${icon} #${index + 1} ${pin}${title}  ${time}`;
}

/** 格式化公告列表(多行,用于 REPL /announcements 命令,支持 i18n) */
export function formatAnnouncements(
  list: AnnouncementBrief[],
  seen: Set<string>,
  opts: { showOnlyUnread?: boolean; max?: number; locale?: AnnouncementLocale } = {},
): string {
  const locale = opts.locale ?? 'zh';
  const t = I18N_STRINGS[locale];
  const filtered = opts.showOnlyUnread ? list.filter((a) => !seen.has(a.id)) : list;
  const limited = opts.max ? filtered.slice(0, opts.max) : filtered;
  if (limited.length === 0) {
    return opts.showOnlyUnread ? t.noUnread : t.noAnnouncements;
  }
  const unread = countUnread(list, seen);
  const lines: string[] = [];
  lines.push(t.listHeader(list.length, unread));
  for (let i = 0; i < limited.length; i++) {
    lines.push(formatAnnouncementBrief(limited[i]!, seen, i, locale));
  }
  return lines.join('\n');
}

/** 启动横幅:返回未读公告数 + 最近 1 条标题(用于 REPL 启动时显示,支持 i18n) */
export function formatStartupBanner(
  list: AnnouncementBrief[],
  seen: Set<string>,
  locale: AnnouncementLocale = 'zh',
): string {
  const unread = countUnread(list, seen);
  if (unread === 0) return '';
  const firstUnread = list.find((a) => !seen.has(a.id));
  if (!firstUnread) return '';
  const icon = typeIcon(firstUnread.type);
  return I18N_STRINGS[locale].startupBanner(unread, icon, firstUnread.title ?? I18N_STRINGS[locale].defaultTitle);
}
