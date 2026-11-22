// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import {
  decideInstallPolicy,
  ENSURE_MINIMUM_PRESENCE,
  type DesiredResource,
} from '../src/plugins/install-policy.js';
import { evaluateArchiveQuota, quotaAllowsLanding, INSTALL_COPY_QUOTA } from '../src/plugins/archive-quota.js';
import {
  installPlugin,
  loadInstallRegistry,
  saveInstallRegistry,
  guardInstallCopyQuota,
  resolveCopyQuotaLimits,
  PluginArchiveQuotaError,
  COPY_QUOTA_ENV,
} from '../src/plugins/installer.js';
import { getInstalledPluginsDir, getPluginInstallPath, getRegistryPath } from '../src/plugins/paths.js';

/**
 * goal-b49 落地票:内置资源装机策略(#9)的两条腿 —— `ensure-minimum` 装机判定 + 解压双上限。
 * 对照程序锚点:`bundled-resources/manifest.json` 的
 * `install.presence="ensure-minimum"` / `revision` / 逐文件 sha256 / `archive.maxEntries` /
 * `archive.maxExpandedBytes`(取证见 docs/benchmark-evidence/2026-11/…/Q1-qoder-cn-main-bundle.md §3 #9)。
 *
 * 每一型都给**正反对照**:正例证明"该放行的真放行",反例证明"该拦的真拦住" ——
 * 只写反例的判据等于把红绿焊死在默认值上。三态里的 `unjudged` 另算一格,绝不与两态并桶。
 */

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
const hereDir = path.dirname(fileURLToPath(import.meta.url));

let tmpHome: string;
let tmpCwd: string;
let originalCwd: string;
let savedHome: string | undefined;
let savedQuota: string | undefined;

beforeEach(() => {
  tmpHome = mkScratch('s1-install-home-');
  tmpCwd = mkScratch('s1-install-cwd-');
  originalCwd = process.cwd();
  savedHome = process.env.IHUI_HOME;
  savedQuota = process.env[COPY_QUOTA_ENV];
  process.env.IHUI_HOME = tmpHome;
  delete process.env[COPY_QUOTA_ENV];
});

afterEach(() => {
  // 先离开夹具目录再删:cwd 还钉在 tmpCwd 里时 rmScratch 必抛 EPERM/EBUSY(本机实测)
  process.chdir(originalCwd);
  if (savedHome === undefined) delete process.env.IHUI_HOME;
  else process.env.IHUI_HOME = savedHome;
  if (savedQuota === undefined) delete process.env[COPY_QUOTA_ENV];
  else process.env[COPY_QUOTA_ENV] = savedQuota;
  rmScratch(tmpCwd);
  rmScratch(tmpHome);
});

/** 写一枚可安装的本地插件源,返回源目录绝对路径 */
function writeSource(dirName: string, name: string, version: string, extra: Record<string, string> = {}): string {
  const dir = path.join(tmpCwd, dirName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ name, version }), 'utf-8');
  for (const [file, body] of Object.entries(extra)) fs.writeFileSync(path.join(dir, file), body, 'utf-8');
  return dir;
}

/** 把安装目录造成"可用副本"(cache.ts 的判据 = 目录存在且非空) */
function makeDestUsable(name: string, body: string): string {
  const dest = getPluginInstallPath(name);
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'plugin.json'), body, 'utf-8');
  return dest;
}

const baseResource = (over: Partial<DesiredResource> = {}): DesiredResource => ({
  id: 'qoder-cn-context-plugin',
  presence: ENSURE_MINIMUM_PRESENCE,
  version: '1.0.91',
  revision: 2026102902,
  ...over,
});

// ==================== A 清单缺失:判不了不记绿也不冒红(§0.3) ====================

