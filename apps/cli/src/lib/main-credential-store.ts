// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主凭据安全存储 —— settings.json 的 `apiKey` / `refreshToken` / `apiSecret` 不再明文落盘。
 *
 * 2026-11-06 安全债:同一个 CLI 里,MCP 凭据已经走 DPAPI/机器绑定口令文件,而主 JWT 还明文躺在
 * `~/.ihui/settings.json`。本模块把主凭据搬到**同一套**存储机制(`lib/credential-vault.ts`),
 * 不新造第二套加密。
 *
 * 落盘位置(优先 `IHUI_HOME`,回退 `~/.ihui`,与 MCP 凭据同一目录约定):
 *   - `main-credentials.json`       —— `ihuiVaultV1` 信封(域 `ihui-cli/main-credentials/v1`)
 *   - `main-cred-master.dpapi`      —— 档位①:Windows DPAPI 保护的主密钥
 *   - `main-cred-key.json`          —— 档位②:`ihuiMainKeyV1` 机器绑定主密钥信封
 *
 * 为什么是**同步**实现:settings 读取链路(`loadSettings()` / `resolveEffectiveConfig`)是同步契约,
 * 被几十个命令在模块顶层直接调用;改成 async 会把签名扩散到整个 CLI。加密原语本身是同步的,
 * DPAPI 只多一个 `execFileSync` 外壳,与 MCP 侧共用同一份脚本/候选序/缓存。
 *
 * 四条硬纪律(与本仓既有安全债口径一致):
 *   ① **不许明文落盘**:档位①②都不可用时,主凭据读写一律失败,不存在"退化成明文文件"这一档。
 *   ② **读失败必须响**:信封存在但解不开/密钥缺失 ⇒ 记录故障并让需要凭据的操作显式报错;
 *      绝不把"解不开"折成"未登录"继续跑。
 *   ③ **读通道失败不生成/不覆盖密钥**:已有主密钥信封解不开时,不换新密钥(换钥 = 旧数据永久孤儿)。
 *   ④ **跨进程不互踩**:存储写入在 `main-cred.lock` 内做"读最新 → 合并补丁 → 封存 → 回读校验";
 *      多实例各自只改自己的字段,不整份覆盖。
 *
 * 迁移:
 *   - 首次读到 home 层 settings.json 里的明文凭据时,先写安全存储并回读校验,再原子删除明文字段;
 *   - settings 备份/日志/审计文件里的**精确令牌原文**做有界清洗(仅 `~/.ihui` 与 `~/.ihui/logs`);
 *   - 迁移失败时内存中也不返回明文(加载方统一剥离字段),需要凭据的操作按 ①/② 显式报错。
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  captureWriteBaseline,
  commitAtomicWrite,
  sleepSync,
  WriteConflictError,
} from '../util/atomic-write.js';
import {
  chmodSafeSync,
  kidOfKey,
  openKeyEnvelope,
  openVaultEnvelope,
  parseKeyEnvelope,
  parseVaultEnvelope,
  probeDpapiSync,
  runDpapiSync,
  sealKeyEnvelope,
  sealVaultEnvelope,
} from './credential-vault.js';
import { randomBytes } from 'node:crypto';

const STORE_FILENAME = 'main-credentials.json';
const OS_WRAPPED_KEY_FILENAME = 'main-cred-master.dpapi';
const MACHINE_KEY_FILENAME = 'main-cred-key.json';
const LOCK_FILENAME = 'main-cred.lock';

const KEY_ENVELOPE_FIELD = 'ihuiMainKeyV1';
const DOMAIN_INFO = 'ihui-cli/main-credentials/v1';
const KEY_WRAP_INFO = 'ihui-cli/main-credentials/key-wrap/v1';
const KEY_BYTES = 32;

/** 档位钉选(测试/诊断):只允许往**低**处钉;`unavailable` 用于验证 fail-closed。 */
export const MAIN_CRED_BACKEND_ENV = 'IHUI_MAIN_CRED_BACKEND';
/** 单条凭据的长度上限:JWT/API Key 量级,超过即视为损坏,避免把整份文件当令牌。 */
const MAX_SECRET_LENGTH = 8 * 1024;

/** 跨进程锁等待上限:留给 DPAPI 冷启动/一次读改写,超时即显式失败而不是无限等。 */
const LOCK_WAIT_MS = 10_000;
/** 锁的陈旧判据:超过该时长仍未释放视为崩溃残留(正常写盘远小于它)。 */
const LOCK_STALE_MS = 30_000;
/** settings 冲突重试:只防外部编辑器/另一个非 IHUI 进程的瞬时写。 */
const SETTINGS_WRITE_RETRIES = 3;
/** 残留清洗的单文件上限:日志再大也不把整份读进内存。 */
const SCRUB_MAX_BYTES = 32 * 1024 * 1024;

export type MainCredentialField = 'apiKey' | 'refreshToken' | 'apiSecret';

export interface MainCredentials {
  apiKey?: string;
  refreshToken?: string;
  apiSecret?: string;
}

export type MainCredentialPatch = {
  [K in MainCredentialField]?: string | null;
};

export interface MainCredentialStorePaths {
  dir: string;
  storePath: string;
  osWrappedKeyPath: string;
  machineKeyPath: string;
  lockPath: string;
}

