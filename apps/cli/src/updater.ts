/**
 * Update notifier — 启动时异步检查 npm registry,版本落后提示用户升级。
 *
 * 灵感来源:cli 的 update + minimum_version 强制检查(Rust,启动时同步拉取 manifest)。
 * 简化策略(做减法,符合 project_memory "免费"硬约束):
 *   - 异步检查(setImmediate),不阻塞启动
 *   - 24h 缓存(~/.ihui/.update-check.json),避免每次启动都打 registry
 *   - 超时 3s,失败静默(离线/无网/无包均不报错)
 *   - semver 简单比较(不引入 semver 库,只比 X.Y.Z 三段数字)
 *   - minimum_version:从本地 package.json 的 `engines.minimumVersion` 字段读取
 *     (npm 协议不强制该字段,但可用作"建议最低版本"阈值;与 registry 无关,由本项目维护)
 *
 * 配置:
 *   - IHUI_REGISTRY_URL:覆盖默认 registry(默认 https://registry.npmjs.org)
 *   - IHUI_NO_UPDATE_CHECK=1 / --no-update-check:禁用检查
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const CACHE_FILE = path.join(os.homedir(), '.ihui', '.update-check.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const FETCH_TIMEOUT_MS = 3_000;
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion?: string;
  minimumVersion?: string;
  hasUpdate: boolean;
  belowMinimum: boolean;
  checkedAt: number;
  error?: string;
}

interface CacheShape {
  checkedAt: number;
  latestVersion?: string;
}

/**
 * 读取当前包版本(从 package.json dist 路径推断)。
 * 不能用 import.meta.resolve(包不一定是 ESM 导入路径)。
 */
export function getCurrentVersion(): string {
  // src/updater.ts → dist/updater.js → package.json
  const pkgPath = path.join(__dirname, '..', 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return String(pkg.version ?? '0.0.0');
  } catch {
    return '0.0.0';
  }
}

/**
 * 读取本地 package.json 的 `engines.minimumVersion` 字段(建议最低版本阈值)。
 * 与 registry 无关,由本项目维护。
 */
export function getMinimumVersion(): string | undefined {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const v = pkg?.engines?.minimumVersion;
    return typeof v === 'string' ? v : undefined;
  } catch {
    return undefined;
  }
}

/** 简单 semver 比较(只支持 X.Y.Z 三段数字,不含 prerelease)。返回 -1/0/1。 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((s) => parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => parseInt(s, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

function readCache(): CacheShape | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as CacheShape;
    if (parsed && typeof parsed.checkedAt === 'number') return parsed;
  } catch {
    // 损坏文件忽略
  }
  return null;
}

function writeCache(data: CacheShape): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf-8');
  } catch {
    // 写入失败不影响启动
  }
}

interface RegistryPackageMeta {
  'dist-tags'?: { latest?: string };
}

async function fetchRegistryInfo(
  packageName: string,
  registryUrl: string,
): Promise<{ latestVersion?: string; error?: string }> {
  const url = `${registryUrl.replace(/\/$/, '')}/${encodeURIComponent(packageName)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const data = (await res.json()) as RegistryPackageMeta;
    return { latestVersion: data['dist-tags']?.latest };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 执行一次更新检查(读缓存或 fetch registry)。
 * 不抛异常,失败返回 hasUpdate=false 的默认结果(并填充 error 字段)。
 */
export async function checkForUpdates(
  packageName = '@ihui/cli',
  opts: { forceRefresh?: boolean; registryUrl?: string } = {},
): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentVersion();
  const minimumVersion = getMinimumVersion();
  const registryUrl = opts.registryUrl ?? process.env.IHUI_REGISTRY_URL ?? DEFAULT_REGISTRY;

  // 环境变量禁用检查
  if (process.env.IHUI_NO_UPDATE_CHECK === '1') {
    return {
      currentVersion,
      minimumVersion,
      hasUpdate: false,
      belowMinimum:
        !!minimumVersion && compareVersions(currentVersion, minimumVersion) < 0,
      checkedAt: Date.now(),
    };
  }

  const now = Date.now();
  const cache = readCache();
  const cacheFresh = cache && (now - cache.checkedAt) < CACHE_TTL_MS;

  let latestVersion: string | undefined;
  let error: string | undefined;

  if (cacheFresh && !opts.forceRefresh) {
    latestVersion = cache?.latestVersion;
  } else {
    const info = await fetchRegistryInfo(packageName, registryUrl);
    latestVersion = info.latestVersion;
    error = info.error;
    if (latestVersion && !error) {
      writeCache({ checkedAt: now, latestVersion });
    }
  }

  const hasUpdate =
    !!latestVersion && compareVersions(currentVersion, latestVersion) < 0;
  const belowMinimum =
    !!minimumVersion && compareVersions(currentVersion, minimumVersion) < 0;

  return {
    currentVersion,
    latestVersion,
    minimumVersion,
    hasUpdate,
    belowMinimum,
    checkedAt: now,
    error,
  };
}

/**
 * 异步触发更新检查(不阻塞调用方)。
 * 用于 CLI 启动时:`notifyUpdates()` 内部用 setImmediate 异步执行,
 * 在主流程退出前不会阻塞。
 *
 * 提示格式:
 *   - hasUpdate & !belowMinimum:dim 提示"新版本可用,运行 npm i -g @ihui/cli 升级"
 *   - belowMinimum:yellow 警告"当前版本低于建议最低版本 X.Y.Z,部分功能可能不可用"
 */
export function notifyUpdates(): void {
  if (process.env.IHUI_NO_UPDATE_CHECK === '1') return;
  setImmediate(() => {
    checkForUpdates()
      .then((r) => {
        if (r.belowMinimum && r.minimumVersion) {
          console.warn(
            `\n⚠ 当前版本 v${r.currentVersion} 低于建议最低版本 v${r.minimumVersion},部分功能可能不可用。请运行 \`npm i -g @ihui/cli\` 升级。\n`,
          );
        } else if (r.hasUpdate && r.latestVersion) {
          console.warn(
            `\nℹ 新版本可用:v${r.currentVersion} → v${r.latestVersion}。运行 \`npm i -g @ihui/cli\` 升级。\n`,
          );
        }
      })
      .catch(() => {
        // 静默失败
      });
  });
}
