// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP 凭证持久化 — ~/.ihui/mcp-credentials.json
 *
 * 策略:
 *   - **只有"文件不存在(ENOENT)"可以折算成空对象 {}**(G-709 收口,取代旧版"读坏当没有"):
 *     解析失败 / 形状不合 / 信封解不开 / 其它 errno 一律**先把原文件留证隔离、点名路径、再抛错**。
 *     立因:本模块每个写入口都是"整文件读-改-写",旧实现把所有读盘异常都 `return {}`,
 *     于是一次瞬时损坏之后的**第一次保存就把其它 server 的 OAuth/登录凭据全部清空**,
 *     而账面没有任何线索。判据原文见下方"存储健康度"一节与 `readCredentialStoreSnapshot()`。
 *   - 落盘走 `../util/atomic-write.ts` 那一份出口(同目录 tmp + fsync + rename):
 *     裸 `fs.writeFile` 会让并发读方看见半截 JSON —— 那正是上面"读坏"的成因之一。
 *   - 整文件读-改-写(setCredential / deleteCredential)包在**跨进程变更锁**内,锁复用
 *     `mcp-oauth.ts` 的 acquireLock/releaseLock 那一份实现与 `mcp-refresh.lock` 那把锁,
 *     覆盖"读取 → 变更 → 原子替换"全过程;逐条覆盖情况与证据行号见 commitCredentialCas 上方对账。
 *   - 写入时设置权限 0600(仅当前用户可读写)
 *   - Windows 兼容:fs.chmod 仅设置 owner 权限,POSIX 才有 group/other
 *   - **D146(2026-09-29 拍板"按预填")**:新写入即加密,存量在首次读时迁移。
 *     落盘档位三档降级,任何一档都必须在 `describeCredentialStore()` 里报出
 *     "在哪 + 哪一档 + 为什么":
 *       ① `keychain`       —— OS 自带凭据能力(Windows DPAPI / CurrentUser,经 PowerShell
 *                             只保护 32 字节主密钥;探针实测通过才启用,见 OS_TIER_EVIDENCE)
 *       ② `encrypted-file` —— 机器绑定口令文件(主密钥以本机身份派生的包裹密钥再封一层)
 *       ③ `plaintext-file` —— 明文(**必须落档并打印路径 + 原因**,不得静默;§5e"失败必须响")
 *     信封格式与 `apps/web/src/lib/local-vault.ts` 同形(`{"ihuiVaultV1":{alg,kid,iv,ct}}`,
 *     A256GCM + HKDF 域分隔),使"是否被包裹了一层"是**结构级**可判的 ⇒ 迁移幂等(恰一层)。
 *     三条照抄该文件的硬约束:回读比对一致才承认密钥可用、读通道失败绝不生成/覆盖密钥、
 *     迁移有任何不确定就**保留原文件不覆盖**并大声报。
 *     逃生口 `IHUI_MCP_CRED_PLAINTEXT=1` 只关"要不要加密",不关"要不要喊"。
 *
 * 数据结构:McpCredentials 按 serverUrl 为 key 索引,
 * 每个 entry 含 accessToken / refreshToken / expiresAt / scope / obtainedAt / generation。
 * generation 是"换代计数器"(跨进程单飞刷新的 CAS 锚点),缺省视为 0。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { t } from '../i18n/index.js';
import { captureWriteBaseline, commitAtomicWrite } from '../util/atomic-write.js';
// G-709:整文件读-改-写要包在跨进程锁里。锁**复用** mcp-oauth.ts 已有的那一份实现
// (acquireLock / releaseLock / getRefreshLockPath + mcp-refresh.lock),不新造第二把锁。
// ⚠️ 这是一条**环形 import**(mcp-oauth.ts 顶部就 import 本文件)。两条由此而来的纪律:
//   ① 只能在**函数体内**读 `REFRESH_LOCK_WAIT_MS` —— 它是 `export const`,而本模块的顶层
//      代码一定在 mcp-oauth 的顶层之前求值(mcp-oauth 依赖本文件 ⇒ 本文件先跑完),
//      在顶层读它会把 TDZ 里的绑定读成 ReferenceError,症状是"一 import 就炸";
//      被引的 acquireLock/releaseLock/getRefreshLockPath 都是 `export function`(提升,
//      实例化阶段即绑定)⇒ 顶层引用它们才安全。
//   ② 不得为"消环"去把锁另抄一份或把锁往别处搬 —— 同一个 store 交给两把互不知情的锁,
//      比环更难查(本仓记过最多次的失效型就是"两处算同一件事必漂移")。
import { acquireLock, releaseLock, getRefreshLockPath, REFRESH_LOCK_WAIT_MS } from './mcp-oauth.js';

const CREDENTIALS_FILENAME = 'mcp-credentials.json';
/** 档位①:被 DPAPI 保护的主密钥(base64 文本,不是密钥本身) */
const OS_WRAPPED_KEY_FILENAME = 'mcp-cred-master.dpapi';
/** 档位②:被"本机身份派生密钥"包裹的主密钥信封 */
const MACHINE_KEY_FILENAME = 'mcp-cred-key.json';

/** 显式降级逃生口:只允许关掉"要不要加密",不允许关掉"要不要喊"。 */
export const CRED_PLAINTEXT_ENV = 'IHUI_MCP_CRED_PLAINTEXT';
/** 档位钉选(测试/特殊场景):只允许把档往**低**处钉,不认可"往高处钉"。 */
export const CRED_BACKEND_ENV = 'IHUI_MCP_CRED_BACKEND';

// ============ 信封常量(与 local-vault.ts 同形;跨包同族约束 §3,不抄第二份"语义"只对齐"结构") ============
const ENVELOPE_FIELD = 'ihuiVaultV1';
const KEY_ENVELOPE_FIELD = 'ihuiMcpKeyV1';
const ALG = 'A256GCM';
/** Object.keys().sort() 的比对基准 —— 必须是排好序的同一份名单 */
const ENVELOPE_KEYS_SORTED: readonly string[] = ['alg', 'ct', 'iv', 'kid'];
const KEY_ENVELOPE_KEYS_SORTED: readonly string[] = ['ct', 'iv', 'mb'];
/** HKDF 域分隔:CLI 的 MCP 凭据与桌面端聊天正文各用一把互不通用的子密钥 */
const DOMAIN_INFO = 'ihui-cli/mcp-credentials/v1';
const KEY_WRAP_INFO = 'ihui-cli/mcp-credentials/key-wrap/v1';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KID_BYTES = 8;
const MAX_UNWRAP_LAYERS = 4;
/** OS 档单次 PowerShell 调用的硬超时:取"引擎冷启动"最差档的数倍,挂住不等于可用 */
const DPAPI_TIMEOUT_MS = 15_000;

/**
 * 档位①的可行性证据(2026-09-28 本机现读,取证经 `scripts/run-evidence.mjs` 落件):
 *   pwsh 7.6.4(`C:\Program Files\PowerShell\7\pwsh.exe`)
 *     → `PROBE A_ProtectedDataAssembly OK roundtrip=8bytes`
 *   powershell 5.1.26100(`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`)
 *     → `PROBE A_ProtectedDataAssembly FAIL 无法加载找到程序集…`(消息被 GBK 码页打乱,
 *        所以判据只认 ASCII 状态词,绝不解析本地化文案)
 * ⇒ 档位①**只**在能 `Add-Type -AssemblyName System.Security.Cryptography.ProtectedData`
 *   的引擎上启用;每次运行现探,不照抄本注释。
 */
const OS_TIER_EVIDENCE = 'pwsh7=OK;windows-powershell5.1=FAIL(assembly-not-found;2026-09-28 实测)';

/** 凭证文件路径解析:优先 IHUI_HOME,回退 ~/.ihui */
export function getCredentialsPath(): string {
  const ihuiHome = process.env.IHUI_HOME || path.join(os.homedir(), '.ihui');
  return path.join(ihuiHome, CREDENTIALS_FILENAME);
}

function getStateDir(): string {
  return path.dirname(getCredentialsPath());
}
function getOsWrappedKeyPath(): string {
  return path.join(getStateDir(), OS_WRAPPED_KEY_FILENAME);
}
function getMachineKeyPath(): string {
  return path.join(getStateDir(), MACHINE_KEY_FILENAME);
}

export interface McpCredentialEntry {
  accessToken?: string;
  refreshToken?: string;
  /** 过期时间(ms epoch) */
  expiresAt?: number;
  scope?: string[];
  /** 获取时间(ms epoch) */
  obtainedAt: number;
  /**
   * 代次(单飞刷新的 CAS 锚点,2026-09-28 票A 引入)。
   * 语义:每次**换发凭据**单调 +1 —— setCredential(交互授权/兼容写)与
   * commitCredentialCas(锁内刷新提交)都会推进它,旧条目缺省视为 0。
   * 刷新单飞在取锁**前**观察它、锁内**再**读它:值变了 ⇒ 别的进程已经换代,
   * 绝不再发第二次 refresh_token 请求(reuse-detection 会撤销整个 token family),
   * 直接复用 winner 落库的结果。它不是时间戳,也不承载任何凭据内容。
   */
  generation?: number;
}