export interface MainCredentialStoreFailure {
  code: string;
  detail: string;
  remediation: string;
}

export class MainCredentialStoreError extends Error {
  readonly code: string;
  readonly remediation: string;

  constructor(failure: MainCredentialStoreFailure) {
    super(`${failure.detail}\n处置:${failure.remediation}`);
    this.name = 'MainCredentialStoreError';
    this.code = failure.code;
    this.remediation = failure.remediation;
  }
}

export interface MainCredentialRead {
  state: 'ok' | 'absent' | 'unavailable';
  credentials: MainCredentials;
  backend: 'keychain' | 'encrypted-file' | null;
  failure?: MainCredentialStoreFailure;
}

export interface PlaintextMigrationResult {
  migrated: boolean;
  strippedFiles: number;
  scrubbedFiles: number;
  failure?: MainCredentialStoreFailure;
  warnings: string[];
}

/** 进程级故障台账:按存储目录隔离(测试会切 HOME/IHUI_HOME,不能互相污染)。 */
const failureByDir = new Map<string, MainCredentialStoreFailure>();

interface MasterKeyMaterial {
  key: Uint8Array;
  backend: 'keychain' | 'encrypted-file';
}

const keyCache = new Map<string, MasterKeyMaterial>();

/** 存储目录约定与 MCP 凭据一致:IHUI_HOME 优先,回退 ~/.ihui。 */
export function getMainCredentialStorePaths(): MainCredentialStorePaths {
  const dir = process.env.IHUI_HOME || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), '.ihui');
  return {
    dir,
    storePath: path.join(dir, STORE_FILENAME),
    osWrappedKeyPath: path.join(dir, OS_WRAPPED_KEY_FILENAME),
    machineKeyPath: path.join(dir, MACHINE_KEY_FILENAME),
    lockPath: path.join(dir, LOCK_FILENAME),
  };
}

function errCode(error: unknown): string | undefined {
  return error !== null && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function isMissing(error: unknown): boolean {
  const code = errCode(error);
  return code === 'ENOENT' || code === 'ENOTDIR';
}

// ==================== 凭据字段的剥离/校验 ====================

/** 精确剥离三个凭据字段,返回浅拷贝;其余字段(含嵌套对象)原样保留。 */
export function withoutMainCredentialFields<T extends object>(settings: T): T {
  const copy = { ...settings } as Record<string, unknown>;
  delete copy.apiKey;
  delete copy.refreshToken;
  delete copy.apiSecret;
  return copy as T;
}

function normalizeSecrets(source: Record<string, unknown>): MainCredentials | null {
  const out: MainCredentials = {};
  for (const field of ['apiKey', 'refreshToken', 'apiSecret'] as const) {
    const value = source[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_SECRET_LENGTH) {
      return null;
    }
    out[field] = value;
  }
  return out;
}

function hasCredentials(credentials: MainCredentials): boolean {
  return credentials.apiKey !== undefined || credentials.refreshToken !== undefined || credentials.apiSecret !== undefined;
}

function mergeCredentials(base: MainCredentials, patch: MainCredentialPatch): MainCredentials {
  const merged: MainCredentials = { ...base };
  for (const field of ['apiKey', 'refreshToken', 'apiSecret'] as const) {
    const value = patch[field];
    if (value === undefined) continue;
    if (value === null) {
      delete merged[field];
    } else {
      merged[field] = value;
    }
  }
  return merged;
}

/**
 * 回读校验用的规范化序列化:按固定字段序输出。
 * 不能直接 JSON.stringify 比字符串 —— 合并后的键序取决于"先读到哪些字段 + 本次补丁写哪些字段",
 * 内容相同也可能键序不同,会把正常写入误判成 store-readback-mismatch。
 */
function canonicalCredentialsJson(credentials: MainCredentials): string {
  return JSON.stringify(
    (['apiKey', 'refreshToken', 'apiSecret'] as const).map((field) => [field, credentials[field]] as const),
  );
}

// ==================== 故障台账 ====================

function recordFailure(dir: string, failure: MainCredentialStoreFailure): void {
  failureByDir.set(dir, failure);
}

function clearFailure(dir: string): void {
  failureByDir.delete(dir);
}

export function getMainCredentialStoreFailure(): MainCredentialStoreFailure | null {
  return failureByDir.get(getMainCredentialStorePaths().dir) ?? null;
}

/**
 * 需要主凭据的操作在读取前必须过这里:安全存储不可用时显式失败,而不是静默当"未登录"。
 * 不含任何凭据原文;remediation 给出可执行处置。
 */
export function assertMainCredentialStoreUsable(): void {
  const failure = getMainCredentialStoreFailure();
  if (failure) throw new MainCredentialStoreError(failure);
}

// ==================== 跨进程锁 ====================

interface LockInfo {
  pid: number;
  token: string;
  at: number;
}

function readLockInfo(lockPath: string): LockInfo | null {
  try {
    const raw = fs.readFileSync(lockPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.pid !== 'number' || typeof record.token !== 'string' || typeof record.at !== 'number') {
      return null;
    }
    return { pid: record.pid, token: record.token, at: record.at };
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM = 进程存在但无权限;ESRCH = 不存在
    return errCode(error) === 'EPERM';
  }
}

/**
 * 锁文件年龄(ms)。判"陈旧"必须看 mtime,而不能只看能否解析出内容:
 * 建锁是"先 open 成功、再写入 pid/token"两步,中间存在**空锁文件**窗口;
 * 此时若把"解析不出"直接判成崩溃残留,后来的实例会抢走仍在使用的锁,
 * 两个进程同时进临界区 ⇒ 互相覆盖。
 */
function lockAgeMs(lockPath: string): number | null {
  try {
    return Date.now() - fs.statSync(lockPath).mtimeMs;
  } catch {
    return null;
  }
}

function isLockStale(info: LockInfo | null, ageMs: number | null): boolean {
  if (ageMs !== null && ageMs > LOCK_STALE_MS) return true;
  // 解析不出但文件还年轻(< LOCK_STALE_MS)= 别人正在建锁/正在写,按活锁等,不许抢
  if (info === null) return false;
  if (Date.now() - info.at > LOCK_STALE_MS) return true;
  return !isProcessAlive(info.pid);
}

function withStoreLock<T>(fn: () => T): T {
  const { dir, lockPath } = getMainCredentialStorePaths();
  fs.mkdirSync(dir, { recursive: true });
  const token = `${process.pid}-${Date.now()}-${randomBytes(6).toString('hex')}`;
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (true) {
    try {
      // 单次 writeFile('wx'):open + 写内容尽量贴近,缩短"空锁文件"窗口
      fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token, at: Date.now() }), {
        flag: 'wx',
        mode: 0o600,
      });
      break;
    } catch (error) {
      if (errCode(error) !== 'EEXIST') {
        throw new MainCredentialStoreError({
          code: 'lock-failed',
          detail: `无法创建主凭据锁文件(${lockPath}:${errCode(error) ?? 'unknown'})。`,
          remediation: '检查 ~/.ihui 目录读写权限后重试。',
        });
      }
      const info = readLockInfo(lockPath);
      const ageMs = lockAgeMs(lockPath);
      if (info !== null && isLockStale(info, ageMs)) {
        // 陈旧锁:先删再抢;删除失败就让下一轮重读判,不在这里猜
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // ignore
        }
        continue;
      }
      if (info === null && isLockStale(null, ageMs)) {
        // 空/坏锁且已超过陈旧阈值:崩溃残留,清掉
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // ignore
        }
        continue;
      }
      if (ageMs === null) continue; // 锁刚被别人释放,直接重抢
      if (Date.now() >= deadline) {
        throw new MainCredentialStoreError({
          code: 'lock-timeout',
          detail: `另一个 IHUI 实例正在更新主凭据,等待 ${LOCK_WAIT_MS}ms 仍未释放。`,
          remediation: `稍后重试;若确认没有其它实例,可删除陈旧锁文件 ${lockPath}。`,
        });
      }
      sleepSync(50);
    }
  }
  try {
    return fn();
  } finally {
    const info = readLockInfo(lockPath);
    if (info?.token === token) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // 释放失败不改写盘结论;陈旧锁会被下一轮判掉
      }
    }
  }
}

