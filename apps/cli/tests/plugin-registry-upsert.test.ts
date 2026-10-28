// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-808:插件安装登记表(registry.json)的写入侧必须按主键 upsert,不得无条件追加。
//
// 钉的实测缺陷(票面原文):写侧 `installer.ts` 旧形态是 `reg.records.push(record)` 无条件追加,
// 而恢复/收尾侧 `cache.ts:520-524` 按 name 取**首行**去问事务号 ⇒ 从第二次覆盖安装起
// `authorityTransactionVerdict` 恒落 `not-committed`,归档永远收不走(方向安全,但账目烂掉)。
// 正解 = 写入侧就地替换(一名一行);追加语义只留给"真的多实例",而本仓没有那种承载物
// (安装目录按裸 name 派生,见 `paths.ts:55-57`)。
//
// 三条主用例逐条对应票面验收:
//   ① 同一主键连写两次 ⇒ 只有一行,且是第二次的内容;
//   ② 不同主键 ⇒ 两行都在(防把 upsert 写成"每次清空");
//   ③ 读侧遇到历史多行时 verdict 不再恒 not-committed(喂一份手工构造的旧格式 registry)。
//
// G-832 第一格(本文件 ④ 组)钉的是 G-808 落地时点名的那一格残余:写侧 upsert 只管"以后",
// 而**从未再安装过的历史同名多行**仍然留在表里 —— 读侧 `cache.ts` 的 `authorityScope` 当时
// 仍取**首行**(= 最旧那一代)去问事务号 ⇒ 问最新那笔永远 `not-committed` ⇒ 归档永远收不走。
// 现口径 = 同名行里取 `installedAt` 最新的一条,并列取数组靠后那条(判据住在
// `cache.ts` 的 `pickAuthorityRecord`,与写侧"每次覆盖刷新 installedAt"配对)。

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import { getInstalledPluginsDir, getPluginInstallPath, getRegistryPath } from '../src/plugins/paths.js';
import {
  authorityForTarget,
  authorityTransactionVerdict,
  landStagedSwap,
  prepareStagingDirectory,
  recoverStaleSwapArtifacts,
  swapMarkerName,
  supersededPathFor,
  takeOwnershipOfTarget,
  swapScratchMarkers,
} from '../src/plugins/cache.js';
import {
  installPlugin,
  loadInstallRegistry,
  saveInstallRegistry,
  uninstallPlugin,
  upsertInstallRecord,
  type InstallRecord,
  type InstallRegistry,
} from '../src/plugins/installer.js';

const HOME_ENV = 'IHUI_HOME';

let tmpHome: string;
let tmpCwd: string;
let originalCwd: string;
let savedHome: string | undefined;

beforeEach(() => {
  tmpHome = mkScratch('plugin-registry-upsert-home-');
  tmpCwd = mkScratch('plugin-registry-upsert-cwd-');
  originalCwd = process.cwd();
  savedHome = process.env[HOME_ENV];
  // 权威文件路径全部由 IHUI_HOME 推导(paths.ts:24-31)⇒ 每条用例都在临时家目录下跑,
  // 绝不碰本机 ~/.ihui 的真实 registry。
  process.env[HOME_ENV] = tmpHome;
});

afterEach(() => {
  process.chdir(originalCwd);
  if (savedHome !== undefined) process.env[HOME_ENV] = savedHome;
  else delete process.env[HOME_ENV];
  rmScratch(tmpCwd);
  rmScratch(tmpHome);
});

// ==================== 夹具助手 ====================

/** 在临时 cwd 下写一个可安装的本地插件源(同名的两个源就是"一次覆盖安装"的两代) */
function writeLocalPlugin(relDir: string, manifest: { name: string; version: string }): string {
  const dir = path.join(tmpCwd, relDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest), 'utf-8');
  fs.writeFileSync(path.join(dir, 'marker.txt'), manifest.version, 'utf-8');
  return dir;
}

function readRegistry(): InstallRegistry {
  return loadInstallRegistry();
}

/** 某个 name 在权威文件里的全部行(票面判据要数的是"恰一份",不是"≥一份") */
function rowsFor(name: string): InstallRecord[] {
  return readRegistry().records.filter((r) => r.name === name);
}

/** 交换残留(暂存/归档):成功路径 + 权威认账之后不应存在 */
function leftoverSwapScratch(): string[] {
  const dir = getInstalledPluginsDir();
  if (!fs.existsSync(dir)) return [];
  const markers = swapScratchMarkers();
  return fs.readdirSync(dir).filter((n) => n.includes(markers.staging) || n.includes(markers.superseded));
}