export interface McpCredentials {
  [serverUrl: string]: McpCredentialEntry;
}

// ==================== 档位可见化(D146 第①步:止血先于根治) ====================

export type CredentialStoreBackend = 'keychain' | 'encrypted-file' | 'plaintext-file';

/** 人类可读的档位名(进 `--capabilities` 与授权完成提示;不含任何凭据内容) */
const BACKEND_LABEL: Record<CredentialStoreBackend, string> = {
  keychain: 'OS keychain (DPAPI/CurrentUser)',
  'encrypted-file': 'machine-bound key file',
  'plaintext-file': 'plaintext file',
};

export interface CredentialStoreDescription {
  /** 现在这一档 */
  backend: CredentialStoreBackend;
  /** 凭据落点绝对路径(降级档也必须给,这是本票的存在理由) */
  path: string;
  /** 主密钥落点(档位③为 null) */
  keyPath: string | null;
  /** 稳定 ASCII 码,供脚本/文档对账(不含凭据内容) */
  reasonCode: string;
  /** 本地化的一句话原因(为什么是这一档) */
  reason: string;
  /** 判据侧证据细节:探针结论 / 不可用原因(ASCII) */
  detail: string;
  /** 盘上那份文件此刻**是否还能被 JSON.parse 直接读出 token** */
  plaintextAtRest: boolean;
  /** 盘上是否已有信封(已加密形态) */
  envelopeAtRest: boolean;
  /** 信封在、本机解不开(换机/密钥被清)—— 与"没有凭据"是两件事,必须分开报 */
  unreadableAtRest: boolean;
  /** 已存的授权条目数(只数,不报名) */
  entryCount: number;
}

/**
 * 写盘后/读盘前的客观自检:只回答两件事 ——
 *  ① 这个文件是不是还能被 `JSON.parse` 直接读出 token(= 明文档 / 迁移没跑成);
 *  ② 现在**实际**存着几条授权(信封形态也数得出,靠解密而不是猜)。
 * 判据按**值形态**(某条 entry 上 `accessToken` 是字符串),与档位推断无关 ——
 * 档位说"我加密了"而盘上仍是明文,这一层必须能把它抓住,否则报告只是自我背书。
 */
async function inspectCredentialFile(): Promise<{
  present: boolean;
  envelope: boolean;
  plaintextReadable: boolean;
  unreadable: boolean;
  entryCount: number;
}> {
  const p = getCredentialsPath();
  let raw: string;
  try {
    raw = await fs.readFile(p, 'utf-8');
  } catch {
    return { present: false, envelope: false, plaintextReadable: false, unreadable: false, entryCount: 0 };
  }
  const decoded = await decodeCredentialText(raw);
  if (decoded.kind === 'sealed') {
    return {
      present: true,
      envelope: true,
      plaintextReadable: false,
      unreadable: false,
      entryCount: credentialEntriesOf(decoded.creds).length,
    };
  }
  if (decoded.kind === 'plain') {
    return {
      present: true,
      envelope: false,
      plaintextReadable: credentialEntriesOf(decoded.creds).length > 0,
      unreadable: false,
      entryCount: credentialEntriesOf(decoded.creds).length,
    };
  }
  // 信封在但本机解不开:present/envelope 为真,条目数**如实报 0 并另标 unreadable**,
  // 绝不把"解不开"折成"没有凭据"那同一格(那正是"把没判写成判过了"的形态)。
  return {
    present: true,
    envelope: decoded.kind === 'unreadable' && parseCredentialEnvelope(raw) !== null,
    plaintextReadable: false,
    unreadable: true,
    entryCount: 0,
  };
}

/** 取"值形态上确实是凭据集合"的条目(顶层是凭据 entry 也算一条);解不开/结构不符 ⇒ 空。 */
function credentialEntriesOf(parsed: unknown): McpCredentialEntry[] {
  if (!isPlainObject(parsed)) return [];
  const self = parsed as Record<string, unknown>;
  if (typeof self.accessToken === 'string') return [self as unknown as McpCredentialEntry];
  const out: McpCredentialEntry[] = [];
  for (const value of Object.values(self)) {
    if (isPlainObject(value) && typeof (value as Record<string, unknown>).accessToken === 'string') {
      out.push(value as unknown as McpCredentialEntry);
    }
  }
  return out;
}

function isPlainObject(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 唯一的状态行出口:任何档位都不许静默(§5e"失败必须响"同条禁令)。 */
function reportStoreState(desc: CredentialStoreDescription): void {
  if (desc.unreadableAtRest) {
    // "解不开"与"已加密"是两件事:报成已加密就是把没判写成判过了(本仓最高频失效型)。
    console.error(
      `❌ ${t('cli.mcpCredentials.migrationFailed', {
        reason: `${desc.reasonCode}; ${desc.detail}`,
      })}`,
    );
    console.error(`   文件=${desc.path}`);
    return;
  }
  if (desc.backend === 'plaintext-file' || desc.plaintextAtRest) {
    // 降级/残留明文都必须走 warn:stdout 是给用户读结论的,警告不得被淹没。
    console.warn(`⚠️  ${t('cli.mcpCredentials.storePlaintext', { path: desc.path })}`);
    console.warn(`    reason=${desc.reasonCode} detail=${desc.detail}`);
    return;
  }
  // 已加密:信息行只在调用方主动问状态时打(授权完成 / capabilities),不在每次写盘时刷屏。
  console.info(`🔐 ${t('cli.mcpCredentials.storeEncrypted', { backend: BACKEND_LABEL[desc.backend] })}`);
}

/**
 * 凭据状态出口(本票唯一):`capabilities` 与授权完成提示都必须经它。
 * **纯读**:不生成密钥、不落盘、不锁死任何回退路径(票第 8 栏)。
 */
export async function describeCredentialStore(): Promise<CredentialStoreDescription> {
  const plan = await planStoreBackend(false);
  const at = await inspectCredentialFile();
  const backend = plan.backend;
  const reason =
    backend === 'plaintext-file'
      ? t('cli.mcpCredentials.storePlaintext', { path: getCredentialsPath() })
      : t('cli.mcpCredentials.storeEncrypted', { backend: BACKEND_LABEL[backend] });
  const caveat =
    at.envelope && plan.material === null
      ? ' —— ⚠️ 盘上已是信封,但本机当前没有可用主密钥(换机/密钥文件被清):解不开,不会覆盖'
      : !at.envelope && at.plaintextReadable
        ? ' —— ⚠️ 盘上仍是明文存量:首次读时迁移,迁移不确定则保留原文件并大声报'
        : '';
  return {
    backend,
    path: getCredentialsPath(),
    keyPath: plan.keyPath,
    reasonCode: plan.reasonCode,
    reason,
    detail: plan.detail + caveat,
    plaintextAtRest: at.plaintextReadable,
    envelopeAtRest: at.envelope,
    unreadableAtRest: at.unreadable,
    entryCount: at.entryCount,
  };
}

interface StorePlan {
  backend: CredentialStoreBackend;
  keyPath: string | null;
  reasonCode: string;
  detail: string;
}

/**
 * 写入完成后必须经这里把档位喊出来(生产调用点:`mcp-oauth.ts` 第 6 步、`capabilities`)。
 * 出口与判档共用 `planStoreBackend`,不在调用方各写一份"看起来一样的"档位推断。
 */
export async function announceCredentialStore(): Promise<CredentialStoreDescription> {
  const desc = await describeCredentialStore();
  reportStoreState(desc);
  return desc;
}

/**
 * 档位判定的**唯一一份**实现:describe(纯读)与 write(可创建)都走它,
 * 否则"报告说的档"与"实际用的档"会分叉 —— 本仓记过太多次两处算同一件事必漂移。
 */
async function planStoreBackend(allowCreate: boolean): Promise<StorePlan & { material: MasterKeyMaterial | null }> {
  const plaintextOptIn = process.env[CRED_PLAINTEXT_ENV] === '1';
  const pinned = readPinnedBackend();
  if (plaintextOptIn || pinned === 'plaintext-file') {
    return {
      backend: 'plaintext-file',
      keyPath: null,
      reasonCode: 'env-plaintext-opt-in',
      detail: `${CRED_PLAINTEXT_ENV}=1 关掉加密(逃生口;状态行仍照打)`,
      material: null,
    };
  }
  const readOnly = !allowCreate;
  const pinnedToEncrypted = pinned === 'encrypted-file';
  // 档位①:探针过 **且** 现有主密钥封套在本机解得开(或有得可建)才算这一档可用。
  // 纯读出口允许 material=null —— 它的含义是"这一档会被用,但密钥要到写的那一刻才生成";
  // 把这种"判得出档、暂时没密钥"误报成明文档,就等于让 capabilities 说一件写入不做的事。
  const tier1 = pinnedToEncrypted
    ? ({
        ok: false,
        created: false,
        material: null,
        reasonCode: 'os-tier-skipped',
        detail: `${CRED_BACKEND_ENV}=encrypted-file 显式跳过 OS 档`,
      } satisfies TierAttempt)
    : await tryOsTier(readOnly);
  if (tier1.ok) {
    return {
      backend: 'keychain',
      keyPath: getOsWrappedKeyPath(),
      reasonCode: tier1.created ? 'os-tier-created-now' : readOnly && !tier1.material ? 'os-tier-will-create' : 'os-tier-available',
      detail: `DPAPI/CurrentUser via ${tier1.engine ?? 'unknown engine'}; probe evidence ${OS_TIER_EVIDENCE}`,
      material: tier1.material,
    };
  }
  const tier2 = await tryMachineTier(readOnly);
  if (tier2.ok) {
    return {
      backend: 'encrypted-file',
      keyPath: getMachineKeyPath(),
      reasonCode: tier2.created ? 'machine-key-created-now' : readOnly && !tier2.material ? 'machine-key-will-create' : 'machine-key-bound-ok',
      detail: tier2.detail,
      material: tier2.material,
    };
  }
  // 两档都起不来 ⇒ 明文,但**大声报**:降级可见是本票的验收判据之一。
  return {
    backend: 'plaintext-file',
    keyPath: null,
    reasonCode: tier2.reasonCode,
    detail: `tier1=${tier1.reasonCode}(${tier1.detail}); tier2=${tier2.reasonCode}(${tier2.detail})`,
    material: null,
  };
}

function readPinnedBackend(): CredentialStoreBackend | null {
  const raw = (process.env[CRED_BACKEND_ENV] ?? '').trim();
  if (raw === 'encrypted-file' || raw === 'plaintext-file') return raw;
  // 'keychain' 是"往高处钉",不接受为真值 —— 档必须由探针判出,不得被 env 冒充。
  return null;
}

// ==================== 信封结构(结构级判据:恰一层,可判幂等) ====================

export interface CredentialEnvelopeBody {
  alg: typeof ALG;
  kid: string;
  iv: string;
  ct: string;
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
    const buf = Buffer.from(padded, 'base64');
    if (buf.length === 0) return null;
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function sortedKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort();
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const got = sortedKeys(value);
  if (got.length !== expected.length) return false;
  return got.every((k, i) => k === expected[i]);
}

/**
 * 结构级判据:对象**有且仅有** `ihuiVaultV1` 一个键,其值**有且仅有** alg/kid/iv/ct 四个字段,
 * 且 iv/ct 能解出 base64url 字节。"存在即算"不够 —— 迁移幂等要求能判"恰一层",
 * 否则会把已加密的 blob 再包一层(照 local-vault.ts 的同一条判据)。
 */
export function parseCredentialEnvelope(stored: string): CredentialEnvelopeBody | null {
  let outer: unknown;
  try {
    outer = JSON.parse(stored);
  } catch {
    return null;
  }
  if (!isPlainObject(outer)) return null;
  const record = outer as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== ENVELOPE_FIELD) return null;
  const inner = record[ENVELOPE_FIELD];
  if (!isPlainObject(inner)) return null;
  const body = inner as Record<string, unknown>;
  if (!hasExactKeys(body, ENVELOPE_KEYS_SORTED)) return null;
  if (body.alg !== ALG) return null;
  if (typeof body.kid !== 'string' || body.kid.length === 0) return null;
  if (typeof body.iv !== 'string' || typeof body.ct !== 'string') return null;
  if (!fromBase64Url(body.iv) || !fromBase64Url(body.ct)) return null;
  return { alg: ALG, kid: body.kid, iv: body.iv, ct: body.ct };
}