// ==================== 原子写 ====================

function writeAtomic(pathname: string, content: string): void {
  commitAtomicWrite(captureWriteBaseline(pathname), content);
  chmodSafeSync(pathname);
}

/** settings 改写:冲突时重读最新内容后再应用一次 strip,最多 SETTINGS_WRITE_RETRIES 轮。 */
function rewriteSettingsStrippingCredentials(pathname: string): { ok: boolean; changed: boolean; reason?: string } {
  for (let attempt = 0; attempt < SETTINGS_WRITE_RETRIES; attempt += 1) {
    let raw: string;
    try {
      raw = fs.readFileSync(pathname, 'utf-8');
    } catch (error) {
      if (isMissing(error)) return { ok: true, changed: false };
      return { ok: false, changed: false, reason: `read ${pathname}: ${errCode(error) ?? 'unknown'}` };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // 坏 JSON 不在这里"修":原加载路径本来就不把它当配置;强行重写会覆盖用户内容
      return { ok: true, changed: false };
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: true, changed: false };
    }
    const record = parsed as Record<string, unknown>;
    const hadCredentials =
      record.apiKey !== undefined || record.refreshToken !== undefined || record.apiSecret !== undefined;
    if (!hadCredentials) return { ok: true, changed: false };
    const stripped = withoutMainCredentialFields(record);
    try {
      writeAtomic(pathname, `${JSON.stringify(stripped, null, 2)}\n`);
      return { ok: true, changed: true };
    } catch (error) {
      if (error instanceof WriteConflictError) {
        // 外部改动:重读后再剥一次;只要对方没再写回凭据就不会无限循环
        continue;
      }
      return { ok: false, changed: false, reason: `write ${pathname}: ${errCode(error) ?? 'unknown'}` };
    }
  }
  return { ok: false, changed: false, reason: `write ${pathname}: conflict after ${SETTINGS_WRITE_RETRIES} retries` };
}

/** 供登录/续期等写入口复用:只清明文,不动安全存储。 */
export function stripPlaintextCredentialFile(pathname: string): { ok: boolean; changed: boolean; reason?: string } {
  return rewriteSettingsStrippingCredentials(pathname);
}

// ==================== 密钥获取 ====================

type KeyPlan =
  | { ok: true; material: MasterKeyMaterial | null; backend: 'keychain' | 'encrypted-file' | null }
  | { ok: false; failure: MainCredentialStoreFailure };

