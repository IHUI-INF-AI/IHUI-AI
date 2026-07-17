/**
 * Plugin Marketplace 远程插件市场测试 — 覆盖 paths / cache / marketplace / installer 全部 API。
 *
 * 测试策略:
 *   - 用 os.tmpdir() + mkdtemp 模拟 ~/.ihui(通过 IHUI_HOME 环境变量覆盖)
 *   - 用 IHUI_MOCK_GIT_CLONE_SRC 模拟 git clone 成功(避免真实网络)
 *   - 用 IHUI_GIT_BIN 指向不存在路径模拟无网络
 *   - installer 测试用 process.chdir 切到临时 cwd(原 cwd 在 afterEach 恢复)
 *   - 符号链接测试根据平台能力条件运行(Windows 用 junction,Unix 用 symlink)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

import {
  getIhuiRoot,
  getInstalledPluginsDir,
  getMarketplaceCacheDir,
  getPluginInstallPath,
  getPluginDataDir,
  getRegistryPath,
} from '../src/plugins/paths.js';
import {
  getCachePath,
  getOrCloneGitCache,
  clearMarketplaceCache,
} from '../src/plugins/cache.js';
import {
  scanMarketplace,
  findPluginInIndex,
  isLocalSource,
  isGitSource,
  type MarketplaceIndex,
} from '../src/plugins/marketplace.js';
import {
  installPlugin,
  installMarketplacePlugin,
  uninstallPlugin,
  loadInstallRegistry,
  saveInstallRegistry,
  PluginManifestMissingError,
  PluginPathUnsafeError,
  type InstallRegistry,
} from '../src/plugins/installer.js';

// ==================== 符号链接能力检测 ====================

/** 跨平台创建目录符号链接(Windows 用 junction 不需要管理员权限) */
function createDirSymlink(target: string, linkPath: string): void {
  if (process.platform === 'win32') {
    fs.symlinkSync(target, linkPath, 'junction');
  } else {
    fs.symlinkSync(target, linkPath, 'dir');
  }
}

let canSymlink = false;
try {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-sym-cap-'));
  const l = path.join(t, 'link');
  createDirSymlink(t, l);
  canSymlink = fs.lstatSync(l).isSymbolicLink();
  fs.rmSync(t, { recursive: true, force: true });
} catch {
  canSymlink = false;
}

// ==================== 公共测试夹具 ====================

