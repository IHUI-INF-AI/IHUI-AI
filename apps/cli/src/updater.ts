// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Update notifier — 启动时异步检查 npm registry,版本落后提示用户升级。
 *
 * 灵感来源:参考行业 Agent 框架的 update + minimum_version 强制检查设计。
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
import { fileURLToPath } from 'node:url';
import { isRecord } from './util/json.js';
import { createApiRequest, resolveBaseUrl } from './commands/http-utils.js';

/**
 * 本模块所在目录。包是 ESM(`"type": "module"`),**没有** `__dirname` 这个全局 ——
 * 旧写法 `path.join(__dirname, ...)` 被外层 try/catch 吞成 `'0.0.0'` / `undefined`,
 * 于是 `getCurrentVersion()` 在 dist 里长期返回哨兵值(实测 `dist/updater.js` 仍写 `__dirname`)。
 * 这一条对闸门是致命的:版本读成 `0.0.0` ⇒ 只要服务端设了最低版本就挡住所有人。
 * 故按 index.ts:110 的既有形态用 `import.meta.url` 推导,并对"读不到版本"另设放行出口。
 */
const PKG_DIR = path.dirname(fileURLToPath(import.meta.url));
/** 版本自识别失败时的哨兵;闸门见到它一律放行(见 enforceServerMinimumVersion 的 UNKNOWN_VERSION 分支)。 */
export const UNKNOWN_VERSION = '0.0.0';

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
  /**
   * 建议最低版本这一档的**三态**结论(G-660)。`unknown` = 两端之一不可解析,
   * 此时 `belowMinimum` 一定是 false,但它**不是**"已满足最低版本"——
   * 消费面要按这一档喊"本轮判不了",不得把 false 读成 ok。
   */
  minimumStatus: 'below' | 'ok' | 'unknown';
  /** registry 那一档的三态,同上;`unknown` 时 `hasUpdate` 为 false 而不等于"已是最新"。 */
  updateStatus: 'available' | 'current' | 'unknown';
  checkedAt: number;
  error?: string;
}

/**
 * 读取当前包版本(从 package.json dist 路径推断)。
 * 不能用 import.meta.resolve(包不一定是 ESM 导入路径)。
 */
export function getCurrentVersion(): string {
  // src/updater.ts → dist/updater.js → package.json
  const pkgPath = path.join(PKG_DIR, '..', 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return String(pkg.version ?? UNKNOWN_VERSION);
  } catch {
    return UNKNOWN_VERSION;
  }
}

/**
 * 读取本地 package.json 的 `engines.minimumVersion` 字段(建议最低版本阈值)。
 * 与 registry 无关,由本项目维护。
 */