/** 主密钥的公开指纹:SHA-256(key) 前 8 字节 hex。用于判"密钥被换过",不是密钥。 */
function kidOfKey(key: Uint8Array): string {
  return createHash('sha256').update(key).digest().subarray(0, KID_BYTES).toString('hex');
}

function deriveDomainKey(master: Uint8Array, info: string): Uint8Array {
  const label = Buffer.from(info, 'utf-8');
  // hkdfSync 返回 ArrayBuffer;salt 与 info 同取域标签,与 local-vault.ts 的 deriveDomainKey 同形
  return new Uint8Array(hkdfSync('sha256', master, label, label, KEY_BYTES));
}

/** AES-256-GCM 密封:ct 尾部含 16 字节 tag —— 与 WebCrypto 的产出字节同形。 */
function aesGcmSeal(key: Uint8Array, plain: string): { iv: string; ct: string } {
  const iv = new Uint8Array(randomBytes(IV_BYTES));
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(plain, 'utf-8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: toBase64Url(iv), ct: toBase64Url(new Uint8Array(Buffer.concat([enc, tag]))) };
}

function aesGcmOpen(key: Uint8Array, iv: string, ct: string): string | null {
  const ivBytes = fromBase64Url(iv);
  const ctBytes = fromBase64Url(ct);
  if (!ivBytes || !ctBytes || ctBytes.length <= TAG_BYTES) return null;
  const tag = ctBytes.subarray(ctBytes.length - TAG_BYTES);
  const body = ctBytes.subarray(0, ctBytes.length - TAG_BYTES);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, ivBytes);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(body)), decipher.final()]).toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * 唯一的加密出口(守门 67 的 AT 维认这个名字):
 * 含 accessToken/refreshToken/client_secret 的对象写盘前必须过它,否则那道门判红。
 */
export function sealCredentialEnvelope(
  plain: string,
  masterKey: Uint8Array,
  kid: string,
): string {
  const key = deriveDomainKey(masterKey, DOMAIN_INFO);
  const { iv, ct } = aesGcmSeal(key, plain);
  return JSON.stringify({ [ENVELOPE_FIELD]: { alg: ALG, kid, iv, ct } });
}

function openCredentialEnvelope(body: CredentialEnvelopeBody, masterKey: Uint8Array): string | null {
  if (kidOfKey(masterKey) !== body.kid) return null; // 密钥已换/异机封的:不解、不猜
  const key = deriveDomainKey(masterKey, DOMAIN_INFO);
  return aesGcmOpen(key, body.iv, body.ct);
}

// ==================== 档位①:OS 自带凭据能力(DPAPI) ====================

interface MasterKeyMaterial {
  key: Uint8Array;
  kid: string;
  backend: 'keychain' | 'encrypted-file';
}

interface TierAttempt {
  ok: boolean;
  created: boolean;
  material: MasterKeyMaterial | null;
  reasonCode: string;
  detail: string;
  engine?: string;
}

const DPAPI_PS_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  '$mode=$args[0]',
  'try {',
  '  Add-Type -AssemblyName System.Security.Cryptography.ProtectedData -ErrorAction Stop',
  '  $in=[Console]::In.ReadToEnd().Trim()',
  '  $raw=[Convert]::FromBase64String($in)',
  "  if ($mode -eq 'protect') {",
  '    $out=[System.Security.Cryptography.ProtectedData]::Protect($raw,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '  } else {',
  '    $out=[System.Security.Cryptography.ProtectedData]::Unprotect($raw,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '  }',
  '  [Console]::Out.Write([Convert]::ToBase64String($out))',
  '  exit 0',
  '} catch {',
  '  exit 3',
  '}',
].join('\n');

interface DpapiOutcome {
  ok: boolean;
  payload: string | null;
  engine: string;
  detail: string;
}