describe('A 装机策略 · 清单取不到', () => {
  it('A1 反例:整张清单没传 ⇒ unjudged 并点名"清单取不到"', () => {
    const d = decideInstallPolicy({ installed: { version: '1.0.91' } });
    expect(d.verdict).toBe('unjudged');
    expect(d.reasons.join(' ')).toContain('清单取不到');
  });

  it('A2 反例:清单显式为 null 与缺省同格(不把 null 读成"空清单已核对")', () => {
    expect(decideInstallPolicy({ resource: null }).verdict).toBe('unjudged');
    expect(decideInstallPolicy({ resource: { id: '', presence: ENSURE_MINIMUM_PRESENCE } }).reasons.join(' ')).toContain(
      '缺 id',
    );
  });

  it('A3 正例:清单齐备且版本/代数齐平 ⇒ 判得出(不是"永远 unjudged"的摆设判据)', () => {
    const d = decideInstallPolicy({ resource: baseResource(), installed: { version: '1.0.91', revision: 2026102902 } });
    expect(d.verdict).toBe('already-satisfied');
    expect(d.reasons.join(' ')).not.toContain('取不到');
  });

  it('A4 反例:presence 未声明 / 形态不认 ⇒ 都判不了(不猜默认档)', () => {
    expect(decideInstallPolicy({ resource: baseResource({ presence: null }) }).verdict).toBe('unjudged');
    const d = decideInstallPolicy({ resource: baseResource({ presence: 'ensure-latest' }), installed: {} });
    expect(d.verdict).toBe('unjudged');
    expect(d.reasons.join(' ')).toContain('形态不认');
  });
});

// ==================== B revision 单调 + 不降级 ====================

describe('B 装机策略 · revision 单调与不降级', () => {
  it('B1 正例:清单代数更高 ⇒ 要装(缺最低版本才装)', () => {
    const d = decideInstallPolicy({ resource: baseResource({ revision: 2026102903 }), installed: { version: '1.0.91', revision: 2026102902 } });
    expect(d.verdict).toBe('installed');
    expect(d.reasons.join(' ')).toContain('revision');
  });

  it('B2 反例:已装代数更高 ⇒ already-satisfied,并写明"不降级"', () => {
    const d = decideInstallPolicy({ resource: baseResource({ revision: 2026102901 }), installed: { version: '1.0.91', revision: 2026102902 } });
    expect(d.verdict).toBe('already-satisfied');
    expect(d.reasons.join(' ')).toContain('不降级');
  });

  it('B3 边界:revision 不是有限数且版本两维都拿不出 ⇒ unjudged(不冒判"要装")', () => {
    const d = decideInstallPolicy({
      resource: { id: 'x', presence: ENSURE_MINIMUM_PRESENCE, revision: Number.NaN },
      installed: {},
    });
    expect(d.verdict).toBe('unjudged');
    expect(d.reasons.join(' ')).toContain('不可比');
  });

  it('B4 现状整块为空(没装过)⇒ installed(缺最低版本才装的正半句)', () => {
    expect(decideInstallPolicy({ resource: baseResource(), installed: null }).verdict).toBe('installed');
  });

  it('B5 版本形状读不出(1.0.0-a vs 1.0.0-b)⇒ unjudged,不猜 pre-release 序', () => {
    const d = decideInstallPolicy({
      resource: baseResource({ revision: null, version: '1.0.0-a' }),
      installed: { revision: null, version: '1.0.0-b' },
    });
    expect(d.verdict).toBe('unjudged');
  });
});

// ==================== C 逐文件 sha256 ====================