/** 造一条"接线前/别代"的记录(带指定的 transactionId,用于制造历史同名多行) */
function legacyRecord(name: string, version: string, installedAt: string, transactionId?: string): InstallRecord {
  const base: InstallRecord = {
    name,
    version,
    sourceType: 'local',
    sourcePath: path.join(tmpCwd, version),
    installedAt,
  };
  return transactionId === undefined ? base : { ...base, transactionId };
}

// ==================== ① 同主键连写两次 ====================

describe('G-808 写侧 upsert —— 同一主键只许一行', () => {
  it('① 生产入口连装两代(换源目录绕开"已装短路")⇒ registry 里该 name 只剩一行,内容是第二次', async () => {
    process.chdir(tmpCwd);
    writeLocalPlugin('v1', { name: 'p-up', version: '1.0.0' });
    writeLocalPlugin('v2', { name: 'p-up', version: '2.0.0' });

    const first = await installPlugin('./v1');
    const second = await installPlugin('./v2');

    const rows = rowsFor('p-up');
    // 判据数的是"恰一份":旧写侧在这里产出 ['1.0.0','2.0.0'] 两行
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe('2.0.0');
    // "第二次的内容"包括**本次**交换的事务号,而不是上一代的
    expect(rows[0].transactionId).toBe(second.transactionId);
    expect(rows[0].transactionId).not.toBe(first.transactionId);
    // 来源列也随本次改写(它不是主键的一部分,否则同名多行就是合法形态)
    expect(path.basename(rows[0].sourcePath ?? '')).toBe('v2');
    // 盘上确实是新那一代
    expect(fs.readFileSync(path.join(getPluginInstallPath('p-up'), 'marker.txt'), 'utf-8')).toBe('2.0.0');
  });

  it('①b 第三次连装仍是同一行(幂等收口,不是"每轮少一行"或"越装越多")', async () => {
    process.chdir(tmpCwd);
    for (const v of ['1.0.0', '2.0.0', '3.0.0']) {
      writeLocalPlugin(`v${v}`, { name: 'p-three', version: v });
      await installPlugin(`./v${v}`);
    }
    const rows = rowsFor('p-three');
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe('3.0.0');
  });

  it('①c 内存层判据:upsert 覆盖上一代 transactionId,且整体取第二次的内容(不逐字段合并)', () => {
    const reg: InstallRegistry = {
      records: [legacyRecord('m-a', '1.0.0', '2026-01-01T00:00:00.000Z', 'TXN-OLD')],
    };
    const next: InstallRecord = {
      name: 'm-a',
      version: '2.0.0',
      sourceType: 'git',
      sourceUrl: 'https://example.invalid/repo.git',
      installedAt: '2026-02-02T00:00:00.000Z',
      transactionId: 'TXN-NEW',
    };

    upsertInstallRecord(reg, next);

    expect(reg.records).toHaveLength(1);
    // 整体替换 ⇒ 上一代的 sourcePath/sourceType 与事务号都不残留(留着旧 transactionId
    // 就等于让 finalize 去问一笔已被取代的事务)
    expect(reg.records[0]).toEqual(next);
    expect(reg.records[0].sourcePath).toBeUndefined();
  });
});

// ==================== ② 不同主键不得被清空 ====================