/** PowerShell 候选引擎(命中即缓存)。绝不写死盘符:ProgramFiles/SystemRoot 取自 env。 */
function pwshCandidates(): string[] {
  const out = ['pwsh'];
  const programFiles = process.env.ProgramFiles || process.env['ProgramFiles(x86)'] || '';
  if (programFiles) out.push(path.posix.join(programFiles.replace(/\\/g, '/'), 'PowerShell/7/pwsh.exe'));
  const systemRoot = (process.env.SystemRoot || '').replace(/\\/g, '/');
  if (systemRoot) {
    out.push(path.posix.join(systemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'));
  }
  return out;
}

let cachedEngine: string | null = null;
/** 引擎都试过一遍的失败结论(进程内缓存,避免每次写盘都重跑一遍冷启动) */
let osTierFailure: string | null = null;

function runOneEngine(engine: string, mode: 'protect' | 'unprotect', payloadB64: string): Promise<DpapiOutcome> {
  return new Promise((resolve) => {
    const encoded = Buffer.from(DPAPI_PS_SCRIPT, 'utf16le').toString('base64');
    const child = execFile(
      engine,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded, mode],
      { encoding: 'utf8', timeout: DPAPI_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
      (err, stdout) => {
        if (err) {
          resolve({
            ok: false,
            payload: null,
            engine,
            // 只取退出码与 ASCII 片段:PowerShell 的异常文案是本机码页下的本地化文本(实测被 GBK 打乱)
            detail: `${engine} rc=${(err as { code?: number | string }).code ?? 'n/a'} ${String(err.message).replace(/[^\x20-\x7e]/g, '').slice(0, 80)}`,
          });
          return;
        }
        const last = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0).pop() ?? '';
        resolve({
          ok: last.length > 0,
          payload: last.length > 0 ? last.trim() : null,
          engine,
          detail: `roundtrip chars=${last.length}`,
        });
      },
    );
    // 载荷走 stdin,不进 argv(进程列表里看得见命令行参数)
    if (child.stdin) {
      child.stdin.end(payloadB64);
    }
  });
}

/** DPAPI 一次调用:按候选序试,首个成功者缓存为本次进程的引擎。 */
async function runDpapi(mode: 'protect' | 'unprotect', bytes: Uint8Array): Promise<DpapiOutcome> {
  const payloadB64 = Buffer.from(bytes).toString('base64');
  const candidates = cachedEngine ? [cachedEngine, ...pwshCandidates().filter((e) => e !== cachedEngine)] : pwshCandidates();
  const failures: string[] = [];
  for (const engine of candidates) {
    if (engine === 'pwsh' && process.platform !== 'win32') continue; // 'pwsh' 候选只在 Windows 侧试
    const outcome = await runOneEngine(engine, mode, payloadB64);
    if (outcome.ok && outcome.payload) {
      cachedEngine = engine;
      return outcome;
    }
    failures.push(outcome.detail);
    if (process.platform === 'win32') break; // Windows 上"pwsh 不在 PATH"是常态,继续往下探
  }
  return { ok: false, payload: null, engine: '', detail: failures.join(' | ').slice(0, 240) };
}

/** 探针 = 真跑一次 protect 往返(不写盘),因此"探针通过"与"能力可用"是同一件事。 */
async function probeOsTier(): Promise<{ ok: boolean; engine: string; detail: string }> {
  if (process.platform !== 'win32') {
    // 本票只在 Windows/DPAPI 上取过证(见 OS_TIER_EVIDENCE)。其它平台的 OS 档**未取证** ⇒ 不启用,
    // 也不冒充:让 macOS/Linux 走档位②,档位与原因照实打印。
    return { ok: false, engine: '', detail: 'non-win32: OS tier 未取证,不启用' };
  }
  if (osTierFailure) return { ok: false, engine: '', detail: osTierFailure };
  const probe = await runDpapi('protect', new Uint8Array(Buffer.from('ihui-d146-os-tier-probe', 'utf-8')));
  if (!probe.ok || !probe.payload) {
    osTierFailure = probe.detail || 'all engines failed';
    return { ok: false, engine: '', detail: osTierFailure };
  }
  const back = await runDpapi('unprotect', new Uint8Array(Buffer.from(probe.payload, 'base64')));
  const roundtrip =
    back.ok && back.payload && Buffer.from(back.payload, 'base64').toString('utf-8') === 'ihui-d146-os-tier-probe';
  if (!roundtrip) {
    osTierFailure = `protect ok 但 unprotect 往返不一致(${back.detail})`;
    return { ok: false, engine: '', detail: osTierFailure };
  }
  return { ok: true, engine: probe.engine, detail: probe.detail };
}

const osWrappedCache = new Map<string, MasterKeyMaterial>();

async function tryOsTier(readOnly: boolean): Promise<TierAttempt> {
  const probe = await probeOsTier();
  if (!probe.ok) {
    return { ok: false, created: false, material: null, reasonCode: 'os-tier-unavailable', detail: probe.detail };
  }
  const p = getOsWrappedKeyPath();
  const cached = osWrappedCache.get(p);
  if (cached) {
    return { ok: true, created: false, material: cached, reasonCode: 'os-tier-available', detail: probe.detail, engine: probe.engine };
  }
  let existing: string | null = null;
  try {
    existing = await fs.readFile(p, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      // 读通道失败(权限/IO):**绝不生成/覆盖密钥**(local-vault 硬约束 1)
      return { ok: false, created: false, material: null, reasonCode: 'os-wrapper-read-error', detail: `read ${p}: ${code ?? 'error'}` };
    }
  }
  if (existing !== null) {
    const un = await runDpapi('unprotect', new Uint8Array(Buffer.from(existing.trim(), 'base64')));
    if (!un.ok || !un.payload) {
      return { ok: false, created: false, material: null, reasonCode: 'os-wrapper-unreadable-on-this-machine', detail: `已有主密钥封套在本机解不开(${un.detail});不覆盖` };
    }
    const key = new Uint8Array(Buffer.from(un.payload, 'base64'));
    if (key.length !== KEY_BYTES) {
      return { ok: false, created: false, material: null, reasonCode: 'os-wrapper-key-size', detail: `解出 ${key.length} 字节,应为 ${KEY_BYTES}` };
    }
    const material: MasterKeyMaterial = { key, kid: kidOfKey(key), backend: 'keychain' };
    osWrappedCache.set(p, material);
    return { ok: true, created: false, material, reasonCode: 'os-tier-available', detail: un.detail, engine: un.engine };
  }
  if (readOnly) {
    // 纯读出口不创建:档位仍可报 keychain,因为探针已过、写入时会就地生成
    return { ok: true, created: false, material: null, reasonCode: 'os-tier-will-create', detail: probe.detail, engine: probe.engine };
  }
  // 生成 → 落盘 → **回读比对一致才认**(不承认落盘就不加密)
  const fresh = new Uint8Array(randomBytes(KEY_BYTES));
  const prot = await runDpapi('protect', fresh);
  if (!prot.ok || !prot.payload) {
    return { ok: false, created: false, material: null, reasonCode: 'os-protect-failed', detail: prot.detail };
  }
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, prot.payload.trim(), 'utf-8');
  await chmodSafe(p);
  const verify = await runDpapi('unprotect', new Uint8Array(Buffer.from(prot.payload.trim(), 'base64')));
  const same =
    verify.ok && !!verify.payload && Buffer.compare(Buffer.from(verify.payload, 'base64'), Buffer.from(fresh)) === 0;
  if (!same) {
    return { ok: false, created: false, material: null, reasonCode: 'os-key-readback-mismatch', detail: `回读不一致(${verify.detail});不落任何密文` };
  }
  const material: MasterKeyMaterial = { key: fresh, kid: kidOfKey(fresh), backend: 'keychain' };
  osWrappedCache.set(p, material);
  return { ok: true, created: true, material, reasonCode: 'os-tier-created-now', detail: verify.detail, engine: prot.engine };
}

// ==================== 档位②:机器绑定口令文件 ====================

function machineMaterialLabel(): string {
  let user = '';
  try {
    user = os.userInfo().username;
  } catch {
    user = process.env.USERNAME || process.env.USER || '';
  }
  return `${os.hostname()}|${os.platform()}|${os.arch()}|${user}`;
}

/** 本机身份指纹(只出指纹,不出原料;它自身不是密钥) */
function machineBindingFingerprint(): string {
  return createHash('sha256').update(machineMaterialLabel(), 'utf-8').digest().subarray(0, 8).toString('hex');
}

function wrapKeyForMachine(): Uint8Array {
  return deriveDomainKey(new Uint8Array(Buffer.from(machineMaterialLabel(), 'utf-8')), KEY_WRAP_INFO);
}

function parseKeyEnvelope(stored: string): { mb: string; iv: string; ct: string } | null {
  let outer: unknown;
  try {
    outer = JSON.parse(stored);
  } catch {
    return null;
  }
  if (!isPlainObject(outer)) return null;
  const record = outer as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== KEY_ENVELOPE_FIELD) return null;
  const inner = record[KEY_ENVELOPE_FIELD];
  if (!isPlainObject(inner)) return null;
  const body = inner as Record<string, unknown>;
  if (!hasExactKeys(body, KEY_ENVELOPE_KEYS_SORTED)) return null;
  if (typeof body.mb !== 'string' || typeof body.iv !== 'string' || typeof body.ct !== 'string') return null;
  return { mb: body.mb, iv: body.iv, ct: body.ct };
}

function sealKeyEnvelope(master: Uint8Array): string {
  const { iv, ct } = aesGcmSeal(wrapKeyForMachine(), toBase64Url(master));
  return JSON.stringify({ [KEY_ENVELOPE_FIELD]: { mb: machineBindingFingerprint(), iv, ct } });
}

function openKeyEnvelope(env: { mb: string; iv: string; ct: string }): Uint8Array | null {
  if (env.mb !== machineBindingFingerprint()) return null; // 换了机器/换了账号:解不开,不猜、不覆盖
  const plain = aesGcmOpen(wrapKeyForMachine(), env.iv, env.ct);
  if (plain === null) return null;
  const key = fromBase64Url(plain);
  if (!key || key.length !== KEY_BYTES) return null;
  return key;
}