describe('C 装机策略 · 逐文件 sha256 校验', () => {
  const fa = sha('plugin.json body');
  const fb = sha('runtime/native/mtree/index.cjs body');
  const files = [{ path: 'plugin.json', sha256: fa }, { path: 'runtime/index.cjs', sha256: fb }];
  const flat = { version: '1.0.91', revision: 2026102902 };

  it('C1 正例:逐枚相符 ⇒ already-satisfied 且点名核对了几枚', () => {
    const d = decideInstallPolicy({
      resource: baseResource({ files }),
      installed: { ...flat, files: [{ path: 'plugin.json', sha256: fa }, { path: 'runtime/index.cjs', sha256: fb }] },
    });
    expect(d.verdict).toBe('already-satisfied');
    expect(d.reasons.join(' ')).toContain('2 枚已核对');
  });

  it('C2 反例:一枚摘要不符 ⇒ 判"要装",并把不符的路径点名出来', () => {
    const d = decideInstallPolicy({
      resource: baseResource({ files }),
      installed: { ...flat, files: [{ path: 'plugin.json', sha256: fa }, { path: 'runtime/index.cjs', sha256: sha('篡改') }] },
    });
    expect(d.verdict).toBe('installed');
    expect(d.mismatchedFiles).toEqual(['runtime/index.cjs']);
  });

  it('C3 反例:清单声明的文件在盘上根本没有 ⇒ 判"要装"(缺文件 ≠ 摘要不符)', () => {
    const d = decideInstallPolicy({
      resource: baseResource({ files }),
      installed: { ...flat, files: [{ path: 'plugin.json', sha256: fa }] },
    });
    expect(d.verdict).toBe('installed');
    expect(d.missingFiles).toEqual(['runtime/index.cjs']);
  });

  it('C4 三态:哈希算不出(读不动)⇒ unjudged,绝不写成相符', () => {
    const d = decideInstallPolicy({
      resource: baseResource({ files }),
      installed: { ...flat, files: [{ path: 'plugin.json', sha256: fa }, { path: 'runtime/index.cjs', sha256: null }] },
    });
    expect(d.verdict).toBe('unjudged');
    expect(d.unjudgedFiles).toEqual(['runtime/index.cjs']);
    expect(d.reasons.join(' ')).toContain('算不出 ≠ 相符');
  });

  it('C5 老记录(摘要面整块拿不到)⇒ 版本维照常判,但摘要维必须留下"未判定"点名', () => {
    const d = decideInstallPolicy({ resource: baseResource({ files }), installed: { ...flat, files: null } });
    expect(d.verdict).toBe('already-satisfied');
    expect(d.reasons.join(' ')).toContain('该维未判定');
  });

  it('C6 判序:不降级优先于摘要不符(更高代数在前,缺口只登记不掀盘)', () => {
    const d = decideInstallPolicy({
      resource: baseResource({ files }),
      installed: { version: '2.0.0', revision: 2026102902, files: [{ path: 'plugin.json', sha256: sha('别一代') }] },
    });
    expect(d.verdict).toBe('already-satisfied');
    expect(d.missingFiles).toContain('runtime/index.cjs');
  });
});

// ==================== D 到期判据(超越轴:对方无此档) ====================

describe('D 装机策略 · 到期即回待裁队列(§0.7 验过才免且会到期)', () => {
  const flat = { version: '1.0.91', revision: 2026102902 };

  it('D1 反例:已到期 ⇒ unjudged 并写明"回到待裁队列,不静默放行"', () => {
    const d = decideInstallPolicy({
      resource: baseResource({ expires: '2026-01-01T00:00:00.000Z' }),
      installed: flat,
      now: '2026-11-05T00:00:00.000Z',
    });
    expect(d.verdict).toBe('unjudged');
    expect(d.reasons.join(' ')).toContain('回到待裁队列');
  });

  it('D2 正例:未到期 ⇒ 照常按版本/代数判定(到期维不无故拦)', () => {
    const d = decideInstallPolicy({
      resource: baseResource({ expires: '2027-01-01T00:00:00.000Z' }),
      installed: flat,
      now: '2026-11-05T00:00:00.000Z',
    });
    expect(d.verdict).toBe('already-satisfied');
  });

  it('D3 三态:声明了 expires 却给不出当下时刻 ⇒ 到期维判不了(不拿"没时钟"冒充"没到期")', () => {
    const d = decideInstallPolicy({ resource: baseResource({ expires: '2027-01-01T00:00:00.000Z' }), installed: flat });
    expect(d.verdict).toBe('unjudged');
    expect(d.reasons.join(' ')).toContain('拿不到当下时刻');
  });

  it('D4 反例:到期串读不出 ⇒ unjudged;正例对照:未声明 expires 时照常判', () => {
    expect(
      decideInstallPolicy({ resource: baseResource({ expires: '明年吧' }), installed: flat, now: '2026-11-05' }).verdict,
    ).toBe('unjudged');
    const d = decideInstallPolicy({ resource: baseResource(), installed: flat });
    expect(d.verdict).toBe('already-satisfied');
    expect(d.reasons.join(' ')).toContain('未声明 expires');
  });
});

