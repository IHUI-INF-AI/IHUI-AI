// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plugins Marketplace 路径管理 — 集中维护 ~/.ihui 下各类子路径。
 *
 * 设计:
 *   - 所有路径以 getHomeDir() 为根,支持 IHUI_HOME 环境变量覆盖(测试用)
 *   - 不创建目录,仅返回路径(目录创建由调用方负责)
 *   - 纯函数,无副作用,可安全并发调用
 *
 * 路径布局:
 *   ~/.ihui/
 *     installed-plugins/        ← 已装插件目录(每插件一子目录)
 *       registry.json           ← 安装记录注册表
 *     marketplace-cache/        ← Git URL 远程仓库缓存(sha1(url) 哈希)
 *     plugin-data/<name>/       ← 插件运行时数据(卸载时可选保留)
 */
import * as path from 'node:path';
import * as os from 'node:os';

/** 测试用 home 覆盖环境变量(优先级最高) */
const HOME_OVERRIDE_ENV = 'IHUI_HOME';

/**
 * 获取用户 home 目录。
 * 优先级:IHUI_HOME > HOME > USERPROFILE > os.homedir()。
 */
export function getHomeDir(): string {
  return process.env[HOME_OVERRIDE_ENV] || process.env.HOME || process.env.USERPROFILE || os.homedir();
}

/** ~/.ihui 根目录 */
export function getIhuiRoot(): string {
  return path.join(getHomeDir(), '.ihui');
}

/** ~/.ihui/installed-plugins/ — 已装插件目录 */
export function getInstalledPluginsDir(): string {
  return path.join(getIhuiRoot(), 'installed-plugins');
}

/** ~/.ihui/marketplace-cache/ — Git URL 缓存根目录 */
export function getMarketplaceCacheDir(): string {
  return path.join(getIhuiRoot(), 'marketplace-cache');
}

/** ~/.ihui/plugin-data/ — 插件运行时数据根目录(卸载时的边界面) */
export function getPluginDataRoot(): string {
  return path.join(getIhuiRoot(), 'plugin-data');
}

/**
 * 插件名安全判据:只允许单段目录名。
 *
 * `manifest.name` 是**源仓可控**的字符串,而它直接参与 `path.join(..., name)`:
 * `../x` / `a/b` / 绝对路径都能把安装目录/数据目录派生到 ~/.ihui 之外(安装 =
 * 任意目录写入,卸载 = 任意目录删除)。此判据在**路径派生的唯一出口**做 fail-closed,
 * 不依赖任何调用方记得先校验。
 */
const SAFE_PLUGIN_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export class UnsafePluginNameError extends Error {
  constructor(name: string) {
    super(`插件名含非法字符,拒绝派生路径: ${JSON.stringify(name)}`);
    this.name = 'UnsafePluginNameError';
  }
}

/** 校验并返回插件名;不安全即抛错(路径不许派生)。 */
export function assertSafePluginName(name: string): string {
  if (
    typeof name !== 'string' ||
    name === '.' ||
    name === '..' ||
    !SAFE_PLUGIN_NAME.test(name) ||
    name.includes('/') ||
    name.includes('\\')
  ) {
    throw new UnsafePluginNameError(name);
  }
  return name;
}

/** ~/.ihui/plugin-data/<name>/ — 插件运行时数据目录 */
export function getPluginDataDir(name: string): string {
  return path.join(getPluginDataRoot(), assertSafePluginName(name));
}

/** ~/.ihui/installed-plugins/<name>/ — 单个插件安装路径 */
export function getPluginInstallPath(name: string): string {
  return path.join(getInstalledPluginsDir(), assertSafePluginName(name));
}

/** ~/.ihui/installed-plugins/registry.json — 安装注册表路径 */
export function getRegistryPath(): string {
  return path.join(getInstalledPluginsDir(), 'registry.json');
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