const machineKeyCache = new Map<string, MasterKeyMaterial>();

async function tryMachineTier(readOnly: boolean): Promise<TierAttempt> {
  const p = getMachineKeyPath();
  const cached = machineKeyCache.get(p);
  if (cached) {
    return { ok: true, created: false, material: cached, reasonCode: 'machine-key-bound-ok', detail: 'cache hit' };
  }
  let existing: string | null = null;
  try {
    existing = await fs.readFile(p, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      return { ok: false, created: false, material: null, reasonCode: 'machine-key-read-error', detail: `read ${p}: ${code ?? 'error'}` };
    }
  }
  if (existing !== null) {
    const env = parseKeyEnvelope(existing);
    if (!env) {
      return { ok: false, created: false, material: null, reasonCode: 'machine-key-envelope-shape', detail: '口令文件结构不符信封判据;不覆盖' };
    }
    const key = openKeyEnvelope(env);
    if (!key) {
      return {
        ok: false,
        created: false,
        material: null,
        reasonCode: 'machine-key-binding-mismatch',
        detail: `本机指纹 ${machineBindingFingerprint()} 与口令文件 ${env.mb} 不同(换机/换账号);不覆盖`,
      };
    }
    const material: MasterKeyMaterial = { key, kid: kidOfKey(key), backend: 'encrypted-file' };
    machineKeyCache.set(p, material);
    return { ok: true, created: false, material, reasonCode: 'machine-key-bound-ok', detail: 'unwrapped' };
  }
  if (readOnly) {
    return { ok: true, created: false, material: null, reasonCode: 'machine-key-will-create', detail: '本机身份可用,写入时就地生成' };
  }
  const fresh = new Uint8Array(randomBytes(KEY_BYTES));
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, sealKeyEnvelope(fresh), 'utf-8');
  await chmodSafe(p);
  const verifyRaw = await fs.readFile(p, 'utf-8').catch(() => null);
  const verifyKey = verifyRaw === null ? null : openKeyEnvelope(parseKeyEnvelope(verifyRaw) ?? { mb: '', iv: '', ct: '' });
  if (!verifyKey || Buffer.compare(Buffer.from(verifyKey), Buffer.from(fresh)) !== 0) {
    return { ok: false, created: false, material: null, reasonCode: 'machine-key-readback-mismatch', detail: '回读比对不一致;不落任何密文' };
  }
  const material: MasterKeyMaterial = { key: fresh, kid: kidOfKey(fresh), backend: 'encrypted-file' };
  machineKeyCache.set(p, material);
  return { ok: true, created: true, material, reasonCode: 'machine-key-created-now', detail: 'created + verified' };
}

async function chmodSafe(p: string): Promise<void> {
  try {
    // 0o600 = rw-------;Windows 上 chmod 只影响 owner 位(group/other 被忽略)
    await fs.chmod(p, 0o600);
  } catch {
    // 某些文件系统不支持 chmod:忽略(文件已写入),但**不**把它当成"加密已生效"
  }
}

// ==================== 读写主链路 ====================

/** 把盘上文本解成凭据集合:0 层=明文存量,≥1 层=信封。解不开 ⇒ kind:'unreadable'(交上层判故障,**不再折回空对象**)。 */
async function decodeCredentialText(
  raw: string,
): Promise<
  | { kind: 'plain'; creds: McpCredentials }
  | { kind: 'sealed'; creds: McpCredentials; layers: number }
  | { kind: 'unreadable'; reasonCode: string; detail: string; cause?: unknown }
> {
  let current = raw;
  let layers = 0;
  for (let guard = 0; guard < MAX_UNWRAP_LAYERS; guard++) {
    const body = parseCredentialEnvelope(current);
    if (body === null) break;
    const plan = await planStoreBackend(false);
    if (!plan.material) {
      const willCreate = plan.reasonCode.endsWith('-will-create') || plan.backend === 'plaintext-file';
      return {
        kind: 'unreadable',
        reasonCode: willCreate ? 'envelope-without-local-key-material' : plan.reasonCode,
        detail: `本机当前没有可用于解开的密钥材料(档=${plan.backend},reason=${plan.reasonCode}); ${plan.detail}`,
      };
    }
    const text = openCredentialEnvelope(body, plan.material.key);
    if (text === null) {
      return {
        kind: 'unreadable',
        reasonCode: body.kid === plan.material.kid ? 'envelope-corrupt' : 'envelope-kid-mismatch',
        detail: `信封 kid=${body.kid} 本机 kid=${plan.material.kid}(同值却解不开=密文损坏;不等=密钥已换/异机封的)`,
      };
    }
    current = text;
    layers += 1;
  }
  const payload = classifyCredentialPayload(current);
  if (!payload.ok) {
    return { kind: 'unreadable', reasonCode: payload.reasonCode, detail: payload.detail, cause: payload.cause };
  }
  if (layers === 0) return { kind: 'plain', creds: payload.creds };
  return { kind: 'sealed', creds: payload.creds, layers };
}

/** 解出来的顶层/条目形状结论(每条都带**可点名的** ASCII 码,供上层分档与脚本对账)。 */
type PayloadVerdict =
  | { ok: true; creds: McpCredentials }
  | {
      ok: false;
      reasonCode: 'payload-not-json' | 'payload-not-object' | 'payload-entry-not-object';
      detail: string;
      cause?: unknown;
    };

/**
 * 顶层必须是对象、每个条目也必须**是对象**(G-709 的"形状不合"档)。
 *
 * 刻意只判到"条目是不是对象",不逐字段验类型:字段级损坏(如 accessToken 写成数字)
 * 不会造成"一次保存清空其它 server 的凭据"这一型事故,读方一律按可选处理;
 * 把判据拉到逐字段,等于把一次良性手编辑升格成整站不可用 —— 那是另一种"恒红门"。
 * 但**条目不是对象**必须判故障:`{"https://a": "oops"}` 被当成凭据集合读下去,
 * 下一次整文件写回就会把它连同其它条目一起改写掉。
 */
function classifyCredentialPayload(text: string): PayloadVerdict {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, reasonCode: 'payload-not-json', detail: 'JSON 解析失败(半截/被截断的内容)', cause: err };
  }
  if (!isPlainObject(parsed)) return { ok: false, reasonCode: 'payload-not-object', detail: '顶层不是 JSON 对象' };
  const record = parsed as Record<string, unknown>;
  for (const serverUrl of Object.keys(record)) {
    if (!isPlainObject(record[serverUrl])) {
      return { ok: false, reasonCode: 'payload-entry-not-object', detail: `条目 ${serverUrl} 不是对象` };
    }
  }
  return { ok: true, creds: record as McpCredentials };
}

// ==================== G-709:存储健康度(把"读坏"与"没有"分开) ====================

/**
 * 读盘的结论。**只有 `absent`(ENOENT)可以折算成"空 store"。**
 *
 * 现网缺陷(G-709)的形状:旧实现在 catch 里对 SyntaxError 与其它 errno 一律 `return {}`,
 * 而本模块每个写入口都是"整文件读-改-写"(loadMcpCredentials → 改一个 key → 整份回写),
 * 于是一次瞬时损坏(半截 JSON / 磁盘抖动 / 别的进程写坏)之后的**第一次保存,就把其它
 * server 的 OAuth/登录凭据全部清空**,而账面没有任何线索。
 * 上游对照(逐字读到体)`credentialService.ts:61-72` 的原文判据:
 *   "把损坏 JSON/schema 当成空 store 后继续 save 会清空其他 OAuth 与登录凭据。
 *    保留损坏文件证据并向上传递错误,禁止自动覆盖。"
 *
 * 三档故障(`McpCredentialStoreProblem`)各自的处置,**全部抛,不返回空对象**:
 *   - `corrupt`       字节读到了却解不出可用凭据集合(半截 JSON / 顶层或条目形状不合 /
 *                     信封密文自身坏了)⇒ **先把原文件留证隔离,再抛**。
 *   - `unreadable`    连字节都没读到(非 ENOENT 的 errno:权限、IO、路径被占)⇒
 *                     没有可隔离的证据,直接抛。**"读不到"永远不写成"没有"**。
 *   - `undecryptable` 字节完好、信封结构合法,只是本机没有对得上的密钥(换机/换账号/
 *                     密钥文件被清)⇒ **不产隔离件**(那份文件并不坏),但仍然抛 ——
 *                     悄悄用新内容重写它,同样是清空。
 */
export type McpCredentialStoreState = 'ok' | 'absent' | 'corrupt' | 'unreadable' | 'undecryptable';

/** 故障档(= 状态去掉 ok/absent)。调用方据此把"存储坏了"与"这条没有凭据"分开的唯一依据。 */
export type McpCredentialStoreProblem = Exclude<McpCredentialStoreState, 'ok' | 'absent'>;

const STORE_PROBLEMS: readonly McpCredentialStoreProblem[] = ['corrupt', 'unreadable', 'undecryptable'];