// ==================== E 解压双上限(纯判据侧) ====================

describe('E 解压配额 · maxEntries 与 maxExpandedBytes 双上限', () => {
  // 现读对照样本:对方一枚归档的 97 条目 / 25,864,942 B
  const limits = { maxEntries: 97, maxExpandedBytes: 25_864_942 };

  it('E1 正例:两维都等于上限 ⇒ within(等于不是超过)', () => {
    const d = evaluateArchiveQuota({ entries: 97, expandedBytes: 25_864_942 }, limits);
    expect(d.verdict).toBe('within');
    expect(quotaAllowsLanding(d)).toBe(true);
  });

  it('E2 反例:条目超限 ⇒ exceeded,且实测数与上限数同时在场', () => {
    const d = evaluateArchiveQuota({ entries: 98, expandedBytes: 1024 }, limits);
    expect(d.verdict).toBe('exceeded');
    expect(d.exceededDimensions).toEqual(['entries']);
    expect(d.report).toContain('98 / 上限 97');
    expect(d.reasons.join(' ')).toContain('条目超限');
  });

  it('E3 反例:展开字节超限 ⇒ exceeded(bytes),读数带两侧数字', () => {
    const d = evaluateArchiveQuota({ entries: 10, expandedBytes: 25_864_943 }, limits);
    expect(d.verdict).toBe('exceeded');
    expect(d.exceededDimensions).toEqual(['bytes']);
    expect(d.report).toContain('25864943 / 上限 25864942');
  });

  it('E4 两维同时跳牌 ⇒ 两个维度都点名(不报最先的那一维就完事)', () => {
    const d = evaluateArchiveQuota({ entries: 5000, expandedBytes: 999_999_999 }, limits);
    expect(d.exceededDimensions).toEqual(['entries', 'bytes']);
  });

  it('E5 三态:上限未声明 / 实测整块取不到 / 单维量不出 ⇒ 一律 unjudged,不记绿', () => {
    expect(evaluateArchiveQuota({ entries: 1, expandedBytes: 1 }, null).verdict).toBe('unjudged');
    expect(evaluateArchiveQuota(null, limits).verdict).toBe('unjudged');
    const d = evaluateArchiveQuota({ entries: null, expandedBytes: 1 }, limits);
    expect(d.verdict).toBe('unjudged');
    expect(d.report).toContain('量不出');
    expect(quotaAllowsLanding(d)).toBe(false);
  });

  it('E6 反例:上限形态坏 ⇒ 判据本身坏,不拿它裁实测', () => {
    const d = evaluateArchiveQuota({ entries: 500_000, expandedBytes: 9e15 }, { maxEntries: Number.NaN, maxExpandedBytes: -1 });
    expect(d.verdict).toBe('unjudged');
    expect(d.reasons.join(' ')).toContain('判据本身坏');
  });

  it('E7 默认档的不变量:可放行落位的树必须 ⊇ 能被摘要台账证到的树', () => {
    expect(INSTALL_COPY_QUOTA.maxEntries).toBeGreaterThanOrEqual(2000);
    expect(INSTALL_COPY_QUOTA.maxExpandedBytes).toBeGreaterThanOrEqual(128 * 1024 * 1024);
  });
});

