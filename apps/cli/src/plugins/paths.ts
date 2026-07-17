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

/** ~/.ihui/plugin-data/<name>/ — 插件运行时数据目录 */
export function getPluginDataDir(name: string): string {
  return path.join(getIhuiRoot(), 'plugin-data', name);
}

/** ~/.ihui/installed-plugins/<name>/ — 单个插件安装路径 */
export function getPluginInstallPath(name: string): string {
  return path.join(getInstalledPluginsDir(), name);
}

/** ~/.ihui/installed-plugins/registry.json — 安装注册表路径 */
export function getRegistryPath(): string {
  return path.join(getInstalledPluginsDir(), 'registry.json');
}