describe('G-808 写侧 upsert —— 主键之外的行必须原样留着', () => {
  it('② 两个不同 name ⇒ 两行都在(阳性对照:防把 upsert 写成"每次清空整张表")', async () => {
    process.chdir(tmpCwd);
    writeLocalPlugin('aaa', { name: 'p-aaa', version: '1.0.0' });
    writeLocalPlugin('bbb', { name: 'p-bbb', version: '1.0.0' });

    await installPlugin('./aaa');
    await installPlugin('./bbb');
    // 再来一次覆盖安装:只有 p-aaa 那一行被改写,p-bbb 一字不动
    writeLocalPlugin('aaa2', { name: 'p-aaa', version: '2.0.0' });
    await installPlugin('./aaa2');

    const names = readRegistry().records.map((r) => r.name).sort();
    expect(names).toEqual(['p-aaa', 'p-bbb']);
    expect(rowsFor('p-aaa').map((r) => r.version)).toEqual(['2.0.0']);
    expect(rowsFor('p-bbb').map((r) => r.version)).toEqual(['1.0.0']);
  });

  it('②a 就地替换保持数组位置 ⇒ 读侧按 name 取的首行必然就是刚落的这一代', () => {
    const reg: InstallRegistry = {
      records: [
        legacyRecord('other', '0.1.0', '2025-12-01T00:00:00.000Z'),
        legacyRecord('m-b', '1.0.0', '2026-01-01T00:00:00.000Z', 'TXN-OLD'),
        legacyRecord('third', '0.2.0', '2025-12-02T00:00:00.000Z'),
      ],
    };
    const fresh: InstallRecord = {
      name: 'm-b',
      version: '2.0.0',
      sourceType: 'local',
      sourcePath: path.join(tmpCwd, 'v2'),
      installedAt: '2026-02-02T00:00:00.000Z',
      transactionId: 'TXN-NEW',
    };

    upsertInstallRecord(reg, fresh);

    expect(reg.records).toHaveLength(3);
    expect(reg.records[1]).toEqual(fresh);
    // 别的行逐字未动(顺序与内容都不变)
    expect(reg.records.map((r) => r.name)).toEqual(['other', 'm-b', 'third']);
    expect(reg.records[0].transactionId).toBeUndefined();
    expect(reg.records[2].version).toBe('0.2.0');
  });

  it('②b 主键不同(sourceType 不同)也照样各占一行 —— 来源列不在主键里,但 name 才是唯一区分', () => {
    const reg: InstallRegistry = { records: [] };
    upsertInstallRecord(reg, { name: 'x', sourceType: 'local', sourcePath: '/tmp/x', installedAt: '2026-01-01T00:00:00.000Z' });
    upsertInstallRecord(reg, { name: 'y', sourceType: 'git', sourceUrl: 'https://example.invalid/y.git', installedAt: '2026-01-02T00:00:00.000Z' });
    expect(reg.records.map((r) => r.name)).toEqual(['x', 'y']);
  });
});

// ==================== ③ 历史多行的读侧结论 ====================

describe('G-808 读侧 —— 历史同名多行不再把本轮遮蔽成 not-committed', () => {
  it('③ 手造旧格式 registry(同名两行,都带上一代事务号)→ 一次真实覆盖安装 ⇒ 恢复侧问这笔事务得 committed', async () => {
    process.chdir(tmpCwd);
    const name = 'p-legacy';
    const dest = getPluginInstallPath(name);
    // 先把"旧代码留下的两代"落进权威文件,并把 dest 目录造成第一代(v1)
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'plugin.json'), JSON.stringify({ name, version: '1.0.0' }), 'utf-8');
    fs.writeFileSync(path.join(dest, 'marker.txt'), 'v1', 'utf-8');
    saveInstallRegistry({
      records: [
        legacyRecord(name, '1.0.0', '2026-01-01T00:00:00.000Z', 'TXN-STALE-1'),
        legacyRecord(name, '2.0.0', '2026-01-02T00:00:00.000Z', 'TXN-STALE-2'),
      ],
    });

    writeLocalPlugin('v3', { name, version: '3.0.0' });
    const outcome = await installPlugin('./v3');
    expect(outcome.wasInstalled).toBe(false);

    const authority = authorityForTarget(dest);
    expect(authority).not.toBeNull();
    // ★ 本票的靶心:改前读侧在这里拿到的是**首行**(TXN-STALE-1)⇒ 恒 not-committed ⇒ 归档收不走。
    //   改后首行就是刚落的这一代 ⇒ committed。
    expect(authorityTransactionVerdict(authority!, outcome.transactionId!)).toBe('committed');

    // 判据没被放宽成"无条件绿":被取代的那两代仍判 not-committed(安全方向一字未变)
    expect(authorityTransactionVerdict(authority!, 'TXN-STALE-1')).toBe('not-committed');
    expect(authorityTransactionVerdict(authority!, 'TXN-STALE-2')).toBe('not-committed');

    // 归档被收走 ⇒ 不再堆垃圾(finalize 只在权威认这笔时才处置)
    expect(fs.existsSync(supersededPathFor(dest))).toBe(false);
    expect(leftoverSwapScratch()).toEqual([]);

    // 存量兼容如实登记:第二行(旧代码留下的)本票**不迁移**,仍在表里。
    // 它不再被任何读侧取到(首行已是本轮),但它也没被静默删掉 —— 清它属另行裁决。
    const rows = rowsFor(name);
    expect(rows).toHaveLength(2);
    expect(rows[0].transactionId).toBe(outcome.transactionId);
    expect(rows[1].transactionId).toBe('TXN-STALE-2');
  });

  it('③b 卸载删该 name 的**全部**同名行(安装目录只有一份,幸存行必谎报"还装着")', async () => {
    process.chdir(tmpCwd);
    const name = 'p-uninst';
    const dest = getPluginInstallPath(name);
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'plugin.json'), JSON.stringify({ name, version: '1.0.0' }), 'utf-8');
    saveInstallRegistry({
      records: [
        legacyRecord(name, '1.0.0', '2026-01-01T00:00:00.000Z', 'TXN-A'),
        legacyRecord(name, '2.0.0', '2026-01-02T00:00:00.000Z', 'TXN-B'),
        legacyRecord('p-keep', '1.0.0', '2026-01-03T00:00:00.000Z'),
      ],
    });

    await uninstallPlugin(name);

    expect(fs.existsSync(dest)).toBe(false);
    // 旧实现 `splice(idx, 1)` 会留下 TXN-B 那一行:目录已删而记录说装着
    expect(rowsFor(name)).toHaveLength(0);
    // 别的插件的行不受牵连
    expect(rowsFor('p-keep')).toHaveLength(1);
  });
});

