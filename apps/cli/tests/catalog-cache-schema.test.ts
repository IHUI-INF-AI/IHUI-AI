// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能/市场列表缓存信封契约的用例(goal-b49 B4,2026-11-05)。
 *
 * 对照组:外部程序本机实读的 `.skill-list-cache.json`(顶层 version/results/watch/signature/
 * scopeKey/savedAt)。它的 `scopeKey` 是**字符串套字符串的定长位置编码**(11 槽含 4 个空串占位),
 * 换机时槽位错位是静默的;本契约改成具名自描述 scope,并把"空"与"未判定"分档(AGENTS §0.3)。
 *
 * 判据全部 import 源脚本(§22c:测试不复制判据)。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CATALOG_CACHE_SCHEMA_VERSION,
  CATALOG_EMPTY_STABLE,
  classifyCacheHit,
  decodeCatalogCacheEnvelope,
  differingScopeKeys,
  encodeCatalogCacheEnvelope,
  fingerprintCatalogEntries,
  isCatalogDirty,
  sameCatalogSignature,
  type CatalogCacheEnvelope,
  type CatalogCacheScope,
} from '@ihui/shared/skills/catalog-cache-schema';

const NOW = 1_800_000_000_000;
const TTL = 60_000;

const scope: CatalogCacheScope = {
  projectDir: 'G:/proj/a',
  repoRoot: 'G:/proj/a',
  userHomeDir: 'C:/Users/Administrator',
  includeUserHome: true,
};

interface Row {
  name: string;
  source: string;
}

function envelopeOf(over: Partial<CatalogCacheEnvelope<Row>> = {}): CatalogCacheEnvelope<Row> {
  return {
    schemaVersion: CATALOG_CACHE_SCHEMA_VERSION,
    scope,
    savedAt: NOW - 1_000,
    signature: fingerprintCatalogEntries([{ name: 'alpha', updatedAt: 111 }]),
    watch: { dirs: ['G:/proj/a/.ihui/skills'], files: [] },
    results: [{ name: 'alpha', source: 'G:/proj/a/.ihui/skills/alpha/SKILL.md' }],
    ...over,
  };
}

describe('classifyCacheHit 三态成对', () => {
  it('新鲜 + scope 对得上 ⇒ hit,并带回 results/ageMs', () => {
    const v = classifyCacheHit(envelopeOf(), NOW, TTL, scope);
    expect(v.status).toBe('hit');
    if (v.status !== 'hit') throw new Error('unreachable');
    expect(v.results).toHaveLength(1);
    expect(v.ageMs).toBe(1_000);
  });

  it('超出新鲜窗口 ⇒ stale(带实测年龄与窗口,不冒充 hit)', () => {
    const v = classifyCacheHit(envelopeOf({ savedAt: NOW - TTL - 1 }), NOW, TTL, scope);
    expect(v.status).toBe('stale');
    if (v.status !== 'stale') throw new Error('unreachable');
    expect(v.ageMs).toBe(TTL + 1);
    expect(v.freshnessMs).toBe(TTL);
  });

  it('信封缺席 ⇒ unjudged 并点名,不记绿也不冒红', () => {
    const v = classifyCacheHit(null, NOW, TTL, scope);
    expect(v.status).toBe('unjudged');
    if (v.status !== 'unjudged') throw new Error('unreachable');
    expect(v.reasons.join(' ')).toContain('envelope absent');
  });

  it('schema 版本不符 ⇒ unjudged(换版不猜旧数据)', () => {
    const v = classifyCacheHit(envelopeOf({ schemaVersion: 99 }), NOW, TTL, scope);
    expect(v.status).toBe('unjudged');
    if (v.status !== 'unjudged') throw new Error('unreachable');
    expect(v.reasons.join(' ')).toContain('schemaVersion');
  });

  it.each([
    ['watch 不可读', { watch: null as unknown as CatalogCacheEnvelope<Row>['watch'] }],
    ['signature 不可读', { signature: 'x' as unknown as CatalogCacheEnvelope<Row>['signature'] }],
    ['savedAt 不可读', { savedAt: 'yesterday' as unknown as number }],
  ])('信封缺字段(%s)⇒ unjudged 并点名那一格', (_label, over) => {
    const v = classifyCacheHit(envelopeOf(over), NOW, TTL, scope);
    expect(v.status).toBe('unjudged');
    if (v.status !== 'unjudged') throw new Error('unreachable');
    expect(v.reasons.length).toBeGreaterThan(0);
  });

  it('results 取不到 ⇒ unjudged(不得把"读不出"当"没有")', () => {
    const v = classifyCacheHit(envelopeOf({ results: undefined as unknown as Row[] }), NOW, TTL, scope);
    expect(v.status).toBe('unjudged');
    if (v.status !== 'unjudged') throw new Error('unreachable');
    expect(v.reasons.join(' ')).toContain('results unreadable');
  });
});