export function getMinimumVersion(): string | undefined {
  const pkgPath = path.join(PKG_DIR, '..', 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const v = pkg?.engines?.minimumVersion;
    return typeof v === 'string' ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 严格 semver 三段解析:只接受 `X.Y.Z`(全数字)。
 * 返回 null = **不可解析**,调用方不得把它折成 0 或"相等"。
 * 刻意不接受 `v` 前缀与 prerelease(`1.0.0-beta`):那一档真值是"本轮判不了",
 * 而不是"它等于 1.0.0"—— 闸门拿"等于"当放行,就会把拦不住写成合规(G-660)。
 */
export const VERSION_TRIPLE_RE = /^\d+\.\d+\.\d+$/;

export type VersionOrder = -1 | 0 | 1;

export function parseVersionTriple(version: unknown): [number, number, number] | null {
  if (typeof version !== 'string' || !VERSION_TRIPLE_RE.test(version)) return null;
  const parts = version.split('.');
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

/** 逐段整数比(两档解析口径共用这一份比较,`1.10` > `1.9`;不得再手写字符串比较)。 */
function compareTriples(
  a: [number, number, number],
  b: [number, number, number],
): VersionOrder {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  if (a[2] === b[2]) return 0;
  return a[2] < b[2] ? -1 : 1;
}

/**
 * **决策面唯一出口**:任何会拦人/改行为/触发安装的判断都必须走它。
 * 任一端不可解析 ⇒ `null`(= 未知),由调用方显式处置,不得折成 0/-1/1。
 */
export function compareVersionsOrUnknown(a: unknown, b: unknown): VersionOrder | null {
  const pa = parseVersionTriple(a);
  const pb = parseVersionTriple(b);
  if (!pa || !pb) return null;
  return compareTriples(pa, pb);
}

/**
 * 宽松档(旧口径,**只允许用于展示面**):逐段 `parseInt … || 0` 后比较。
 * 它把 `1.0.0-beta` 读成 `1.0.0`、把 `invalid` 读成 `0.0.0` —— 这两条折叠在
 * "要不要提示有更新"上无害,在闸门上是致命的(见 G-660:同一个不可解析版本,
 * `enforceServerMinimumVersion` 一律放行、`decideGate` 判成低于最低版并挡人)。
 * 新代码请一律用 {@link compareVersionsOrUnknown}。
 */
export function compareVersions(a: string, b: string): number {
  const fold = (v: string): [number, number, number] => {
    const p = v.split('.').map((s) => parseInt(s, 10) || 0);
    return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
  };
  return compareTriples(fold(a), fold(b));
}

/**
 * 缓存原始结构。`minGate` 是服务端最低版本闸门的结论(G-243)：
 * 复用同一个文件而不是再开一个 `~/.ihui/.min-version-gate.json` —— 一次启动一份状态,
 * 少一个孤儿文件,也少一个"两个文件说不同话"的对账面。**写任何一方都必须合并,不得整块覆盖**,
 * 否则 24h 的 registry 检查会把刚拿到的闸门结论抹掉(反之亦然)。
 */
interface CacheShape {
  checkedAt: number;
  latestVersion?: string;
  minGate?: GateCacheShape;
}

/** 读原始 JSON(不做形状校验,合并写回时要保住另一方的键);损坏/不存在 ⇒ null。 */
function readRawCache(cacheFile: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(cacheFile)) return null;
    const parsed: unknown = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** 合并写回:只覆盖 patch 里点名的键,其余键(另一方写的结论)原样保留。 */
function mergeWriteCache(cacheFile: string, patch: Record<string, unknown>): void {
  try {
    const dir = path.dirname(cacheFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const base = readRawCache(cacheFile) ?? {};
    fs.writeFileSync(cacheFile, JSON.stringify({ ...base, ...patch }), 'utf-8');
  } catch {
    // 写入失败不影响启动,也不影响本次结论
  }
}

function readCache(): CacheShape | null {
  const parsed = readRawCache(CACHE_FILE);
  if (parsed && typeof parsed.checkedAt === 'number') return parsed as unknown as CacheShape;
  return null;
}

function writeCache(data: CacheShape): void {
  mergeWriteCache(CACHE_FILE, {
    checkedAt: data.checkedAt,
    ...(data.latestVersion === undefined ? {} : { latestVersion: data.latestVersion }),
  });
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
 * 「当前版本 vs 建议最低版本」的三态结论(G-660 的唯一判定出口)。
 * 没有配最低版本 ⇒ `ok`(服务端明确要求过"不拦");任一端不可解析 ⇒ `unknown`。
 * `unknown` 与 `ok` 都不拦人,但**含义相反**:前者是"本轮判不了",必须喊出来。
 */
export function versionOutcome(
  currentVersion: unknown,
  minimumVersion: string | undefined | null,
): { belowMinimum: boolean; minimumStatus: 'below' | 'ok' | 'unknown' } {
  if (!minimumVersion) return { belowMinimum: false, minimumStatus: 'ok' };
  const cmp = compareVersionsOrUnknown(currentVersion, minimumVersion);
  if (cmp === null) return { belowMinimum: false, minimumStatus: 'unknown' };
  return { belowMinimum: cmp < 0, minimumStatus: cmp < 0 ? 'below' : 'ok' };
}

/** 「当前版本 vs registry 最新版」的三态结论,口径同上(不可解析 ⇒ 不催更,但报名"判不了")。 */
export function updateOutcome(
  currentVersion: unknown,
  latestVersion: string | undefined | null,
): { hasUpdate: boolean; updateStatus: 'available' | 'current' | 'unknown' } {
  if (!latestVersion) return { hasUpdate: false, updateStatus: 'unknown' };
  const cmp = compareVersionsOrUnknown(currentVersion, latestVersion);
  if (cmp === null) return { hasUpdate: false, updateStatus: 'unknown' };
  return cmp < 0
    ? { hasUpdate: true, updateStatus: 'available' }
    : { hasUpdate: false, updateStatus: 'current' };
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
      ...updateOutcome(currentVersion, null),
      ...versionOutcome(currentVersion, minimumVersion),
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

  return {
    currentVersion,
    latestVersion,
    minimumVersion,
    ...updateOutcome(currentVersion, latestVersion),
    ...versionOutcome(currentVersion, minimumVersion),
    checkedAt: now,
    error,
  };
}

// =============================================================================
// 服务端可下发的最低版本闸门(G-243,2026-09-27)
// =============================================================================
//
// 与上面 registry 那条链的区别:registry 只回答"有没有新版",这一条回答"服务端要求最低几版"。
// 三条不可动摇的判据(用户拍板"默认可远程改"时立下的):
//   1. 问不到 / 超时 / 形状不认识 / 值写坏 ⇒ **一律放行**,但必须留下一条可读痕迹(静默放行 = 伪造完整性);
//   2. 真拦下时给可读原因 + 可复制的升级出口(不得是裸错误码);
//   3. 默认档必须是"不拦"。
//
// 文案语言:本文件在守门 70(硬编码中文基线棘轮)的射程内,`updater.ts` 的额度 2 已被上面
// 那两条 registry 提示占满,而新增 i18n 键要改 `packages/i18n/messages/cli/*` 五语 + 重跑翻译流水线
// (不在本票文件清单内)。故闸门文案走英文技术文案 + 服务端 reason 原样透传(中文在服务端)。
// 这是一个**如实登记的缺口**,不是"已收口"。

/** 闸门结论的缓存寿命:服务端随时可改,所以不能沿用 registry 那条的 24h。 */
const GATE_CACHE_TTL_MS = 10 * 60 * 1000;
/** 有界等待:超过这个数就按"问不到"处理 ⇒ 放行。 */
const GATE_FETCH_TIMEOUT_MS = 1_500;
/** 导出给探针与诊断出口用,避免第二份路径字面量。 */
export const GATE_PATH = '/api/app-version/min-cli-version';
export const GATE_TIMEOUT_MS = GATE_FETCH_TIMEOUT_MS;
export const UPGRADE_COMMAND = 'npm i -g @ihui/cli';
/** 拦下时的退出码:78 = BSD sysexits 的 EX_CONFIG(配置类错误,需人工升级后重试)。 */
export const EXIT_CODE_BELOW_MINIMUM = 78;

/** 与 api 侧 `app-version.ts` 的 MIN_VERSION_RE 同形,不另立一套版本协议。 */
const SERVER_MIN_VERSION_RE = /^\d+\.\d+\.\d+$/;

/** 服务端事实:minimumVersion=null 表示"服务端没有要求"。 */
export interface ServerMinVersionFacts {
  minimumVersion: string | null;
  source: string;
  reason: string;
}

/** 一次闸门的结论 —— 三个字段各自回答一条判据。 */
export interface GateResult {
  /** 问过没有(没问 ⇒ 连"放行"都不该写成结论)。 */
  asked: boolean;
  blocked: boolean;
  /**
   * 结论是不是**量出来的**(G-660)。`determined:false` ⇒ 这一轮没有可比的两端
   * (版本自识别失败 / 响应形状不认识),此时 `blocked` 恒为 false,但那**不是**
   * "已满足最低版本"——消费面必须喊"本轮无法判定",不得把它读成 pass。
   */
  determined: boolean;
  currentVersion: string;
  requiredVersion: string | null;
  source: string;
  reason: string;
}

interface GateCacheShape {
  checkedAt: number;
  minimumVersion: string | null;
  source: string;
  reason: string;
}

/** 闸门可注入面 —— 测试靠它把网络/时钟/退出这三件事隔开,生产全走默认值。 */
export interface GateDeps {
  baseUrl?: string;
  currentVersion?: string;
  now?: number;
  request?: (baseUrl: string, timeoutMs: number) => Promise<unknown>;
  warn?: (line: string) => void;
  exit?: (code: number) => void;
  cacheFile?: string;
}

const gateApiRequest = createApiRequest('', GATE_FETCH_TIMEOUT_MS);

/**
 * 把响应折成事实。返回 null = **形状不认识**(与"服务端没要求"是两件事,前者记 source=unknown)。
 */
export function parseServerMinVersion(raw: unknown): ServerMinVersionFacts | null {
  const data = isRecord(raw) && isRecord(raw.data) ? raw.data : null;
  if (!data || !('minimumVersion' in data)) return null;
  const source = typeof data.source === 'string' ? data.source : 'unknown';
  const reason = typeof data.reason === 'string' && data.reason ? data.reason : 'server gave no reason';
  const value = data.minimumVersion;
  if (value === null) return { minimumVersion: null, source, reason };
  if (typeof value !== 'string' || !SERVER_MIN_VERSION_RE.test(value)) {
    return {
      minimumVersion: null,
      source: 'invalid',
      reason: `unparsable minimumVersion from server: ${JSON.stringify(value)}`,
    };
  }
  return { minimumVersion: value, source, reason };
}

/** 比较:复用本文件既有的 compareVersions(逐段整数比,`1.10` > `1.9`),不手写字符串比较。 */
export function decideGate(currentVersion: string, facts: ServerMinVersionFacts | null): GateResult {
  if (!facts) {
    return {
      asked: true,
      blocked: false,
      determined: false,
      currentVersion,
      requiredVersion: null,
      source: 'unknown',
      reason: 'response shape not recognised, failing open',
    };
  }
  if (facts.minimumVersion === null) {
    // 服务端明确回答了"没有最低版本要求" ⇒ 这是一个**判定结论**,不是没判。
    return {
      asked: true,
      blocked: false,
      determined: true,
      currentVersion,
      requiredVersion: null,
      source: facts.source,
      reason: facts.reason,
    };
  }
  // G-660:哨兵版本(package.json 读不到时 getCurrentVersion 返回 '0.0.0')形状上可解析,
  // 拿它去比会把"所有人都低于最低版"写成事实;而 enforceServerMinimumVersion 对同一事实
  // 一律放行 —— 两条消费点对同一个版本给相反答案。现两处同尺:不可信 ⇒ determined:false 且不拦。
  const cmp =
    currentVersion === UNKNOWN_VERSION ? null : compareVersionsOrUnknown(currentVersion, facts.minimumVersion);
  if (cmp === null) {
    return {
      asked: true,
      blocked: false,
      determined: false,
      currentVersion,
      requiredVersion: facts.minimumVersion,
      source: facts.source,
      reason: `cannot compare current version ${JSON.stringify(currentVersion)} against required ${facts.minimumVersion} — NOT the same as satisfying it（本轮无法判定，放行是降级选择，不是结论）— ${facts.reason}`,
    };
  }
  const below = cmp < 0;
  // 服务端那句"这个值是哪来的"必须原样带进结论 —— 闸门挡人时,人要能一句话问出真值来源。
  return {
    asked: true,
    blocked: below,
    determined: true,
    currentVersion,
    requiredVersion: facts.minimumVersion,
    source: facts.source,
    reason: below
      ? `server requires >= ${facts.minimumVersion} — ${facts.reason}`
      : `current version satisfies the server minimum ${facts.minimumVersion} — ${facts.reason}`,
  };
}

/**
 * 闸门结论读自同一份 `.update-check.json` 的 `minGate` 键(见 CacheShape 的注释)。
 * 单独一份文件 = 两个地方描述同一次启动,迟早互相指认。
 */
function readGateCache(cacheFile: string): GateCacheShape | null {
  const raw = readRawCache(cacheFile);
  const entry = raw && isRecord(raw.minGate) ? raw.minGate : null;
  if (!entry) return null;
  if (typeof entry.checkedAt !== 'number') return null;
  if (typeof entry.source !== 'string' || typeof entry.reason !== 'string') return null;
  const mv = entry.minimumVersion;
  if (mv !== null && typeof mv !== 'string') return null;
  return { checkedAt: entry.checkedAt, minimumVersion: mv, source: entry.source, reason: entry.reason };
}

function writeGateCache(cacheFile: string, r: GateResult, checkedAt: number): void {
  const entry: GateCacheShape = {
    checkedAt,
    minimumVersion: r.requiredVersion,
    source: r.source,
    reason: r.reason,
  };
  // 合并写回:不得把 registry 那条的 checkedAt/latestVersion 整块盖掉(反之 registry 也不能盖掉它)
  mergeWriteCache(cacheFile, { minGate: entry });
}

/** 拦下时的出口 —— 当前版本、要求版本、真值来源、服务端理由、可复制的升级命令,一个都不能少。 */
export function renderBlockMessage(r: GateResult): string {
  return [
    '',
    `✗ IHUI CLI is too old to keep running: current v${r.currentVersion} is below the minimum v${r.requiredVersion} required by the server.`,
    `  requirement source : ${r.source}`,
    `  server said        : ${r.reason}`,
    `  fix              : run \`${UPGRADE_COMMAND}\` and retry this command.`,
    '',
  ].join('\n');
}

/** 留痕行 —— 放行也要有,否则"闸门没起作用"与"闸门起了且判放行"在终端上长得一样。 */
export function renderTrailLine(r: GateResult, endpoint: string): string {
  // 三态不得并成两桶(G-660):"没判出来"打成 pass,读日志的人就以为闸门通过了这条版本检查。
  const verdict = r.blocked ? 'BLOCK' : r.determined ? 'pass' : 'UNDETERMINED';
  return `ℹ version gate [${verdict}] ${endpoint} → asked=${r.asked} source=${r.source} required=${r.requiredVersion ?? 'none'} current=${r.currentVersion} — ${r.reason}`;
}

function notAsked(currentVersion: string, reason: string): GateResult {
  return {
    asked: false,
    blocked: false,
    determined: false,
    currentVersion,
    requiredVersion: null,
    source: 'none',
    reason,
  };
}

/**
 * 问一次服务端(不折成结论、不判放行)—— 闸门与问责探针共用的**唯一**出口。
 * 走 `commands/http-utils.ts` 既有的 `createApiRequest`(守门 73 的存量清单里已有它),
 * 不在端内新起第二套裸 fetch。
 */
export function fetchServerMinVersion(
  baseUrl: string,
  timeoutMs: number = GATE_FETCH_TIMEOUT_MS,
): Promise<unknown> {
  return gateApiRequest(baseUrl, GATE_PATH, { timeoutMs });
}

/**
 * 问一次服务端并给出结论。本函数**不**退出进程,退出由调用方(notifyUpdates)决定,
 * 这样它既能被 await,也能被单测直接判。
 */
export async function enforceServerMinimumVersion(deps: GateDeps = {}): Promise<GateResult> {
  const warn = deps.warn ?? ((line: string) => console.warn(line));
  const currentVersion = deps.currentVersion ?? getCurrentVersion();
  const now = deps.now ?? Date.now();
  const cacheFile = deps.cacheFile ?? CACHE_FILE;
  const baseUrl = deps.baseUrl ?? resolveBaseUrl(undefined);
  const endpoint = `${baseUrl}${GATE_PATH}`;
  const request = deps.request ?? fetchServerMinVersion;

  if (process.env.IHUI_NO_UPDATE_CHECK === '1') {
    return notAsked(currentVersion, 'update check disabled (IHUI_NO_UPDATE_CHECK=1)');
  }
  if (currentVersion === UNKNOWN_VERSION) {
    // 版本自识别失败 ⇒ 一律放行。没有"当前版本"就没有可比的两端,拿哨兵去比会把所有人挡在门外。
    return notAsked(currentVersion, 'cannot determine own version (package.json unreadable), failing open');
  }

  let result: GateResult;
  try {
    const raw = await request(baseUrl, GATE_FETCH_TIMEOUT_MS);
    result = decideGate(currentVersion, parseServerMinVersion(raw));
  } catch (e) {
    // 网络失败 / 非 2xx / 超时 ⇒ 放行,但必须喊出来
    result = {
      asked: true,
      blocked: false,
      determined: false,
      currentVersion,
      requiredVersion: null,
      source: 'unreachable',
      reason: `could not reach the server (${e instanceof Error ? e.message : String(e)}), failing open`,
    };
  }
  writeGateCache(cacheFile, result, now);
  warn(renderTrailLine(result, endpoint));
  return result;
}

/**
 * 同步落点:拿新鲜的既有结论决定是否在 action 启动前就拦下。
 *
 * 为什么需要它:index.ts 的 preAction 挂点是 `notifyUpdates();`(**没有 await**,改它不在本票
 * 文件清单内),所以异步拿到的结论无法保证先于命令执行。缓存把"上一次问到的结论"变成
 * 本次启动可以同步判定的事实 ⇒ 拦截落在任何 action 之前,不是"跑了一半被 kill"。
 * 缓存过期(GATE_CACHE_TTL_MS)即视为没有结论 ⇒ 放行 + 重新问。
 */
function blockFromFreshCache(deps: Required<Pick<GateDeps, 'currentVersion' | 'now' | 'cacheFile' | 'warn' | 'exit'>>): void {
  if (deps.currentVersion === UNKNOWN_VERSION) return;
  const cached = readGateCache(deps.cacheFile);
  if (!cached) return;
  if (deps.now - cached.checkedAt >= GATE_CACHE_TTL_MS) return;
  if (cached.minimumVersion === null) return;
  const r = decideGate(deps.currentVersion, {
    minimumVersion: cached.minimumVersion,
    source: cached.source,
    reason: `${cached.reason}（缓存结论，问于 ${new Date(cached.checkedAt).toISOString()}）`,
  });
  if (!r.determined) return; // 本轮判不了 ⇒ 不得拿一条"无法判定"的缓存结论去退出进程
  if (!r.blocked) return;
  deps.warn(renderBlockMessage(r));
  deps.exit(EXIT_CODE_BELOW_MINIMUM);
}

/**
 * 异步触发更新检查 + 服务端最低版本闸门(不阻塞调用方)。
 *
 * 提示格式:
 *   - 闸门拦下:打印当前版本 / 要求版本 / 真值来源 / 升级出口,退出码 78
 *   - hasUpdate & !belowMinimum:dim 提示"新版本可用,运行 npm i -g @ihui/cli 升级"
 *   - belowMinimum:yellow 警告"当前版本低于建议最低版本 X.Y.Z,部分功能可能不可用"
 */
export function notifyUpdates(deps: GateDeps = {}): void {
  if (process.env.IHUI_NO_UPDATE_CHECK === '1') return;
  const warn = deps.warn ?? ((line: string) => console.warn(line));
  const exit = deps.exit ?? ((code: number): void => {
    process.exit(code);
  });
  blockFromFreshCache({
    currentVersion: deps.currentVersion ?? getCurrentVersion(),
    now: deps.now ?? Date.now(),
    cacheFile: deps.cacheFile ?? CACHE_FILE,
    warn,
    exit,
  });
  setImmediate(() => {
    void enforceServerMinimumVersion({ ...deps, warn })
      .then((r) => {
        // 本轮现问现判:低于 ⇒ 同一份出口。index.ts 的挂点没有 await 本函数,所以这一支可能落在
        // 命令已经开始之后 —— 上面 blockFromFreshCache 那一条保证下一次启动必然先拦后跑。
        if (r.blocked) {
          warn(renderBlockMessage(r));
          exit(EXIT_CODE_BELOW_MINIMUM);
        }
      })
      .catch(() => {
        // enforceServerMinimumVersion 已把失败折成"放行 + 留痕",到这里只剩写盘/渲染类异常
      });
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

// =============================================================================
// 更新检查结果一致性状态机(b75-2#1,2026-09-30)
// =============================================================================
//
// 上游 ZCode desktop autoUpdater 的"异步结果一致性"机制降维。检查是异步的而触发源有
// 多个(启动自动检查 / 用户手动检查),两条结论在空中交错时,迟到的那条**不得覆盖**
// 已被更新的状态。checkForUpdates 本体维持既有形态(被既有测试钉死),本状态机作为
// 独立出口承接这组不变量:
//   - generation 门:每次真正发起的检查持有一个递增代数;结算时对不上号的结论整体丢弃,
//     不许碰 latest / notified / skip 任何一面(自动+手动并发的迟到结果就死在这);
//   - 互斥:自动触发在检查中只拒并不重入;手动触发可以取代在途检查(旧结论从此变 stale);
//   - 通道不匹配:结果携带的 channel 与本进程通道不符 ⇒ 丢弃 + 留痕;
//   - 失败回退:取数失败/抛错 ⇒ 回 idle 可检查态(非终态),不污染任何记忆面;
//   - 同版本不二次通知:notifiedVersion 备忘,同版本重复结算只喊一次;
//   - skip 语义:skipVersion 记住的版本在自动检查里不再催;手动检查清掉 skip。

/** 检查状态机的状态:idle=可检查 / checking=在途(失败也回 idle,没有失败终态)。 */
export type UpdateCheckMachineState = 'idle' | 'checking';

/** 一次检查取回的事实(注入面自行决定来源;error 在场 = 本次失败)。 */
export interface UpdateCheckFacts {
  latestVersion?: string;
  /** 该结果所属的发布通道;与本进程通道不符 ⇒ 整条丢弃。 */
  channel?: string;
  error?: string;
}

export interface UpdateCheckMachineDeps {
  currentVersion: string;
  /** 本进程的发布通道;结果的 channel 与之不符 ⇒ 丢弃 + 留痕。 */
  channel: string;
  /** 异步取数(注入;单测手工 resolve/reject,不发真网)。 */
  fetchLatest: () => Promise<UpdateCheckFacts>;
  /** 丢弃/失败留痕(迟到结果、通道不匹配、取数失败都要可读,不静默吞)。 */
  log?: (line: string) => void;
  /** 有效且有更新的结算出口;同版本重复结算不会二次进入。 */
  notify?: (info: { currentVersion: string; latestVersion: string }) => void;
}

export interface UpdateCheckMachine {
  readonly state: UpdateCheckMachineState;
  /** 已发起的最大检查代数(单调递增;stale 判定的对照面)。 */
  readonly generation: number;
  /** 最近一次**有效**结算的最新版(stale/失败/通道不符都不会写它)。 */
  readonly latestVersion: string | null;
  /** 最近一次实际通知过的版本(同版本不二次通知的对照面)。 */
  readonly notifiedVersion: string | null;
  readonly skippedVersion: string | null;
  /** 发起检查。manual=true 清 skip;自动触发在途时拒并(返回 false);手动触发取代在途(旧结论变 stale)。 */
  beginCheck(opts?: { manual?: boolean }): boolean;
  /** 记住一个"别再催"的版本(自动检查生效;手动检查清空)。 */
  skipVersion(version: string): void;
}

export function createUpdateCheckMachine(deps: UpdateCheckMachineDeps): UpdateCheckMachine {
  const log = deps.log ?? (() => {});
  let state: UpdateCheckMachineState = 'idle';
  let generation = 0;
  let latest: string | null = null;
  let notified: string | null = null;
  let skipped: string | null = null;

  const settle = (gen: number, facts: UpdateCheckFacts): void => {
    // generation 门:对不上号 = 迟到结果,整体丢弃(这是并发两次检查不互相覆盖的唯一闸)
    if (gen !== generation || state !== 'checking') {
      log(`[update-check] stale result dropped (generation ${gen}, current ${generation})`);
      return;
    }
    if (facts.error) {
      // 失败回退:回 idle 可检查态(非终态);latest/notified 保持上次的有效结论
      state = 'idle';
      log(`[update-check] check failed, back to idle: ${facts.error}`);
      return;
    }
    if (facts.channel !== undefined && facts.channel !== deps.channel) {
      // 通道不匹配:丢弃 + 留痕,不冒充本通道的结论
      state = 'idle';
      log(
        `[update-check] result for channel ${JSON.stringify(facts.channel)} dropped (this process is ${JSON.stringify(deps.channel)})`,
      );
      return;
    }
    state = 'idle';
    const v = facts.latestVersion;
    if (!v) return;
    latest = v;
    if (notified === v) return; // 同版本不二次通知
    if (skipped === v) return; // 用户明确跳过的版本不催(手动检查已在 beginCheck 清 skip)
    const cmp = compareVersionsOrUnknown(deps.currentVersion, v);
    if (cmp === null || cmp >= 0) return; // 不可解析/不比当前新 ⇒ 不催(unknown 不冒充结论)
    notified = v;
    deps.notify?.({ currentVersion: deps.currentVersion, latestVersion: v });
  };

  return {
    get state() {
      return state;
    },
    get generation() {
      return generation;
    },
    get latestVersion() {
      return latest;
    },
    get notifiedVersion() {
      return notified;
    },
    get skippedVersion() {
      return skipped;
    },
    beginCheck(opts = {}) {
      if (state === 'checking' && !opts.manual) return false; // 互斥:自动触发并线,不重入
      if (opts.manual && skipped !== null) {
        // 手动检查清 skip:用户主动来问,就该给全量结论
        skipped = null;
        log('[update-check] manual check clears skipped version');
      }
      generation += 1;
      state = 'checking';
      const gen = generation; // 代数必须在发起时定格 —— 结算时重读就放进了迟到结果
      void deps.fetchLatest().then(
        (facts) => settle(gen, facts),
        (e: unknown) => settle(gen, { error: e instanceof Error ? e.message : String(e) }),
      );
      return true;
    },
    skipVersion(version: string) {
      skipped = version;
    },
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