// ==================== ④ G-832 第一格:历史同名多行的读侧取舍 ====================

describe('G-832 读侧 —— 历史同名多行问"当代"那一行,不再问首行', () => {
  it('④ 手造历史两行且**从未再安装** ⇒ 恢复侧问"出生时刻最新"那笔得 committed(票面验收)', () => {
    const name = 'p-hist';
    saveInstallRegistry({
      records: [
        // 旧写侧(records.push)留下的两代:首行是**最旧**那一代
        legacyRecord(name, '1.0.0', '2026-01-01T00:00:00.000Z', 'TXN-HIST-OLD'),
        legacyRecord(name, '2.0.0', '2026-01-02T00:00:00.000Z', 'TXN-HIST-NEW'),
      ],
    });

    const authority = authorityForTarget(getPluginInstallPath(name));
    expect(authority).not.toBeNull();

    // ★ 本票的靶心:改前读侧拿的是首行(TXN-HIST-OLD)⇒ 问最新那笔永远 not-committed ⇒ 归档永远收不走。
    expect(authorityTransactionVerdict(authority!, 'TXN-HIST-NEW')).toBe('committed');
    // 反向对照(判据没有被放宽成"任一同名行认了就 committed"):更早那一代仍被否认。
    // 这两条**必须成对**才把"取首行"与"按出生时刻取当代"区分开 —— 只留前一条的话,
    // "整份文档一起搜"也能蒙对 committed,而那正是别的插件/别代把本 target 洗白的形态。
    expect(authorityTransactionVerdict(authority!, 'TXN-HIST-OLD')).toBe('not-committed');

    // 存量不迁移:两行都还在(清理/合并属另行裁决,本票只改"问哪一行")
    expect(rowsFor(name)).toHaveLength(2);
  });

  it('④b 出生时刻**并列** ⇒ 取数组靠后那条(后写的行覆盖先写的行,且结论确定)', () => {
    const name = 'p-tie';
    const same = '2026-03-03T00:00:00.000Z';
    saveInstallRegistry({
      records: [
        legacyRecord(name, '1.0.0', same, 'TXN-TIE-FIRST'),
        legacyRecord(name, '2.0.0', same, 'TXN-TIE-LAST'),
      ],
    });

    const authority = authorityForTarget(getPluginInstallPath(name));
    expect(authorityTransactionVerdict(authority!, 'TXN-TIE-LAST')).toBe('committed');
    // 并列时选"靠后"而不是"靠前":这一条把首行语义与并列兜底彻底分开
    expect(authorityTransactionVerdict(authority!, 'TXN-TIE-FIRST')).toBe('not-committed');
  });

  it('④c 量不到的 installedAt 一律当**最旧**,绝不冒充"最新"(脏数据不得抢走当代那一行)', () => {
    const name = 'p-dirty';
    saveInstallRegistry({
      records: [
        // 首行时刻不可解析(盘上外部数据完全可能这样),第二行是一个**更早**的真时刻。
        // 若把"量不到"当成最新 ⇒ 会选中首行 ⇒ 本用例翻红;按"量不到=最旧"则第二行赢。
        legacyRecord(name, '1.0.0', 'not-a-timestamp', 'TXN-GARBAGE'),
        legacyRecord(name, '2.0.0', '2026-01-01T00:00:00.000Z', 'TXN-DATED'),
      ],
    });

    const authority = authorityForTarget(getPluginInstallPath(name));
    expect(authorityTransactionVerdict(authority!, 'TXN-DATED')).toBe('committed');
    expect(authorityTransactionVerdict(authority!, 'TXN-GARBAGE')).toBe('not-committed');

    // 两条都量不到(缺键 + 空串)⇒ 仍按"靠后"取,结论确定而不是抛错/判不出
    fs.mkdirSync(path.dirname(getRegistryPath()), { recursive: true });
    fs.writeFileSync(
      getRegistryPath(),
      JSON.stringify({
        records: [
          { name, version: '1.0.0', sourceType: 'local', transactionId: 'TXN-NONE-1' },
          { name, version: '2.0.0', sourceType: 'local', installedAt: '', transactionId: 'TXN-NONE-2' },
        ],
      }),
      'utf-8',
    );
    expect(authorityTransactionVerdict(authority!, 'TXN-NONE-2')).toBe('committed');
    expect(authorityTransactionVerdict(authority!, 'TXN-NONE-1')).toBe('not-committed');
  });

  it('④d name 过滤先于时刻取舍:别的插件留下更晚的时刻也不得把本 target 洗成已提交', () => {
    const name = 'p-scope';
    saveInstallRegistry({
      records: [
        legacyRecord(name, '1.0.0', '2026-01-01T00:00:00.000Z', 'TXN-MINE'),
        legacyRecord('p-other', '9.9.9', '2099-01-01T00:00:00.000Z', 'TXN-OTHER-PLUGIN'),
      ],
    });

    const authority = authorityForTarget(getPluginInstallPath(name));
    // 整份文档搜的话这里会得 committed —— 正是既有注释点名要防的那一型
    expect(authorityTransactionVerdict(authority!, 'TXN-OTHER-PLUGIN')).toBe('not-committed');
    expect(authorityTransactionVerdict(authority!, 'TXN-MINE')).toBe('committed');
  });

  it('④e 端到端:历史两行 + 遗留归档 ⇒ 恢复侧真的把归档收走(读侧结论落到处置上)', async () => {
    const name = 'p-recover';
    const target = getPluginInstallPath(name);
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'old.txt'), 'old', 'utf-8');
    fs.writeFileSync(path.join(target, 'plugin.json'), JSON.stringify({ name, version: '1.0.0' }), 'utf-8');

    saveInstallRegistry({
      records: [
        legacyRecord(name, '1.0.0', '2026-01-01T00:00:00.000Z', 'TXN-GEN-OLD'),
        legacyRecord(name, '2.0.0', '2026-01-02T00:00:00.000Z', 'TXN-GEN-NEW'),
      ],
    });

    // 用生产原语造现场(判据吃的必须是真实形态的归档与 marker)
    const staging = prepareStagingDirectory(target);
    fs.writeFileSync(path.join(staging, 'new.txt'), 'new', 'utf-8');
    const swap = takeOwnershipOfTarget(target, staging);
    landStagedSwap(swap);
    const archive = swap.superseded as string;
    // 归档 marker 属于"最新那一代"的那笔事务(它才是历史里当代的那一行);
    // 写者身份改成外进程,配合注入的判活=false ⇒ 走"dead"这一档
    fs.writeFileSync(
      path.join(archive, swapMarkerName()),
      JSON.stringify({
        transactionId: 'TXN-GEN-NEW',
        target,
        stagedAt: new Date().toISOString(),
        ownerPid: 424242,
        ownerId: 'another-process',
        authorityPath: getRegistryPath(),
        authorityKey: name,
      }),
      'utf-8',
    );

    const deadWriter = async (): Promise<boolean> => false;
    const outcomes = await recoverStaleSwapArtifacts(target, { isPidAlive: deadWriter });

    // 改前:首行(TXN-GEN-OLD)被问 ⇒ not-committed ⇒ 两代并存一律 left-as-is ⇒ 垃圾永久堆着
    expect(outcomes.map((o) => o.action)).toEqual(['archive-deleted']);
    expect(fs.existsSync(archive)).toBe(false);
    // 落位的新副本一字未动(恢复没有把它换回旧代)
    expect(fs.readFileSync(path.join(target, 'new.txt'), 'utf-8')).toBe('new');
    expect(leftoverSwapScratch()).toEqual([]);

    // 反向对照:同一份表、marker 写的是**更早那一代**的号 ⇒ 仍不得删(判据没被放宽成"见谁认谁")
    const staging2 = prepareStagingDirectory(target);
    fs.writeFileSync(path.join(staging2, 'new2.txt'), 'new2', 'utf-8');
    const swap2 = takeOwnershipOfTarget(target, staging2);
    landStagedSwap(swap2);
    const archive2 = swap2.superseded as string;
    fs.writeFileSync(
      path.join(archive2, swapMarkerName()),
      JSON.stringify({
        transactionId: 'TXN-GEN-OLD',
        target,
        stagedAt: new Date().toISOString(),
        ownerPid: 424242,
        ownerId: 'another-process',
        authorityPath: getRegistryPath(),
        authorityKey: name,
      }),
      'utf-8',
    );
    const outcomes2 = await recoverStaleSwapArtifacts(target, { isPidAlive: deadWriter });
    expect(outcomes2.map((o) => o.action)).toEqual(['left-as-is']);
    expect(fs.existsSync(archive2)).toBe(true);
  });
});

