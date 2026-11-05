// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BUG-0002 回归:插件名不可信 —— 不得把未校验名称拼进路径后递归删除。
 *
 * 钉三件事:
 *   - `../` 逃逸:卸载被拒,根目录外的受害目录与文件原样存在;
 *   - 绝对路径 / 盘符 / 裸 `..`:白名单直接拒,且不产生任何删除;
 *   - 反向对照:合法插件名照常卸载(安装目录 + plugin-data 被删),不误伤正常路径。
 * 符号链接场景单列(宿主不允许建链接时跳过),验证 realpath 断言能挡住根外指向。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs';

import { getInstalledPluginsDir, getPluginDataRoot } from '../src/plugins/paths.js';
import { assertSafePluginName, uninstallPlugin } from '../src/plugins/installer.js';

const HOME_ENV = 'IHUI_HOME';

let tmpHome: string;
let savedHome: string | undefined;

beforeEach(() => {
  tmpHome = mkScratch('bug0002-home-');
  savedHome = process.env[HOME_ENV];
  process.env[HOME_ENV] = tmpHome;
});

afterEach(() => {
  if (savedHome === undefined) delete process.env[HOME_ENV];
  else process.env[HOME_ENV] = savedHome;
  rmScratch(tmpHome);
});

function seedPlugin(name: string): void {
  const installDir = path.join(getInstalledPluginsDir(), name);
  const dataDir = path.join(getPluginDataRoot(), name);
  fs.mkdirSync(installDir, { recursive: true });
  fs.writeFileSync(path.join(installDir, 'plugin.json'), '{}', 'utf-8');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'state.json'), '{}', 'utf-8');
}

describe('BUG-0002 插件名白名单', () => {
  it('合法名称通过', () => {
    expect(assertSafePluginName('good-plugin')).toBe('good-plugin');
    expect(assertSafePluginName('good_plugin.v2')).toBe('good_plugin.v2');
  });

  it.each(['../victim', '..', '.', '../../etc', '/etc/passwd', 'C:\\Windows\\evil', 'a/b', 'a\\b', 'name with space'])(
    '非法名称 %s 被拒',
    (name) => {
      expect(() => assertSafePluginName(name)).toThrow(/非法字符/);
    },
  );
});

describe('BUG-0002 卸载路径穿越', () => {
  it('`../` 逃逸被拒,根外受害目录不丢文件', async () => {
    const victim = path.join(tmpHome, 'victim');
    fs.mkdirSync(victim, { recursive: true });
    const keep = path.join(victim, 'keep.txt');
    fs.writeFileSync(keep, 'keep', 'utf-8');

    await expect(uninstallPlugin('../victim')).rejects.toThrow(/非法字符/);
    expect(fs.existsSync(keep)).toBe(true);
  });

  it('绝对路径逃逸被拒,目标目录原样存在', async () => {
    const outside = mkScratch('bug0002-outside-');
    try {
      const keep = path.join(outside, 'keep.txt');
      fs.writeFileSync(keep, 'keep', 'utf-8');
      await expect(uninstallPlugin(outside)).rejects.toThrow(/非法字符/);
      expect(fs.existsSync(keep)).toBe(true);
    } finally {
      rmScratch(outside);
    }
  });

  it('正常插件不受影响:安装目录与 plugin-data 均被删除', async () => {
    seedPlugin('good-plugin');
    const outcome = await uninstallPlugin('good-plugin');
    expect(outcome.name).toBe('good-plugin');
    expect(outcome.hadData).toBe(true);
    expect(fs.existsSync(path.join(getInstalledPluginsDir(), 'good-plugin'))).toBe(false);
    expect(fs.existsSync(path.join(getPluginDataRoot(), 'good-plugin'))).toBe(false);
  });

  it('keepData 仍保留 plugin-data', async () => {
    seedPlugin('keep-plugin');
    const outcome = await uninstallPlugin('keep-plugin', { keepData: true });
    expect(outcome.hadData).toBe(true);
    expect(fs.existsSync(path.join(getInstalledPluginsDir(), 'keep-plugin'))).toBe(false);
    expect(fs.existsSync(path.join(getPluginDataRoot(), 'keep-plugin'))).toBe(true);
  });

  it('安装目录为指向根外的符号链接时拒绝删除,链接目标原样保留', async (ctx) => {
    const outside = mkScratch('bug0002-link-outside-');
    const keep = path.join(outside, 'keep.txt');
    fs.writeFileSync(keep, 'keep', 'utf-8');
    const linkPath = path.join(getInstalledPluginsDir(), 'link-plugin');
    try {
      fs.mkdirSync(getInstalledPluginsDir(), { recursive: true });
      fs.symlinkSync(outside, linkPath, 'junction');
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      await expect(uninstallPlugin('link-plugin')).rejects.toThrow(/符号链接解析后落在根目录/);
      expect(fs.existsSync(keep)).toBe(true);
    } finally {
      try {
        fs.unlinkSync(linkPath);
      } catch {
        /* 链接已不存在 */
      }
      rmScratch(outside);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