// ==================== F 已满足不重复装(走生产入口) ====================

describe('F 装机面接线 · 已满足不重复装 / 不降级 / 判不了不跳过', () => {
  it('F1 正例:同一源连装两次 ⇒ 第二次既不复制也不重写权威记录', async () => {
    process.chdir(tmpCwd);
    writeSource('plug', 'p-f1', '1.0.0', { 'marker.txt': 'v1' });
    const first = await installPlugin('./plug');
    expect(first.wasInstalled).toBe(false);
    expect(first.policy?.verdict).toBe('installed');
    const landedAt = loadInstallRegistry().records.find((r) => r.name === 'p-f1')?.installedAt;
    expect(typeof landedAt).toBe('string');

    const second = await installPlugin('./plug');
    expect(second.wasInstalled).toBe(true);
    expect(second.policy?.verdict).toBe('already-satisfied');
    const rows = loadInstallRegistry().records.filter((r) => r.name === 'p-f1');
    expect(rows).toHaveLength(1);
    // "不重复装"量的不是行数,而是**权威没被再写一次**:时刻仍是第一次那一枚
    expect(rows[0]?.installedAt).toBe(landedAt);
  });

  it('F2 反例(旧缺陷):源目录就地升级后再装一次 ⇒ 必须真装,不再被读成"已装过"', async () => {
    process.chdir(tmpCwd);
    writeSource('up', 'p-f2', '1.0.0', { 'marker.txt': 'v1' });
    await installPlugin('./up');
    fs.writeFileSync(path.join(tmpCwd, 'up', 'plugin.json'), JSON.stringify({ name: 'p-f2', version: '2.0.0' }), 'utf-8');

    const again = await installPlugin('./up');
    expect(again.wasInstalled).toBe(false);
    expect(again.version).toBe('2.0.0');
    expect(again.policy?.verdict).toBe('installed');
    expect(loadInstallRegistry().records.find((r) => r.name === 'p-f2')?.version).toBe('2.0.0');
  });

  it('F3 反例:已装更高一代 ⇒ 不降级,盘上仍是高的那一代', async () => {
    process.chdir(tmpCwd);
    writeSource('high', 'p-f3', '2.0.0', { 'marker.txt': 'v2' });
    await installPlugin('./high');
    fs.writeFileSync(path.join(tmpCwd, 'high', 'plugin.json'), JSON.stringify({ name: 'p-f3', version: '1.0.0' }), 'utf-8');

    const down = await installPlugin('./high');
    expect(down.wasInstalled).toBe(true);
    expect(down.policy?.reasons.join(' ')).toContain('不降级');
    const dest = getPluginInstallPath('p-f3');
    expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('v2');
    expect(loadInstallRegistry().records.find((r) => r.name === 'p-f3')?.version).toBe('2.0.0');
  });

  it('F4 三态:老记录没有版本 ⇒ 判不了,按"不跳过"处置(绝不写成已满足)', async () => {
    process.chdir(tmpCwd);
    const src = writeSource('legacy', 'p-f4', '1.0.0', { 'marker.txt': 'v1' });
    saveInstallRegistry({
      records: [{ name: 'p-f4', sourceType: 'local', sourcePath: src, installedAt: '2026-01-01T00:00:00.000Z' }],
    });
    makeDestUsable('p-f4', JSON.stringify({ name: 'p-f4', version: '0.9.0' }));

    const out = await installPlugin('./legacy');
    expect(out.policy?.verdict).toBe('unjudged');
    expect(out.wasInstalled).toBe(false);
    expect(fs.readFileSync(path.join(getPluginInstallPath('p-f4'), 'marker.txt'), 'utf-8')).toBe('v1');
  });
});

// ==================== G 拒绝发生在任何 fs 动作之前 ====================