// ==================== ⑤ G-832 第二格:写侧"已装短路"只认当代那一条 ====================

describe('G-832 写侧 —— 已装短路只对"当代那条来自同一个源"成立', () => {
  it('⑤ 当代那条是别处装的 ⇒ 不得短路(目录里躺着的是别一代,装了 A 却还是 B)', async () => {
    process.chdir(tmpCwd);
    const name = 'p-stale-short';
    const srcA = writeLocalPlugin('a', { name, version: '1.0.0' });
    const srcB = writeLocalPlugin('b', { name, version: '2.0.0' });

    // 手造历史两行:首行是本源 A(**最旧**,正是旧短路 `records.find` 会命中的那行),
    // 第二行是别源 B 且**更新** ⇒ 当代那条是 B。
    saveInstallRegistry({
      records: [
        { ...legacyRecord(name, '1.0.0', '2026-01-01T00:00:00.000Z', 'TXN-A-OLD'), sourcePath: srcA },
        { ...legacyRecord(name, '2.0.0', '2026-02-02T00:00:00.000Z', 'TXN-B-NEW'), sourcePath: srcB },
      ],
    });

    // 让"已装"这一侧的可用性判据成立(目录可用):旧实现正是靠它把本次安装跳掉
    const dest = getPluginInstallPath(name);
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'plugin.json'), JSON.stringify({ name, version: '2.0.0' }), 'utf-8');
    fs.writeFileSync(path.join(dest, 'marker.txt'), '2.0.0', 'utf-8');

    const out = await installPlugin('./a');
    // ★ 靶心:改前短路命中首行(A)⇒ wasInstalled:true ⇒ 盘上仍是 B 那一代
    expect(out.wasInstalled).toBe(false);
    expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('1.0.0');
    // 权威表里当代那行已换成本次装的这一代(来源列 = A)
    const rows = rowsFor(name);
    expect(rows).toHaveLength(2); // 存量同名多行不迁移(清理属另行裁决)
    expect(path.basename(rows[0].sourcePath ?? '')).toBe('a');
  });

  it('⑤b 当代那条就是本源 ⇒ 短路仍然成立(阳性对照:判据没被写成"永不短路")', async () => {
    process.chdir(tmpCwd);
    const name = 'p-fresh-short';
    const srcA = writeLocalPlugin('a', { name, version: '1.0.0' });
    const srcB = writeLocalPlugin('b', { name, version: '2.0.0' });

    // 同一份两行,但**当代换成本源 A**:首行是别源 B(旧短路 `records.find` 会命中它 ——
    // 但它的谓词不匹配 ⇒ 旧实现同样不短路),第二行才是本源 A 且时刻更新。
    saveInstallRegistry({
      records: [
        { ...legacyRecord(name, '2.0.0', '2026-01-01T00:00:00.000Z', 'TXN-B-OLD'), sourcePath: srcB },
        { ...legacyRecord(name, '1.0.0', '2026-02-02T00:00:00.000Z', 'TXN-A-NEW'), sourcePath: srcA },
      ],
    });

    const dest = getPluginInstallPath(name);
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'plugin.json'), JSON.stringify({ name, version: '1.0.0' }), 'utf-8');
    fs.writeFileSync(path.join(dest, 'marker.txt'), '1.0.0', 'utf-8');

    const out = await installPlugin('./a');
    expect(out.wasInstalled).toBe(true);
    // 短路 = 什么都不动,盘上仍是原来那一代
    expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('1.0.0');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
