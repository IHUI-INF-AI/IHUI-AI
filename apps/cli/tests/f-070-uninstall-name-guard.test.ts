// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-070 回归:部分修复的卸载 name 校验缺「registry 里有该记录才动」这一格。
 *
 * 钉四件事(逐条对应票面验收):
 *   ① 卸载 `..` —— assertSafePluginName 白名单拒,不产生任何删除;
 *   ② 卸载绝对路径 —— 同上,目录原样存在;
 *   ③ 卸载 registry 无记录的合法 name —— 新闸门拒绝,即便安装根下同名目录真的存在也一概不删
 *      (这是 F-070 的核心缺口:旧写法只看 installPresence==='present',攻击者只要能让目标目录
 *      出现在安装根下,就能借一次「卸载」清掉它);
 *   ④ registry 有该记录的正常 name —— 照常卸载,目录与 plugin-data 被清,registry 行也摘掉。
 *
 * 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir(),走 mkScratch/rmScratch。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import { getInstalledPluginsDir, getPluginDataRoot, getRegistryPath } from '../src/plugins/paths.js';
import { loadInstallRegistry, saveInstallRegistry, uninstallPlugin, type InstallRecord } from '../src/plugins/installer.js';

const HOME_ENV = 'IHUI_HOME';

let tmpHome: string;
let savedHome: string | undefined;

beforeEach(() => {
  tmpHome = mkScratch('f070-home-');
  savedHome = process.env[HOME_ENV];
  process.env[HOME_ENV] = tmpHome;
});

afterEach(() => {
  if (savedHome === undefined) delete process.env[HOME_ENV];
  else process.env[HOME_ENV] = savedHome;
  rmScratch(tmpHome);
});

/** 在安装根下造一个同名目录(不代表已登记),用来证明新闸门不因「目录在」就放行删除。 */
function seedOrphanInstallDir(name: string): string {
  const installDir = path.join(getInstalledPluginsDir(), name);
  fs.mkdirSync(installDir, { recursive: true });
  fs.writeFileSync(path.join(installDir, 'plugin.json'), '{}', 'utf-8');
  return installDir;
}

/** 显式登记一条安装记录,并把对应目录也造出来 —— 模拟「真的装过」的状态。 */
function seedRegisteredPlugin(name: string): { installDir: string; dataDir: string } {
  const installDir = seedOrphanInstallDir(name);
  const dataDir = path.join(getPluginDataRoot(), name);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'state.json'), '{}', 'utf-8');
  const record: InstallRecord = {
    name,
    version: '1.0.0',
    sourceType: 'local',
    installedAt: '2026-11-01T00:00:00.000Z',
    transactionId: `txn-${name}`,
  } as InstallRecord;
  saveInstallRegistry({ records: [record] });
  return { installDir, dataDir };
}

describe('F-070 卸载 name 校验', () => {
  it('① 卸载 `..` 被白名单拒,不产生任何删除', async () => {
    // `..` 解析后就是安装根本身;若闸门失守,fs.rmSync 会把整个 plugins 目录掀掉
    fs.mkdirSync(getInstalledPluginsDir(), { recursive: true });
    const marker = path.join(getInstalledPluginsDir(), 'sentinel.txt');
    fs.writeFileSync(marker, 'keep', 'utf-8');

    await expect(uninstallPlugin('..')).rejects.toThrow(/非法字符/);
    expect(fs.existsSync(marker)).toBe(true);
    expect(fs.existsSync(getInstalledPluginsDir())).toBe(true);
  });

  it('② 卸载绝对路径被白名单拒,目标目录原样存在', async () => {
    const outside = mkScratch('f070-outside-');
    try {
      const keep = path.join(outside, 'keep.txt');
      fs.writeFileSync(keep, 'keep', 'utf-8');
      await expect(uninstallPlugin(outside)).rejects.toThrow(/非法字符/);
      expect(fs.existsSync(keep)).toBe(true);
    } finally {
      rmScratch(outside);
    }
  });

  it('③ registry 无记录的合法 name 被拒,同名目录未被删(F-070 核心缺口)', async () => {
    const installDir = seedOrphanInstallDir('ghost-plugin');
    // 此时 registry.json 不存在或不含 ghost-plugin 的行 —— loadInstallRegistry 返回空表
    expect(loadInstallRegistry().records.find((r) => r.name === 'ghost-plugin')).toBeUndefined();

    await expect(uninstallPlugin('ghost-plugin')).rejects.toThrow(
      /未在插件安装记录中找到 "ghost-plugin"/,
    );
    // 关键断言:目录一个字节都没动 —— F-070 补的就是这一格
    expect(fs.existsSync(installDir)).toBe(true);
    expect(fs.existsSync(path.join(installDir, 'plugin.json'))).toBe(true);
    // registry 也没被改写(避免半途把"未登记"洗成"已登记")
    if (fs.existsSync(getRegistryPath())) {
      expect(loadInstallRegistry().records.find((r) => r.name === 'ghost-plugin')).toBeUndefined();
    }
  });

  it('③b registry 空表时同样拒绝,即便安装根下同名目录存在', async () => {
    const installDir = seedOrphanInstallDir('orphan-plugin');
    // 显式写一个空表,确认拒绝不是"文件不存在时的偶然短路"
    saveInstallRegistry({ records: [] });

    await expect(uninstallPlugin('orphan-plugin')).rejects.toThrow(/未在插件安装记录中找到/);
    expect(fs.existsSync(installDir)).toBe(true);
  });

  it('④ 正常 name:registry 有记录时照常卸载,目录、plugin-data、registry 行三者都清', async () => {
    const { installDir, dataDir } = seedRegisteredPlugin('good-plugin');

    const outcome = await uninstallPlugin('good-plugin');

    expect(outcome.name).toBe('good-plugin');
    expect(outcome.removedPath).toBe(installDir);
    expect(outcome.hadData).toBe(true);
    expect(fs.existsSync(installDir)).toBe(false);
    expect(fs.existsSync(dataDir)).toBe(false);
    expect(loadInstallRegistry().records.find((r) => r.name === 'good-plugin')).toBeUndefined();
  });

  it('④b keepData=true 时仍保留 plugin-data(不改既有语义)', async () => {
    const { installDir, dataDir } = seedRegisteredPlugin('keep-plugin');

    const outcome = await uninstallPlugin('keep-plugin', { keepData: true });

    expect(outcome.hadData).toBe(true);
    expect(fs.existsSync(installDir)).toBe(false);
    expect(fs.existsSync(dataDir)).toBe(true);
    expect(loadInstallRegistry().records.find((r) => r.name === 'keep-plugin')).toBeUndefined();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