describe('G 配额闸次序 · 拒在任何写盘之前', () => {
  it('G1 反例:条目数超上限 ⇒ 拒,且安装目录/权威记录一步都没被创建', async () => {
    process.chdir(tmpCwd);
    writeSource('bomb', 'p-g1', '1.0.0', { 'a.txt': 'a', 'b.txt': 'b' });
    process.env[COPY_QUOTA_ENV] = '2:1048576';

    const err = await installPlugin('./bomb').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PluginArchiveQuotaError);
    const quota = err as PluginArchiveQuotaError;
    expect(quota.decision.verdict).toBe('exceeded');
    expect(quota.decision.exceededDimensions).toEqual(['entries']);
    expect(quota.message).toContain('/ 上限 2');
    // 拒绝发生在任何 fs 动作之前:装机根、staging、归档、registry 一个都不该在场
    expect(fs.existsSync(getInstalledPluginsDir())).toBe(false);
    expect(fs.existsSync(getRegistryPath())).toBe(false);
    // 源目录也不该被动过(三条内容都还在原地)
    expect(fs.readdirSync(path.join(tmpCwd, 'bomb')).sort()).toEqual(['a.txt', 'b.txt', 'plugin.json']);
  });

  it('G2 阳性对照:同一夹具放宽上限 ⇒ 装成功(证明 G1 的红是真配额判的,不是夹具坏了)', async () => {
    process.chdir(tmpCwd);
    writeSource('bomb', 'p-g2', '1.0.0', { 'a.txt': 'a', 'b.txt': 'b' });
    process.env[COPY_QUOTA_ENV] = '10:1048576';
    const out = await installPlugin('./bomb');
    expect(out.wasInstalled).toBe(false);
    expect(fs.existsSync(getRegistryPath())).toBe(true);
  });

  it('G3 覆盖档解析:只认 "<条目>:<字节>";形态读不出回落默认档(不猜覆盖值)', () => {
    expect(resolveCopyQuotaLimits('5:10')).toEqual({ maxEntries: 5, maxExpandedBytes: 10 });
    for (const bad of [undefined, '', 'abc', '1:2:3', '-1:5', '5:']) {
      expect(resolveCopyQuotaLimits(bad)).toEqual(INSTALL_COPY_QUOTA);
    }
  });

  it('G4 直接调用配额闸:小上限当场抛、大上限返回 within(同一枚夹具,正反成对)', () => {
    process.chdir(tmpCwd);
    const src = writeSource('guard', 'p-g4', '1.0.0', { 'a.txt': 'a' });
    expect(guardInstallCopyQuota(src, { maxEntries: 50, maxExpandedBytes: 1_000_000 }).verdict).toBe('within');
    const err = (() => {
      try {
        guardInstallCopyQuota(src, { maxEntries: 1, maxExpandedBytes: 1 });
        return null;
      } catch (e) {
        return e as PluginArchiveQuotaError;
      }
    })();
    expect(err).toBeInstanceOf(PluginArchiveQuotaError);
    expect(err?.decision.observedEntries).toBe(2);
    expect(err?.decision.report ?? '').toContain('/ 上限 1');
  });

  it('G5 形状锁:installFromDirectory 体内配额闸排在第一个写动作之前(次序是判据不是风格)', () => {
    const srcText = fs.readFileSync(path.join(hereDir, '../src/plugins/installer.ts'), 'utf-8');
    const body = srcText.slice(
      srcText.indexOf('function installFromDirectory('),
      srcText.indexOf('async function installLocal('),
    );
    const guard = body.indexOf('guardInstallCopyQuota(sourceDir)');
    expect(guard).toBeGreaterThan(-1);
    for (const write of ['prepareStagingDirectory(destDir)', 'copyDirRecursive(sourceDir', 'persistInstallAuthority(']) {
      expect(body.indexOf(write)).toBeGreaterThan(guard);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
