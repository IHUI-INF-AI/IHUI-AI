/**
 * 公告系统测试 — 覆盖缓存读写、已读状态、格式化、未读统计。
 *
 * 测试策略:
 *   - 用 os.tmpdir() 创建隔离的临时文件,测试后清理
 *   - 不发起真实 HTTP 请求(fetchAnnouncements 用 try/catch 兜底,网络异常返回 [])
 *   - 重点测试本地状态机:cache / seen / format / unread count
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadCache,
  saveCache,
  loadSeenIds,
  markSeen,
  markAllSeen,
  countUnread,
  formatAnnouncements,
  formatAnnouncementBrief,
  formatStartupBanner,
  getDefaultCachePath,
  getDefaultSeenPath,
  fetchAnnouncements,
  getAnnouncements,
  refreshAnnouncements,
  type AnnouncementBrief,
} from '../src/announcements/index.js';

let tmpDir: string;
let cachePath: string;
let seenPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-ann-'));
  cachePath = path.join(tmpDir, 'cache', 'announcements.json');
  seenPath = path.join(tmpDir, 'state', 'seen-announcements.json');
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

const sampleList: AnnouncementBrief[] = [
  { id: 'a-1', title: '公告1', type: 'info', isPinned: true, publishedAt: '2026-07-01T00:00:00Z', summary: '摘要1' },
  { id: 'a-2', title: '公告2', type: 'warning', isPinned: false, publishedAt: '2026-07-02T00:00:00Z', summary: '摘要2' },
  { id: 'a-3', title: '公告3', type: 'update', isPinned: false, publishedAt: '2026-07-03T00:00:00Z', summary: null },
];

describe('默认路径', () => {
  it('getDefaultCachePath 返回 ~/.ihui/cache/announcements.json', () => {
    const p = getDefaultCachePath();
    expect(p).toMatch(/\.ihui[\/\\]cache[\/\\]announcements\.json$/);
  });

  it('getDefaultSeenPath 返回 ~/.ihui/state/seen-announcements.json', () => {
    const p = getDefaultSeenPath();
    expect(p).toMatch(/\.ihui[\/\\]state[\/\\]seen-announcements\.json$/);
  });
});

describe('缓存读写', () => {
  it('loadCache 文件不存在时返回 null', () => {
    expect(loadCache(cachePath)).toBeNull();
  });

  it('saveCache + loadCache 往返一致', () => {
    saveCache(cachePath, sampleList);
    const loaded = loadCache(cachePath);
    expect(loaded).not.toBeNull();
    expect(loaded!.length).toBe(3);
    expect(loaded![0]!.id).toBe('a-1');
  });

  it('saveCache 自动创建父目录', () => {
    expect(fs.existsSync(path.dirname(cachePath))).toBe(false);
    saveCache(cachePath, sampleList);
    expect(fs.existsSync(cachePath)).toBe(true);
  });

  it('loadCache TTL 过期后返回 null', () => {
    saveCache(cachePath, sampleList);
    // 手动改 fetchedAt 为 1 小时前
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const parsed = JSON.parse(raw);
    parsed.fetchedAt = Date.now() - 60 * 60 * 1000;
    fs.writeFileSync(cachePath, JSON.stringify(parsed), 'utf-8');
    // TTL 5 秒:已过期
    expect(loadCache(cachePath, 5000)).toBeNull();
  });

  it('loadCache 损坏文件返回 null', () => {
    ensureParent(cachePath);
    fs.writeFileSync(cachePath, 'not json', 'utf-8');
    expect(loadCache(cachePath)).toBeNull();
  });

  it('loadCache 缺少 fetchedAt 返回 null', () => {
    ensureParent(cachePath);
    fs.writeFileSync(cachePath, JSON.stringify({ list: [] }), 'utf-8');
    expect(loadCache(cachePath)).toBeNull();
  });
});

function ensureParent(p: string): void {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

describe('已读状态', () => {
  it('loadSeenIds 文件不存在时返回空 Set', () => {
    const s = loadSeenIds(seenPath);
    expect(s.size).toBe(0);
  });

  it('markSeen 后 loadSeenIds 包含该 ID', () => {
    markSeen(seenPath, 'a-1');
    const s = loadSeenIds(seenPath);
    expect(s.has('a-1')).toBe(true);
    expect(s.size).toBe(1);
  });

  it('markSeen 幂等(重复标记不增加)', () => {
    markSeen(seenPath, 'a-1');
    markSeen(seenPath, 'a-1');
    const s = loadSeenIds(seenPath);
    expect(s.size).toBe(1);
  });

  it('markSeen 空字符串 ID 忽略', () => {
    markSeen(seenPath, '');
    const s = loadSeenIds(seenPath);
    expect(s.size).toBe(0);
  });

  it('markSeen 自动创建父目录', () => {
    expect(fs.existsSync(path.dirname(seenPath))).toBe(false);
    markSeen(seenPath, 'a-1');
    expect(fs.existsSync(seenPath)).toBe(true);
  });

  it('markAllSeen 批量标记', () => {
    markAllSeen(seenPath, sampleList);
    const s = loadSeenIds(seenPath);
    expect(s.size).toBe(3);
    expect(s.has('a-1')).toBe(true);
    expect(s.has('a-2')).toBe(true);
    expect(s.has('a-3')).toBe(true);
  });

  it('markAllSeen 空列表不写文件', () => {
    markAllSeen(seenPath, []);
    expect(fs.existsSync(seenPath)).toBe(false);
  });

  it('markAllSeen 追加到已有 seen 集合(不覆盖)', () => {
    markSeen(seenPath, 'pre-existing');
    markAllSeen(seenPath, sampleList);
    const s = loadSeenIds(seenPath);
    expect(s.size).toBe(4);
    expect(s.has('pre-existing')).toBe(true);
  });

  it('loadSeenIds 损坏文件返回空 Set', () => {
    ensureParent(seenPath);
    fs.writeFileSync(seenPath, 'not json', 'utf-8');
    const s = loadSeenIds(seenPath);
    expect(s.size).toBe(0);
  });
});

describe('未读统计', () => {
  it('空 seen 时全部未读', () => {
    expect(countUnread(sampleList, new Set())).toBe(3);
  });

  it('已读 1 条时未读为 2', () => {
    const seen = new Set(['a-1']);
    expect(countUnread(sampleList, seen)).toBe(2);
  });

  it('全部已读时未读为 0', () => {
    const seen = new Set(['a-1', 'a-2', 'a-3']);
    expect(countUnread(sampleList, seen)).toBe(0);
  });

  it('空列表未读为 0', () => {
    expect(countUnread([], new Set())).toBe(0);
  });
});

describe('格式化', () => {
  it('formatAnnouncements 空列表返回"暂无公告"', () => {
    expect(formatAnnouncements([], new Set())).toBe('暂无公告');
  });

  it('formatAnnouncements 含总数与未读数', () => {
    const out = formatAnnouncements(sampleList, new Set());
    expect(out).toContain('共 3 条');
    expect(out).toContain('未读 3 条');
  });

  it('formatAnnouncements showOnlyUnread 过滤已读', () => {
    const seen = new Set(['a-1', 'a-2']);
    const out = formatAnnouncements(sampleList, seen, { showOnlyUnread: true });
    expect(out).toContain('未读 1 条');
    expect(out).toContain('公告3');
    expect(out).not.toContain('公告1');
    expect(out).not.toContain('公告2');
  });

  it('formatAnnouncements max 限制返回数量', () => {
    const out = formatAnnouncements(sampleList, new Set(), { max: 2 });
    expect(out).toContain('公告1');
    expect(out).toContain('公告2');
    expect(out).not.toContain('公告3');
  });

  it('formatAnnouncements showOnlyUnread 但全已读时返回"暂无未读公告"', () => {
    const seen = new Set(['a-1', 'a-2', 'a-3']);
    expect(formatAnnouncements(sampleList, seen, { showOnlyUnread: true })).toBe('暂无未读公告');
  });

  it('formatAnnouncementBrief 已读显示 ✓', () => {
    const seen = new Set(['a-1']);
    const out = formatAnnouncementBrief(sampleList[0]!, seen, 0);
    expect(out).toContain('✓');
    expect(out).toContain('#1');
    expect(out).toContain('公告1');
  });

  it('formatAnnouncementBrief 未读显示空格', () => {
    const out = formatAnnouncementBrief(sampleList[1]!, new Set(), 1);
    expect(out).toContain('#2');
    expect(out).toContain('公告2');
  });

  it('formatAnnouncementBrief 置顶显示 [置顶]', () => {
    const out = formatAnnouncementBrief(sampleList[0]!, new Set(), 0);
    expect(out).toContain('[置顶]');
  });

  it('formatStartupBanner 全部已读返回空字符串', () => {
    const seen = new Set(['a-1', 'a-2', 'a-3']);
    expect(formatStartupBanner(sampleList, seen)).toBe('');
  });

  it('formatStartupBanner 含未读数和最近未读标题', () => {
    const banner = formatStartupBanner(sampleList, new Set());
    expect(banner).toContain('3 条未读');
    expect(banner).toContain('公告1');
  });

  it('formatStartupBanner 部分已读时找首个未读', () => {
    const seen = new Set(['a-1', 'a-2']);
    const banner = formatStartupBanner(sampleList, seen);
    expect(banner).toContain('1 条未读');
    expect(banner).toContain('公告3');
  });
});

describe('fetchAnnouncements / getAnnouncements / refreshAnnouncements', () => {
  it('fetchAnnouncements 无效 URL 返回空数组(不抛错)', async () => {
    const list = await fetchAnnouncements({ apiUrl: 'http://127.0.0.1:0' });
    expect(list).toEqual([]);
  });

  it('getAnnouncements 缓存未过期时返回缓存(不发起 HTTP)', async () => {
    saveCache(cachePath, sampleList);
    // 用一个无法访问的 URL,如果走 HTTP 会返回 []
    const list = await getAnnouncements({
      apiUrl: 'http://127.0.0.1:0',
      cachePath,
      cacheTtlMs: 60_000,
    });
    expect(list.length).toBe(3);
    expect(list[0]!.id).toBe('a-1');
  });

  it('getAnnouncements 缓存过期时尝试 HTTP(失败返回空数组)', async () => {
    saveCache(cachePath, sampleList);
    // 把 fetchedAt 改到 1 小时前
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const parsed = JSON.parse(raw);
    parsed.fetchedAt = Date.now() - 60 * 60 * 1000;
    fs.writeFileSync(cachePath, JSON.stringify(parsed), 'utf-8');
    const list = await getAnnouncements({
      apiUrl: 'http://127.0.0.1:0',
      cachePath,
      cacheTtlMs: 1000,
    });
    expect(list).toEqual([]);
  });

  it('refreshAnnouncements 绕过缓存直接 HTTP(失败返回 [])', async () => {
    const list = await refreshAnnouncements({
      apiUrl: 'http://127.0.0.1:0',
      cachePath,
    });
    expect(list).toEqual([]);
  });
});
