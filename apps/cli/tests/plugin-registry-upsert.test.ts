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

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import { getInstalledPluginsDir, getPluginInstallPath } from '../src/plugins/paths.js';
import {
  authorityForTarget,
  authorityTransactionVerdict,
  supersededPathFor,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