function unavailableFailure(detail: string, remediation: string): KeyPlan {
  return {
    ok: false,
    failure: {
      code: 'secure-store-unavailable',
      detail: `主凭据安全存储不可用:${detail}`,
      remediation,
    },
  };
}

function readTextIfExists(pathname: string): { exists: boolean; raw: string | null; error?: string } {
  try {
    return { exists: true, raw: fs.readFileSync(pathname, 'utf-8') };
  } catch (error) {
    if (isMissing(error)) return { exists: false, raw: null };
    return { exists: true, raw: null, error: `${errCode(error) ?? 'unknown'}` };
  }
}

function readKeyFromOsWrapper(pathname: string): { material: MasterKeyMaterial } | { failure: MainCredentialStoreFailure } {
  const read = readTextIfExists(pathname);
  if (read.error) {
    return {
      failure: {
        code: 'key-read-failed',
        detail: `主密钥封套读不到(${pathname}:${read.error})。`,
        remediation: '修复 ~/.ihui 目录读写权限后重试;不要删除该文件(删了旧凭据将无法解密)。',
      },
    };
  }
  if (!read.exists || read.raw === null) {
    return {
      failure: {
        code: 'key-missing',
        detail: '主凭据信封存在,但主密钥文件缺失或为空。',
        remediation: '运行 `ihui login` 重新登录以重建安全存储;若需先清理,运行 `ihui login --logout`。',
      },
    };
  }
  const out = runDpapiSync('unprotect', new Uint8Array(Buffer.from(read.raw.trim(), 'base64')));
  if (!out.ok || !out.payload) {
    return {
      failure: {
        code: 'key-unreadable',
        detail: `已有主密钥封套在本机解不开(${out.detail});已拒绝覆盖。`,
        remediation: '确认当前是登录该凭据的同一 Windows 账号;需要恢复请运行 `ihui login` 重新登录。',
      },
    };
  }
  const key = new Uint8Array(Buffer.from(out.payload, 'base64'));
  if (key.length !== KEY_BYTES) {
    return {
      failure: {
        code: 'key-size',
        detail: `解出的主密钥长度异常(${key.length} 字节,应为 ${KEY_BYTES})。`,
        remediation: '运行 `ihui login` 重新登录以重建安全存储。',
      },
    };
  }
  return { material: { key, backend: 'keychain' } };
}

function readKeyFromMachineFile(pathname: string): { material: MasterKeyMaterial } | { failure: MainCredentialStoreFailure } {
  const read = readTextIfExists(pathname);
  if (read.error) {
    return {
      failure: {
        code: 'key-read-failed',
        detail: `机器绑定口令文件读不到(${pathname}:${read.error})。`,
        remediation: '修复 ~/.ihui 目录读写权限后重试。',
      },
    };
  }
  if (!read.exists || read.raw === null) {
    return {
      failure: {
        code: 'key-missing',
        detail: '主凭据信封存在,但机器绑定口令文件缺失。',
        remediation: '运行 `ihui login` 重新登录以重建安全存储。',
      },
    };
  }
  const env = parseKeyEnvelope(read.raw, KEY_ENVELOPE_FIELD);
  if (!env) {
    return {
      failure: {
        code: 'key-envelope-shape',
        detail: '机器绑定口令文件结构不符信封判据;已拒绝覆盖。',
        remediation: '运行 `ihui login` 重新登录以重建安全存储。',
      },
    };
  }
  const key = openKeyEnvelope(env, KEY_WRAP_INFO);
  if (!key) {
    return {
      failure: {
        code: 'key-binding-mismatch',
        detail: '机器绑定口令文件在本机解不开(换机/换账号/文件损坏);已拒绝覆盖。',
        remediation: '在原机器/原账号上使用,或运行 `ihui login` 重新登录。',
      },
    };
  }
  return { material: { key, backend: 'encrypted-file' } };
}

function createKey(paths: MainCredentialStorePaths, backend: 'keychain' | 'encrypted-file'): KeyPlan {
  const fresh = new Uint8Array(randomBytes(KEY_BYTES));
  try {
    fs.mkdirSync(paths.dir, { recursive: true });
    if (backend === 'keychain') {
      const protectedKey = runDpapiSync('protect', fresh);
      if (!protectedKey.ok || !protectedKey.payload) {
        return unavailableFailure(`DPAPI protect 失败(${protectedKey.detail})。`, '确认当前 Windows 账号可访问 DPAPI,或改用机器绑定档位。');
      }
      writeAtomic(paths.osWrappedKeyPath, protectedKey.payload.trim());
      // 回读比对一致才认:落盘成功不等于密钥可用
      const verify = runDpapiSync('unprotect', new Uint8Array(Buffer.from(protectedKey.payload.trim(), 'base64')));
      const same =
        verify.ok && verify.payload !== null && Buffer.compare(Buffer.from(verify.payload, 'base64'), Buffer.from(fresh)) === 0;
      if (!same) {
        return unavailableFailure(`主密钥回读不一致(${verify.detail});未落任何密文。`, '重试;若持续失败,检查 DPAPI 可用性。');
      }
    } else {
      writeAtomic(paths.machineKeyPath, sealKeyEnvelope(fresh, KEY_ENVELOPE_FIELD, KEY_WRAP_INFO));
      const raw = readTextIfExists(paths.machineKeyPath);
      const env = raw.raw === null ? null : parseKeyEnvelope(raw.raw, KEY_ENVELOPE_FIELD);
      const verify = env === null ? null : openKeyEnvelope(env, KEY_WRAP_INFO);
      if (!verify || Buffer.compare(Buffer.from(verify), Buffer.from(fresh)) !== 0) {
        return unavailableFailure('机器绑定主密钥回读不一致;未落任何密文。', '检查 ~/.ihui 目录读写权限后重试。');
      }
    }
  } catch (error) {
    return unavailableFailure(
      `主密钥落盘失败(${errPathDetail(paths, backend)}:${errCode(error) ?? 'unknown'})。`,
      '检查 ~/.ihui 目录读写权限与磁盘空间后重试。',
    );
  }
  return { ok: true, material: { key: fresh, backend }, backend };
}