describe('空清单是稳定态,不是错误态(catalog-empty-stable)', () => {
  it('空 + 具名件 ⇒ hit 且 emptyStable=true', () => {
    const v = classifyCacheHit(envelopeOf({ results: [], emptyMarker: CATALOG_EMPTY_STABLE }), NOW, TTL, scope);
    expect(v.status).toBe('hit');
    if (v.status !== 'hit') throw new Error('unreachable');
    expect(v.emptyStable).toBe(true);
    expect(v.results).toEqual([]);
  });

  it('空而**没有**具名件 ⇒ unjudged(与"确实没有技能"必须分得开)', () => {
    const v = classifyCacheHit(envelopeOf({ results: [] }), NOW, TTL, scope);
    expect(v.status).toBe('unjudged');
    if (v.status !== 'unjudged') throw new Error('unreachable');
    expect(v.reasons.join(' ')).toContain(CATALOG_EMPTY_STABLE);
  });

  it('非空却带具名件 ⇒ 语义仍按条数走(hit),但编解码会把非法标记拦下', () => {
    const v = classifyCacheHit(envelopeOf({ emptyMarker: CATALOG_EMPTY_STABLE }), NOW, TTL, scope);
    expect(v.status).toBe('hit');
    const bad = decodeCatalogCacheEnvelope<Row>(
      encodeCatalogCacheEnvelope(envelopeOf({ emptyMarker: 'catalog-empty-stable-ish' as typeof CATALOG_EMPTY_STABLE })),
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error('unreachable');
    expect(bad.reasons.join(' ')).toContain('emptyMarker');
  });
});

describe('scope 自描述:换机必判不命中', () => {
  it('换一个字段值 ⇒ 不是 hit,且点名的是**字段名**', () => {
    const moved: CatalogCacheScope = { ...scope, userHomeDir: 'D:/Users/other' };
    const v = classifyCacheHit(envelopeOf(), NOW, TTL, moved);
    expect(v.status).toBe('unjudged');
    if (v.status !== 'unjudged') throw new Error('unreachable');
    expect(v.reasons.join(' ')).toContain('userHomeDir');
    expect(v.reasons.join(' ')).not.toContain('index 2');
  });

  it('两个字段同时变 ⇒ 两个都点名(位置编码只会错位到别的字段)', () => {
    const diff = differingScopeKeys(scope, { ...scope, projectDir: 'G:/other', includeUserHome: false });
    expect(diff).toEqual(['projectDir', 'includeUserHome']);
  });

  it('scope 写成字符串(对方那种 scopeKey 形态)⇒ decode 直接拒', () => {
    const like = JSON.stringify({
      schemaVersion: CATALOG_CACHE_SCHEMA_VERSION,
      scope: JSON.stringify(['G:/proj/a', 'G:/proj/a', '', '', '', '', false]),
      savedAt: NOW,
      signature: { ok: 0, missing: 0, sum: 0, xor: 0 },
      watch: { dirs: [], files: [] },
      results: [],
    });
    const d = decodeCatalogCacheEnvelope<Row>(like);
    expect(d.ok).toBe(false);
    if (d.ok) throw new Error('unreachable');
    expect(d.reasons.join(' ')).toContain('scope missing/not an object');
  });
});

describe('廉价签名:纯函数、不读盘、"量不到"单独计票', () => {
  it('同名同版本同刻 ⇒ 同签名;顺序无关', () => {
    const a = fingerprintCatalogEntries([{ name: 'x', version: '1', updatedAt: 10 }, { name: 'y', updatedAt: 20 }]);
    const b = fingerprintCatalogEntries([{ name: 'y', updatedAt: 20 }, { name: 'x', version: '1', updatedAt: 10 }]);
    expect(sameCatalogSignature(a, b)).toBe(true);
  });

  it('内容时刻变了 ⇒ 签名变(判脏不吃 mtime 猜测,吃探针)', () => {
    const a = fingerprintCatalogEntries([{ name: 'x', updatedAt: 10 }]);
    const b = fingerprintCatalogEntries([{ name: 'x', updatedAt: 11 }]);
    expect(sameCatalogSignature(a, b)).toBe(false);
  });

  it('名字为空 / 时刻取不到 ⇒ 计入 missing,不计入 ok', () => {
    const s = fingerprintCatalogEntries([{ name: '  ' }, { name: 'x' }, { name: 'y', updatedAt: 'not-a-date' }]);
    expect(s).toEqual({ ok: 0, missing: 3, sum: 0, xor: 0 });
  });

  it('探针缺失 ⇒ 即使两侧相等也判脏(量不到 ≠ 没变)', () => {
    const s = fingerprintCatalogEntries([{ name: 'x' }]);
    const dirty = isCatalogDirty(s, s);
    expect(dirty.dirty).toBe(true);
    expect(dirty.reasons.join(' ')).toContain('unread probe');
  });

  it('两侧都干净且相等 ⇒ 不脏', () => {
    const s = fingerprintCatalogEntries([{ name: 'x', updatedAt: 5 }]);
    expect(isCatalogDirty(s, s)).toEqual({ dirty: false, reasons: [] });
  });

  it('一侧条数不同 ⇒ 脏,并把两组四整数都写进原因', () => {
    const cached = fingerprintCatalogEntries([{ name: 'x', updatedAt: 5 }]);
    const live = fingerprintCatalogEntries([{ name: 'x', updatedAt: 5 }, { name: 'z', updatedAt: 6 }]);
    const dirty = isCatalogDirty(cached, live);
    expect(dirty.dirty).toBe(true);
    expect(dirty.reasons.join(' ')).toContain('signature differs');
  });
});

describe('编解码与时间 skew', () => {
  it('编解码往返保持五件套', () => {
    const env = envelopeOf();
    const d = decodeCatalogCacheEnvelope<Row>(encodeCatalogCacheEnvelope(env));
    expect(d.ok).toBe(true);
    if (!d.ok) throw new Error('unreachable');
    expect(d.envelope.scope).toEqual(scope);
    expect(d.envelope.results).toEqual(env.results);
  });

  it('坏 JSON ⇒ unjudged 且点名,不返回半成品', () => {
    const d = decodeCatalogCacheEnvelope<Row>('{oops');
    expect(d.ok).toBe(false);
    if (d.ok) throw new Error('unreachable');
    expect(d.reasons.join(' ')).toContain('json unreadable');
  });

  it('savedAt 略超当前时刻(Windows 实测可超前若干 ms)⇒ 仍算新鲜', () => {
    const v = classifyCacheHit(envelopeOf({ savedAt: NOW + 1_500 }), NOW, TTL, scope);
    expect(v.status).toBe('hit');
  });

  it('savedAt 超前超出容忍量 ⇒ stale(未来时间戳不构成"更新过")', () => {
    const v = classifyCacheHit(envelopeOf({ savedAt: NOW + 60_000 }), NOW, TTL, scope);
    expect(v.status).toBe('stale');
  });

  it('没给 expectedScope ⇒ 不做 scope 比较(仍可 hit)', () => {
    expect(classifyCacheHit(envelopeOf(), NOW, TTL).status).toBe('hit');
  });
});

describe('形状锁:shared 判据面必须保持非 Node 纯度', () => {
  const srcText = readFileSync(
    fileURLToPath(new URL('../../../packages/shared/src/skills/catalog-cache-schema.ts', import.meta.url)),
    'utf8',
  );

  it.each(['node:fs', 'node:path', 'node:crypto', 'process.cwd', 'os.homedir', '__dirname', 'require('])(
    '不出现 %s(AGENTS「shared 包非 Node 宿主纯度」)',
    (token) => {
      expect(srcText).not.toContain(token);
    },
  );

  it('除类型外零 import(纯判据、IO 留端内)', () => {
    const imports = srcText.split('\n').filter((l) => /^\s*import\s/.test(l));
    expect(imports).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