/**
 * 只有这两个稳定 ASCII 码算"文件本身没坏、是本机没有钥匙"⇒ 不产 `.corrupt-*` 隔离件。
 * 其余解不开(含 `envelope-corrupt`:kid 相同却解不开)一律按 corrupt 留证。
 */
const UNDECRYPTABLE_REASON_CODES: readonly string[] = [
  'envelope-kid-mismatch',
  'envelope-without-local-key-material',
];

/** 读盘结论(结构化三态出口;`loadMcpCredentials()` 就是"非 ok/absent 即抛"的投影)。 */
export interface McpCredentialStoreSnapshot {
  state: McpCredentialStoreState;
  /** 只有 `ok` 交出内容;其余一律 `{}` —— 但**空对象不再是唯一信号**,那正是本票修的形态 */
  credentials: McpCredentials;
  storePath: string;
  /** corrupt 时的隔离件路径;隔离失败或非 corrupt 档 ⇒ null */
  evidencePath: string | null;
  /** 稳定 ASCII 码(供脚本/文档对账,不含凭据内容) */
  reasonCode: string;
  /** 人类可读结论(点名路径与处置方向,不含凭据内容) */
  detail: string;
  /** 原始异常(JSON SyntaxError / errno),抛错时挂到新错误的 `cause` 上 */
  cause?: unknown;
}

/**
 * 存储故障错误 —— 消息**点名路径**、带状态与 reason 码、带隔离件路径,
 * 且**永不携带文件内容或任何凭据值**(§5d 同条禁令)。
 *
 * 为什么不照上游那样"console.warn + throw":warn 会被日志级别与终端翻页吃掉,
 * 而"存储坏了"这件事的后果是**下一次保存静默清掉别人的凭据** —— 那种事故只允许
 * 以"调用拿不到结果"的形态发生,不允许以"打印过了就算喊过了"的形态发生。
 */
export class McpCredentialStoreError extends Error {
  readonly mcpCredentialStoreProblem: McpCredentialStoreProblem;
  readonly storePath: string;
  readonly evidencePath: string | null;
  readonly storeReasonCode: string;

  constructor(snapshot: McpCredentialStoreSnapshot) {
    const problem = snapshot.state as McpCredentialStoreProblem;
    super(describeStoreFailure(snapshot), snapshot.cause === undefined ? undefined : { cause: snapshot.cause });
    this.name = 'McpCredentialStoreError';
    this.mcpCredentialStoreProblem = problem;
    this.storePath = snapshot.storePath;
    this.evidencePath = snapshot.evidencePath;
    this.storeReasonCode = snapshot.reasonCode;
  }
}

/** 组装故障消息(纯 ASCII + 路径;把 detail 附在最后,便于人读也便于 grep 状态词)。 */
function describeStoreFailure(snap: McpCredentialStoreSnapshot): string {
  const evidence =
    snap.state !== 'corrupt'
      ? snap.evidencePath
        ? `; evidence copy at ${snap.evidencePath}`
        : `; no evidence copy written (state=${snap.state}: not the "bytes are broken" tier)`
      : snap.evidencePath
        ? `; original bytes copied to ${snap.evidencePath}`
        : '; evidence copy FAILED — the unreadable file is still in place, do not overwrite it';
  return (
    `MCP credential store cannot be read safely: ${snap.storePath} ` +
    `(state=${snap.state}, reason=${snap.reasonCode})${evidence}. ` +
    'Refusing to read it as an empty store: the next whole-file save would drop every other ' +
    "server's OAuth / login credentials. Repair or explicitly delete the file to proceed." +
    ` detail=${snap.detail}`
  );
}

/**
 * 不依赖 `instanceof` 的错误分档(与 `mcp-oauth.ts` 的 `readMcpRefreshKind` 同一条理由:
 * 模块 mock / 跨包副本会让 instanceof 失真,而"认不出类型"就会被折进兜底分支)。
 */
export function readMcpCredentialStoreProblem(err: unknown): McpCredentialStoreProblem | undefined {
  if (err === null || typeof err !== 'object') return undefined;
  const raw = (err as { mcpCredentialStoreProblem?: unknown }).mcpCredentialStoreProblem;
  if (typeof raw !== 'string') return undefined;
  return (STORE_PROBLEMS as readonly string[]).includes(raw) ? (raw as McpCredentialStoreProblem) : undefined;
}

/** 隔离件后缀族名:与 `apps/cli/src/hooks/trust.ts` 的 `.corrupt-<…>` 同族,不自造第三套命名 */
const CORRUPT_EVIDENCE_SUFFIX = '.corrupt-';
/** 隔离件名里的内容指纹字节数:够判"同一份损坏已留过证"即可 */
const CORRUPT_EVIDENCE_ID_BYTES = 12;

/**
 * 把读不出内容的那份文件**复制**到同目录 `.corrupt-<内容指纹>` 留证,原文件**留在原位**。
 *
 * 两个刻意的选择(都不是随手):
 *  - **按内容指纹命名,不按时刻**:一份损坏的 store 会被桌面宿主、CLI 与重试循环反复读
 *    (上游 `backupCorruptFile` 同因)。按时刻命名 ⇒ 每读一次多长一件证据,真信号被淹在
 *    自己造出的噪声里;按内容命名 + `wx` 排他创建 ⇒ 同一份损坏稳定收敛到一件证据,
 *    而内容又变了一次(再次写坏)自然落成新的一件 —— 两型都判得出来。
 *  - **复制,不改名移走**:`.corrupt-*` 只是证据,被审判的那份必须**仍在原位**继续拒绝下一次读。
 *    把它移走 ⇒ 下一次读得到 ENOENT ⇒ 折算成"空 store" ⇒ 第一次保存写回一份只含当前这一条
 *    server 的文件 —— 那正是本票要拦的清空,只是换了个触发路径。
 *
 * 为什么这一处**不**走 `util/atomic-write.ts`:那个出口的载荷是 `string`(utf-8 写死),
 * 而证据的价值在于**原字节逐字可复得** —— 损坏形态常常正是"非法/半截 UTF-8",
 * 经字符串往返会被替换字符改写掉。这里是"排他创建一份新文件"(`wx`,不覆盖任何东西),
 * 不是读-改-写替换,atomic 出口要防的那两格(截断可见、覆盖别人改动)在本动作里都不存在。
 */
async function isolateUnreadableStore(
  storePath: string,
): Promise<{ evidencePath: string | null; failed: string }> {
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(storePath);
  } catch (err) {
    return { evidencePath: null, failed: `重读原文件失败(errno=${errCodeOf(err) ?? 'n/a'})` };
  }
  const contentId = createHash('sha256')
    .update(bytes)
    .digest()
    .subarray(0, CORRUPT_EVIDENCE_ID_BYTES)
    .toString('hex');
  const evidencePath = `${storePath}${CORRUPT_EVIDENCE_SUFFIX}${contentId}`;
  try {
    await fs.writeFile(evidencePath, bytes, { flag: 'wx', mode: 0o600 });
  } catch (err) {
    // EEXIST = 同一份损坏已经留过证 ⇒ 收敛到已有那一件,不是失败;其余 errno 才算隔离失败
    if (errCodeOf(err) !== 'EEXIST') {
      return { evidencePath: null, failed: `留证写入失败(errno=${errCodeOf(err) ?? 'n/a'})` };
    }
  }
  // 证据里装的是别人的 token,权限位必须与主文件同档(0600),不能留默认 0644
  await chmodSafe(evidencePath);
  return { evidencePath, failed: '' };
}