function errPathDetail(paths: MainCredentialStorePaths, backend: 'keychain' | 'encrypted-file'): string {
  return backend === 'keychain' ? paths.osWrappedKeyPath : paths.machineKeyPath;
}

/**
 * 解析当前可用档位与主密钥。
 * - readOnly 且无任何密钥文件、也无存储文件 ⇒ 返回 material:null(调用方报 absent);
 * - 存储文件存在但密钥全缺 ⇒ 显式失败(不生成新钥,否则旧信封永久孤儿);
 * - 写路径才创建密钥。
 */
function resolveKey(readOnly: boolean): KeyPlan {
  const paths = getMainCredentialStorePaths();
  const cached = keyCache.get(paths.dir);
  if (cached) {
    const exists =
      cached.backend === 'keychain' ? fs.existsSync(paths.osWrappedKeyPath) : fs.existsSync(paths.machineKeyPath);
    if (exists) {
      return { ok: true, material: cached, backend: cached.backend };
    }
    keyCache.delete(paths.dir);
  }

  const pinned = (process.env[MAIN_CRED_BACKEND_ENV] ?? '').trim();
  if (pinned === 'unavailable') {
    return unavailableFailure(
      `${MAIN_CRED_BACKEND_ENV}=unavailable(诊断/测试钉选,禁止明文降级)。`,
      `去掉 ${MAIN_CRED_BACKEND_ENV} 后重试;或修复系统钥匙串/目录权限。`,
    );
  }

  const osExists = fs.existsSync(paths.osWrappedKeyPath);
  const machineExists = fs.existsSync(paths.machineKeyPath);
  const storeExists = fs.existsSync(paths.storePath);

  if (osExists) {
    const out = readKeyFromOsWrapper(paths.osWrappedKeyPath);
    if ('failure' in out) return { ok: false, failure: out.failure };
    keyCache.set(paths.dir, out.material);
    return { ok: true, material: out.material, backend: 'keychain' };
  }
  if (machineExists) {
    const out = readKeyFromMachineFile(paths.machineKeyPath);
    if ('failure' in out) return { ok: false, failure: out.failure };
    keyCache.set(paths.dir, out.material);
    return { ok: true, material: out.material, backend: 'encrypted-file' };
  }
  if (storeExists) {
    return {
      ok: false,
      failure: {
        code: 'key-missing',
        detail: '主凭据信封存在,但主密钥文件(DPAPI/机器绑定)都缺失。',
        remediation: '运行 `ihui login` 重新登录以重建安全存储;若需先清理,运行 `ihui login --logout`。',
      },
    };
  }
  if (readOnly) {
    return { ok: true, material: null, backend: null };
  }

  if (pinned === 'encrypted-file') {
    const created = createKey(paths, 'encrypted-file');
    if ('failure' in created) return { ok: false, failure: created.failure };
    if (created.material) keyCache.set(paths.dir, created.material);
    return created;
  }
  const probe = probeDpapiSync();
  if (probe.ok) {
    const created = createKey(paths, 'keychain');
    if ('failure' in created) {
      // DPAPI 探针过但落盘失败:不再偷偷换档,显式失败
      return { ok: false, failure: created.failure };
    }
    if (created.material) keyCache.set(paths.dir, created.material);
    return created;
  }
  const created = createKey(paths, 'encrypted-file');
  if ('failure' in created) return { ok: false, failure: created.failure };
  if (created.material) keyCache.set(paths.dir, created.material);
  return created;
}

// ==================== 存储读写 ====================

interface StoreSnapshot {
  state: 'absent' | 'ok' | 'corrupt';
  credentials: MainCredentials;
  reason?: string;
}