describe('Plugin Marketplace', () => {
  let tmpHome: string;
  let tmpCwd: string;
  let tmpMarketplace: string;
  let originalCwd: string;
  let originalHomeEnv: string | undefined;
  let originalMockEnv: string | undefined;
  let originalGitBinEnv: string | undefined;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-home-'));
    tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cwd-'));
    tmpMarketplace = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-mp-'));
    originalCwd = process.cwd();
    originalHomeEnv = process.env.IHUI_HOME;
    originalMockEnv = process.env.IHUI_MOCK_GIT_CLONE_SRC;
    originalGitBinEnv = process.env.IHUI_GIT_BIN;
    process.env.IHUI_HOME = tmpHome;
    delete process.env.IHUI_MOCK_GIT_CLONE_SRC;
    delete process.env.IHUI_GIT_BIN;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalHomeEnv !== undefined) process.env.IHUI_HOME = originalHomeEnv;
    else delete process.env.IHUI_HOME;
    if (originalMockEnv !== undefined) process.env.IHUI_MOCK_GIT_CLONE_SRC = originalMockEnv;
    else delete process.env.IHUI_MOCK_GIT_CLONE_SRC;
    if (originalGitBinEnv !== undefined) process.env.IHUI_GIT_BIN = originalGitBinEnv;
    else delete process.env.IHUI_GIT_BIN;
    fs.rmSync(tmpHome, { recursive: true, force: true });
    fs.rmSync(tmpCwd, { recursive: true, force: true });
    fs.rmSync(tmpMarketplace, { recursive: true, force: true });
  });

  // ==================== paths.ts 测试 ====================

  describe('paths.ts', () => {
    it('getIhuiRoot 返回 <IHUI_HOME>/.ihui', () => {
      expect(getIhuiRoot()).toBe(path.join(tmpHome, '.ihui'));
    });

    it('getInstalledPluginsDir 返回 <root>/installed-plugins', () => {
      expect(getInstalledPluginsDir()).toBe(path.join(tmpHome, '.ihui', 'installed-plugins'));
    });

    it('getMarketplaceCacheDir 返回 <root>/marketplace-cache', () => {
      expect(getMarketplaceCacheDir()).toBe(path.join(tmpHome, '.ihui', 'marketplace-cache'));
    });

    it('getPluginInstallPath 返回 <installed-plugins>/<name>', () => {
      expect(getPluginInstallPath('foo')).toBe(
        path.join(tmpHome, '.ihui', 'installed-plugins', 'foo'),
      );
    });

    it('getRegistryPath 返回 <installed-plugins>/registry.json', () => {
      expect(getRegistryPath()).toBe(
        path.join(tmpHome, '.ihui', 'installed-plugins', 'registry.json'),
      );
    });
  });

  // ==================== cache.ts 测试 ====================

  describe('cache.ts', () => {
    it('getCachePath 返回 sha1(url) 哈希路径', () => {
      const url = 'https://github.com/x/y.git';
      const expectedHash = crypto.createHash('sha1').update(url).digest('hex');
      const expected = path.join(getMarketplaceCacheDir(), expectedHash);
      expect(getCachePath(url)).toBe(expected);
    });

    it('getOrCloneGitCache 缓存命中时返回 fromCache=true', async () => {
      const url = 'https://github.com/x/cache-hit.git';
      const cachePath = getCachePath(url);
      fs.mkdirSync(cachePath, { recursive: true });
      fs.writeFileSync(path.join(cachePath, 'marker.txt'), 'cached');
      // 默认 TTL 内,直接命中
      const result = await getOrCloneGitCache(url);
      expect(result.fromCache).toBe(true);
      expect(result.localPath).toBe(cachePath);
      expect(fs.existsSync(path.join(result.localPath, 'marker.txt'))).toBe(true);
    });

    it('TTL 过期触发重新 clone', async () => {
      const url = 'https://github.com/x/ttl-refresh.git';
      const cachePath = getCachePath(url);
      // 预创建旧缓存
      fs.mkdirSync(cachePath, { recursive: true });
      fs.writeFileSync(path.join(cachePath, 'old-marker.txt'), 'old');
      const oldTime = new Date(Date.now() - 60 * 60 * 1000);
      fs.utimesSync(cachePath, oldTime, oldTime);

      // mock clone 源(新内容)
      const mockSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-mock-src-'));
      try {
        fs.writeFileSync(path.join(mockSrc, 'new-marker.txt'), 'new');
        process.env.IHUI_MOCK_GIT_CLONE_SRC = mockSrc;

        const result = await getOrCloneGitCache(url, { ttlMs: 1000 });
        expect(result.fromCache).toBe(false);
        expect(result.localPath).toBe(cachePath);
        // 新内容存在
        expect(fs.existsSync(path.join(result.localPath, 'new-marker.txt'))).toBe(true);
        // 旧内容被替换
        expect(fs.existsSync(path.join(result.localPath, 'old-marker.txt'))).toBe(false);
      } finally {
        fs.rmSync(mockSrc, { recursive: true, force: true });
      }
    });

    it('clearMarketplaceCache 清空所有缓存条目', () => {
      const url1 = 'https://github.com/x/clear1.git';
      const url2 = 'https://github.com/x/clear2.git';
      fs.mkdirSync(getCachePath(url1), { recursive: true });
      fs.mkdirSync(getCachePath(url2), { recursive: true });
      expect(fs.existsSync(getCachePath(url1))).toBe(true);
      expect(fs.existsSync(getCachePath(url2))).toBe(true);

      clearMarketplaceCache();

      expect(fs.existsSync(getCachePath(url1))).toBe(false);
      expect(fs.existsSync(getCachePath(url2))).toBe(false);
      // 缓存根目录仍存在
      expect(fs.existsSync(getMarketplaceCacheDir())).toBe(true);
    });

    it('无网络时降级复用过期缓存(不抛错)', async () => {
      const url = 'https://github.com/x/offline.git';
      const cachePath = getCachePath(url);
      // 预创建旧缓存
      fs.mkdirSync(cachePath, { recursive: true });
      fs.writeFileSync(path.join(cachePath, 'cached.txt'), 'data');
      const oldTime = new Date(Date.now() - 60 * 60 * 1000);
      fs.utimesSync(cachePath, oldTime, oldTime);

      // 模拟无网络:git 二进制不存在
      process.env.IHUI_GIT_BIN = path.join(tmpHome, 'nonexistent-git-binary');

      const result = await getOrCloneGitCache(url, { ttlMs: 1000 });
      expect(result.fromCache).toBe(true);
      expect(result.localPath).toBe(cachePath);
      expect(fs.existsSync(path.join(result.localPath, 'cached.txt'))).toBe(true);
    });

    it('无缓存且 git 失败时抛错(无降级路径)', async () => {
      const url = 'https://github.com/x/no-cache-fail.git';
      // 不创建缓存
      process.env.IHUI_GIT_BIN = path.join(tmpHome, 'nonexistent-git-binary');
      await expect(getOrCloneGitCache(url)).rejects.toThrow();
    });
  });

  // ==================== marketplace.ts 测试 ====================

  describe('marketplace.ts', () => {
    it('scanMarketplace 按 .grok-plugin > .claude-plugin > 根 优先级查找', () => {
      // 三个候选都存在,验证 .grok-plugin 优先
      fs.mkdirSync(path.join(tmpMarketplace, '.grok-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpMarketplace, '.grok-plugin', 'marketplace.json'),
        JSON.stringify({ name: 'grok-mp', plugins: [] }),
      );
      fs.mkdirSync(path.join(tmpMarketplace, '.claude-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpMarketplace, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({ name: 'claude-mp', plugins: [] }),
      );
      fs.writeFileSync(
        path.join(tmpMarketplace, 'marketplace.json'),
        JSON.stringify({ name: 'root-mp', plugins: [] }),
      );

      let scan = scanMarketplace(tmpMarketplace);
      expect(scan.found).toBe(true);
      expect(scan.index?.name).toBe('grok-mp');
      expect(scan.indexPath).toBe(path.join(tmpMarketplace, '.grok-plugin', 'marketplace.json'));

      // 移除 .grok-plugin,验证 .claude-plugin 接管
      fs.rmSync(path.join(tmpMarketplace, '.grok-plugin', 'marketplace.json'));
      scan = scanMarketplace(tmpMarketplace);
      expect(scan.found).toBe(true);
      expect(scan.index?.name).toBe('claude-mp');

      // 移除 .claude-plugin,验证根接管
      fs.rmSync(path.join(tmpMarketplace, '.claude-plugin', 'marketplace.json'));
      scan = scanMarketplace(tmpMarketplace);
      expect(scan.found).toBe(true);
      expect(scan.index?.name).toBe('root-mp');
    });

    it('scanMarketplace 未找到任何候选返回 found=false', () => {
      const scan = scanMarketplace(tmpMarketplace);
      expect(scan.found).toBe(false);
      expect(scan.index).toBeUndefined();
      expect(scan.indexPath).toBe('');
    });

    it('scanMarketplace 损坏 JSON 返回 found=false', () => {
      fs.mkdirSync(path.join(tmpMarketplace, '.grok-plugin'), { recursive: true });
      const corruptPath = path.join(tmpMarketplace, '.grok-plugin', 'marketplace.json');
      fs.writeFileSync(corruptPath, '{ not valid json');

      const scan = scanMarketplace(tmpMarketplace);
      expect(scan.found).toBe(false);
      expect(scan.index).toBeUndefined();
      // indexPath 指向损坏文件,便于诊断
      expect(scan.indexPath).toBe(corruptPath);
    });

    it('findPluginInIndex 按 name 精确匹配', () => {
      const index: MarketplaceIndex = {
        name: 'test',
        plugins: [
          { name: 'foo', source: './foo' },
          { name: 'bar', source: './bar' },
        ],
      };
      expect(findPluginInIndex(index, 'foo')?.source).toBe('./foo');
      expect(findPluginInIndex(index, 'bar')?.source).toBe('./bar');
      expect(findPluginInIndex(index, 'nonexistent')).toBeUndefined();
    });

    it('findPluginInIndex qualifier 匹配 tags/keywords/domains/category 别名', () => {
      const index: MarketplaceIndex = {
        name: 'test',
        plugins: [
          {
            name: 'foo',
            source: './foo',
            tags: ['experimental'],
            keywords: ['kw1'],
            domains: ['dev'],
            category: 'cat-x',
          },
          { name: 'foo', source: './foo2', tags: ['stable'] },
        ],
      };
      // qualifier 匹配 tags(第一个)
      expect(findPluginInIndex(index, 'foo', 'experimental')?.source).toBe('./foo');
      // qualifier 匹配 keywords
      expect(findPluginInIndex(index, 'foo', 'kw1')?.source).toBe('./foo');
      // qualifier 匹配 domains
      expect(findPluginInIndex(index, 'foo', 'dev')?.source).toBe('./foo');
      // qualifier 匹配 category
      expect(findPluginInIndex(index, 'foo', 'cat-x')?.source).toBe('./foo');
      // qualifier 匹配 tags(第二个)
      expect(findPluginInIndex(index, 'foo', 'stable')?.source).toBe('./foo2');
      // qualifier 不匹配任何别名
      expect(findPluginInIndex(index, 'foo', 'nonexistent')).toBeUndefined();
      // 不传 qualifier 返回首个
      expect(findPluginInIndex(index, 'foo')?.source).toBe('./foo');
    });

    it('isLocalSource 三态判定正确', () => {
      // 字符串相对路径 → true
      expect(isLocalSource('./plugins/foo')).toBe(true);
      // { type: 'local' } → true
      expect(isLocalSource({ type: 'local', path: './plugins/foo' })).toBe(true);
      // { source: 'url' } → false
      expect(isLocalSource({ source: 'url', url: 'https://x.git' })).toBe(false);
    });

    it('isGitSource 三态判定正确', () => {
      // 字符串 → false
      expect(isGitSource('./plugins/foo')).toBe(false);
      // { type: 'local' } → false
      expect(isGitSource({ type: 'local', path: './plugins/foo' })).toBe(false);
      // { source: 'url' } → true
      expect(isGitSource({ source: 'url', url: 'https://x.git' })).toBe(true);
    });
  });

  // ==================== installer.ts 测试 ====================

  describe('installer.ts', () => {
    it('loadInstallRegistry 空文件返回空注册表', () => {
      const regPath = getRegistryPath();
      fs.mkdirSync(path.dirname(regPath), { recursive: true });
      fs.writeFileSync(regPath, ''); // 空文件
      const reg = loadInstallRegistry();
      expect(reg.records).toEqual([]);
    });

    it('loadInstallRegistry 文件不存在返回空注册表', () => {
      const reg = loadInstallRegistry();
      expect(reg.records).toEqual([]);
    });

    it('saveInstallRegistry 写入注册表并可读回', () => {
      const reg: InstallRegistry = {
        records: [
          {
            name: 'saved-plugin',
            version: '1.0.0',
            sourceType: 'local',
            sourcePath: '/some/path',
            installedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      };
      saveInstallRegistry(reg);

      const regPath = getRegistryPath();
      expect(fs.existsSync(regPath)).toBe(true);
      const raw = fs.readFileSync(regPath, 'utf-8');
      const parsed = JSON.parse(raw) as InstallRegistry;
      expect(parsed.records).toHaveLength(1);
      expect(parsed.records[0]?.name).toBe('saved-plugin');
      expect(parsed.records[0]?.sourceType).toBe('local');
    });

    it('installPlugin 本地路径安装成功', async () => {
      process.chdir(tmpCwd);
      fs.mkdirSync(path.join(tmpCwd, 'my-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpCwd, 'my-plugin', 'plugin.json'),
        JSON.stringify({ name: 'my-plugin', version: '1.0.0', description: 'test' }),
      );

      const outcome = await installPlugin('./my-plugin');
      expect(outcome.name).toBe('my-plugin');
      expect(outcome.version).toBe('1.0.0');
      expect(outcome.source).toBe('local');
      expect(outcome.wasInstalled).toBe(false);
      expect(outcome.installedPath).toBe(getPluginInstallPath('my-plugin'));
      expect(fs.existsSync(path.join(outcome.installedPath, 'plugin.json'))).toBe(true);

      // registry 应有记录
      const reg = loadInstallRegistry();
      const record = reg.records.find((r) => r.name === 'my-plugin');
      expect(record).toBeDefined();
      expect(record?.sourceType).toBe('local');
    });

    it('installPlugin 拒绝包含 .. 的越界路径', async () => {
      process.chdir(tmpCwd);
      await expect(installPlugin('./../outside')).rejects.toThrow(PluginPathUnsafeError);
    });

    it('installPlugin 拒绝符号链接逃逸', async () => {
      if (!canSymlink) {
        console.warn('跳过符号链接测试:当前环境不支持创建符号链接');
        return;
      }
      process.chdir(tmpCwd);
      // 创建 tmpCwd 外部的目标目录(含 plugin.json,模拟可安装)
      const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-sym-target-'));
      try {
        fs.writeFileSync(
          path.join(targetDir, 'plugin.json'),
          JSON.stringify({ name: 'evil', version: '1.0.0' }),
        );
        // 在 tmpCwd 内创建符号链接指向外部
        const linkPath = path.join(tmpCwd, 'evil-link');
        createDirSymlink(targetDir, linkPath);

        await expect(installPlugin('./evil-link')).rejects.toThrow(PluginPathUnsafeError);
      } finally {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    });

    it('installPlugin 缺 plugin.json 抛 PluginManifestMissingError', async () => {
      process.chdir(tmpCwd);
      fs.mkdirSync(path.join(tmpCwd, 'no-manifest'), { recursive: true });
      // 不创建 plugin.json
      await expect(installPlugin('./no-manifest')).rejects.toThrow(PluginManifestMissingError);
    });

    it('installPlugin 已装短路返回 wasInstalled=true', async () => {
      process.chdir(tmpCwd);
      fs.mkdirSync(path.join(tmpCwd, 'dup-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpCwd, 'dup-plugin', 'plugin.json'),
        JSON.stringify({ name: 'dup-plugin', version: '1.0.0' }),
      );

      const first = await installPlugin('./dup-plugin');
      expect(first.wasInstalled).toBe(false);

      const second = await installPlugin('./dup-plugin');
      expect(second.wasInstalled).toBe(true);
      expect(second.installedPath).toBe(first.installedPath);

      // registry 只有一条记录(去重)
      const reg = loadInstallRegistry();
      const records = reg.records.filter((r) => r.name === 'dup-plugin');
      expect(records).toHaveLength(1);
    });

    it('installPlugin Git URL 安装成功(通过 mock clone)', async () => {
      // 创建 mock clone 源(模拟 git clone 结果)
      const mockSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-git-src-'));
      try {
        fs.writeFileSync(
          path.join(mockSrc, 'plugin.json'),
          JSON.stringify({ name: 'git-plugin', version: '2.0.0' }),
        );
        process.env.IHUI_MOCK_GIT_CLONE_SRC = mockSrc;

        const outcome = await installPlugin('https://github.com/x/git-plugin.git');
        expect(outcome.name).toBe('git-plugin');
        expect(outcome.version).toBe('2.0.0');
        expect(outcome.source).toBe('git:url');
        expect(outcome.wasInstalled).toBe(false);
        expect(fs.existsSync(path.join(outcome.installedPath, 'plugin.json'))).toBe(true);

        // registry 记录
        const reg = loadInstallRegistry();
        const record = reg.records.find((r) => r.name === 'git-plugin');
        expect(record).toBeDefined();
        expect(record?.sourceType).toBe('git');
        expect(record?.sourceUrl).toBe('https://github.com/x/git-plugin.git');
      } finally {
        fs.rmSync(mockSrc, { recursive: true, force: true });
      }
    });

    it('installMarketplacePlugin 通过 marketplace 索引查找并安装', async () => {
      // 创建 marketplace 索引(.grok-plugin 优先级)
      fs.mkdirSync(path.join(tmpMarketplace, '.grok-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpMarketplace, '.grok-plugin', 'marketplace.json'),
        JSON.stringify({
          name: 'test-marketplace',
          owner: { name: 'tester' },
          plugins: [
            {
              name: 'mp-plugin',
              version: '1.2.3',
              description: 'from marketplace',
              source: './plugins/mp-plugin',
              tags: ['official'],
            },
          ],
        }),
      );
      // 创建插件源
      fs.mkdirSync(path.join(tmpMarketplace, 'plugins', 'mp-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpMarketplace, 'plugins', 'mp-plugin', 'plugin.json'),
        JSON.stringify({ name: 'mp-plugin', version: '1.2.3', description: 'from marketplace' }),
      );

      const outcome = await installMarketplacePlugin('mp-plugin', tmpMarketplace);
      expect(outcome.name).toBe('mp-plugin');
      expect(outcome.version).toBe('1.2.3');
      expect(outcome.source).toBe('local');
      expect(outcome.wasInstalled).toBe(false);
      expect(outcome.installedPath).toBe(getPluginInstallPath('mp-plugin'));
      expect(fs.existsSync(path.join(outcome.installedPath, 'plugin.json'))).toBe(true);

      // registry 记录
      const reg = loadInstallRegistry();
      expect(reg.records.find((r) => r.name === 'mp-plugin')).toBeDefined();
    });

    it('installMarketplacePlugin qualifier 别名查找', async () => {
      fs.mkdirSync(path.join(tmpMarketplace, '.grok-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpMarketplace, '.grok-plugin', 'marketplace.json'),
        JSON.stringify({
          name: 'test-marketplace',
          plugins: [
            { name: 'multi', source: './plugins/multi-a', tags: ['variant-a'] },
            { name: 'multi', source: './plugins/multi-b', tags: ['variant-b'] },
          ],
        }),
      );
      // 只创建 variant-b 的源
      fs.mkdirSync(path.join(tmpMarketplace, 'plugins', 'multi-b'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpMarketplace, 'plugins', 'multi-b', 'plugin.json'),
        JSON.stringify({ name: 'multi', version: '1.0.0' }),
      );

      // 用 qualifier=variant-b 选中第二个
      const outcome = await installMarketplacePlugin('multi', tmpMarketplace, 'variant-b');
      expect(outcome.name).toBe('multi');
      expect(outcome.wasInstalled).toBe(false);
      expect(fs.existsSync(path.join(outcome.installedPath, 'plugin.json'))).toBe(true);
    });

    it('installMarketplacePlugin 未找到索引抛错', async () => {
      await expect(installMarketplacePlugin('foo', tmpMarketplace)).rejects.toThrow(
        /marketplace 索引未找到/,
      );
    });

    it('installMarketplacePlugin 插件不存在抛错', async () => {
      fs.mkdirSync(path.join(tmpMarketplace, '.grok-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpMarketplace, '.grok-plugin', 'marketplace.json'),
        JSON.stringify({ name: 'test', plugins: [] }),
      );
      await expect(installMarketplacePlugin('nonexistent', tmpMarketplace)).rejects.toThrow(
        /未在 marketplace 中找到/,
      );
    });

    it('uninstallPlugin 成功删除已装插件', async () => {
      process.chdir(tmpCwd);
      fs.mkdirSync(path.join(tmpCwd, 'uninstall-target'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpCwd, 'uninstall-target', 'plugin.json'),
        JSON.stringify({ name: 'uninstall-target', version: '1.0.0' }),
      );
      await installPlugin('./uninstall-target');

      const installPath = getPluginInstallPath('uninstall-target');
      expect(fs.existsSync(installPath)).toBe(true);

      const outcome = await uninstallPlugin('uninstall-target');
      expect(outcome.name).toBe('uninstall-target');
      expect(outcome.removedPath).toBe(installPath);
      expect(outcome.hadData).toBe(false);
      expect(fs.existsSync(installPath)).toBe(false);

      // registry 已移除
      const reg = loadInstallRegistry();
      expect(reg.records.find((r) => r.name === 'uninstall-target')).toBeUndefined();
    });

    it('uninstallPlugin 卸载不存在的插件不抛错', async () => {
      const outcome = await uninstallPlugin('nonexistent-plugin');
      expect(outcome.name).toBe('nonexistent-plugin');
      expect(outcome.removedPath).toBe('');
      expect(outcome.hadData).toBe(false);
    });

    it('uninstallPlugin keepData=true 保留 plugin-data', async () => {
      process.chdir(tmpCwd);
      fs.mkdirSync(path.join(tmpCwd, 'keep-data-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpCwd, 'keep-data-plugin', 'plugin.json'),
        JSON.stringify({ name: 'keep-data-plugin', version: '1.0.0' }),
      );
      await installPlugin('./keep-data-plugin');

      // 创建 plugin-data
      const dataDir = getPluginDataDir('keep-data-plugin');
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(path.join(dataDir, 'state.json'), '{}');

      const installPath = getPluginInstallPath('keep-data-plugin');
      const outcome = await uninstallPlugin('keep-data-plugin', { keepData: true });
      expect(outcome.hadData).toBe(true);
      expect(outcome.removedPath).toBe(installPath);
      // 安装目录已删
      expect(fs.existsSync(installPath)).toBe(false);
      // 数据目录保留
      expect(fs.existsSync(dataDir)).toBe(true);
      expect(fs.existsSync(path.join(dataDir, 'state.json'))).toBe(true);

      // registry 已移除
      const reg = loadInstallRegistry();
      expect(reg.records.find((r) => r.name === 'keep-data-plugin')).toBeUndefined();
    });

    it('uninstallPlugin 默认删除 plugin-data', async () => {
      process.chdir(tmpCwd);
      fs.mkdirSync(path.join(tmpCwd, 'del-data-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpCwd, 'del-data-plugin', 'plugin.json'),
        JSON.stringify({ name: 'del-data-plugin', version: '1.0.0' }),
      );
      await installPlugin('./del-data-plugin');

      const dataDir = getPluginDataDir('del-data-plugin');
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(path.join(dataDir, 'state.json'), '{}');

      const outcome = await uninstallPlugin('del-data-plugin');
      expect(outcome.hadData).toBe(true);
      // 数据目录已删
      expect(fs.existsSync(dataDir)).toBe(false);
    });
  });
});