function errCodeOf(err: unknown): string | undefined {
  if (err === null || typeof err !== 'object' || !('code' in err)) return undefined;
  const code = (err as { code: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * 凭据存储的**结构化读盘出口**(G-709 新增;`loadMcpCredentials()` 是它的"非 ok/absent 即抛"投影)。
 * 需要"三态"而不是 try/catch 的调用方(状态命令、能力披露、迁移前自检)用它。
 */
export async function readCredentialStoreSnapshot(): Promise<McpCredentialStoreSnapshot> {
  const storePath = getCredentialsPath();
  let raw: string;
  try {
    raw = await fs.readFile(storePath, 'utf-8');
  } catch (err) {
    const code = errCodeOf(err);
    if (code === 'ENOENT') {
      return {
        state: 'absent',
        credentials: {},
        storePath,
        evidencePath: null,
        reasonCode: 'absent',
        detail: `${storePath} 不存在(尚未保存任何 MCP 凭据)`,
      };
    }
    return {
      state: 'unreadable',
      credentials: {},
      storePath,
      evidencePath: null,
      reasonCode: `read-${code ?? 'error'}`,
      detail: `读取 ${storePath} 失败(errno=${code ?? 'n/a'})—— 未取到字节,没有可隔离的证据`,
      cause: err,
    };
  }
  const decoded = await decodeCredentialText(raw);
  if (decoded.kind === 'unreadable') {
    const problem: McpCredentialStoreProblem = UNDECRYPTABLE_REASON_CODES.includes(decoded.reasonCode)
      ? 'undecryptable'
      : 'corrupt';
    // 顺序固定:先隔离证据,再判故障。判据**不依赖**隔离是否成功 —— 隔离失败只多一句
    // "证据没保住",绝不允许因为隔离失败而把故障折回"没有凭据"(那等于把止血动作变成新的出血点)。
    const isolation = problem === 'corrupt' ? await isolateUnreadableStore(storePath) : null;
    return {
      state: problem,
      credentials: {},
      storePath,
      evidencePath: isolation?.evidencePath ?? null,
      reasonCode: decoded.reasonCode,
      detail:
        isolation && isolation.failed ? `${decoded.detail};留证隔离**失败**(${isolation.failed})` : decoded.detail,
      cause: decoded.cause,
    };
  }
  if (decoded.kind === 'plain') {
    // 明文存量 → 就地迁移(D146);迁移任何不确定 ⇒ 它自己保留原文件并大声报,不影响本次读
    await migratePlaintextStore(raw, decoded.creds);
  }
  if (decoded.kind === 'sealed' && decoded.layers > 1) {
    // 双重包裹(历史/并发产物)⇒ 归正为恰一层;"恰一层"判据由 parseCredentialEnvelope 给
    console.warn(`⚠️  凭据信封被包裹了 ${decoded.layers} 层,正在归正为 1 层: ${storePath}`);
    await persistCredentials(decoded.creds);
  }
  return {
    state: 'ok',
    credentials: decoded.creds,
    storePath,
    evidencePath: null,
    reasonCode: 'ok',
    detail: '',
  };
}

/**
 * 加载所有 MCP 凭证。
 * - 文件不存在(ENOENT)→ 返回 {}(**唯一**可以折算成空 store 的形态)
 * - 解析失败 / 形状不合 / 信封解不开 / 其它读盘 errno → **抛 `McpCredentialStoreError`**
 *   (corrupt 档先留证隔离;消息点名路径;永不带凭据内容),因为本模块的写入口是
 *   整文件读-改-写 —— 把"读坏"读成"没有",下一次保存就会清空其它 server 的凭据。
 *   需要三态而不是异常形态的调用方用 `readCredentialStoreSnapshot()`。
 *
 * 抛之前仍要打那一行 `migrationFailed`(D146 已把它写成测试断言:"解不开"必须喊,
 * 且喊的内容是"原文件已保留、未覆盖"):**只喊不抛**留不住本票要拦的事故(调用方拿着空对象
 * 继续 save),**只抛不喊**又会让状态命令的使用者看不到"文件仍在、没被动过"这条关键信息。
 * 上游 `credentialService.ts:61-72` 也正是两件事一起做:logger.warn + throw。
 */
export async function loadMcpCredentials(): Promise<McpCredentials> {
  const snap = await readCredentialStoreSnapshot();
  if (snap.state === 'ok' || snap.state === 'absent') return snap.credentials;
  console.error(
    `❌ ${t('cli.mcpCredentials.migrationFailed', { reason: `${snap.state}/${snap.reasonCode}` })}`,
  );
  console.error(
    `   file=${snap.storePath} kept as-is —— not overwritten, not read as an empty store` +
      (snap.evidencePath ? `; evidence copy=${snap.evidencePath}` : ''),
  );
  throw new McpCredentialStoreError(snap);
}

/**
 * 存量明文 → 信封(票第③步:幂等迁移)。
 * 三道防护(照抄 local-vault.ts 硬约束):内存内 seal→open→比对一致才写;
 * 写完回读再解一次比对;**回读不合格就把原文写回去**并大声报 —— 宁可这一轮写明文,
 * 也不制造解不开的密文。
 */
async function migratePlaintextStore(originalRaw: string, creds: McpCredentials): Promise<void> {
  const p = getCredentialsPath();
  const plan = await planStoreBackend(true);
  if (plan.backend === 'plaintext-file' || !plan.material) {
    const desc = await describeCredentialStore();
    reportStoreState(desc);
    return;
  }
  const sealed = sealCredentialEnvelope(JSON.stringify(creds), plan.material.key, plan.material.kid);
  const back = parseCredentialEnvelope(sealed);
  const inMemoryOk = back !== null && openCredentialEnvelope(back, plan.material.key) === JSON.stringify(creds);
  if (!inMemoryOk) {
    console.error(
      `❌ ${t('cli.mcpCredentials.migrationFailed', { reason: 'seal/open 内存往返不一致;未改动原文件' })}`,
    );
    return;
  }
  try {
    // 迁移写也走原子出口:一次"半截的密文"比一次半截的明文更难查(它读起来像密钥坏了)。
    commitAtomicWrite(captureWriteBaseline(p), sealed);
    await chmodSafe(p);
  } catch (err) {
    const code = errCodeOf(err) ?? 'write-error';
    console.error(
      `❌ ${t('cli.mcpCredentials.migrationFailed', { reason: `写入失败 ${code};原文件未改动` })}`,
    );
    return;
  }
  const reread = await fs.readFile(p, 'utf-8').catch(() => null);
  if (reread === null) {
    console.error(
      `❌ ${t('cli.mcpCredentials.migrationFailed', { reason: '回读写不到;文件状态未知,交下次读收敛' })}`,
    );
    return;
  }
  const rereadBody = parseCredentialEnvelope(reread);
  const verified =
    rereadBody !== null && openCredentialEnvelope(rereadBody, plan.material.key) === JSON.stringify(creds);
  if (!verified) {
    // 已经改过盘 ⇒ 唯一安全动作是把**原明文**放回去(它仍在手里),不能留下解不开的东西
    try {
      // 还原这一笔的基线取"当前盘上那份(我们刚写的、已判定解不开的密文)",
      // 所以正常路径上必然校验通过;而不取基线、直接覆写会静默盖掉第三者在此期间写入的凭据。
      const currentOnDisk = await fs.readFile(p, 'utf-8').catch(() => null);
      commitAtomicWrite({ absPath: p, content: currentOnDisk }, originalRaw);
      await chmodSafe(p);
      console.error(
        `❌ ${t('cli.mcpCredentials.migrationFailed', { reason: '落盘回读不一致;已把原明文文件还原,未覆盖' })}`,
      );
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? 'restore-error';
      console.error(
        `❌ ${t('cli.mcpCredentials.migrationFailed', { reason: `落盘回读不一致且还原失败 ${code};文件状态未知,必须人工核对 ${p}` })}`,
      );
    }
    return;
  }
  console.info(
    `✅ ${t('cli.mcpCredentials.storeEncrypted', { backend: BACKEND_LABEL[plan.backend] })} —— 存量明文已迁移: ${p}`,
  );
}

/**
 * 保存全部凭证到磁盘(**整文件覆写**,不是读-改-写)。
 * - 自动创建父目录
 * - 按档位加密后写盘(①/② 加密;③ 或加密起不来时明文,**并大声报档与原因**)
 * - **落盘走 `util/atomic-write.ts` 那一份出口**(同目录 tmp + fsync + rename):
 *   裸 `fs.writeFile` 会让并发读方看见半截 JSON,而"半截 JSON"正是本票
 *   `readCredentialStoreSnapshot()` 要拦的那一型损坏 —— 写方不能自己当上游故障的制造者。
 *   磁盘基线在提交前一刻才捕获,所以"别人在这期间改过"会以 `WriteConflictError` **必然报错**,
 *   而不是静默覆盖(两个都不带锁的整文件写方相撞,过去表现为"后写的赢")。
 * - **本函数刻意不取跨进程变更锁**:`commitCredentialCas` 是在**已持有** `mcp-refresh.lock`
 *   的时候调它的,在这里加锁等于让同一个进程等自己的锁(acquireLock 不可重入 ⇒ 等满
 *   `REFRESH_LOCK_WAIT_MS` 再抛"等锁超时"),把刷新路径换成一台自锁死的死锁。
 *   需要"读-改-写全过程在锁内"的入口是 setCredential / deleteCredential,见那两个函数。
 * - 写入后设置权限 0600(Windows 仅影响 owner 位)
 * - **写盘后自检一次**"还能不能被 JSON.parse 直接读出 token":是 ⇒ WARN,不得静默
 */
export async function saveMcpCredentials(creds: McpCredentials): Promise<void> {
  await persistCredentials(creds);
}

async function persistCredentials(creds: McpCredentials): Promise<void> {
  const p = getCredentialsPath();
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  const plan = await planStoreBackend(true);
  const plainText = JSON.stringify(creds, null, 2);
  const body =
    plan.material && plan.backend !== 'plaintext-file'
      ? sealCredentialEnvelope(plainText, plan.material.key, plan.material.kid)
      : plainText;
  commitAtomicWrite(captureWriteBaseline(p), body);
  await chmodSafe(p);
  const desc = await describeCredentialStore();
  const at = await inspectCredentialFile();
  if (at.plaintextReadable) {
    if (desc.backend === 'plaintext-file') {
      reportStoreState(desc); // 档位③:必须落档并打印路径 + 原因
    } else {
      console.warn(
        `⚠️  档位报的是 ${desc.backend},但盘上这份仍能被 JSON.parse 读出 token:${p}(reason=${desc.reasonCode})`,
      );
    }
  }
}

// ==================== 既有 API(语义不变,只是底下换了落盘格式) ====================

/**
 * 跨进程变更锁(G-709 现读对账后的落点)。
 *
 * 对账结论(2026-09-29 本机现读,行号取工作树那一份,勿照抄 —— 并发会话会挪号):
 *   **已覆盖**整条"读 → 变更 → 落盘"的只有刷新单飞那一条:
 *     `mcp-oauth.ts:481` acquireLock(mcp-refresh.lock)
 *     → `:485` 锁内读代次 → `:505` commitCredentialCas(锁内 loadMcpCredentials + saveMcpCredentials)
 *     → `:553-554` finally releaseLock
 *   **没有覆盖**的恰是另外两条整文件读-改-写(旧版 `mcp-credentials.ts` 第 141 行那句注释
 *   只声明了刷新锁,把这两条留在了锁外,而它的措辞读起来像"落库全程都有锁" —— 那是
 *   散文承诺,不是机器保证):
 *     ① `setCredential` 的两个生产调用点:`mcp-oauth.ts:257`(持 mcp-oauth.**lock**,不是这把)
 *        与 `mcp-runtime.ts:735`(刷新**返回之后**才调 ⇒ 刷新锁已释放)
 *     ② `deleteCredential`(全部调用点)
 *   为什么这一格必须补:上游 `credentialService.ts:109-115` 的原话是"进程内排队不能阻止
 *   whole-file read-modify-write 丢更新;共享锁必须覆盖读取、变更和替换全过程"。
 *   两个进程各读一份整文件、各改自己那一个 key、各写回整文件 ⇒ 后写的那个把前一个的
 *   凭据整条抹掉,而代次 CAS 只护得住**同一 key** 的换代,护不住"别人的 key 从我这份快照里
 *   根本没出现过"。
 *
 * 复用而非新造:锁本体是 `mcp-oauth.ts` 的 `acquireLock`/`releaseLock`(判活/抢占/超时都那份),
 * 锁路径复用 `mcp-refresh.lock` —— 必须与刷新用的是**同一把**,否则"刷新在锁内写、兼容写在另一把
 * 锁外写"照旧互不可见。等待预算也复用 `REFRESH_LOCK_WAIT_MS`(见上方环形 import 纪律 ①)。
 *
 * 已知不可重入(acquireLock 不认"自己的 pid"):**已持锁的路径不得再调它** ——
 * 所以 commitCredentialCas 不包(它在锁内),saveMcpCredentials 不包(它被 commitCredentialCas 调)。
 */
async function withStoreMutationLock<T>(serverUrl: string, mutate: () => Promise<T>): Promise<T> {
  await acquireLock(serverUrl, { lockPath: getRefreshLockPath(), timeoutMs: REFRESH_LOCK_WAIT_MS });
  try {
    return await mutate();
  } finally {
    await releaseLock({ lockPath: getRefreshLockPath() });
  }
}

/**
 * 读取指定 server 的凭证与其代次。
 * 三态(G-709):`entry === undefined` 只表示"**这条 key 没有凭据**";
 * "存储读不出来"是 **抛 `McpCredentialStoreError`**,绝不折成 `entry === undefined`。
 */
export async function getCredentialWithGeneration(
  serverUrl: string,
): Promise<{ entry: McpCredentialEntry | undefined; generation: number }> {
  const all = await loadMcpCredentials();
  const entry = all[serverUrl];
  const raw = entry?.generation;
  // 非有限数/负数 ⇒ 按 0(缺省档),绝不让损坏的代次把 CAS 变成"永远不等"
  const generation = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
  return { entry, generation };
}

/**
 * 获取单个 server 的凭证。
 * 三态(G-709):`undefined` = 这条 key 没有凭据;存储坏了 ⇒ **抛**(带路径与 reason 码),
 * 调用方不得把"读坏了"当成"没登录过"—— 那正是"起一次交互式授权去覆写整份 store"的入口。
 */
export async function getCredential(
  serverUrl: string,
): Promise<McpCredentialEntry | undefined> {
  const all = await loadMcpCredentials();
  return all[serverUrl];
}

/**
 * 设置单个 server 的凭证(合并写入,不影响其他 server)。
 * 代次推进(票A):调用方未显式携带 generation 时,一律在当前值上 +1 ——
 * 交互授权完成、兼容路径覆写都必须让并发刷新观察得到"换代了",
 * 否则单飞的锁内复核看不见变化,会继续用旧 refresh_token 发第二次请求。
 *
 * 全程在跨进程变更锁内(G-709,见 `withStoreMutationLock` 的对账):读、改、原子替换是**一个**
 * 临界区 —— 分开做就等于"两个进程各拿一份旧快照,后写的把先写的凭据整条抹掉"。
 * ⚠️ 不可在已持有该锁的路径里调用(锁不可重入)。
 */
export async function setCredential(
  serverUrl: string,
  cred: McpCredentialEntry,
): Promise<void> {
  await withStoreMutationLock(serverUrl, async () => {
    const all = await loadMcpCredentials();
    const prev = all[serverUrl];
    const prevGen =
      typeof prev?.generation === 'number' && Number.isFinite(prev.generation) && prev.generation >= 0
        ? Math.floor(prev.generation)
        : 0;
    all[serverUrl] = { ...cred, generation: cred.generation ?? prevGen + 1 };
    await saveMcpCredentials(all);
  });
}

/**
 * 代次 CAS 提交(票A 唯一合法的程序化写入口):
 * 当前 generation 仍等于 expectedGeneration 才写入,并把代次推进 1;
 * 不等 ⇒ **不落盘**,原样带回当前 entry 供调用方复用(winner 的结果优先)。
 *
 * ⚠️ **本函数不取锁,且必须在已持有 `mcp-refresh.lock` 的临界区内调用** ——
 * 证据行号(2026-09-29 现读工作树,勿照抄):`mcp-oauth.ts:481` 取锁 → `:505` 调本函数 →
 * `:553-554` finally 释放。在这里再加一次同一把锁会**自重入死锁**(acquireLock 不可重入,
 * 判活问到的 pid 就是自己 ⇒ 等满 `REFRESH_LOCK_WAIT_MS` 再抛"等锁超时",而调用侧会把
 * 等锁超时折成 temporary 刷新失败 —— 一台自锁死的机器看起来只是"刷新慢")。
 * 锁被抢占等极端并发下,expectedGeneration 这道判据是最后一道"不把别人的结果覆盖掉"的闸;
 * 它只护**同一个 key** 的换代,护不住"别人的 key 没出现在我这份快照里"—— 那一格由上面
 * `withStoreMutationLock` 的对账负责(setCredential / deleteCredential 已进锁)。
 */
export async function commitCredentialCas(
  serverUrl: string,
  cred: McpCredentialEntry,
  expectedGeneration: number,
): Promise<{ committed: boolean; generation: number; current: McpCredentialEntry | undefined }> {
  const all = await loadMcpCredentials();
  const current = all[serverUrl];
  const raw = current?.generation;
  const curGen = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
  if (curGen !== expectedGeneration) {
    return { committed: false, generation: curGen, current };
  }
  const nextGen = curGen + 1;
  all[serverUrl] = { ...cred, generation: nextGen };
  await saveMcpCredentials(all);
  return { committed: true, generation: nextGen, current: all[serverUrl] };
}

/**
 * 删除单个 server 的凭证。
 * 三态(G-709):`false` 只表示"这条 key 本来就没有";存储坏了 ⇒ **抛**,
 * 否则"删不掉"会被读成"已经删干净了",而下一次整份回写会把读坏的那份当成空 store。
 * 与 setCredential 同一个临界区(见 `withStoreMutationLock`)。
 */
export async function deleteCredential(serverUrl: string): Promise<boolean> {
  return withStoreMutationLock(serverUrl, async () => {
    const all = await loadMcpCredentials();
    if (!(serverUrl in all)) return false;
    delete all[serverUrl];
    await saveMcpCredentials(all);
    return true;
  });
}

/**
 * 判断凭证是否已过期。
 * - 无 expiresAt 视为永不过期(返回 false)
 * - 距离 expiresAt 不足 skewMs 视为已过期(默认 60s 提前刷新,避免请求途中失效)
 */
export async function isExpired(
  cred: McpCredentialEntry,
  skewMs = 60_000,
): Promise<boolean> {
  if (!cred.expiresAt) return false;
  return Date.now() + skewMs >= cred.expiresAt;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