function readStoreWithKey(paths: MainCredentialStorePaths, key: Uint8Array): StoreSnapshot {
  let raw: string;
  try {
    raw = fs.readFileSync(paths.storePath, 'utf-8');
  } catch (error) {
    if (isMissing(error)) return { state: 'absent', credentials: {} };
    return { state: 'corrupt', credentials: {}, reason: `read ${errCode(error) ?? 'unknown'}` };
  }
  const envelope = parseVaultEnvelope(raw);
  if (!envelope) {
    return { state: 'corrupt', credentials: {}, reason: 'envelope-shape' };
  }
  const plain = openVaultEnvelope(envelope, key, DOMAIN_INFO);
  if (plain === null) {
    return { state: 'corrupt', credentials: {}, reason: 'decrypt-failed' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(plain);
  } catch {
    return { state: 'corrupt', credentials: {}, reason: 'payload-not-json' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { state: 'corrupt', credentials: {}, reason: 'payload-not-object' };
  }
  const credentials = normalizeSecrets(parsed as Record<string, unknown>);
  if (credentials === null) {
    return { state: 'corrupt', credentials: {}, reason: 'payload-field-shape' };
  }
  return { state: 'ok', credentials };
}

function quarantineCorruptStore(paths: MainCredentialStorePaths, reason: string): string | null {
  const target = path.join(paths.dir, `main-credentials.corrupt-${Date.now()}.json`);
  try {
    fs.renameSync(paths.storePath, target);
    chmodSafeSync(target);
    console.warn(`[credentials] 主凭据存储已隔离(原因:${reason});原文件=${target}(仍加密,未泄漏明文)`);
    return target;
  } catch {
    return null;
  }
}

function writeStoreUnlocked(patch: MainCredentialPatch, options: { recoverCorrupt?: boolean } = {}): void {
  const paths = getMainCredentialStorePaths();
  const keyPlan = resolveKey(false);
  if (!keyPlan.ok) {
    recordFailure(paths.dir, keyPlan.failure);
    throw new MainCredentialStoreError(keyPlan.failure);
  }
  if (keyPlan.material === null) {
    const failure: MainCredentialStoreFailure = {
      code: 'secure-store-unavailable',
      detail: '主凭据安全存储未能生成可用主密钥。',
      remediation: '检查 ~/.ihui 目录读写权限后重试;若需清除本地凭据,运行 `ihui login --logout`。',
    };
    recordFailure(paths.dir, failure);
    throw new MainCredentialStoreError(failure);
  }
  const current = readStoreWithKey(paths, keyPlan.material.key);
  let base: MainCredentials = current.credentials;
  if (current.state === 'corrupt') {
    if (options.recoverCorrupt !== true) {
      // 续期等"只写部分字段"的路径不许拿坏存储冒替换:解不开就显式失败,否则会丢 refreshToken
      const failure: MainCredentialStoreFailure = {
        code: 'store-unreadable',
        detail: `主凭据安全存储无法解密(原因:${current.reason ?? 'unknown'});拒绝以部分字段覆盖。`,
        remediation: '运行 `ihui login` 重新登录重建安全存储;如需先清理,运行 `ihui login --logout`。',
      };
      recordFailure(paths.dir, failure);
      throw new MainCredentialStoreError(failure);
    }
    // 坏文件留证隔离(仍是密文/残缺密文),再重建;隔离失败则拒绝覆盖
    const quarantined = quarantineCorruptStore(paths, current.reason ?? 'unknown');
    if (quarantined === null) {
      const failure: MainCredentialStoreFailure = {
        code: 'store-corrupt',
        detail: `主凭据存储损坏(${current.reason ?? 'unknown'}),且无法隔离原文件;拒绝覆盖。`,
        remediation: '检查 ~/.ihui 目录权限,手动移走 main-credentials.json 后重试。',
      };
      recordFailure(paths.dir, failure);
      throw new MainCredentialStoreError(failure);
    }
    base = {};
  }
  const merged = mergeCredentials(base, patch);
  const plain = JSON.stringify(merged);
  const sealed = sealVaultEnvelope(plain, keyPlan.material.key, kidOfKey(keyPlan.material.key), DOMAIN_INFO);
  for (let attempt = 0; attempt < SETTINGS_WRITE_RETRIES; attempt += 1) {
    try {
      writeAtomic(paths.storePath, sealed);
      break;
    } catch (error) {
      if (error instanceof WriteConflictError && attempt < SETTINGS_WRITE_RETRIES - 1) continue;
      const failure: MainCredentialStoreFailure = {
        code: 'store-write-failed',
        detail: `主凭据安全存储写入失败(${errCode(error) ?? 'unknown'})。`,
        remediation: '检查 ~/.ihui 目录读写权限与磁盘空间后重试。',
      };
      recordFailure(paths.dir, failure);
      throw new MainCredentialStoreError(failure);
    }
  }
  // 回读:解不开或字段不符 ⇒ 不承认这次写入
  const verify = readStoreWithKey(paths, keyPlan.material.key);
  const expected = canonicalCredentialsJson(merged);
  const actual = canonicalCredentialsJson(verify.credentials);
  if (verify.state !== 'ok' || actual !== expected) {
    const failure: MainCredentialStoreFailure = {
      code: 'store-readback-mismatch',
      // 只写状态/原因/字段名,不写任何令牌值
      detail: `主凭据安全存储回读校验不一致(state=${verify.state}${
        verify.reason ? `,reason=${verify.reason}` : ''
      },fields=${Object.keys(verify.credentials).sort().join('|') || '-'})。`,
      remediation: '重试;若持续失败,检查 ~/.ihui 目录与磁盘状态,或运行 `ihui login` 重新登录。',
    };
    recordFailure(paths.dir, failure);
    throw new MainCredentialStoreError(failure);
  }
  clearFailure(paths.dir);
}

/** 写入主凭据(合并补丁):跨进程锁内"读最新 → 合并 → 封存 → 回读校验"。 */
export function writeMainCredentials(
  patch: MainCredentialPatch,
  options: { recoverCorrupt?: boolean } = {},
): void {
  withStoreLock(() => writeStoreUnlocked(patch, options));
}

/** 读取主凭据;读不到/解不开时返回 unavailable 并把故障记到当前的存储目录。 */
export function readMainCredentials(): MainCredentialRead {
  // 测试隔离:未把 HOME/IHUI_HOME 指到临时目录时不读开发机真实存储,避免把真实登录态带进单测
  if (process.env.VITEST && !isTestSafeStoreDir()) {
    return { state: 'absent', credentials: {}, backend: null };
  }
  const paths = getMainCredentialStorePaths();
  const storeRead = readTextIfExists(paths.storePath);
  if (storeRead.error) {
    const failure: MainCredentialStoreFailure = {
      code: 'store-read-failed',
      detail: `主凭据安全存储读不到(${paths.storePath}:${storeRead.error})。`,
      remediation: '修复 ~/.ihui 目录读写权限后重试。',
    };
    recordFailure(paths.dir, failure);
    return { state: 'unavailable', credentials: {}, backend: null, failure };
  }
  if (!storeRead.exists) {
    clearFailure(paths.dir);
    return { state: 'absent', credentials: {}, backend: null };
  }
  const keyPlan = resolveKey(true);
  if (!keyPlan.ok) {
    recordFailure(paths.dir, keyPlan.failure);
    return { state: 'unavailable', credentials: {}, backend: null, failure: keyPlan.failure };
  }
  if (keyPlan.material === null) {
    const failure: MainCredentialStoreFailure = {
      code: 'key-missing',
      detail: '主凭据信封存在,但主密钥不可用。',
      remediation: '运行 `ihui login` 重新登录以重建安全存储;若需先清理,运行 `ihui login --logout`。',
    };
    recordFailure(paths.dir, failure);
    return { state: 'unavailable', credentials: {}, backend: null, failure };
  }
  const snapshot = readStoreWithKey(paths, keyPlan.material.key);
  if (snapshot.state !== 'ok') {
    const failure: MainCredentialStoreFailure = {
      code: 'store-unreadable',
      detail: `主凭据安全存储无法解密(原因:${snapshot.reason ?? 'unknown'});已拒绝以明文继续。`,
      remediation: '运行 `ihui login` 重新登录重建安全存储;如需先清理,运行 `ihui login --logout`。',
    };
    recordFailure(paths.dir, failure);
    return { state: 'unavailable', credentials: {}, backend: null, failure };
  }
  clearFailure(paths.dir);
  return { state: 'ok', credentials: snapshot.credentials, backend: keyPlan.material.backend };
}

/** 清除本地主凭据(登出):删存储与密钥缓存;密钥文件一并删除,避免残留孤儿。 */
export function clearMainCredentials(): void {
  const paths = getMainCredentialStorePaths();
  withStoreLock(() => {
    for (const p of [paths.storePath, paths.osWrappedKeyPath, paths.machineKeyPath]) {
      try {
        fs.rmSync(p, { force: true });
      } catch (error) {
        if (!isMissing(error)) {
          throw new MainCredentialStoreError({
            code: 'store-clear-failed',
            detail: `清除主凭据文件失败(${p}:${errCode(error) ?? 'unknown'})。`,
            remediation: '检查文件占用/权限后重试,或手动删除该文件。',
          });
        }
      }
    }
  });
  keyCache.delete(paths.dir);
  clearFailure(paths.dir);
}

// ==================== 明文迁移与残留清理 ====================

interface PlaintextFound {
  path: string;
  credentials: MainCredentials;
}

/** 测试安全闸:存储目录必须落在 os.tmpdir() 下,防止单测改写开发机真实主凭据。 */
function isTestSafeStoreDir(): boolean {
  const dir = path.resolve(getMainCredentialStorePaths().dir);
  const tmp = path.resolve(os.tmpdir());
  return dir === tmp || dir.startsWith(`${tmp}${path.sep}`);
}

function collectPlaintextCredentials(filePaths: readonly string[], warnings: string[]): { found: PlaintextFound[]; failure?: MainCredentialStoreFailure } {
  const found: PlaintextFound[] = [];
  for (const filePath of filePaths) {
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      if (isMissing(error)) continue;
      return {
        found,
        failure: {
          code: 'settings-read-failed',
          detail: `无法读取 settings 文件(${filePath}:${errCode(error) ?? 'unknown'}),不能确认明文凭据是否已迁移。`,
          remediation: '修复该文件读写权限后重试;若不再使用该来源,可将其移走。',
        },
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // 坏 JSON 在既有加载路径里本就不当配置;不在迁移里猜它是不是令牌
      warnings.push(`${filePath} 不是合法 JSON,跳过凭据迁移`);
      continue;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    const credentials = normalizeSecrets(parsed as Record<string, unknown>);
    if (credentials === null) {
      warnings.push(`${filePath} 的凭据字段形状异常,跳过迁移(该文件不会被当作凭据来源)`);
      continue;
    }
    if (hasCredentials(credentials)) found.push({ path: filePath, credentials });
  }
  return { found };
}

/** 只清迁移来源目录(含存储目录)下有限类型的文件;精确替换令牌原文。 */
function scrubCredentialResidue(dirs: readonly string[], secrets: readonly string[]): number {
  if (secrets.length === 0) return 0;
  const candidates: string[] = [];
  const consider = (candidateDir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(candidateDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (name === STORE_FILENAME || name === OS_WRAPPED_KEY_FILENAME || name === MACHINE_KEY_FILENAME) continue;
      if (name === LOCK_FILENAME || name.startsWith('main-credentials.corrupt-')) continue;
      const isSidecar = name.startsWith('settings.json.') || /\.(log|jsonl|bak|tmp|old)$/i.test(name);
      if (!isSidecar) continue;
      candidates.push(path.join(candidateDir, name));
    }
  };
  for (const dir of new Set(dirs)) {
    consider(dir);
    consider(path.join(dir, 'logs'));
  }

  let scrubbed = 0;
  for (const candidate of candidates) {
    try {
      const stat = fs.lstatSync(candidate);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > SCRUB_MAX_BYTES) continue;
      const raw = fs.readFileSync(candidate, 'utf-8');
      let next = raw;
      for (const secret of secrets) {
        if (secret.length < 8) continue;
        next = next.split(secret).join('[REDACTED]');
      }
      if (next === raw) continue;
      let wrote = false;
      for (let attempt = 0; attempt < SETTINGS_WRITE_RETRIES && !wrote; attempt += 1) {
        try {
          writeAtomic(candidate, next);
          wrote = true;
        } catch (error) {
          if (error instanceof WriteConflictError && attempt < SETTINGS_WRITE_RETRIES - 1) continue;
          break;
        }
      }
      if (wrote) scrubbed += 1;
    } catch {
      // 清洗失败不改变"迁移已完成"的结论;下次加载会再试
    }
  }
  return scrubbed;
}

/**
 * 把 home 层 settings 文件里的明文凭据搬进安全存储并清除明文。
 *
 * 调用方按"低优先级 → 高优先级"传入路径:后写者覆盖前写者,与 V1 合并优先级一致。
 * 存储写失败 ⇒ 停止迁移且**不删除明文文件**(安全存储不可用时不能假装搬完了),同时记故障。
 * 文件清洗失败 ⇒ 记录 warning,后续加载会再试;内存中始终不返回明文。
 */
export function migratePlaintextCredentials(filePaths: readonly string[]): PlaintextMigrationResult {
  const result: PlaintextMigrationResult = { migrated: false, strippedFiles: 0, scrubbedFiles: 0, warnings: [] };
  // 测试默认不允许改写开发机真实 ~/.ihui:只有存储目录落在系统临时目录时才迁移。
  // 生产(VITEST 未设置)不受影响;这样既有测试不会因为"读到真实明文"去改用户配置。
  if (process.env.VITEST && !isTestSafeStoreDir()) {
    return result;
  }
  const collected = collectPlaintextCredentials([...new Set(filePaths)], result.warnings);
  if (collected.failure) {
    result.failure = collected.failure;
    recordFailure(getMainCredentialStorePaths().dir, collected.failure);
    return result;
  }
  if (collected.found.length === 0) return result;

  const secrets: string[] = [];
  try {
    withStoreLock(() => {
      for (const item of collected.found) {
        // 逐文件写:高优先级来源最后写,覆盖低优先级来源
        writeStoreUnlocked(item.credentials, { recoverCorrupt: true });
        result.migrated = true;
        for (const field of ['apiKey', 'refreshToken', 'apiSecret'] as const) {
          const value = item.credentials[field];
          if (value) secrets.push(value);
        }
        const stripped = rewriteSettingsStrippingCredentials(item.path);
        if (stripped.ok && stripped.changed) {
          result.strippedFiles += 1;
          // 二次确认:盘上不能再出现这些精确值
          try {
            const after = fs.readFileSync(item.path, 'utf-8');
            for (const value of secrets) {
              if (value.length >= 8 && after.includes(value)) {
                result.warnings.push(`${item.path} 明文清理后仍检出凭据原文,请手动检查`);
              }
            }
          } catch {
            // 读失败由下一轮加载重试
          }
        } else if (!stripped.ok) {
          result.warnings.push(`明文清理失败(${item.path}:${stripped.reason ?? 'unknown'});下次加载会重试`);
        }
      }
    });
  } catch (error) {
    const failure =
      error instanceof MainCredentialStoreError
        ? { code: error.code, detail: error.message.split('\n')[0] ?? error.message, remediation: error.remediation }
        : {
            code: 'migration-failed',
            detail: `明文凭据迁移失败(${errCode(error) ?? 'unknown'})。`,
            remediation: '检查 ~/.ihui 目录读写权限后重试。',
          };
    result.failure = failure;
    recordFailure(getMainCredentialStorePaths().dir, failure);
    return result;
  }

  // 残留可能落在任意一个曾写过明文的位置:存储目录 + 各迁移来源文件所在目录(含各自 logs/)
  const scrubDirs = [getMainCredentialStorePaths().dir, ...collected.found.map((item) => path.dirname(item.path))];
  result.scrubbedFiles = scrubCredentialResidue(scrubDirs, secrets);
  return result;
}

/**
 * 把安全存储里的凭据回填到 settings 对象(仅在**global 层**回填,保证 env/CLI 仍可覆盖)。
 * 安全存储不可用时保持字段缺失,并已由 `readMainCredentials` 记录故障。
 */
export function applyStoredMainCredentials<T extends object>(settings: T): T {
  const read = readMainCredentials();
  if (read.state !== 'ok') return settings;
  return { ...settings, ...read.credentials };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
